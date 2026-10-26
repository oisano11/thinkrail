import { useT } from "@thinkrail/locales/react";
import { cn } from "@thinkrail/ui/utils";
import { useEffect, useState } from "react";
import {
	applyFontScale,
	clampFontScale,
	FONT_SCALE_MAX,
	FONT_SCALE_MIN,
	FONT_SCALE_STEP,
	fontScalePercent,
	readFontScale,
	writeFontScale,
} from "../styles/fontScale";
import { SETTINGS_ROWS_CONTAINER, SettingsRow } from "./SettingsRow";

const MOVEMENT_THUMB =
	"pointer-events-none absolute inset-0 h-24 w-full appearance-none bg-transparent focus-visible:outline-none [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-16 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-border-default [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:shadow-sm [&::-moz-range-track]:bg-transparent [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-16 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-border-default [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-sm focus-visible:[&::-moz-range-thumb]:ring-2 focus-visible:[&::-moz-range-thumb]:ring-primary focus-visible:[&::-webkit-slider-thumb]:ring-2 focus-visible:[&::-webkit-slider-thumb]:ring-primary";

/**
 * Scales the typography custom properties on `documentElement`, so the whole interface grows or
 * shrinks without a rebuild. The value lives in the reader's own preference storage rather than in
 * server settings: it is a display preference, not workspace configuration.
 */
export function FontScaleControl() {
	const t = useT();
	const [scale, setScale] = useState(() => clampFontScale(readFontScale()));

	useEffect(() => {
		applyFontScale(scale);
	}, [scale]);

	const percent = fontScalePercent(scale);

	return (
		<div
			data-testid="font-scale-control"
			className={cn(SETTINGS_ROWS_CONTAINER, "border-border-muted border-b")}
		>
			<SettingsRow
				label={t("settings.appearance.fontScale.label")}
				description={t("settings.appearance.fontScale.description")}
				control={
					<div className="flex items-center gap-12">
						<span
							data-testid="font-scale-value"
							className="min-w-48 text-right tr-text-ui text-text-default tabular-nums"
						>
							{percent}%
						</span>
						<div className="relative h-24 w-160">
							<div
								aria-hidden="true"
								className="absolute inset-x-0 top-1/2 flex h-4 -translate-y-1/2 overflow-hidden rounded-full bg-control-bg"
							>
								<span className="h-full bg-primary" style={{ width: `${percent}%` }} />
							</div>
							<input
								type="range"
								className={MOVEMENT_THUMB}
								min={FONT_SCALE_MIN}
								max={FONT_SCALE_MAX}
								step={FONT_SCALE_STEP}
								value={scale}
								aria-label={t("settings.appearance.fontScale.label")}
								aria-valuetext={t("settings.appearance.fontScale.value", { percent })}
								data-testid="font-scale-input"
								onChange={(event) => {
									const next = clampFontScale(Number(event.target.value));
									setScale(next);
									writeFontScale(next);
								}}
							/>
						</div>
					</div>
				}
			/>
		</div>
	);
}
