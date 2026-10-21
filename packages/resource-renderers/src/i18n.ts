/**
 * The translation seam for this package.
 *
 * Renderer copy is written as English keys, exactly like the app's own copy, and translated by
 * whoever hosts the package: the host owns the catalogs and the active locale. This package cannot
 * import app source — it is a package, the app is an app — so the host installs a translator here
 * instead. The default renders the English key itself, filling `{0}`-style placeholders, which is
 * what shows when nothing is installed.
 *
 * Install the translator before the bundled renderers are registered: registration reads renderer
 * labels, so a translator installed afterwards would leave those labels in English for the life of
 * the module.
 */
export type ResourceTranslator = (key: string, ...args: readonly unknown[]) => string;

/** The English key is the message, so the default translator still performs the positional fill. */
let translate: ResourceTranslator = (key, ...args) =>
	key.replace(/\{(\d+)\}/g, (whole, index: string) => {
		const value = args[Number(index)];
		return value === undefined || value === null ? whole : String(value);
	});

export function setResourceTranslator(translator: ResourceTranslator): void {
	translate = translator;
}

export function t(key: string, ...args: readonly unknown[]): string {
	return translate(key, ...args);
}
