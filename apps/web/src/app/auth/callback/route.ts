import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/server/supabase";

/**
 * Existing @supabase/ssr PKCE callback (email confirm / recovery).
 * Not a second auth system.
 */
export const dynamic = "force-dynamic";

const AUTH_FAILURE_PATH = "/login?error=auth_callback";

export function publicOrigin(requestUrl: URL): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (site) {
    try {
      const configured = new URL(site);
      if (configured.protocol === "http:" || configured.protocol === "https:") {
        return configured.origin;
      }
    } catch {
      // Fall back to the request origin for invalid configuration.
    }
  }
  return requestUrl.origin;
}

export function safeNextPath(raw: string | null): string {
  if (
    !raw ||
    !raw.startsWith("/") ||
    raw.startsWith("//") ||
    raw.includes("\\") ||
    /[\u0000-\u001F\u007F]/.test(raw)
  ) {
    return "/";
  }
  const base = new URL("https://openbento.invalid");
  const resolved = new URL(raw, base);
  if (resolved.origin !== base.origin) {
    return "/";
  }
  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}

function authFailure(origin: string): NextResponse {
  return NextResponse.redirect(new URL(AUTH_FAILURE_PATH, origin));
}

export async function GET(request: Request): Promise<NextResponse> {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeNextPath(requestUrl.searchParams.get("next"));
  const origin = publicOrigin(requestUrl);

  if (!code?.trim()) {
    return authFailure(origin);
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return authFailure(origin);
    }
  } catch {
    return authFailure(origin);
  }

  return NextResponse.redirect(new URL(next, origin));
}
