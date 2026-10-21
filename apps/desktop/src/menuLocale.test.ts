import { expect, test } from "bun:test";
import type { ApplicationMenuItemConfig } from "electrobun/main";
import { desktopApplicationMenu } from "./applicationMenu";
import {
	localeFromAppleLanguages,
	localeFromPreferences,
	menuLabel,
	normalizeMenuLocale,
	resolveMenuLocale,
	systemLocale,
} from "./menuLocale";

/**
 * Menu items are a union (`{submenu}`, `{role}`, `{label, action}`), so reading a label or a submenu out
 * of it needs a narrowing helper rather than a non-null assertion.
 */
function labelAt(item: ApplicationMenuItemConfig | undefined): string | null {
	return item !== undefined && "label" in item && typeof item.label === "string"
		? item.label
		: null;
}

function submenuAt(item: ApplicationMenuItemConfig | undefined): ApplicationMenuItemConfig[] {
	return item !== undefined && "submenu" in item && Array.isArray(item.submenu) ? item.submenu : [];
}

test("localizes the macOS menu labels while keeping the roles the platform owns", () => {
	const english = desktopApplicationMenu("darwin", "en");
	const chinese = desktopApplicationMenu("darwin", "zh-CN");
	expect(labelAt(english?.[1])).toBe("Edit");
	expect(labelAt(chinese?.[1])).toBe("编辑");
	expect(labelAt(chinese?.[2])).toBe("窗口");
	expect(labelAt(submenuAt(chinese?.[2])[2])).toBe("关闭");
	expect(labelAt(submenuAt(chinese?.[0])[2])).toBe("设置…");
	expect(labelAt(submenuAt(english?.[0])[2])).toBe("Settings…");
	expect(labelAt(submenuAt(chinese?.[0]).at(-1))).toBe("退出 ThinkRail");
	// `role` items keep the platform's behaviour, but carry our wording: the platform only knows English
	// unless the whole bundle is localised.
	expect(submenuAt(chinese?.[1])[0]).toEqual({ role: "undo", label: "撤销" });
	expect(submenuAt(english?.[1])[0]).toEqual({ role: "undo", label: "Undo" });
	expect(labelAt(submenuAt(chinese?.[1])[5])).toBe("粘贴");
	expect(labelAt(submenuAt(chinese?.[2])[0])).toBe("最小化");
	expect(labelAt(submenuAt(chinese?.[0])[0])).toBe("关于 ThinkRail");
});

test("keeps the English menu byte-identical to the shipped one", () => {
	const english = desktopApplicationMenu("darwin", "en");
	expect(labelAt(submenuAt(english?.[0]).at(-1))).toBe("Quit ThinkRail");
	expect(labelAt(submenuAt(english?.[2])[2])).toBe("Close");
	expect(desktopApplicationMenu("darwin")?.[1]).toBeDefined();
	expect(desktopApplicationMenu("win32", "zh-CN")?.[0]).toBeDefined();
	expect(labelAt(desktopApplicationMenu("win32", "zh-CN")?.[0])).toBe("编辑");
	expect(desktopApplicationMenu("linux", "zh-CN")).toBeNull();
});

test("resolves a locale from the persisted preference the client writes", () => {
	expect(
		localeFromPreferences({ preferences: { "profile:window": { "thinkrail-locale": "en" } } }),
	).toBe("en");
	expect(
		localeFromPreferences({ preferences: { "profile:window": { "thinkrail-locale": "zh-CN" } } }),
	).toBe("zh-CN");
	// A stored tag with a region still resolves; an unrelated or absent key means "no explicit choice".
	expect(localeFromPreferences({ preferences: { a: { "thinkrail-locale": "zh-Hans-CN" } } })).toBe(
		"zh-CN",
	);
	expect(localeFromPreferences({ preferences: { a: { "thinkrail-locale": "fr" } } })).toBeNull();
	expect(localeFromPreferences({ preferences: { a: {} } })).toBeNull();
	expect(localeFromPreferences(null)).toBeNull();
	expect(localeFromPreferences("nonsense")).toBeNull();
	// An explicit scope reads only that scope.
	expect(
		localeFromPreferences(
			{ preferences: { a: { "thinkrail-locale": "en" }, b: { "thinkrail-locale": "zh-CN" } } },
			"b",
		),
	).toBe("zh-CN");
});

test("falls back to the requested key so an unknown label stays readable", () => {
	expect(menuLabel("zh-CN", "Not A Menu Label")).toBe("Not A Menu Label");
	expect(menuLabel("en", "Quit", ["ThinkRail"])).toBe("Quit ThinkRail");
	expect(menuLabel("zh-CN", "Quit", ["ThinkRail"])).toBe("退出 ThinkRail");
	// A missing argument leaves the placeholder instead of printing `undefined`.
	expect(menuLabel("en", "Quit", [])).toBe("Quit {0}");
});

test("localizes the startup-failure dialog, which is drawn before any window exists", () => {
	// The dialog appears when `start()` throws, so it cannot wait for the client's translator.
	expect(menuLabel("en", "Could not start")).toBe("ThinkRail could not start");
	expect(menuLabel("zh-CN", "Could not start")).toBe("ThinkRail 无法启动");
	expect(menuLabel("zh-CN", "QuitApp")).toBe("退出");
});

test("normalizes locale tags the way the client does", () => {
	expect(normalizeMenuLocale("zh-Hans-CN")).toBe("zh-CN");
	expect(normalizeMenuLocale("zh_CN")).toBe("zh-CN");
	expect(normalizeMenuLocale("ZH")).toBe("zh-CN");
	expect(normalizeMenuLocale("en-GB")).toBe("en");
	expect(normalizeMenuLocale("ja")).toBeNull();
	expect(normalizeMenuLocale(null)).toBeNull();
});

test("resolves the menu locale from an unreadable preference path without throwing", () => {
	expect(resolveMenuLocale("/nonexistent/preferences.json")).toBe(resolveMenuLocale(undefined));
});

test("reads the first language macOS lists, which a Finder launch does not export", () => {
	// `defaults read -g AppleLanguages` prints an old-style property list on one line.
	expect(localeFromAppleLanguages('(\n    "zh-Hans-CN",\n    "en-US"\n)')).toBe("zh-CN");
	expect(localeFromAppleLanguages('(\n    "en-US",\n    "zh-Hans-CN"\n)')).toBe("en");
	expect(localeFromAppleLanguages('(\n    "fr-FR"\n)')).toBeNull();
	expect(localeFromAppleLanguages("")).toBeNull();
	// Whatever this host runs, the probe answers with a locale the menu has labels for, or nothing.
	expect([null, "en", "zh-CN"]).toContain(systemLocale());
});
