/**
 * The display-edge translation of host messages.
 *
 * Locale is passed explicitly everywhere here: `test-preload` pins the app to English so component
 * assertions read the source copy, and a test that relied on the ambient locale would be asserting
 * against that pin instead of against the translation.
 */
import { describe, expect, test } from "bun:test";
import { translateHostMessage } from "./hostMessages";

describe("translateHostMessage", () => {
	test("translates a plain host message", () => {
		expect(translateHostMessage("Not a git repository: /tmp/x", "zh-CN")).toBe(
			"不是 git 仓库：/tmp/x",
		);
	});

	test("keeps the interpolated value while translating around it", () => {
		expect(translateHostMessage("No such folder: /Users/me/projects", "zh-CN")).toBe(
			"没有此文件夹：/Users/me/projects",
		);
	});

	test("recovers several holes and lets the translation reorder them", () => {
		expect(translateHostMessage("Unknown or unavailable model: openai/gpt-5.4", "zh-CN")).toBe(
			"模型未知或不可用：openai/gpt-5.4",
		);
		expect(
			translateHostMessage("Lines 3+4 lie outside the worktree side of a.ts (9 line(s)).", "zh-CN"),
		).toBe("第 3+4 行超出了 a.ts 的 worktree 侧范围（共 9 行）。");
	});

	test("prefers the specific template over a shorter generic one", () => {
		// `Invalid {0}` also matches this sentence; the longer template has to win.
		expect(translateHostMessage("Invalid workspace name: my repo", "zh-CN")).toBe(
			"workspace 名称无效：my repo",
		);
	});

	test("leaves a message nobody translated alone", () => {
		expect(translateHostMessage("Something the host never said", "zh-CN")).toBe(
			"Something the host never said",
		);
	});

	test("is a no-op in English", () => {
		expect(translateHostMessage("No such folder: /tmp/x", "en")).toBe("No such folder: /tmp/x");
	});

	test("does not treat a client-side message as a host template", () => {
		// Already localized by the caller; a second pass must not mangle it.
		const already = "没有此文件夹：/tmp/x";
		expect(translateHostMessage(already, "zh-CN")).toBe(already);
	});
});
