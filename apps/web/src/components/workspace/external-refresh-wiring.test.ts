import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

describe("external refresh wiring", () => {
  it("polls via the bound WorkspaceSession and verified getUser()", () => {
    const provider = readFileSync(join(here, "WorkspaceProvider.tsx"), "utf8");
    const hook = readFileSync(join(here, "use-external-canvas-refresh.ts"), "utf8");
    const refresh = readFileSync(
      join(here, "../../lib/domain/external-canvas-refresh.ts"),
      "utf8",
    );
    expect(provider).toContain("useExternalCanvasRefresh(session)");
    expect(provider).toContain("supabase.auth.getUser()");
    expect(provider).toContain("never JWT / session.user");
    expect(provider).not.toMatch(/onAuthStateChange\(\(event, session\)/);
    expect(provider).not.toMatch(/data\.session\.user/);
    expect(hook).toContain("acquireExternalCanvasRefresh(session)");
    expect(refresh).toContain("syncExternalState");
    expect(refresh).toContain("visibilityState");
    expect(refresh).not.toMatch(/supabase\.channel/);
    expect(refresh).toContain("Not Realtime");
    expect(refresh).toContain("zero tables");
  });
});
