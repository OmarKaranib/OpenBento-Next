import { describe, expect, it } from "vitest";
import { parseAddCommand } from "./add-command";

describe("parseAddCommand", () => {
  it("keeps ordinary search text outside command mode", () => {
    expect(parseAddCommand("earnings calendar")).toBeNull();
  });

  it("parses each deterministic Phase 2 command without an LLM", () => {
    expect(parseAddCommand("/note")).toEqual({ kind: "select", id: "note" });
    expect(parseAddCommand("/column Live markets")).toEqual({ kind: "column", name: "Live markets" });
    expect(parseAddCommand("/watch track OpenAI releases")).toEqual({ kind: "watchbot", instruction: "track OpenAI releases" });
    expect(parseAddCommand("/youtube https://youtube.com/watch?v=x")).toEqual({ kind: "source", id: "youtube", url: "https://youtube.com/watch?v=x" });
    expect(parseAddCommand("/web https://example.com")).toEqual({ kind: "source", id: "web", url: "https://example.com" });
    expect(parseAddCommand("/stock aapl")).toEqual({ kind: "stock", symbol: "aapl" });
  });

  it("returns concise errors while preserving the typed command input", () => {
    expect(parseAddCommand("/watch")).toEqual({ kind: "error", message: "Add an instruction after /watch." });
    expect(parseAddCommand("/unknown keep this text")).toEqual({ kind: "error", message: "Unknown command: /unknown" });
  });
});
