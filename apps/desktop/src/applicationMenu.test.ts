import { expect, test } from "bun:test";
import type { ApplicationMenuItemConfig } from "electrobun/main";
import {
	desktopApplicationMenu,
	installDesktopApplicationMenu,
	isNativeCommand,
	QUIT_SHORTCUT_ACTION,
	readMenuAction,
} from "./applicationMenu";

const editMenu: ApplicationMenuItemConfig = {
	label: "Edit",
	submenu: [
		{ role: "undo", label: "Undo" },
		{ role: "redo", label: "Redo" },
		{ type: "separator" },
		{ role: "cut", label: "Cut" },
		{ role: "copy", label: "Copy" },
		{ role: "paste", label: "Paste" },
		{ role: "pasteAndMatchStyle", label: "Paste and Match Style" },
		{ role: "delete", label: "Delete" },
		{ role: "selectAll", label: "Select All" },
	],
};

test("builds the native macOS application, edit, and window menus", () => {
	expect(desktopApplicationMenu("darwin")).toEqual([
		{
			submenu: [
				{ role: "about", label: "About ThinkRail" },
				{ type: "separator" },
				{ label: "Settings…", action: "open-settings", accelerator: "CommandOrControl+," },
				{ type: "separator" },
				{ role: "hide", label: "Hide ThinkRail", accelerator: "CommandOrControl+H" },
				{
					role: "hideOthers",
					label: "Hide Others",
					accelerator: "CommandOrControl+Alt+H",
				},
				{ role: "showAll", label: "Show All" },
				{ type: "separator" },
				{
					label: "Quit ThinkRail",
					action: QUIT_SHORTCUT_ACTION,
					accelerator: "CommandOrControl+Q",
				},
			],
		},
		editMenu,
		{
			label: "Window",
			submenu: [
				{ role: "minimize", label: "Minimize", accelerator: "CommandOrControl+M" },
				{ role: "zoom", label: "Zoom" },
				{ label: "Close", action: "close-item", accelerator: "CommandOrControl+W" },
				{ type: "separator" },
				{ role: "bringAllToFront", label: "Bring All to Front" },
			],
		},
	]);
});

test("builds the supported Windows edit menu and skips Linux", () => {
	expect(desktopApplicationMenu("win32")).toEqual([editMenu]);
	expect(desktopApplicationMenu("linux")).toBeNull();
});

test("registers the menu exactly once on supported platforms", () => {
	const calls: ApplicationMenuItemConfig[][] = [];
	const applicationMenu = {
		setApplicationMenu(menu: ApplicationMenuItemConfig[]) {
			calls.push(menu);
		},
	};
	const darwinMenu = desktopApplicationMenu("darwin");
	if (!darwinMenu) throw new Error("macOS application menu is missing");

	expect(installDesktopApplicationMenu(applicationMenu, "darwin")).toBe(true);
	expect(calls).toEqual([darwinMenu]);
	calls.length = 0;
	expect(installDesktopApplicationMenu(applicationMenu, "linux")).toBe(false);
	expect(calls).toEqual([]);
});

test("reads the action from an application-menu-clicked event", () => {
	expect(readMenuAction({ data: { id: 3, action: QUIT_SHORTCUT_ACTION } })).toBe(
		QUIT_SHORTCUT_ACTION,
	);
	expect(readMenuAction({ data: { action: 7 } })).toBeNull();
	expect(readMenuAction({ data: null })).toBeNull();
	expect(readMenuAction(undefined)).toBeNull();
});

test("recognizes forwarded native commands only", () => {
	expect(isNativeCommand("close-item")).toBe(true);
	expect(isNativeCommand("open-settings")).toBe(true);
	expect(isNativeCommand(QUIT_SHORTCUT_ACTION)).toBe(false);
	expect(isNativeCommand(null)).toBe(false);
	expect(isNativeCommand("toString")).toBe(false);
});
