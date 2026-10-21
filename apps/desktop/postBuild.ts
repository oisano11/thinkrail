import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { embedWindowsExecutableIcon } from "./src/windowsExecutableIcon";

const desktopDir = import.meta.dir;

/**
 * macOS names the items it adds to the Edit menu — dictation, emoji, autofill — after the bundle's
 * localization, and a bundle that declares none is treated as English even on a Chinese Mac. The
 * bundle therefore lists both languages the interface can speak, leaving English as the development
 * region: macOS picks the one the user's system prefers.
 */
function localiseMacBundle(bundlePath: string): void {
	const plistPath = join(bundlePath, "Contents", "Info.plist");
	const run = (command: string) => {
		execFileSync("/usr/libexec/PlistBuddy", ["-c", command, plistPath], { stdio: "pipe" });
	};
	// `Add` refuses an existing key and `Set` refuses a missing one, so the keys are deleted first.
	for (const key of ["CFBundleDevelopmentRegion", "CFBundleLocalizations"]) {
		try {
			run(`Delete :${key}`);
		} catch {
			// Absent on a fresh bundle; nothing to delete.
		}
	}
	run("Add :CFBundleDevelopmentRegion string en");
	run("Add :CFBundleLocalizations array");
	run("Add :CFBundleLocalizations:0 string en");
	run("Add :CFBundleLocalizations:1 string zh-Hans");
	console.log("declared the macOS bundle's localizations");
}

if (process.env.ELECTROBUN_OS === "win") {
	const buildDir = process.env.ELECTROBUN_BUILD_DIR;
	const appName = process.env.ELECTROBUN_APP_NAME;
	const buildEnvironment = process.env.ELECTROBUN_BUILD_ENV;
	if (!buildDir || !appName || !buildEnvironment) {
		throw new Error("Windows postBuild requires build output metadata");
	}

	const bundleName = buildEnvironment === "stable" ? appName : `${appName}-${buildEnvironment}`;
	const uninstallerPath = join(buildDir, bundleName, "Resources", "uninstall");
	const iconPath = join(desktopDir, "assets", "icon.ico");
	const branded = embedWindowsExecutableIcon(readFileSync(uninstallerPath), readFileSync(iconPath));
	writeFileSync(uninstallerPath, branded);
	console.log("embedded Windows icon in uninstaller");
}

if (process.env.ELECTROBUN_OS === "macos") {
	const buildDir = process.env.ELECTROBUN_BUILD_DIR;
	const appName = process.env.ELECTROBUN_APP_NAME;
	const buildEnvironment = process.env.ELECTROBUN_BUILD_ENV;
	if (buildDir && appName && buildEnvironment) {
		const bundleName = buildEnvironment === "stable" ? appName : `${appName}-${buildEnvironment}`;
		const bundlePath = join(buildDir, `${bundleName}.app`);
		if (existsSync(join(bundlePath, "Contents", "Info.plist"))) localiseMacBundle(bundlePath);
	}
}

rmSync(join(desktopDir, ".stage"), { recursive: true, force: true });
