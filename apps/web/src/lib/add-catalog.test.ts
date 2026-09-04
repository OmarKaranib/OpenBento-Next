import { describe, expect, it } from "vitest";
import { ADD_CATALOG } from "./add-catalog";

describe("Phase 2 Add catalog", () => {
  it("is the single UI catalog for the required structure and Card entries", () => {
    expect(ADD_CATALOG.map((entry) => entry.id)).toEqual([
      "column", "watchbot", "note", "youtube", "web", "article", "stock",
    ]);
    expect(ADD_CATALOG.filter((entry) => entry.category === "Structure").map((entry) => entry.label)).toEqual(["Column", "WatchBot"]);
    expect(ADD_CATALOG.some((entry) => entry.label === "Frame")).toBe(false);
  });
});
