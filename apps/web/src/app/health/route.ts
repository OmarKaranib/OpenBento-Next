/**
 * Process liveness for Railway. Public. Must not include secrets, env, or user data.
 */
export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json({ ok: true }, { status: 200 });
}
