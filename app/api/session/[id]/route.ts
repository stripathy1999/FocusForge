import { corsHeaders, corsJson } from "@/app/api/cors";
import { computeSummary } from "@/lib/grouping";
import { getAnalysis, getEvents, getSession } from "@/lib/store";

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const session = await getSession(id);

  if (!session) {
    return corsJson({ error: "Session not found." }, { status: 404 });
  }

  const events = await getEvents(id);
  const analysis = await getAnalysis(id);
  const computedSummary = computeSummary(session, events, analysis);

  return corsJson({ session, events, computedSummary });
}
