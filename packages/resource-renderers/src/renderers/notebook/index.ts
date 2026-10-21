import { t } from "../../i18n";
import type { ResourceRenderer } from "../../registry";

export const notebookRenderer: ResourceRenderer = {
	id: "thinkrail/notebook",
	get label() {
		return t("Notebook");
	},
	match: { glob: ["*.ipynb"], text: true },
	rank: 130,
	capabilities: {
		view: true,
		diff: true,
		anchors: {
			view: ["line", "structural:ipynb-cell"],
			diff: ["line", "structural:ipynb-cell"],
		},
		mobile: true,
		copy: true,
		layout: false,
		whitespace: false,
	},
	loadView: () => import("./View"),
	loadDiff: () => import("./Diff"),
};
