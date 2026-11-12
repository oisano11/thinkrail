import {
	isModelContextWindow,
	isModelContextWritable,
	isSharedModelContextTarget,
	MODEL_CONTEXT_WINDOW_LIMITS,
	type ModelContextCeiling,
	type ModelContextSetting,
	type ModelContextTarget,
	modelContextWindowLimits,
} from "@thinkrail/contracts";
import { applyEdits, findNodeAtLocation, modify, type Node, parseTree } from "jsonc-parser";
import { usePiRuntime } from "./agentSessionManager";
import {
	MODELS_JSON_FORMATTING,
	MODELS_JSON_PARSE,
	modelsPath,
	parseModelsConfig,
	publishModelsFileChange,
	readModelsSource,
	serializeModelsWrite,
	splitModelsSource,
	writeModelsFile,
} from "./modelsFile";
import { type AvailableModelsRuntime, settledAvailableModels } from "./piRuntime";

function overridePath(model: Pick<ModelContextSetting, "provider" | "id">): string[] {
	return ["providers", model.provider, "modelOverrides", model.id, "contextWindow"];
}

/**
 * The largest window each model id and display name declares across every interface in the catalog, so
 * a proxy that lists a model without its real capacity still resolves to the official entry.
 */
function ceilingIndex(runtime: AvailableModelsRuntime): ReadonlyMap<string, ModelContextCeiling> {
	const index = new Map<string, ModelContextCeiling>();
	const consider = (key: string, model: { api: string; contextWindow: number }): void => {
		const { contextWindow } = model;
		if (!Number.isSafeInteger(contextWindow) || contextWindow <= 0) return;
		const current = index.get(key);
		if (current && current.contextWindow >= contextWindow) return;
		index.set(key, { contextWindow, api: model.api });
	};
	for (const model of runtime.getModels()) {
		consider(model.id.toLowerCase(), model);
		if (model.name) consider(`name:${model.name.toLowerCase()}`, model);
	}
	return index;
}

function ceilingFor(
	model: { id: string; name: string; contextWindow: number },
	index: ReadonlyMap<string, ModelContextCeiling>,
): ModelContextCeiling | null {
	const found = index.get(model.id.toLowerCase()) ?? index.get(`name:${model.name.toLowerCase()}`);
	if (!found) return null;
	const contextWindow = Math.min(found.contextWindow, MODEL_CONTEXT_WINDOW_LIMITS.max);
	if (contextWindow <= model.contextWindow) return null;
	return { contextWindow, api: found.api };
}

function listSettings(
	runtime: AvailableModelsRuntime,
	config: Node | undefined,
): ModelContextSetting[] {
	const ceilings = ceilingIndex(runtime);
	return settledAvailableModels(runtime).map((model) => {
		const node = config && findNodeAtLocation(config, overridePath(model));
		const override: number | null = node?.type === "number" ? node.value : null;
		return {
			provider: model.provider,
			id: model.id,
			name: model.name,
			contextWindow: model.contextWindow,
			override,
			ceiling: ceilingFor(model, ceilings),
		};
	});
}

function patch(source: string, path: string[], contextWindow: number | null): string {
	if (contextWindow !== null)
		return applyEdits(source, modify(source, path, contextWindow, MODELS_JSON_FORMATTING));
	let current = path;
	while (current.length > 1) {
		source = applyEdits(source, modify(source, current, undefined, MODELS_JSON_FORMATTING));
		const parent = current.slice(0, -1);
		const root = parseTree(source, [], MODELS_JSON_PARSE);
		const node = root && findNodeAtLocation(root, parent);
		if (node?.type !== "object" || node.children?.length) break;
		current = parent;
	}
	return source;
}

export function listModelContextSettings(): Promise<ModelContextSetting[]> {
	return usePiRuntime(async (runtime) => {
		await runtime.refresh({ allowNetwork: false });
		return listSettings(runtime, parseModelsConfig(readModelsSource(modelsPath())));
	});
}

export function setModelContextWindow(
	target: ModelContextTarget,
	contextWindow: number | null,
): Promise<ModelContextSetting[]> {
	const limits =
		target === "available"
			? MODEL_CONTEXT_WINDOW_LIMITS
			: modelContextWindowLimits(target.provider);
	if (contextWindow !== null && !isModelContextWindow(contextWindow, limits)) {
		return Promise.reject(
			new Error(
				`Context window must be a whole number between ${limits.min.toLocaleString("en-US")} and ${limits.max.toLocaleString("en-US")} tokens`,
			),
		);
	}
	return serializeModelsWrite(() => save(target, contextWindow));
}

/** Fills in every model whose own interface reports less than a sibling interface of it declares. */
export function applyModelContextCeilings(): Promise<ModelContextSetting[]> {
	return serializeModelsWrite(() => applyCeilings());
}

function applyCeilings(): Promise<ModelContextSetting[]> {
	return usePiRuntime(async (runtime) => {
		await runtime.refresh({ allowNetwork: false });
		const path = modelsPath();
		const source = readModelsSource(path);
		const settings = listSettings(runtime, parseModelsConfig(source));
		const targets = settings.filter(
			(model) => model.ceiling !== null && model.override === null && isModelContextWritable(model),
		);
		if (targets.length === 0) return settings;
		const { bom, body } = splitModelsSource(source);
		let next = body;
		for (const model of targets) {
			if (model.ceiling) next = patch(next, overridePath(model), model.ceiling.contextWindow);
		}
		if (bom + next !== source) {
			writeModelsFile(path, bom + next);
			await runtime.refresh({ allowNetwork: false });
			publishModelsFileChange();
		}
		return listSettings(runtime, parseModelsConfig(bom + next));
	});
}

function save(
	target: ModelContextTarget,
	contextWindow: number | null,
): Promise<ModelContextSetting[]> {
	return usePiRuntime(async (runtime) => {
		await runtime.refresh({ allowNetwork: false });
		const path = modelsPath();
		const source = readModelsSource(path);
		const settings = listSettings(runtime, parseModelsConfig(source));
		const targets =
			target === "available"
				? settings.filter(isSharedModelContextTarget)
				: settings.filter(
						(model) =>
							model.provider === target.provider &&
							model.id === target.id &&
							(contextWindow === null || isModelContextWritable(model)),
					);
		if (targets.length === 0) throw new Error("Unknown, unavailable or ineligible context target");
		const { bom, body } = splitModelsSource(source);
		let next = body;
		for (const model of targets) next = patch(next, overridePath(model), contextWindow);
		if (bom + next !== source) {
			writeModelsFile(path, bom + next);
			await runtime.refresh({ allowNetwork: false });
			publishModelsFileChange();
		}
		return listSettings(runtime, parseModelsConfig(bom + next));
	});
}
