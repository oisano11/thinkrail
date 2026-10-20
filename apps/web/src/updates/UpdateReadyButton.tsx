import { RiDownloadCloud2Line as DownloadCloud } from "@remixicon/react";
import { Button } from "@thinkrail/ui/button";
import { t } from "@/i18n";
import type { UpdatesController } from "./useUpdates";

export function UpdateReadyButton({
	updates,
	onOpen,
}: {
	updates: UpdatesController;
	onOpen(): void;
}) {
	const hostUpdate = updates.source === "host";
	const hostStatus = updates.source === "host" ? updates.state.status : undefined;
	const hostRequestFailed = updates.source === "host" && updates.requestFailed;
	const nativeState = updates.source === "native" ? updates.state : null;
	const nativeNeedsAttention = updates.source === "native" && updates.requestError !== null;
	const nativeActionable =
		nativeNeedsAttention ||
		nativeState?.status === "available" ||
		nativeState?.status === "downloading" ||
		nativeState?.status === "preparing" ||
		nativeState?.status === "ready" ||
		nativeState?.status === "installing" ||
		nativeState?.status === "error";
	if (!nativeActionable && !hostUpdate) return null;

	const availableVersion = updates.state.availableVersion;
	let label = t("Update needs attention");
	let ariaLabel = availableVersion
		? t("ThinkRail {0} update needs attention", availableVersion)
		: t("A ThinkRail update needs attention");
	if (hostUpdate) {
		if (hostRequestFailed || hostStatus === "failed") {
			label = t("Update failed");
			ariaLabel = t("The ThinkRail host update failed");
		} else if (hostStatus === "running") {
			label = t("Updating host");
			ariaLabel = availableVersion
				? t("Updating the ThinkRail host to {0}", availableVersion)
				: t("Updating the ThinkRail host");
		} else if (hostStatus === "succeeded") {
			label = t("Restart host");
			ariaLabel = availableVersion
				? t("Restart the ThinkRail host to use {0}", availableVersion)
				: t("Restart the ThinkRail host to use the update");
		} else {
			label = t("Update available");
			ariaLabel = availableVersion
				? t("ThinkRail {0} is available", availableVersion)
				: t("A ThinkRail update is available");
		}
	} else if (!nativeNeedsAttention && nativeState) {
		switch (nativeState.status) {
			case "available":
				label = t("Update available");
				ariaLabel = availableVersion
					? t("ThinkRail {0} is available to download", availableVersion)
					: t("A ThinkRail update is available to download");
				break;
			case "downloading":
				label =
					typeof nativeState.progress === "number"
						? t("Downloading {0}%", Math.round(nativeState.progress))
						: t("Downloading update");
				ariaLabel = label;
				break;
			case "preparing":
				label = t("Preparing update");
				ariaLabel = label;
				break;
			case "ready":
				label = t("Update ready");
				ariaLabel = availableVersion
					? t("ThinkRail {0} is ready to install", availableVersion)
					: t("An update is ready to install");
				break;
			case "installing":
				label = t("Installing update");
				ariaLabel = label;
				break;
		}
	}

	return (
		<Button
			variant="ghost"
			size="sm"
			data-testid="update-ready"
			data-source={updates.source}
			data-status={nativeState?.status ?? hostStatus ?? (hostUpdate ? "legacy" : undefined)}
			aria-label={ariaLabel}
			onClick={onOpen}
			className="text-primary"
		>
			<DownloadCloud className="size-14" />
			<span className="hidden md:inline">{label}</span>
		</Button>
	);
}
