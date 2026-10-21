/**
 * Language of the native application menu.
 *
 * The menu is built in the desktop process before the web client loads, so it cannot call the client's
 * translator. It reads the same persisted preference key the client writes (`thinkrail-locale`) and
 * resolves it by the same rule, falling back to the OS language and then to the build's default.
 *
 * Items driven by an Electron-style `role` get their wording from the platform, which only knows English
 * unless the whole bundle is localised. Each of ours therefore carries an explicit label from the same
 * table, keeping the role (and the native behaviour behind it) while translating the text.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

export const MENU_LOCALES = ["en", "zh-CN"] as const;
export type MenuLocale = (typeof MENU_LOCALES)[number];

/** Must match `apps/web/src/i18n/locale.ts`. */
export const LOCALE_PREFERENCE_KEY = "thinkrail-locale";

/** Must match the client's `DEFAULT_LOCALE`. */
const DEFAULT_LOCALE: MenuLocale = "en";

/**
 * Label templates by locale. English is listed explicitly rather than relying on the key fallback so
 * `Quit` keeps its `{0}` placeholder — the product name is an argument, not part of the label, which is
 * what lets a translation put it elsewhere in the sentence.
 */
const LABELS: Record<MenuLocale, Record<string, string>> = {
	en: {
		Edit: "Edit",
		Window: "Window",
		Close: "Close",
		Quit: "Quit {0}",
		// The app menu's Settings item opens the in-app dialog, so it is ours to name.
		"Settings…": "Settings…",
		// The startup-failure dialog is the one other place the desktop process writes text, and it can
		// appear before the window exists — so it reads its language from the same table.
		"Could not start": "ThinkRail could not start",
		"Could not restart": "ThinkRail could not restart",
		"Could not restart to install the update": "ThinkRail could not restart to install the update",
		QuitApp: "Quit",
		// Menu items the platform builds from a role. Naming them here is the only way to reach them:
		// the role itself stays, so undo/copy/… keep the native selector they stand for.
		About: "About ThinkRail",
		Hide: "Hide ThinkRail",
		"Hide Others": "Hide Others",
		"Show All": "Show All",
		Undo: "Undo",
		Redo: "Redo",
		Cut: "Cut",
		Copy: "Copy",
		Paste: "Paste",
		"Paste and Match Style": "Paste and Match Style",
		Delete: "Delete",
		"Select All": "Select All",
		Minimize: "Minimize",
		Zoom: "Zoom",
		"Bring All to Front": "Bring All to Front",
	},
	"zh-CN": {
		Edit: "编辑",
		Window: "窗口",
		Close: "关闭",
		Quit: "退出 {0}",
		"Settings…": "设置…",
		"Could not start": "ThinkRail 无法启动",
		"Could not restart": "ThinkRail 无法重启",
		"Could not restart to install the update": "ThinkRail 无法重启以安装更新",
		QuitApp: "退出",
		About: "关于 ThinkRail",
		Hide: "隐藏 ThinkRail",
		"Hide Others": "隐藏其他",
		"Show All": "全部显示",
		Undo: "撤销",
		Redo: "重做",
		Cut: "剪切",
		Copy: "拷贝",
		Paste: "粘贴",
		"Paste and Match Style": "粘贴并匹配样式",
		Delete: "删除",
		"Select All": "全选",
		Minimize: "最小化",
		Zoom: "缩放",
		"Bring All to Front": "前置全部窗口",
	},
};

export function normalizeMenuLocale(tag: string | null | undefined): MenuLocale | null {
	if (!tag) return null;
	const lower = tag.toLowerCase();
	if (lower.startsWith("zh")) return "zh-CN";
	if (lower.startsWith("en")) return "en";
	return null;
}

/**
 * Read the persisted locale out of a desktop preference document. The client stores preferences as
 * encoded JSON strings under a per-window scope, so an unreadable or absent document simply means "no
 * explicit choice" rather than an error.
 */
export function localeFromPreferences(document: unknown, scopeKey?: string): MenuLocale | null {
	if (typeof document !== "object" || document === null) return null;
	const preferences = Reflect.get(document, "preferences");
	if (typeof preferences !== "object" || preferences === null) return null;
	const scopes = scopeKey !== undefined ? [scopeKey] : Object.keys(preferences);
	for (const scope of scopes) {
		const entries = Reflect.get(preferences, scope);
		if (typeof entries !== "object" || entries === null) continue;
		const raw = Reflect.get(entries, LOCALE_PREFERENCE_KEY);
		if (typeof raw !== "string") continue;
		const normalized = normalizeMenuLocale(raw);
		if (normalized) return normalized;
	}
	return null;
}

export function readLocalePreference(path: string, scopeKey?: string): MenuLocale | null {
	try {
		return localeFromPreferences(JSON.parse(readFileSync(path, "utf8")) as unknown, scopeKey);
	} catch {
		return null;
	}
}

/** The first tag of `AppleLanguages`, which `defaults` prints as a quoted, comma-separated list. */
export function localeFromAppleLanguages(raw: string): MenuLocale | null {
	return normalizeMenuLocale(raw.match(/"([^"]+)"/)?.[1] ?? null);
}

/**
 * The language macOS itself is running in. A bundle launched from Finder inherits no `LANG` — the
 * preference lives in the global domain — so asking `defaults` is the only way to see it. Anything
 * unreadable (no `defaults`, a non-macOS host) means "no opinion" and falls through to the default.
 */
export function systemLocale(): MenuLocale | null {
	if (process.platform !== "darwin") return null;
	try {
		const raw = execFileSync("/usr/bin/defaults", ["read", "-g", "AppleLanguages"], {
			encoding: "utf8",
			timeout: 2_000,
		});
		return localeFromAppleLanguages(raw);
	} catch {
		return null;
	}
}

export function resolveMenuLocale(
	preferencePath: string | undefined,
	scopeKey?: string,
): MenuLocale {
	const explicit =
		preferencePath === undefined ? null : readLocalePreference(preferencePath, scopeKey);
	if (explicit) return explicit;
	// `LANG`/`LC_ALL` are what a POSIX shell exports; Windows exposes the same intent through the
	// locale name, which Node surfaces in the same variables when it is set.
	const fromEnvironment = normalizeMenuLocale(process.env.LC_ALL ?? process.env.LANG ?? null);
	return fromEnvironment ?? systemLocale() ?? DEFAULT_LOCALE;
}

/** Translate a desktop-process label. An unknown key falls back to the key, which is the English text. */
export function menuLabel(locale: MenuLocale, key: string, args?: readonly string[]): string {
	const template = LABELS[locale][key] ?? key;
	if (!args) return template;
	return template.replace(/\{(\d+)\}/g, (match, index: string) => args[Number(index)] ?? match);
}

export function menuLabels(locale: MenuLocale): Record<string, string> {
	return LABELS[locale];
}
