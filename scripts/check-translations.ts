#!/usr/bin/env bun

/**
 * Lists the English keys the Simplified Chinese catalog does not cover yet.
 *
 * Upstream gains keys with almost every merge, and a missing one renders in English on an
 * otherwise Chinese screen. Nothing fails when that happens — `validateCatalog` drops entries
 * it cannot match and `check:i18n` only enforces `en.json` — so a fork merge reports the gap
 * here instead of leaving it to be noticed in the running app.
 *
 * `--strict` exits non-zero when anything is missing, which is what a gate would use. Inside
 * `publish-zh.yml` it runs without `--strict`: an upstream merge that adds ten strings must
 * not block the build, it must announce them.
 */

import { missingKeys } from "../packages/locales/src/missing";

const TARGET = "zh-CN";
const strict = process.argv.includes("--strict");

const root = new URL("..", import.meta.url);
const english = (await Bun.file(new URL("packages/locales/en.json", root)).json()) as Record<
	string,
	string
>;
const catalog = (await Bun.file(new URL(`packages/locales/${TARGET}.json`, root)).json()) as Record<
	string,
	string
>;

const missing = missingKeys(TARGET, catalog);
const pluralAware = Object.keys(english).length - Object.keys(catalog).length;

if (missing.length === 0) {
	console.log(
		`check-translations: OK (${TARGET} covers all ${Object.keys(english).length} keys; ${pluralAware} English plural forms are redundant in this language)`,
	);
	process.exit(0);
}

const groups = new Map<string, string[]>();
for (const key of missing) {
	const group = key.includes(".") ? key.slice(0, key.lastIndexOf(".")) : "(root)";
	groups.set(group, [...(groups.get(group) ?? []), key]);
}

console.log(
	`check-translations: ${missing.length} key(s) missing from ${TARGET}.json — they render in English`,
);
for (const [group, keys] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
	console.log(`  ${group} (${keys.length})`);
}
console.log(`\nKeys: ${JSON.stringify(missing)}`);

if (strict) process.exit(1);
