import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(dir, "index.ts"), "utf8");
const pkg = JSON.parse(
  readFileSync(join(dir, "../package.json"), "utf8"),
) as { scripts: Record<string, string> };

describe("worker persist factory", () => {
  it("uses createWorkerDomainStore and not web getDomainStore", () => {
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(code).toMatch(/createWorkerDomainStore\(\)/);
    expect(code).not.toMatch(/getDomainStore/);
  });

  it("default start scripts use the durable store, not the in-memory fixture", () => {
    expect(pkg.scripts.start).toBe("tsx src/index.ts --once");
    expect(pkg.scripts.start).not.toMatch(/--fixture/);
    expect(pkg.scripts["start:loop"]).toBe("tsx src/index.ts --loop");
    expect(pkg.scripts["start:loop"]).not.toMatch(/--fixture/);
    expect(pkg.scripts["start:fixture"]).toBe("tsx src/index.ts --once --fixture");
  });
});
