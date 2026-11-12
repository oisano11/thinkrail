import { describe, expect, test } from "bun:test";
import { missingKeys } from "./missing";

// `missingKeys` compares against the bundled English catalog, so the fixtures name keys it has.
const PRIMARY = "settings.language.title";
const LABEL = "settings.language.description";
const PLURAL = "changes.review.fileCount";

describe("missingKeys", () => {
	test("reports an English key the catalog does not carry", () => {
		const missing = missingKeys("zh-CN", { [PRIMARY]: "语言" });
		expect(missing).toContain(LABEL);
		expect(missing).not.toContain(PRIMARY);
	});

	test("a language that renders one plural category needs only one form", () => {
		const catalog = { [PRIMARY]: "语言", [`${PLURAL}_other`]: "{{count}} 步" };
		expect(missingKeys("zh-CN", catalog).filter((key) => key.startsWith(PLURAL))).toEqual([]);
	});

	test("a language that renders several categories needs every one of them", () => {
		const catalog = { [PRIMARY]: "Language", [`${PLURAL}_one`]: "1 step" };
		expect(missingKeys("en", catalog).filter((key) => key.startsWith(PLURAL))).toEqual([
			`${PLURAL}_other`,
		]);
	});

	test("a plural family with no form at all is reported once", () => {
		const missing = missingKeys("zh-CN", { [PRIMARY]: "语言" });
		expect(missing.filter((key) => key.startsWith(PLURAL)).length).toBeGreaterThan(0);
		expect(new Set(missing).size).toBe(missing.length);
	});

	test("a catalog that covers English reports nothing", () => {
		const english = Object.fromEntries(missingKeys("en", {}).map((key) => [key, "placeholder"]));
		expect(missingKeys("en", english)).toEqual([]);
	});
});
