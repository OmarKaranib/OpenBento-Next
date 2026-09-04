import { describe, expect, it, vi } from "vitest";
import { exitWorkspaceFullscreen, requestWorkspaceFullscreen, shouldDeactivateWorkspaceView, workspaceOwnsBrowserFullscreen } from "./browser-fullscreen";

describe("workspace browser fullscreen", () => {
  it("uses the browser API when available and handles rejection safely", async () => {
    const element = { requestFullscreen: vi.fn(async () => undefined) } as unknown as HTMLElement;
    await expect(requestWorkspaceFullscreen(element)).resolves.toBe(true);
    expect(element.requestFullscreen).toHaveBeenCalledOnce();
    await expect(requestWorkspaceFullscreen({ requestFullscreen: vi.fn(async () => { throw new Error("denied"); }) } as unknown as HTMLElement)).resolves.toBe(false);
  });

  it("exits only fullscreen owned by the Workspace root", async () => {
    const root = {} as Element;
    const documentLike = { fullscreenElement: root, exitFullscreen: vi.fn(async () => undefined) } as unknown as Document;
    expect(workspaceOwnsBrowserFullscreen(documentLike, root)).toBe(true);
    await expect(exitWorkspaceFullscreen(documentLike, root)).resolves.toBe(true);
    expect(documentLike.exitFullscreen).toHaveBeenCalledOnce();
  });

  it("treats browser Escape/fullscreenchange as an internal fullscreen exit", () => {
    const root = {} as Element;
    expect(shouldDeactivateWorkspaceView("frame-1", { fullscreenElement: null } as Document, root)).toBe(true);
    expect(shouldDeactivateWorkspaceView("frame-1", { fullscreenElement: root } as Document, root)).toBe(false);
  });
});
