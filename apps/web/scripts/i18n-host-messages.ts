#!/usr/bin/env bun
/**
 * Regenerate `src/i18n/hostMessages.generated.ts` from the host's error copy.
 *
 * The host process throws user-visible errors (`new Error("No such folder: …")`) that reach the
 * interface verbatim through `errorText`. Those strings are not `t()` call sites — they live in a
 * package the web client may not import — so the client cannot look them up by hand without the two
 * drifting apart. Deriving the table from the host source instead makes the equality structural: a
 * message added, reworded or removed on the host shows up here on the next `bun run i18n:keys`, and
 * `i18n:check` fails the build until the catalog catches up.
 *
 * The desktop process has the same problem for the same reason (its updater formats failures in
 * English and reports them through a local `fail(phase, message)` helper, which the client renders),
 * so its roots are scanned too.
 *
 * Each entry pairs the English template (with `{0}`-style placeholders, the same shape the catalogs
 * use) with an anchored pattern that captures the interpolated values. Sorting puts the most literal
 * text first so a specific message wins over a generic one that would also match it.
 *
 *   bun scripts/i18n-host-messages.ts --write
 *   bun scripts/i18n-host-messages.ts          # report drift only, exit 1 when stale
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as ts from "typescript";

/**
 * Roots whose error copy reaches the interface as text. The host throws them over RPC; the desktop
 * process hands them to the client as updater state. Both are outside the web package, so neither can
 * be a `t()` call site.
 */
const HOST_ROOTS = ["../../packages/server/src", "../desktop/src"];
const OUTPUT = "src/i18n/hostMessages.generated.ts";
const shouldWrite = process.argv.includes("--write");

/** Tests and fixtures assert the English copy; they are not a source of user-visible messages. */
const SKIP = /\.(?:test|spec)\.[cm]?tsx?$|\.d\.ts$|fixture\.ts$/;

function walk(dir: string, acc: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		const path = join(dir, name);
		if (SKIP.test(path)) continue;
		if (statSync(path).isDirectory()) walk(path, acc);
		else if (/\.[cm]?ts$/.test(path)) acc.push(path);
	}
	return acc;
}

type Entry = { key: string; literals: string[]; holes: number; pattern: string };

const entries = new Map<string, Entry>();

/**
 * Escapes a literal fragment for a RegExp source. `/` is escaped too, because the generated table is
 * emitted as regex literals — an unescaped slash there ends the literal early and the file stops parsing.
 */
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/**
 * Reads one error argument as a template. A string literal is a template with no holes; a template
 * expression becomes its literal fragments plus one capture group per interpolation.
 */
function readTemplate(node: ts.Node): Entry | null {
	if (ts.isStringLiteral(node)) {
		const key = node.text;
		if (!key) return null;
		return { key, literals: [key], holes: 0, pattern: `^${escapeRegExp(key)}$` };
	}
	if (!ts.isTemplateExpression(node)) return null;
	const literals: string[] = [node.head.text];
	for (const span of node.templateSpans) literals.push(span.literal.text);
	const holes = node.templateSpans.length;
	const key = literals.map((part, index) => (index < holes ? `${part}{${index}}` : part)).join("");
	const pattern = `^${literals
		.map((part, index) =>
			index < holes ? `${escapeRegExp(part)}([\\s\\S]*?)` : escapeRegExp(part),
		)
		.join("")}$`;
	return { key, literals, holes, pattern };
}

/**
 * Collects one message the host hands to the client as text. A template that is only glue
 * (`${a} ${b}`, `${a}: ${b}`) is not a message: its pattern would match almost any text, and there
 * is nothing in it to translate.
 */
function collect(message: ts.Node | undefined): void {
	if (!message) return;
	const entry = readTemplate(message);
	const literal = entry ? entry.key.replace(/\{\d+\}/g, "") : "";
	const hasWords = /[A-Za-z\u4e00-\u9fff]{3}/.test(literal);
	if (entry && hasWords && !entries.has(entry.key)) entries.set(entry.key, entry);
}

for (const root of HOST_ROOTS) {
	for (const file of walk(root)) {
		const source = ts.createSourceFile(
			file,
			readFileSync(file, "utf8"),
			ts.ScriptTarget.ESNext,
			true,
			ts.ScriptKind.TS,
		);
		const visit = (node: ts.Node) => {
			if (ts.isNewExpression(node)) {
				const name = ts.isIdentifier(node.expression) ? node.expression.text : "";
				// `new CodedError("CODE", "message")` keeps its message last; `new Error("message")` first.
				const args = node.arguments ?? [];
				if (name === "CodedError") collect(args[args.length - 1]);
				else if (name === "Error") collect(args[0]);
			}
			// The desktop updater reports failures through a local `fail(phase, message)` helper, so
			// its copy reaches the client as updater state rather than as a thrown error.
			if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
				if (node.expression.text === "fail") {
					const args = node.arguments;
					collect(args[args.length - 1]);
				}
			}
			ts.forEachChild(node, visit);
		};
		visit(source);
	}
}

const sorted = [...entries.values()].sort(
	(left, right) =>
		right.literals.join("").length - left.literals.join("").length ||
		(left.key < right.key ? -1 : left.key > right.key ? 1 : 0),
);

const content = `/**
 * Host error copy, mapped to anchored patterns so the client can translate what it displays.
 *
 * GENERATED by \`scripts/i18n-host-messages.ts\` from \`packages/server\` — do not edit by hand. The key
 * is the English template with positional placeholders; the pattern captures the same values. Sorted
 * most-literal-first, so a specific message is matched before a generic one that would also accept it.
 */
export const HOST_MESSAGES: readonly { readonly key: string; readonly pattern: RegExp }[] = [
${sorted
	.map((entry) => `\t{ key: ${JSON.stringify(entry.key)}, pattern: /${entry.pattern}/ },`)
	.join("\n")}
];
`;

const current = (() => {
	try {
		return readFileSync(OUTPUT, "utf8");
	} catch {
		return "";
	}
})();

if (shouldWrite) {
	writeFileSync(OUTPUT, content);
	console.log(`i18n-host-messages: wrote ${sorted.length} messages`);
} else if (current !== content) {
	console.error(`i18n-host-messages: ${OUTPUT} is stale — run \`bun run i18n:host-messages\``);
	process.exit(1);
} else {
	console.log(`i18n-host-messages: OK (${sorted.length} messages)`);
}
