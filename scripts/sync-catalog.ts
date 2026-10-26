#!/usr/bin/env bun

/**
 * Keeps a bundled catalog level with en.json.
 *
 * Upstream adds and rewrites English keys faster than a hand-maintained translation can
 * follow. This reads the drift, asks an OpenAI-compatible chat endpoint for the missing
 * strings, and writes back only the entries that pass the same `validateCatalog` gate the
 * app applies at load time — a translation that drops a `{{placeholder}}` or an `<0>` marker
 * is rejected here instead of silently rendering English at runtime.
 *
 * Usage: bun scripts/sync-catalog.ts --tag zh-CN [--check] [--dry-run]
 *
 * Env: THINKRAIL_CATALOG_API_KEY (required unless --check), THINKRAIL_CATALOG_API_BASE (default
 * https://openrouter.ai/api/v1), THINKRAIL_CATALOG_MODEL (default deepseek/deepseek-chat).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { catalogDrift } from "../packages/locales/src/drift";
import { type Catalog, EN, validateCatalog } from "../packages/locales/src/index";

const root = join(import.meta.dir, "..");
const DEFAULT_API_BASE = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "deepseek/deepseek-chat";
const BATCH_SIZE = 25;
const CONCURRENCY = 3;
const ATTEMPTS = 3;

interface Options {
	tag: string;
	check: boolean;
	dryRun: boolean;
}

function parseOptions(argv: readonly string[]): Options {
	const tag = flagValue(argv, "--tag") ?? "zh-CN";
	return { tag, check: argv.includes("--check"), dryRun: argv.includes("--dry-run") };
}

function flagValue(argv: readonly string[], flag: string): string | undefined {
	const index = argv.indexOf(flag);
	return index === -1 ? undefined : argv[index + 1];
}

function catalogPath(tag: string): string {
	return join(root, "packages", "locales", `${tag}.json`);
}

/**
 * Reads the catalog as written, without the load-time gate: `catalogDrift` needs the entries
 * that gate would drop in order to report them as invalid and replace them.
 */
function readCatalog(tag: string): Catalog {
	const text = readFileSync(catalogPath(tag), "utf8");
	const parsed: unknown = JSON.parse(text);
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		throw new Error(`${tag}.json is not a JSON object`);
	}
	const out: Record<string, string> = {};
	for (const [key, value] of Object.entries(parsed)) {
		if (typeof value === "string") out[key] = value;
	}
	return out;
}

function writeCatalog(tag: string, strings: Catalog): void {
	const sorted = Object.keys(strings)
		.sort()
		.map((key) => `\t${JSON.stringify(key)}: ${JSON.stringify(strings[key])}`);
	writeFileSync(catalogPath(tag), `{\n${sorted.join(",\n")}\n}\n`, "utf8");
}

function chunks<T>(items: readonly T[], size: number): T[][] {
	const out: T[][] = [];
	for (let index = 0; index < items.length; index += size)
		out.push(items.slice(index, index + size));
	return out;
}

function systemPrompt(tag: string): string {
	return [
		`You translate the user interface of ThinkRail, a desktop coding agent, into ${tag}.`,
		"Reply with a single JSON object and nothing else: no prose, no code fence.",
		"Keys are dotted identifiers; translate only the values.",
		"Rules, all mandatory:",
		"- Keep every `{{name}}` placeholder byte-identical. Never rename, drop, or add one.",
		"- Keep every numeric marker such as `<0>` and `</0>` byte-identical, in the same order.",
		"- Never translate product names: ThinkRail, GitHub, Git, MCP, Claude, Codex.",
		"- Match the register of a dense desktop app: short, imperative, no trailing period",
		"  unless the English has one. Prefer the wording a Chinese developer would expect.",
		"- A key ending in `_one` or `_other` is a plural form; keep `{{count}}` in place.",
	].join("\n");
}

function userPrompt(entries: readonly (readonly [string, string])[]): string {
	const payload = Object.fromEntries(entries);
	return `Translate these values into the target language:\n${JSON.stringify(payload, null, "\t")}`;
}

interface ChatChoice {
	message?: { content?: string };
}

