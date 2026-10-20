import type { OpenBranchReview } from "@thinkrail/contracts";
import { t } from "@/i18n";
import { isOpenBranchReview } from "../../panels/useOpenBranchReview";

export interface RemoteCounts {
	unpushed: number;
	behind: number;
}

export function remoteCounts(
	review: OpenBranchReview | null,
	detailsKnown = true,
): RemoteCounts | "unknown" | null {
	if (!review || !isOpenBranchReview(review)) return null;
	if (!detailsKnown) return "unknown";
	const unpushed = review.unpushedCommits ?? 0;
	const behind = review.behindCommits ?? 0;
	return unpushed > 0 || behind > 0 ? { unpushed, behind } : null;
}

export type ReviewTone = "success" | "info" | "neutral";

export function reviewTone(review: OpenBranchReview): ReviewTone {
	return review.state === "merged" ? "info" : review.state === "closed" ? "neutral" : "success";
}

export function reviewStateLabel(review: OpenBranchReview): "Open" | "Merged" | "Closed" {
	return review.state === "merged" ? "Merged" : review.state === "closed" ? "Closed" : "Open";
}

/** `PR #12` while open; `Merged #12` / `Closed #12` afterwards (MRs keep their `!`). */
export function reviewChipLabel(review: OpenBranchReview): string {
	const ref = `${review.kind === "pull-request" ? "#" : "!"}${review.number}`;
	if (isOpenBranchReview(review))
		return t("{0} {1}", review.kind === "pull-request" ? t("PR") : t("MR"), ref);
	return t("{0} {1}", reviewStateLabel(review), ref);
}

export function projectInitial(name: string): string {
	const first = [...name.trim()][0];
	return first ? first.toLocaleUpperCase() : "?";
}

export function pluralCommits(count: number): string {
	return count === 1 ? t("1 commit") : t("{0} commits", count);
}
