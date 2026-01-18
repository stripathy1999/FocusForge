import { corsHeaders, corsJson } from "@/app/api/cors";
import { addEvent, updateSessionStatus } from "@/lib/store";

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    sessionId?: string;
    url?: string;
    title?: string;
  };

  if (!body.sessionId) {
    return corsJson({ error: "sessionId is required." }, { status: 400 });
  }

  const session = await updateSessionStatus(body.sessionId, "paused");
  if (!session) {
    return corsJson({ error: "Session not found." }, { status: 404 });
  }

  await addEvent({
    sessionId: body.sessionId,
    ts: Date.now(),
    type: "PAUSE",
    url: body.url ?? "",
    title: body.title ?? "",
  });

  return corsJson({ ok: true });
}
