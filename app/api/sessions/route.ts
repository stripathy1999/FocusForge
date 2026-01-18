import { corsHeaders, corsJson } from "@/app/api/cors";
import { computeSummary } from "@/lib/grouping";
import { getEvents, listSessions } from "@/lib/store";

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

type SessionListItem = {
  id: string;
  status: string;
  started_at: number;
  ended_at?: number;
  durationSec: number;
  topWorkspaces: string[];
};

export async function GET() {
  const sessions = (await listSessions()).slice(0, 10);
  const payload: SessionListItem[] = await Promise.all(
    sessions.map(async (session) => {
      const events = await getEvents(session.id);
      const summary = computeSummary(session, events);
      const durationSec = summary.timeline.reduce((total, event) => {
        if (event.type !== "TAB_ACTIVE") {
          return total;
        }
        return total + (event.durationSec ?? 0);
      }, 0);
      const topWorkspaces = summary.domains
        .slice(0, 2)
        .map((domain) => domain.label);

      return {
        id: session.id,
        status: session.status,
        started_at: session.started_at,
        ended_at: session.ended_at,
        durationSec,
        topWorkspaces,
      };
    }),
  );

  return corsJson({ sessions: payload });
}
