import { afterEach, describe, expect, it } from "vitest";
import {
  createWebAuthedClient,
  createWorkerAuthedClient,
  readWebSupabaseEnv,
  readWorkerSupabaseEnv,
} from "./supabase-js-adapter";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const adapterSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "supabase-js-adapter.ts"),
  "utf8",
);
const runtimeSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "runtime-store.ts"),
  "utf8",
);

afterEach(() => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

function setBothKeys(): void {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_placeholder";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_service_role_must_not_be_used";
}

describe("web authed client ignores service role", () => {
  it("does not use SUPABASE_SERVICE_ROLE_KEY when both keys are in env", async () => {
    setBothKeys();
    const env = readWebSupabaseEnv();
    expect(env.publishableKey).toBe("sb_publishable_placeholder");
    expect(env).not.toHaveProperty("serviceRoleKey");

    const nativeWebSocket = globalThis.WebSocket;
    Reflect.deleteProperty(globalThis, "WebSocket");
    try {
      const client = await createWebAuthedClient({
        ...env,
        getAccessToken: async () => "user-jwt",
      });
      const usedKey = (client as unknown as { supabaseKey: string }).supabaseKey;
      expect(usedKey).toBe("sb_publishable_placeholder");
      expect(usedKey).not.toBe(process.env.SUPABASE_SERVICE_ROLE_KEY);

      const worker = await createWorkerAuthedClient(readWorkerSupabaseEnv());
      const workerKey = (worker as unknown as { supabaseKey: string })
        .supabaseKey;
      expect(workerKey).toBe("sb_service_role_must_not_be_used");
      expect(workerKey).not.toBe(env.publishableKey);
    } finally {
      globalThis.WebSocket = nativeWebSocket;
    }
  });

  it("readWebSupabaseEnv never copies the service-role key", () => {
    setBothKeys();
    expect(readWebSupabaseEnv()).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "sb_publishable_placeholder",
    });
  });

  it("keeps service role on the worker factory only", () => {
    const webFactory = runtimeSource.match(
      /export function createSupabaseDomainStore\([\s\S]*?\n\}/,
    )?.[0];
    expect(webFactory).toMatch(/readWebSupabaseEnv/);
    expect(webFactory).not.toMatch(/readWorkerSupabaseEnv/);
    expect(webFactory).not.toMatch(/SERVICE_ROLE/);
    expect(adapterSource).toMatch(/export function readWebSupabaseEnv/);
    expect(runtimeSource).toMatch(/createWorkerDomainStore/);
    setBothKeys();
    expect(readWorkerSupabaseEnv().serviceRoleKey).toBe(
      "sb_service_role_must_not_be_used",
    );
  });
});
