import { afterEach, beforeEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { STORAGE_PREFIX } from "../constants/branding";
import {
	applyInterfaceScale,
	BASE_INTERFACE_SIZES,
	BASE_TEXT_ROLES,
	clampInterfaceScale,
	DEFAULT_INTERFACE_SCALE,
	INTERFACE_SCALE_MAX,
	INTERFACE_SCALE_MIN,
	INTERFACE_SCALE_STEP,
	interfaceScalePercent,
	readInterfaceScale,
	writeInterfaceScale,
} from "./interfaceScale";
import typography from "./typography.json";

const store = new Map<string, string>();
const savedStorage = Reflect.get(globalThis, "localStorage");

beforeEach(() => {
	store.clear();
	Reflect.set(globalThis, "localStorage", {
		getItem: (key: string) => store.get(key) ?? null,
		setItem: (key: string, value: string) => void store.set(key, value),
		removeItem: (key: string) => void store.delete(key),
	});
});

afterEach(() => {
	Reflect.set(globalThis, "localStorage", savedStorage);
});

/** A `documentElement` stand-in: only the inline style surface the module writes through. */
function root() {
	const values = new Map<string, string>();
	const style = {
		setProperty: (name: string, value: string) => void values.set(name, value),
		removeProperty: (name: string) => void values.delete(name),
		getPropertyValue: (name: string) => values.get(name) ?? "",
	};
	return { element: { style } as unknown as HTMLElement, values };
}

test("the scale clamps to its range and snaps to the step", () => {
	expect(clampInterfaceScale(0.5)).toBe(INTERFACE_SCALE_MIN);
	expect(clampInterfaceScale(9)).toBe(INTERFACE_SCALE_MAX);
	expect(clampInterfaceScale(Number.NaN)).toBe(DEFAULT_INTERFACE_SCALE);
	expect(clampInterfaceScale(1.12)).toBe(1.1);
	expect(clampInterfaceScale(1.13)).toBe(1.15);
	expect(clampInterfaceScale(1)).toBe(1);
	expect(INTERFACE_SCALE_STEP).toBe(0.05);
	expect(interfaceScalePercent(1.25)).toBe(125);
	expect(interfaceScalePercent(9)).toBe(150);
});

test("every type size and text-bearing role is scaled by the same factor", () => {
	const { element, values } = root();
	applyInterfaceScale(1.25, element);
	for (const [id, base] of Object.entries(BASE_INTERFACE_SIZES)) {
		expect(values.get(`--tr-font-size-${id}`)).toBe(`${Number((base * 1.25).toFixed(2))}px`);
	}
	for (const [name, base] of Object.entries(BASE_TEXT_ROLES)) {
		expect(values.get(name)).toBe(`${Number((base * 1.25).toFixed(2))}px`);
	}
});

test("the default scale leaves no inline override behind", () => {
	const { element, values } = root();
	applyInterfaceScale(1.25, element);
	expect(values.size).toBeGreaterThan(0);
	applyInterfaceScale(1, element);
	expect(values.size).toBe(0);
});

test("code and terminal sizes are not touched — they have their own setting", () => {
	const { element, values } = root();
	applyInterfaceScale(1.5, element);
	expect(values.has("--tr-font-size-code")).toBe(false);
	expect(values.has("--tr-font-size-code-dense")).toBe(false);
	expect(values.has("--tr-code-row-height")).toBe(false);
});

test("the role bases match styles/tokens.css", () => {
	const css = readFileSync(join(import.meta.dir, "tokens.css"), "utf8");
	for (const [name, base] of Object.entries(BASE_TEXT_ROLES)) {
		const declared = new RegExp(`${name}:\\s*(\\d+)px;`).exec(css);
		expect(declared?.[1]).toBe(String(base));
	}
});

test("the size bases match styles/typography.json", () => {
	expect(BASE_INTERFACE_SIZES).toEqual(typography.fontSizes);
});

test("the scale round-trips through the reader's storage", () => {
	expect(readInterfaceScale()).toBe(DEFAULT_INTERFACE_SCALE);
	expect(writeInterfaceScale(1.25)).toBe(1.25);
	expect(readInterfaceScale()).toBe(1.25);
	// Out of range is clamped on the way in and on the way out.
	expect(writeInterfaceScale(4)).toBe(INTERFACE_SCALE_MAX);
	expect(readInterfaceScale()).toBe(INTERFACE_SCALE_MAX);
});

test("a damaged or foreign hint falls back to the default scale", () => {
	for (const raw of ["not json", "null", "[]", '{"version":99,"scale":1.3}', '{"version":1}']) {
		store.set(`${STORAGE_PREFIX}interface-scale`, raw);
		expect(readInterfaceScale()).toBe(DEFAULT_INTERFACE_SCALE);
	}
});
