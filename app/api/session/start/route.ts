import { corsHeaders, corsJson } from "@/app/api/cors";
import { createSession } from "@/lib/store";

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  let intentRaw: string | undefined;
  try {
    const body = (await request.json()) as { intent?: string; intent_raw?: string };
    intentRaw = body.intent_raw ?? body.intent;
  } catch {
    intentRaw = undefined;
  }
  const session = await createSession(intentRaw);
  return corsJson({ sessionId: session.id });
}
