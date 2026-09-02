import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function walkTs(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkTs(path));
    } else if (entry.name.endsWith(".ts")) {
      out.push(path);
    }
  }
  return out;
}

describe("vendor boundary", () => {
  it("keeps @openbento/domain free of Grok/xAI/X provider imports and credentials", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const domainSrc = join(here, "../../domain/src");
    const files = walkTs(domainSrc);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      expect(text).not.toMatch(
        /from\s+["'][^"']*(?:xai|grok|adapters\/x)[^"']*["']|XAI_API_KEY|GROK_API_KEY|X_BEARER_TOKEN|api\.x\.com/i,
      );
      expect(text).not.toMatch(/MeaningfulnessClassifier|createFixtureMeaningfulnessClassifier/);
      expect(text).not.toMatch(
        /createModelMeaningfulnessClassifier|WATCHBOT_MEANINGFULNESS_CLASSIFIER_ENABLED/,
      );
    }
  });
});
