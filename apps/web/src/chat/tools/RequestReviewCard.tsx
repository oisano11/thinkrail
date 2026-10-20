import {
	RiCheckboxCircleFill as ApproveIcon,
	RiErrorWarningFill as ChangesIcon,
} from "@remixicon/react";
import { isPlanReviewResult, type PlanReviewResult } from "@thinkrail/contracts";
import type { ToolRenderProps } from "@thinkrail/extension-api/web";
import type { ReactNode } from "react";
import { t } from "@/i18n";
import { ReviewPackageComments } from "../ReviewPackageComments";
import { reviewFixCommentsToItems } from "../reviewPackage";

export function readPlanReview(raw: unknown): PlanReviewResult | null {
	if (
		raw &&
		typeof raw === "object" &&
		isPlanReviewResult((raw as { details?: unknown }).details)
	) {
		return (raw as { details: PlanReviewResult }).details;
	}
	return isPlanReviewResult(raw) ? raw : null;
}

export function requestReviewSummary({ result }: ToolRenderProps): string {
	const review = readPlanReview(result);
	if (!review) return "";
	if (review.verdict === "approve") {
		const open = review.blockedByOpenFindings ?? 0;
		return open > 0
			? t("Approved “{0}” · {1} still open", review.itemTitle, open)
			: t("Approved “{0}”", review.itemTitle);
	}
	const n = review.findings.length;
	return t(
		"Changes requested on “{0}” · {1} {2}",
		review.itemTitle,
		n,
		n === 1 ? "finding" : "findings",
	);
}

export function RequestReviewCard({ toolCallId, result, status }: ToolRenderProps): ReactNode {
	const review = readPlanReview(result);
	if (!review) {
		return (
			<span className="tr-text-ui text-text-muted">
				{status === "running" ? t("Reviewing the change set…") : t("No review verdict.")}
			</span>
		);
	}
	const blocked = review.blockedByOpenFindings ?? 0;
	const approved = review.verdict === "approve" && blocked === 0;
	const items = reviewFixCommentsToItems(review.findings);
	return (
		<div data-testid="request-review-card" data-verdict={review.verdict} className="tr-text-ui">
			<div className="flex items-start gap-4">
				{approved ? (
					<ApproveIcon className="mt-2 size-16 shrink-0 text-feedback-success" />
				) : (
					<ChangesIcon className="mt-2 size-16 shrink-0 text-feedback-warning" />
				)}
				<div className="min-w-0 flex-1">
					<span data-testid="request-review-verdict" className="block text-text-default">
						{review.verdict === "approve" ? t("Approved") : t("Changes requested")}
						<span className="text-text-muted">{t(" — “{0}”", review.itemTitle)}</span>
						{blocked > 0 ? (
							<span data-testid="request-review-blocked" className="text-feedback-warning">
								{" "}
								{blocked === 1
									? t("· not settled, 1 finding still open")
									: t("· not settled, {0} findings still open", blocked)}
							</span>
						) : null}
					</span>
					{review.summary ? (
						<p className="mt-4 whitespace-pre-wrap text-text-muted">{review.summary}</p>
					) : null}
				</div>
			</div>
			<ReviewPackageComments foldPrefix={toolCallId} items={items} />
		</div>
	);
}
