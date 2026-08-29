import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InMemoryDomainStore } from "./store";
import { SupabaseDomainStore } from "./supabase-store";
import {
  createSupabaseDomainStore,
  createWorkerDomainStore,
  getDomainStore,
  resetDomainStore,
  setDomainSqlAdapterForTests,
  setDomainStore,
} from "./runtime-store";
import { createSqlContractAdapter } from "./sql-adapter";
import { SharedSqlTables } from "./sql-contract";

function clearPersistEnv(): void {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
}

beforeEach(() => {
  resetDomainStore();
  setDomainSqlAdapterForTests(undefined);
  clearPersistEnv();
});

afterEach(() => {
  resetDomainStore();
  setDomainSqlAdapterForTests(undefined);
  clearPersistEnv();
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

  it("createWorkerDomainStore throws instead of falling back to InMemory", () => {
    expect(() => createWorkerDomainStore()).toThrow(
      /No in-memory runtime fallback|SUPABASE_SERVICE_ROLE_KEY|Supabase env is required/i,
    );
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
      "sb_publishable_placeholder";
    expect(() => createWorkerDomainStore()).toThrow(
      /SUPABASE_SERVICE_ROLE_KEY/,
    );
    process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_service_role_placeholder";
    expect(createWorkerDomainStore()).toBeInstanceOf(SupabaseDomainStore);
    expect(createWorkerDomainStore()).not.toBeInstanceOf(InMemoryDomainStore);
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
