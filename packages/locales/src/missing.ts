import { EN } from "./index";

/**
 * The plural forms a key carries, and the categories a language actually renders. A key whose
 * family is `x_one` belongs to family `x`; a key without a plural suffix is its own family.
 */
const PLURAL_KEY = /^(.+)_(zero|one|two|few|many|other)$/;

function pluralCategories(tag: string): readonly string[] {
	try {
		return new Intl.PluralRules(tag).resolvedOptions().pluralCategories;
	} catch {
		return [];
	}
}

function familyOf(key: string): string {
	const match = PLURAL_KEY.exec(key);
	return match?.[1] && match[2] ? match[1] : key;
}

/**
 * The English keys a translation does not cover yet. Plural families are compared by the
 * categories the language renders, so a Chinese catalog that carries only `x_other` is complete
 * even though English also has `x_one`: Chinese renders one category, so the other forms would
 * never be selected. `completePlurals` fills those in from `x_other` at load time.
 */
export function missingKeys(tag: string, catalog: Readonly<Record<string, string>>): string[] {
	const categories = new Set(pluralCategories(tag));
	const filled = new Set<string>();
	const missing: string[] = [];
	for (const key of Object.keys(EN)) {
		const match = PLURAL_KEY.exec(key);
		if (!match?.[1] || !match[2]) {
			if (!(key in catalog)) missing.push(key);
			continue;
		}
		const family = match[1];
		if (categories.has(match[2])) {
			if (!(key in catalog)) missing.push(key);
			continue;
		}
		// A category this language does not render is satisfied by any form of the family.
		if (catalog[key] !== undefined) continue;
		if (filled.has(family)) continue;
		const covered = Object.keys(catalog).some(
			(candidate) => familyOf(candidate) === family && catalog[candidate] !== undefined,
		);
		if (!covered) missing.push(key);
		filled.add(family);
	}
	return missing;
}
