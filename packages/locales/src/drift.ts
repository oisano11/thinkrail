import { type Catalog, completePlurals, EN, validateCatalog } from "./index";

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

export interface CatalogDrift {
	/** Keys this language renders but the catalog has no usable string for. */
	readonly missing: readonly string[];
	/** Keys the catalog carries that validation silently drops, so they render English. */
	readonly invalid: readonly string[];
}

function pluralCategories(tag: string): readonly string[] {
	try {
		return new Intl.PluralRules(tag).resolvedOptions().pluralCategories;
	} catch {
		return [];
	}
}

/**
 * The en.json keys a language actually renders: every plain key, plus only the plural forms
 * its own CLDR categories select. `zh-CN` resolves to `["other"]`, so a `_one` translation it
 * carries is never shown and a `_one` it lacks is not a gap.
 */
export function neededKeys(tag: string): string[] {
	const categories = new Set(pluralCategories(tag));
	return Object.keys(EN).filter((key) => {
		const form = PLURAL_SUFFIX.exec(key)?.[1];
		return form === undefined || categories.has(form);
	});
}

/**
 * What a catalog is behind on. `missing` counts keys en.json gained since the catalog was
 * translated; `invalid` counts entries whose placeholders or markup no longer match English,
 * which `validateCatalog` drops at load time so the string quietly falls back to English.
 */
export function catalogDrift(tag: string, target: Catalog): CatalogDrift {
	const kept = validateCatalog(target);
	const usable = kept.ok ? kept.strings : {};
	const completed = completePlurals(tag, usable);
	const missing = neededKeys(tag).filter((key) => !Object.hasOwn(completed, key));
	const invalid = Object.keys(target).filter(
		(key) => Object.hasOwn(EN, key) && !Object.hasOwn(usable, key),
	);
	return { missing, invalid };
}
