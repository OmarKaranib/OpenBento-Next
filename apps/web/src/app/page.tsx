import { WorkspaceApp } from "@/components/workspace/WorkspaceApp";

/**
 * Authenticated workspace is client-rendered from the session.
 * Force-dynamic so anonymous/permanent user shells are never statically
 * cached across visitors (Supabase anonymous Auth + static rendering risk).
 */
export const dynamic = "force-dynamic";

export default function Home() {
  return <WorkspaceApp />;
}
