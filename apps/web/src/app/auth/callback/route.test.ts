import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => {
  const exchangeCodeForSession = vi.fn();
  const createServerSupabaseClient = vi.fn(async () => ({
    auth: { exchangeCodeForSession },
  }));
  return { createServerSupabaseClient, exchangeCodeForSession };
});

vi.mock("@/server/supabase", () => ({
  createServerSupabaseClient: authMocks.createServerSupabaseClient,
}));

import { GET, publicOrigin, safeNextPath } from "./route";

function redirectLocation(response: Response): URL {
  const location = response.headers.get("location");
  if (!location) {
    throw new Error("expected redirect location");
  }
  return new URL(location);
}

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  authMocks.createServerSupabaseClient.mockClear();
  authMocks.exchangeCodeForSession.mockReset();
  authMocks.exchangeCodeForSession.mockResolvedValue({
    data: { session: { access_token: "fixture-only" } },
    error: null,
  });
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
});

describe("auth callback", () => {
  it("redirects to the safe next path after a successful code exchange", async () => {
    const response = await GET(
      new Request(
        "https://request.example/auth/callback?code=valid-code&next=%2Fcanvas%3Fview%3Dactive",
      ),
    );

    expect(authMocks.exchangeCodeForSession).toHaveBeenCalledWith("valid-code");
    expect(redirectLocation(response).href).toBe(
      "https://request.example/canvas?view=active",
    );
  });

  it("treats an exchangeCodeForSession error as authentication failure", async () => {
    authMocks.exchangeCodeForSession.mockResolvedValue({
      data: { session: null },
      error: { message: "invalid code" },
    });

    const response = await GET(
      new Request(
        "https://request.example/auth/callback?code=bad-code&next=%2Fcanvas",
      ),
    );

    expect(authMocks.exchangeCodeForSession).toHaveBeenCalledWith("bad-code");
    expect(redirectLocation(response).href).toBe(
      "https://request.example/login?error=auth_callback",
    );
    expect(redirectLocation(response).pathname).not.toBe("/canvas");
  });

  it("fails safely when the callback code is missing or malformed", async () => {
    const missing = await GET(
      new Request("https://request.example/auth/callback?next=%2Fcanvas"),
    );
    expect(redirectLocation(missing).href).toBe(
      "https://request.example/login?error=auth_callback",
    );
    expect(authMocks.createServerSupabaseClient).not.toHaveBeenCalled();

    authMocks.exchangeCodeForSession.mockResolvedValue({
      data: { session: null },
      error: { message: "malformed code" },
    });
    const malformed = await GET(
      new Request("https://request.example/auth/callback?code=%25%25%25"),
    );
    expect(redirectLocation(malformed).href).toBe(
      "https://request.example/login?error=auth_callback",
    );
  });

  it("fails closed when the exchange throws", async () => {
    authMocks.exchangeCodeForSession.mockRejectedValue(new Error("unavailable"));

    const response = await GET(
      new Request("https://request.example/auth/callback?code=valid-code"),
    );

    expect(redirectLocation(response).href).toBe(
      "https://request.example/login?error=auth_callback",
    );
  });

  it("keeps unsafe next values on the allowed origin", async () => {
    for (const next of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
    ]) {
      const requestUrl = new URL("https://request.example/auth/callback");
      requestUrl.searchParams.set("code", "valid-code");
      requestUrl.searchParams.set("next", next);
      const response = await GET(new Request(requestUrl));
      expect(redirectLocation(response).href).toBe("https://request.example/");
    }
  });
});

describe("auth callback redirect helpers", () => {
  it("uses a valid NEXT_PUBLIC_SITE_URL origin and ignores its path", () => {
    process.env.NEXT_PUBLIC_SITE_URL =
      "https://example.up.railway.app/configured/path";
    expect(publicOrigin(new URL("http://localhost:3000/auth/callback"))).toBe(
      "https://example.up.railway.app",
    );
  });

  it("falls back to the request origin for invalid public-site configuration", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "javascript:alert(1)";
    expect(publicOrigin(new URL("https://request.example/auth/callback"))).toBe(
      "https://request.example",
    );
  });

  it("rejects open-redirect representations", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath("/canvas")).toBe("/canvas");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath("https://evil.example")).toBe("/");
  });
});
