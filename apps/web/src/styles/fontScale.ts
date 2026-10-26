import {
	asStablePreferenceAdapter,
	getStablePreferenceAdapter,
	type StablePreferenceAdapter,
} from "../clientPreferences";
import { STORAGE_PREFIX } from "../constants/branding";

/**
 * The one runtime override of the typography tokens. `styles/typography.json` stays the source of
 * truth: this module never edits a value, it scales the generated custom properties on
 * `documentElement` so a reader who wants larger text can get it without a rebuild. See the
 * "Permitted exceptions" note in `styles/TYPOGRAPHY.md`.
 */
export const FONT_SCALE_MIN = 0.8;
export const FONT_SCALE_MAX = 1.6;
export const FONT_SCALE_STEP = 0.05;

const HINT_KEY = `${STORAGE_PREFIX}font-scale`;
const HINT_VERSION = 1;

/** Mirrors `styles/typography.json` — the pixel sizes the generated CSS ships today. */
export const BASE_FONT_SIZES: Readonly<Record<string, number>> = {
	s10: 12,
	s11: 13,
	s12: 14,
	s13: 15,
	s14: 16,
	s16: 18,
	s18: 20,
	s20: 22,
	s24: 28,
	s44: 48,
};

/** Mirrors `codeRowHeight()` in `apps/web/scripts/typography.ts` (13px × 1.3, rounded). */
export const BASE_CODE_ROW_HEIGHT = 17;

export const DEFAULT_FONT_SCALE = 1;

export function clampFontScale(scale: number): number {
	if (typeof scale !== "number" || Number.isNaN(scale)) return DEFAULT_FONT_SCALE;
	if (scale === Number.POSITIVE_INFINITY) return FONT_SCALE_MAX;
	if (scale === Number.NEGATIVE_INFINITY) return FONT_SCALE_MIN;
	const clamped = Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, scale));
	// Snap to the slider's step so a stored value never lands between two positions.
	const snapped = Math.round(clamped / FONT_SCALE_STEP) * FONT_SCALE_STEP;
	return Number(snapped.toFixed(2));
}

export function fontScalePercent(scale: number): number {
	return Math.round(clampFontScale(scale) * 100);
}

export function scaledFontSize(base: number, scale: number): number {
	return Math.round(base * clampFontScale(scale));
}

export function scaledCodeRowHeight(scale: number): number {
	return Math.round(BASE_CODE_ROW_HEIGHT * clampFontScale(scale));
}

/**
 * Writes the scaled custom properties onto `root`. At the default scale every property is removed
 * so the generated CSS is used verbatim — the override exists only while the reader wants it.
 */
export function applyFontScale(
	scale: number,
	root: HTMLElement | undefined = typeof document === "undefined"
		? undefined
		: document.documentElement,
): number {
	const applied = clampFontScale(scale);
	if (!root) return applied;
	for (const [id, base] of Object.entries(BASE_FONT_SIZES)) {
		const name = `--tr-font-size-${id}`;
		if (applied === DEFAULT_FONT_SCALE) root.style.removeProperty(name);
		else root.style.setProperty(name, `${scaledFontSize(base, applied)}px`);
	}
	const height = "--tr-code-row-height";
	if (applied === DEFAULT_FONT_SCALE) root.style.removeProperty(height);
	else root.style.setProperty(height, `${scaledCodeRowHeight(applied)}px`);
	return applied;
}

function fontScaleStorage(): StablePreferenceAdapter | null {
	return (
		getStablePreferenceAdapter() ??
		asStablePreferenceAdapter(Reflect.get(globalThis, "localStorage"))
	);
}

export function readFontScale(): number {
	try {
		const value = fontScaleStorage()?.getItem(HINT_KEY);
		if (typeof value !== "string") return DEFAULT_FONT_SCALE;
		const parsed = JSON.parse(value) as unknown;
		if (
			typeof parsed !== "object" ||
			parsed === null ||
			Reflect.get(parsed, "version") !== HINT_VERSION
		) {
			return DEFAULT_FONT_SCALE;
		}
		const scale = Reflect.get(parsed, "scale");
		if (typeof scale !== "number") return DEFAULT_FONT_SCALE;
		return clampFontScale(scale);
	} catch {
		return DEFAULT_FONT_SCALE;
	}
}

export function writeFontScale(scale: number): number {
	const applied = clampFontScale(scale);
	try {
		fontScaleStorage()?.setItem(
			HINT_KEY,
			JSON.stringify({ version: HINT_VERSION, scale: applied }),
		);
	} catch {
		return DEFAULT_FONT_SCALE;
	}
	return applied;
}
