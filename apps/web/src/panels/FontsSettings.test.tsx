import { expect, test } from "bun:test";
import { TooltipProvider } from "@thinkrail/ui/tooltip";
import { renderToStaticMarkup } from "react-dom/server";
import { InterfaceSizeRow } from "./FontsSettings";

const render = (value: number) =>
	renderToStaticMarkup(
		<TooltipProvider>
			<InterfaceSizeRow value={value} onCommit={() => Promise.resolve(true)} />
		</TooltipProvider>,
	);

test("the interface size row reads out the reader's percentage", () => {
	const markup = render(100);
	expect(markup).toContain('data-testid="interface-size"');
	expect(markup).toContain('data-testid="interface-size-input"');
	expect(markup).toContain('value="100"');
	// Nothing to reset at the default scale.
	expect(markup).not.toContain('aria-label="Reset interface text size"');
});

test("a scaled interface offers the reset and shows the current percentage", () => {
	const markup = render(130);
	expect(markup).toContain('value="130"');
	expect(markup).toContain('aria-label="Reset interface text size"');
	expect(markup).toContain("Code and terminal sizes have their own setting.");
});
