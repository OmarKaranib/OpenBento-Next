import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DeleteCanvasDialog } from "./CanvasSwitcher";

describe("DeleteCanvasDialog", () => {
  it("requires an explicit destructive confirmation with consequences", () => {
    const html = renderToStaticMarkup(
      createElement(DeleteCanvasDialog, {
        canvas: { id: "canvas-1", name: "Iran Monitor" },
        deleting: false,
        onCancel: () => undefined,
        onConfirm: () => undefined,
      }),
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain("Delete “Iran Monitor”?");
    expect(html).toContain(
      "This permanently deletes its Cards, Frames and WatchBots.",
    );
    expect(html).toContain("Cancel");
    expect(html).toContain("Delete Canvas");
    expect(html).not.toContain("<form");
  });
});
