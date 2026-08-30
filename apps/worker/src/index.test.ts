import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { main } from "./index";

const dir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(dir, "index.ts"), "utf8");
const pkg = JSON.parse(
  readFileSync(join(dir, "../package.json"), "utf8"),
) as { scripts: Record<string, string> };

function clearPersistEnv(): void {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.X_PROVIDER_ENABLED;
  delete process.env.X_BEARER_TOKEN;
}

beforeEach(clearPersistEnv);
afterEach(clearPersistEnv);

describe("worker persist factory", () => {
  it("uses createWorkerDomainStore and not web getDomainStore", () => {
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(code).toMatch(/createWorkerDomainStore\(\)/);
    expect(code).not.toMatch(/getDomainStore/);
    expect(code).not.toMatch(/InMemoryDomainStore/);
  });

  it("default start scripts use the durable store, not the in-memory fixture", () => {
    expect(pkg.scripts.start).toBe("tsx src/index.ts --once");
    expect(pkg.scripts.start).not.toMatch(/--fixture/);
    expect(pkg.scripts["start:loop"]).toBe("tsx src/index.ts --loop");
    expect(pkg.scripts["start:loop"]).not.toMatch(/--fixture/);
    expect(pkg.scripts["start:fixture"]).toBe("tsx src/index.ts --once --fixture");
  });

  it("default path cannot start on InMemoryDomainStore", async () => {
    await expect(main(["--once"])).rejects.toThrow(
      /No in-memory runtime fallback|SUPABASE_SERVICE_ROLE_KEY|Supabase env is required/i,
    );
  });

  it("fails closed before a worker cycle when X is explicitly selected without a token", async () => {
    process.env.X_PROVIDER_ENABLED = "true";

    await expect(main(["--once", "--fixture", "--provider=x"])).rejects.toMatchObject({
      code: "credential_missing",
    });
  });
});
