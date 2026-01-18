import { corsHeaders, corsJson } from "@/app/api/cors";
import { updateSessionIntent } from "@/lib/store";

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    sessionId?: string;
    intent?: string;
    intent_raw?: string;
  };

  const intentRaw = body.intent_raw ?? body.intent;
  if (!body.sessionId || !intentRaw) {
    return corsJson(
      { error: "sessionId and intent are required." },
      { status: 400 },
    );
  }

  const session = await updateSessionIntent(body.sessionId, intentRaw);
  if (!session) {
    return corsJson({ error: "Session not found." }, { status: 404 });
  }

  return corsJson({ ok: true });
}
