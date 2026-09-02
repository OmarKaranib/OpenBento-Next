import { describe, expect, it } from "vitest";
import { sanitizeUntrustedDisplayText } from "./untrusted";

describe("sanitizeUntrustedDisplayText", () => {
  it("strips tags and collapses whitespace", () => {
    expect(sanitizeUntrustedDisplayText("  hello <b>world</b>  ")).toBe(
      "hello world",
    );
  });

  it("drops script-like payloads to plain text", () => {
    expect(
      sanitizeUntrustedDisplayText('<script>alert("x")</script>Title'),
    ).toBe('alert("x")Title');
  });

  it("truncates long values", () => {
    const value = "a".repeat(500);
    expect(sanitizeUntrustedDisplayText(value, 40).length).toBe(40);
  });

  it("returns empty for non-strings", () => {
    expect(sanitizeUntrustedDisplayText(null)).toBe("");
    expect(sanitizeUntrustedDisplayText(12)).toBe("");
  });
});
