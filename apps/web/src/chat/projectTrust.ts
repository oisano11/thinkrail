import type {
	Project,
	ProjectResourceKind,
	ProjectTrustSummary,
	WsParams,
} from "@thinkrail/contracts";
import { t } from "@/i18n";

export type ProjectTrustNotice =
	| { kind: "hidden" }
	| {
			kind: "untrusted";
			aliasSkills: number;
			piResources: ProjectResourceKind[];
			mcpServers: number;
	  }
	| { kind: "unacknowledged"; names: string[] }
	| { kind: "trusted"; aliasSkills: number };

type TrustRecord = Pick<Project, "trusted" | "piResourceTrust" | "acknowledgedSkills">;

export function deriveProjectTrustNotice(
	project: TrustRecord | undefined,
	summary: ProjectTrustSummary | null,
): ProjectTrustNotice {
	if (!project || !summary) return { kind: "hidden" };
	const mcpServers = summary.mcpServers ?? 0;
	const aliasPending = summary.aliasSkills.length > 0 && project.trusted !== true;
	const nativePending =
		(summary.piResources.length > 0 || mcpServers > 0) && project.piResourceTrust !== "granted";
	if (aliasPending || nativePending) {
		return {
			kind: "untrusted",
			aliasSkills: aliasPending ? summary.aliasSkills.length : 0,
			piResources: nativePending ? summary.piResources : [],
			mcpServers: nativePending ? mcpServers : 0,
		};
	}
	if (summary.aliasSkills.length === 0 && summary.piResources.length === 0 && mcpServers === 0)
		return { kind: "hidden" };
	const acknowledged = new Set(project.acknowledgedSkills ?? []);
	const names = summary.aliasSkills.filter((name) => !acknowledged.has(name));
	if (names.length > 0) return { kind: "unacknowledged", names };
	return { kind: "trusted", aliasSkills: summary.aliasSkills.length };
}

const LOADED_KINDS: ReadonlyArray<[ProjectResourceKind, string]> = [
	["skills", "skills"],
	["prompts", "prompts"],
	["themes", "themes"],
	["systemPrompt", "system prompt"],
	["subagents", "subagent definitions"],
];
const CODE_KINDS: ReadonlyArray<[ProjectResourceKind, string]> = [
	["extensions", "extensions"],
	["settings", "settings"],
];

// The word lists are localised individually and re-joined with a localised
// separator, because English "a, b and c" has no single Chinese equivalent.
function namesOf(
	kinds: ReadonlyArray<[ProjectResourceKind, string]>,
	present: ReadonlySet<ProjectResourceKind>,
): string {
	const words = kinds.filter(([kind]) => present.has(kind)).map(([, word]) => t(word));
	const [last, ...rest] = words.slice().reverse();
	if (last === undefined) return "";
	if (rest.length === 0) return last;
	return t("{0} and {1}", rest.reverse().join(t(", ")), last);
}

export function untrustedNoticeText(
	notice: Extract<ProjectTrustNotice, { kind: "untrusted" }>,
): string {
	const parts = [
		...(notice.aliasSkills > 0
			? [t(notice.aliasSkills === 1 ? "1 skill" : "{0} skills", notice.aliasSkills)]
			: []),
		...(notice.piResources.length > 0 ? [t("its own Pi resources")] : []),
		...(notice.mcpServers > 0
			? [t(notice.mcpServers === 1 ? "1 MCP server" : "{0} MCP servers", notice.mcpServers)]
			: []),
	];
	if (parts.length === 0) return "";
	return t("This project ships {0} — off until you trust it.", parts.join(t(" and ")));
}

export function trustEnablesText(
	notice: Extract<ProjectTrustNotice, { kind: "untrusted" }>,
): string | null {
	const present = new Set(notice.piResources);
	const loads = namesOf(LOADED_KINDS, present);
	const runs = namesOf(CODE_KINDS, present);
	const code = runs ? t("{0} run code on this machine", runs) : "";
	const enables = !runs
		? loads
			? t("Trust loads its {0}.", loads)
			: null
		: loads
			? t("Trust loads its {0}, and lets its {1}.", loads, code)
			: t("Trust lets its {0}.", code);
	if (notice.mcpServers === 0) return enables;
	const mcp = t(
		notice.mcpServers === 1
			? "Its 1 MCP server still needs your approval one by one."
			: "Its {0} MCP servers still need your approval one by one.",
		notice.mcpServers === 1 ? undefined : notice.mcpServers,
	);
	return enables ? t("{0} {1}", enables, mcp) : mcp;
}

export function trustGrantParams(
	projectId: string,
	notice: Extract<ProjectTrustNotice, { kind: "untrusted" }>,
): WsParams<"project.setTrust"> {
	return {
		id: projectId,
		trusted: true,
		...(notice.piResources.length > 0 || notice.mcpServers > 0 ? { resources: true } : {}),
	};
}

export function trustedNoticeText(
	notice: Extract<ProjectTrustNotice, { kind: "trusted" }>,
): string {
	return notice.aliasSkills > 0
		? t(
				notice.aliasSkills === 1 ? "1 project skill trusted." : "{0} project skills trusted.",
				notice.aliasSkills === 1 ? undefined : notice.aliasSkills,
			)
		: t("Project resources trusted.");
}

export function canStopTrusting(project: TrustRecord | undefined): boolean {
	return project?.trusted === true || project?.piResourceTrust === "granted";
}

export function stopTrustingText(
	project: TrustRecord | undefined,
	supportsProjectTrust: boolean,
): string {
	return supportsProjectTrust && project?.piResourceTrust === "granted"
		? t(
				"Its project skills, Pi resources and MCP servers stop loading; running subagents stop and open chats reload when idle.",
			)
		: t("Its project skills stop loading in new chats.");
}
