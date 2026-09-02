import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const webSrc = join(here, "..");
const repoRoot = join(here, "../../../..");

const WORKER_PROVIDER_SECRETS = [
  "OPENAI_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "X_BEARER_TOKEN",
  "XAI_API_KEY",
  "GROK_API_KEY",
] as const;

/** Dedicated Interactive Agent exception — web server-only, never NEXT_PUBLIC. */
const WEB_AGENT_SECRET = "OPENAI_AGENT_API_KEY";

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") {
        continue;
      }
      out.push(...walkTsFiles(full));
      continue;
    }
    if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe("Interactive Agent secret boundary", () => {
  it("does not expose OpenAI or worker secrets to browser/client modules", () => {
    const clientFiles = [
      "components/shell/AgentPanel.tsx",
      "components/shell/SidePanels.tsx",
      "components/shell/AgentEntry.tsx",
      "server/supabase-browser.ts",
    ];
    for (const relative of clientFiles) {
      const source = readFileSync(join(webSrc, relative), "utf8");
      expect(source).not.toMatch(/OPENAI_API_KEY/);
      expect(source).not.toMatch(/OPENAI_AGENT_API_KEY/);
      expect(source).not.toMatch(/NEXT_PUBLIC_OPENAI/);
      expect(source).not.toMatch(/sk-[a-zA-Z0-9]/);
    }
  });

  it("reads OPENAI_AGENT_API_KEY from server Agent code only (not worker OPENAI_API_KEY)", () => {
    const provider = readFileSync(join(here, "openai-provider.ts"), "utf8");
    const actions = readFileSync(
      join(webSrc, "server/agent-actions.ts"),
      "utf8",
    );
    const runtime = readFileSync(join(here, "runtime.ts"), "utf8");

    expect(provider).toContain(WEB_AGENT_SECRET);
    expect(provider).toMatch(/OPENAI_AGENT_API_KEY/);
    // Must not fall back to the worker WatchBot credential name.
    expect(provider).not.toMatch(
      /env\.OPENAI_API_KEY|process\.env\.OPENAI_API_KEY|process\.env\[\s*["']OPENAI_API_KEY["']\s*\]/,
    );
    expect(runtime).toContain(WEB_AGENT_SECRET);
    expect(runtime).not.toMatch(
      /Set server-only OPENAI_API_KEY on the web service/,
    );
    expect(actions).toContain('"use server"');
    expect(actions).toContain("requireOwnerIdFromRequest");
    expect(actions).toContain("runBoundAction");
  });

  it("keeps worker provider secrets off web outside the dedicated Agent exception", () => {
    // Aligns with Track D (#35) platform-boundary policy: worker/provider
    // secrets stay off web. OPENAI_AGENT_API_KEY is the only explicit
    // provider-secret exception, and only under apps/web/src/agent/.
    const agentDir = join(webSrc, "agent");
    const webFiles = walkTsFiles(webSrc).filter(
      (path) => !path.startsWith(agentDir),
    );

    for (const file of webFiles) {
      const source = readFileSync(file, "utf8");
      for (const name of WORKER_PROVIDER_SECRETS) {
        expect(
          source,
          `${file} must not read worker secret ${name}`,
        ).not.toMatch(
          new RegExp(
            `process\\.env(?:\\.${name}|\\[\\s*["']${name}["']\\s*\\])`,
          ),
        );
        expect(source).not.toContain(`NEXT_PUBLIC_${name}`);
      }
      expect(source).not.toMatch(
        /process\.env(?:\.OPENAI_AGENT_API_KEY|\[\s*["']OPENAI_AGENT_API_KEY["']\s*\])/,
      );
    }

    const agentFiles = walkTsFiles(agentDir);
    for (const file of agentFiles) {
      if (file.endsWith(".test.ts")) {
        continue;
      }
      const source = readFileSync(file, "utf8");
      expect(source).not.toContain("NEXT_PUBLIC_OPENAI_AGENT_API_KEY");
      expect(source).not.toMatch(
        /process\.env(?:\.OPENAI_API_KEY|\[\s*["']OPENAI_API_KEY["']\s*\])/,
      );
    }
  });

  it("documents dedicated OPENAI_AGENT_API_KEY and worker-only OPENAI_API_KEY", () => {
    const envExample = readFileSync(join(repoRoot, ".env.example"), "utf8");
    expect(envExample).toContain("OPENAI_AGENT_API_KEY=");
    expect(envExample).toContain("OPENAI_AGENT_MODEL=gpt-5.6-terra");
    expect(envExample).toMatch(/OPENAI_API_KEY=/);
    expect(envExample).toMatch(/worker-only/i);
    expect(envExample).toMatch(/do NOT reuse worker OPENAI_API_KEY/i);
    expect(envExample).not.toContain("NEXT_PUBLIC_OPENAI_API_KEY");
    expect(envExample).not.toContain("NEXT_PUBLIC_OPENAI_AGENT_API_KEY");

    const agentDoc = readFileSync(join(repoRoot, "docs/AGENT.md"), "utf8");
    expect(agentDoc).toContain("OPENAI_AGENT_API_KEY");
    expect(agentDoc).toMatch(/worker.*OPENAI_API_KEY|OPENAI_API_KEY.*worker/i);
    expect(agentDoc).not.toMatch(
      /set OPENAI_API_KEY on the Railway \*\*web\*\*/i,
    );
  });
});
