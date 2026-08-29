import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryDomainStore, SupabaseDomainStore } from "@openbento/domain";
import { getDomainStore, resetDomainStore, setDomainStore } from "./store";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "store.ts"),
  "utf8",
);

afterEach(() => {
  resetDomainStore();
});

describe("web getDomainStore", () => {
  it("does not construct an InMemoryDomainStore fallback", () => {
    expect(source).not.toMatch(/new InMemoryDomainStore/);
    expect(source).toMatch(/getDomainStore/);
    expect(source).toMatch(/SupabaseDomainStore/);
  });

  it("uses the injected store for isolated tests only", () => {
    const isolated = new InMemoryDomainStore();
    setDomainStore(isolated);
    expect(getDomainStore()).toBe(isolated);
    expect(getDomainStore()).not.toBeInstanceOf(SupabaseDomainStore);
  });
});
