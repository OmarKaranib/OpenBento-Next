import { afterEach, describe, expect, it } from "vitest";
import { InMemoryDomainStore } from "./store";
import { SupabaseDomainStore } from "./supabase-store";
import {
  createSupabaseDomainStore,
  getDomainStore,
  resetDomainStore,
  setDomainSqlAdapterForTests,
  setDomainStore,
} from "./runtime-store";
import { createSqlContractAdapter } from "./sql-adapter";
import { SharedSqlTables } from "./sql-contract";

afterEach(() => {
  resetDomainStore();
  setDomainSqlAdapterForTests(undefined);
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

describe("getDomainStore", () => {
  it("does not fall back to InMemoryDomainStore", () => {
    expect(() => getDomainStore()).toThrow(/No in-memory runtime fallback/i);
    expect(() => getDomainStore()).not.toBeInstanceOf(InMemoryDomainStore);
  });

  it("returns SupabaseDomainStore when env is present", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
      "sb_publishable_placeholder";
    const store = getDomainStore();
    expect(store).toBeInstanceOf(SupabaseDomainStore);
    expect(store).toBe(getDomainStore());
  });

  it("createSupabaseDomainStore is the runtime constructor", () => {
    const store = createSupabaseDomainStore(
      createSqlContractAdapter(new SharedSqlTables(), { ownerId: "user-a" }),
    );
    expect(store).toBeInstanceOf(SupabaseDomainStore);
    setDomainStore(new InMemoryDomainStore());
    expect(getDomainStore()).toBeInstanceOf(InMemoryDomainStore);
    resetDomainStore();
    setDomainSqlAdapterForTests(
      createSqlContractAdapter(new SharedSqlTables(), { ownerId: "user-a" }),
    );
    expect(getDomainStore()).toBeInstanceOf(SupabaseDomainStore);
  });
});
