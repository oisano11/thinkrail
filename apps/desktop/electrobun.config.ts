import { version } from "@thinkrail/shared/version";
import type { ElectrobunConfig } from "electrobun";

// Hutch reads `build.bun.version` like the other toolchain versions, but ElectrobunConfig does not type
// it, so the literal is kept out of the excess-property check. It must match the root packageManager pin.
const bun = { entrypoint: "src/entry.ts", version: "1.4.4" };
const MICROPHONE_USAGE = "ThinkRail uses the microphone only while you dictate with voice input.";

export default {
	// This fork ships its own builds, so the app needs an identity of its own: the same name and
	// identifier as the upstream bundle would make the two installs overwrite each other, and the
	// installer refuses an update whose uninstall manifest points at another bundle path.
	app: {
		name: "ThinkRail-ZH",
		identifier: "ai.thinkrail.zh",
		version,
		urlSchemes: ["thinkrail"],
	},
	runtime: {
		exitOnLastWindowClosed: true,
	},
	release: {
		baseUrl: "https://github.com/oisano11/thinkrail/releases/download/desktop-updates",
		generatePatch: false,
	},
	build: {
		mainProcess: "bun",
		bun,
		views: { preload: { entrypoint: "src/preload.ts", format: "iife" } },
		copy: {
			"../web/dist": "views/web",
			".stage/runtime": "runtime",
		},
		mac: {
			bundleCEF: false,
			icons: "../../packages/shared/assets/icon.iconset",
			entitlements: { "com.apple.security.device.audio-input": MICROPHONE_USAGE },
		},
		linux: { bundleCEF: false, icon: "../../packages/shared/assets/icon.png" },
		win: {
			bundleCEF: false,
			icon: "../../packages/shared/assets/icon.ico",
			autoGrantPermissions: ["microphone"],
		},
	},
	scripts: { preBuild: "preBuild.ts", postBuild: "postBuild.ts" },
} satisfies ElectrobunConfig;
