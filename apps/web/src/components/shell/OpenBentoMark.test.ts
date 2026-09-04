import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OpenBentoMark } from "./OpenBentoMark";

describe("OpenBentoMark", () => {
  it("uses the locked favicon asset instead of a generated tile mark", () => {
    const html = renderToStaticMarkup(createElement(OpenBentoMark));
    expect(html).toContain('src="/favicon.ico"');
    expect(html).not.toContain("grid-cols-2");
    expect(html).not.toContain("<span");
  });
});
