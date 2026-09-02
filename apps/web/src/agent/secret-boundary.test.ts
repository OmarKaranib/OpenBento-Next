import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const webSrc = join(here, "..");
const repoRoot = join(here, "../../../..");

describe("Interactive Agent secret boundary", () => {
  it("does not expose OPENAI_API_KEY to browser/client modules", () => {
    const clientFiles = [
      "components/shell/AgentPanel.tsx",
      "components/shell/SidePanels.tsx",
      "components/shell/AgentEntry.tsx",
      "server/supabase-browser.ts",
    ];
    for (const relative of clientFiles) {
      const source = readFileSync(join(webSrc, relative), "utf8");
      expect(source).not.toMatch(/OPENAI_API_KEY/);
      expect(source).not.toMatch(/NEXT_PUBLIC_OPENAI/);
      expect(source).not.toMatch(/sk-[a-zA-Z0-9]/);
    }
  });

  it("keeps the OpenAI provider behind the server agent boundary", () => {
    const provider = readFileSync(join(here, "openai-provider.ts"), "utf8");
    const actions = readFileSync(
      join(webSrc, "server/agent-actions.ts"),
      "utf8",
    );
    expect(provider).toContain("OPENAI_API_KEY");
    expect(actions).toContain('"use server"');
    expect(actions).toContain("requireOwnerIdFromRequest");
    expect(actions).toContain("runBoundAction");
  });

  it("documents server-only agent env in .env.example", () => {
    const envExample = readFileSync(join(repoRoot, ".env.example"), "utf8");
    expect(envExample).toContain("OPENAI_AGENT_MODEL");
    expect(envExample).toContain("gpt-5.6-terra");
    expect(envExample).not.toContain("NEXT_PUBLIC_OPENAI_API_KEY");
  });
});
