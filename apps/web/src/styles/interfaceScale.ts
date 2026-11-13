import {
	asStablePreferenceAdapter,
	getStablePreferenceAdapter,
	type StablePreferenceAdapter,
} from "../clientPreferences";
import { STORAGE_PREFIX } from "../constants/branding";
import typography from "./typography.json";

/**
 * The reader's interface scale. It scales the type tokens AND the sizing roles that hold text, so a
 * larger interface never clips a row that stayed at its default height.
 *
 * `styles/typography.json` and `styles/tokens.css` stay the source of truth: this module never edits
 * a value, it overrides the generated custom properties on `documentElement` while the reader wants
 * a different size. See "The reader's interface scale" in `styles/TYPOGRAPHY.md` and the matching
 * note in `styles/SPACING.md`.
 *
 * Code and terminal sizes are deliberately outside it — they have their own setting
 * (`apps/web/src/fonts`), and `fonts/runtime.ts` pins their tokens so this scale cannot move them.
 */
export const INTERFACE_SCALE_MIN = 0.85;
export const INTERFACE_SCALE_MAX = 1.5;
export const INTERFACE_SCALE_STEP = 0.05;
export const DEFAULT_INTERFACE_SCALE = 1;

const HINT_KEY = `${STORAGE_PREFIX}interface-scale`;
const HINT_VERSION = 1;

/** Read from `styles/typography.json` so raising a size in the source of truth cannot leave a stale base. */
export const BASE_INTERFACE_SIZES: Readonly<Record<string, number>> = typography.fontSizes;

/**
 * The sizing roles in `styles/tokens.css` that exist to hold text: a panel row, a panel header and
 * the three top-bar rows. `interfaceScale.test.ts` pins these bases to that file, so the two cannot
 * drift. Without them an enlarged caption is cut off by its 14px row and a panel row by its 22px.
 *
 * The whitespace roles (`--panel-inset`, `--tree-indent`, `--chat-gutter`) are NOT here: they are
 * geometry, not a text box, and the reader asked for larger text rather than a looser layout.
 */
export const BASE_TEXT_ROLES: Readonly<Record<string, number>> = {
	"--panel-row-height": 22,
	"--panel-header-row-height": 28,
	"--topbar-row-height": 40,
	"--topbar-caption-height": 14,
	"--topbar-value-height": 20,
};

export function clampInterfaceScale(scale: number): number {
	if (typeof scale !== "number" || Number.isNaN(scale)) return DEFAULT_INTERFACE_SCALE;
	if (scale === Number.POSITIVE_INFINITY) return INTERFACE_SCALE_MAX;
	if (scale === Number.NEGATIVE_INFINITY) return INTERFACE_SCALE_MIN;
	const clamped = Math.min(INTERFACE_SCALE_MAX, Math.max(INTERFACE_SCALE_MIN, scale));
	// Snap to the step so a stored value never lands between two positions.
	const snapped = Math.round(clamped / INTERFACE_SCALE_STEP) * INTERFACE_SCALE_STEP;
	return Number(snapped.toFixed(2));
}

export function interfaceScalePercent(scale: number): number {
	return Math.round(clampInterfaceScale(scale) * 100);
}

/**
 * Two decimals rather than whole pixels: rounding every size on its own distorts the scale (11px at
 * 115% would jump to 13px, an 18% step). Browsers lay out fractional sizes exactly.
 */
function scaled(base: number, scale: number): number {
	return Number((base * scale).toFixed(2));
}

/**
 * Writes the scaled custom properties onto `root`. At the default scale every property is removed so
 * the generated CSS is used verbatim — the override exists only while the reader wants it.
 */
export function applyInterfaceScale(
	scale: number,
	root: HTMLElement | undefined = typeof document === "undefined"
		? undefined
		: document.documentElement,
): number {
	const applied = clampInterfaceScale(scale);
	if (!root) return applied;
	for (const [id, base] of Object.entries(BASE_INTERFACE_SIZES)) {
		const name = `--tr-font-size-${id}`;
		if (applied === DEFAULT_INTERFACE_SCALE) root.style.removeProperty(name);
		else root.style.setProperty(name, `${scaled(base, applied)}px`);
	}
	for (const [name, base] of Object.entries(BASE_TEXT_ROLES)) {
		if (applied === DEFAULT_INTERFACE_SCALE) root.style.removeProperty(name);
		else root.style.setProperty(name, `${scaled(base, applied)}px`);
	}
	return applied;
}

function interfaceScaleStorage(): StablePreferenceAdapter | null {
	return (
		getStablePreferenceAdapter() ??
		asStablePreferenceAdapter(Reflect.get(globalThis, "localStorage"))
	);
}

export function readInterfaceScale(): number {
	try {
		const value = interfaceScaleStorage()?.getItem(HINT_KEY);
		if (typeof value !== "string") return DEFAULT_INTERFACE_SCALE;
		const parsed = JSON.parse(value) as unknown;
		if (
			typeof parsed !== "object" ||
			parsed === null ||
			Reflect.get(parsed, "version") !== HINT_VERSION
		) {
			return DEFAULT_INTERFACE_SCALE;
		}
		const scale = Reflect.get(parsed, "scale");
		if (typeof scale !== "number") return DEFAULT_INTERFACE_SCALE;
		return clampInterfaceScale(scale);
	} catch {
		return DEFAULT_INTERFACE_SCALE;
	}
}

export function writeInterfaceScale(scale: number): number {
	const applied = clampInterfaceScale(scale);
	try {
		interfaceScaleStorage()?.setItem(
			HINT_KEY,
			JSON.stringify({ version: HINT_VERSION, scale: applied }),
		);
	} catch {
		// Not persisted, but this window still shows the chosen size.
	}
	return applied;
}
