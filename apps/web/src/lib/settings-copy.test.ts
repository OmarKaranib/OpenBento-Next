import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  OPENBENTO_WEB_VERSION,
  SETTINGS_DEBUG_PHRASES,
  SIGNED_IN_SETTINGS_BODY,
  SIGNED_IN_SETTINGS_NO_EMAIL,
  SIGNED_IN_SETTINGS_TITLE,
  openBentoVersionLabel,
  signedInAccountLabel,
} from "./settings-copy";

const here = dirname(fileURLToPath(import.meta.url));

describe("settings product copy", () => {
  it("keeps the web version label in sync with package.json", () => {
    const pkg = JSON.parse(
      readFileSync(join(here, "../../package.json"), "utf8"),
    ) as { version: string };
    expect(OPENBENTO_WEB_VERSION).toBe(pkg.version);
    expect(openBentoVersionLabel()).toBe(`OpenBento ${pkg.version}`);
  });

  it("sanitizes account email and falls back without inventing identity", () => {
    expect(signedInAccountLabel("omar@example.com")).toBe(
      "Signed in as omar@example.com",
    );
    expect(signedInAccountLabel("  ")).toBe(SIGNED_IN_SETTINGS_NO_EMAIL);
    expect(signedInAccountLabel(undefined)).toBe(SIGNED_IN_SETTINGS_NO_EMAIL);
    expect(
      signedInAccountLabel(`<img src=x onerror="alert(1)">omar@example.com`),
    ).toBe("Signed in as omar@example.com");
    expect(signedInAccountLabel("<script>alert(1)</script>")).toBe(
      SIGNED_IN_SETTINGS_NO_EMAIL,
    );
    expect(SIGNED_IN_SETTINGS_TITLE).toBe("Your account");
    expect(SIGNED_IN_SETTINGS_BODY).toMatch(/saved to your OpenBento account/i);
  });

  it("signed-in Settings panel has product copy and no debug internals", () => {
    const panels = readFileSync(
      join(here, "../components/shell/SidePanels.tsx"),
      "utf8",
    );
    const settingsPanel = panels.slice(
      panels.indexOf("function SettingsPanel"),
      panels.indexOf("function CanvasesPanel"),
    );
    expect(settingsPanel).toContain("SIGNED_IN_SETTINGS_TITLE");
    expect(settingsPanel).toContain("SIGNED_IN_SETTINGS_BODY");
    expect(settingsPanel).toContain("accountEmail");
    expect(settingsPanel).toContain("signedInAccountLabel");
    expect(settingsPanel).toContain("openBentoVersionLabel");
    expect(settingsPanel).toContain("GUEST_WORKSPACE_TITLE");
    expect(settingsPanel).toContain("Sign out");
    for (const phrase of SETTINGS_DEBUG_PHRASES) {
      expect(settingsPanel).not.toContain(phrase);
    }
    expect(settingsPanel).not.toContain(
      "Canvas writes go through server runDomainAction",
    );
  });
});
