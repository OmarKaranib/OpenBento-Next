import { NextResponse, type NextRequest } from "next/server";
import {
  LOCAL_DEV_SESSION_COOKIE,
  localDevSessionCookieOptions,
  mintLocalDevOwnerId,
} from "./server/session";

/**
 * Server-side local/dev session. The browser never chooses ownerId.
 * Hosted Supabase Auth is a later adapter — this does not create a project.
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const existing = request.cookies.get(LOCAL_DEV_SESSION_COOKIE)?.value;
  if (!existing) {
    response.cookies.set({
      name: LOCAL_DEV_SESSION_COOKIE,
      value: mintLocalDevOwnerId(),
      ...localDevSessionCookieOptions(),
    });
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
