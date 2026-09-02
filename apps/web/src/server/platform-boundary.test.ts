import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const productionFiles = [
  "instrumentation-client.ts",
  "sentry.server.config.ts",
  "sentry.edge.config.ts",
  "src/instrumentation.ts",
  "src/proxy.ts",
  "src/server/store.ts",
  "src/server/supabase.ts",
  "src/server/supabase-browser.ts",
];

describe("web platform boundary", () => {
  it("does not reference worker-only credential names", () => {
    const forbidden = [
      "SUPABASE" + "_SERVICE_ROLE_KEY",
      "X_" + "BEARER_TOKEN",
      "OPENAI" + "_API_KEY",
      "XAI" + "_API_KEY",
      "GROK" + "_API_KEY",
    ];

    for (const relativePath of productionFiles) {
      const source = readFileSync(join(webRoot, relativePath), "utf8");
      for (const name of forbidden) {
        expect(source, `${relativePath} must not read ${name}`).not.toMatch(
          new RegExp(`process\\.env(?:\\.${name}|\\[\\s*["']${name}["']\\s*\\])`),
        );
        expect(source, `${relativePath} must not publish ${name}`).not.toContain(
          `NEXT_PUBLIC_${name}`,
        );
      }
    }
  });

  it("keeps the browser Sentry configuration public-only and telemetry-minimal", () => {
    const source = readFileSync(
      join(webRoot, "instrumentation-client.ts"),
      "utf8",
    );
    expect(source).toContain("NEXT_PUBLIC_SENTRY_DSN");
    expect(source).toContain("sendDefaultPii: false");
    expect(source).toContain("tracesSampleRate: 0");
    expect(source).not.toContain("SENTRY_AUTH_TOKEN");
  });
});
