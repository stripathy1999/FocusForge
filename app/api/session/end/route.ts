import { corsHeaders, corsJson } from "@/app/api/cors";
import { runGeminiAnalysis } from "@/lib/analysis";
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

  const endedAt = Date.now();
  const session = updateSessionStatus(body.sessionId, "ended", endedAt);
  if (!session) {
    return corsJson({ error: "Session not found." }, { status: 404 });
  }

  addEvent({
    sessionId: body.sessionId,
    ts: endedAt,
    type: "STOP",
    url: body.url ?? "",
    title: body.title ?? "",
  });

  try {
    console.info("[Gemini] Triggered for session", body.sessionId);
    await runGeminiAnalysis(body.sessionId);
  } catch {
    // Ignore analysis failures; deterministic summary is the fallback.
    console.warn("[Gemini] Analysis failed for session", body.sessionId);
  }

  return corsJson({ ok: true });
}