async function requestBatch(
	entries: readonly (readonly [string, string])[],
	tag: string,
	apiBase: string,
	model: string,
	apiKey: string,
): Promise<Record<string, string>> {
	let lastError: unknown;
	for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
		try {
			const response = await fetch(`${apiBase}/chat/completions`, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					authorization: `Bearer ${apiKey}`,
				},
				body: JSON.stringify({
					model,
					temperature: 0,
					messages: [
						{ role: "system", content: systemPrompt(tag) },
						{ role: "user", content: userPrompt(entries) },
					],
				}),
			});
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 400)}`);
			}
			const body = (await response.json()) as { choices?: ChatChoice[] };
			const content = body.choices?.[0]?.message?.content ?? "";
			return parseReply(content);
		} catch (error) {
			lastError = error;
			if (attempt < ATTEMPTS) await Bun.sleep(1000 * attempt);
		}
	}
	throw lastError;
}

function parseReply(content: string): Record<string, string> {
	const trimmed = content.trim();
	const start = trimmed.indexOf("{");
	const end = trimmed.lastIndexOf("}");
	if (start === -1 || end <= start) throw new Error("reply carried no JSON object");
	const parsed: unknown = JSON.parse(trimmed.slice(start, end + 1));
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		throw new Error("reply JSON was not an object");
	}
	const out: Record<string, string> = {};
	for (const [key, value] of Object.entries(parsed)) {
		if (typeof value === "string") out[key] = value;
	}
	return out;
}

async function main(): Promise<void> {
	const options = parseOptions(process.argv.slice(2));
	const current = readCatalog(options.tag);
	const drift = catalogDrift(options.tag, current);
	const todo = [...new Set([...drift.missing, ...drift.invalid])].sort();

	if (todo.length === 0) {
		console.log(
			`sync-catalog: ${options.tag} is level with en.json (${Object.keys(EN).length} keys)`,
		);
		return;
	}
	const summary = `sync-catalog: ${options.tag} is behind — ${drift.missing.length} missing, ${drift.invalid.length} invalid, ${todo.length} to translate`;
	console.log(summary);
	if (options.check) {
		for (const key of todo) console.log(`  ${key}`);
		process.exitCode = 1;
		return;
	}
	if (options.dryRun) {
		for (const key of todo) console.log(`  ${key}`);
		return;
	}

	const apiKey = process.env.THINKRAIL_CATALOG_API_KEY ?? "";
	if (apiKey === "") {
		console.error("sync-catalog: THINKRAIL_CATALOG_API_KEY is required to translate");
		process.exit(1);
	}
	const apiBase = (process.env.THINKRAIL_CATALOG_API_BASE ?? DEFAULT_API_BASE).replace(/\/+$/, "");
	const model = process.env.THINKRAIL_CATALOG_MODEL ?? DEFAULT_MODEL;

	const batches = chunks(todo, BATCH_SIZE);
	const translated: Record<string, string> = {};
	let rejected = 0;
	for (let index = 0; index < batches.length; index += CONCURRENCY) {
		const group = batches.slice(index, index + CONCURRENCY);
		const results = await Promise.all(
			group.map(async (batch) => {
				const entries = batch.map((key) => [key, EN[key] ?? ""] as const);
				return requestBatch(entries, options.tag, apiBase, model, apiKey);
			}),
		);
		for (const result of results) {
			for (const [key, value] of Object.entries(result)) {
				const gate = validateCatalog({ [key]: value });
				if (gate.ok && Object.hasOwn(gate.strings, key)) translated[key] = value;
				else rejected += 1;
			}
		}
		console.log(
			`sync-catalog: ${Math.min(index + CONCURRENCY, batches.length)}/${batches.length} batches`,
		);
	}

	// Drop keys en.json no longer carries: a bundled catalog has to stay a subset of English.
	const merged: Record<string, string> = {};
	for (const [key, value] of Object.entries({ ...current, ...translated })) {
		if (Object.hasOwn(EN, key)) merged[key] = value;
	}
	const after = catalogDrift(options.tag, merged);
	writeCatalog(options.tag, merged);
	console.log(
		`sync-catalog: wrote ${Object.keys(translated).length} translations (${rejected} rejected by the gate); ${after.missing.length} still missing, ${after.invalid.length} still invalid`,
	);
	if (after.missing.length > 0 || after.invalid.length > 0) process.exitCode = 1;
}

if (import.meta.main) await main();
