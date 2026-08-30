import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryDomainStore, SupabaseDomainStore } from "@openbento/domain";
import { getDomainStore, resetDomainStore, setDomainStore } from "./store";

const webSrc = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(webSrc, "server/store.ts"), "utf8");

function walkTsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return walkTsFiles(path);
    }
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

function isRuntimeSource(file: string): boolean {
  return !/\.(?:test|spec)\.(?:ts|tsx)$/.test(file);
}

afterEach(() => {
  resetDomainStore();
});

describe("web getDomainStore", () => {
  it("does not construct an InMemoryDomainStore fallback", () => {
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(code).not.toMatch(/new InMemoryDomainStore/);
    expect(code).toMatch(/getDomainStore/);
    expect(source).toMatch(/SupabaseDomainStore/);
    expect(code).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("uses the injected store for isolated tests only", () => {
    const isolated = new InMemoryDomainStore();
    setDomainStore(isolated);
    expect(getDomainStore()).toBe(isolated);
    expect(getDomainStore()).not.toBeInstanceOf(SupabaseDomainStore);
  });

  it("does not import the worker service-role factory", () => {
    const runtimeFiles = walkTsFiles(webSrc).filter(isRuntimeSource);
    expect(runtimeFiles.length).toBeGreaterThan(0);
    expect(runtimeFiles).not.toContain(fileURLToPath(import.meta.url));
    for (const file of runtimeFiles) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/createWorkerDomainStore/);
      expect(text, file).not.toMatch(/readWorkerSupabaseEnv/);
      expect(text, file).not.toMatch(/createWorkerAuthedClient/);
      expect(text, file).not.toMatch(/createWorkerSupabaseJsAdapter/);
    }
  });
});
