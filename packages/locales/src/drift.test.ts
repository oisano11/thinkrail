import { describe, expect, test } from "bun:test";
import { catalogDrift, neededKeys } from "./drift";
import { EN } from "./index";

describe("neededKeys", () => {
	test("skips the plural forms a language never renders", () => {
		// zh-CN selects only CLDR `other`, so `_one` is dead weight rather than a gap.
		const needed = neededKeys("zh-CN");
		expect(needed).toContain("chat.divider.filesChanged_other");
		expect(needed).not.toContain("chat.divider.filesChanged_one");
	});

	test("keeps every form for a language that renders more than one", () => {
		const needed = neededKeys("en");
		expect(needed).toContain("chat.divider.filesChanged_one");
		expect(needed).toContain("chat.divider.filesChanged_other");
	});

	test("covers every plain key", () => {
		const needed = new Set(neededKeys("zh-CN"));
		const plain = Object.keys(EN).filter((key) => !/_(zero|one|two|few|many|other)$/.test(key));
		const uncovered = plain.filter((key) => !needed.has(key));
		expect(uncovered).toEqual([]);
	});
});

describe("catalogDrift", () => {
	const level = { "settings.appearance.fontScale.label": "字体大小" };

	test("reports a key the catalog never translated", () => {
		const drift = catalogDrift("zh-CN", level);
		expect(drift.missing).toContain("settings.appearance.theme");
		expect(drift.missing).not.toContain("settings.appearance.fontScale.label");
		expect(drift.invalid).toEqual([]);
	});

	test("reports an entry the load-time gate would drop", () => {
		// `auth.login.deviceCode` carries `<0>{{url}}</0>`; a translation that loses the marker
		// passes JSON parsing but fails validation, so it renders English at runtime.
		const drift = catalogDrift("zh-CN", {
			...level,
			"auth.login.deviceCode": "请输入代码",
		});
		expect(drift.invalid).toEqual(["auth.login.deviceCode"]);
	});

	test("accepts an entry that keeps every placeholder and marker", () => {
		const drift = catalogDrift("zh-CN", {
			...level,
			"auth.login.deviceCode": "请在 <0>{{url}}</0> 输入此代码",
		});
		expect(drift.invalid).toEqual([]);
	});

	test("does not count a plural form the language never renders", () => {
		const drift = catalogDrift("zh-CN", {
			...level,
			"chat.divider.filesChanged_other": "{{count}} 个文件已更改",
		});
		expect(drift.missing).not.toContain("chat.divider.filesChanged_one");
	});
});
