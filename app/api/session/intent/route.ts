import { NextResponse } from "next/server";

import { updateSessionIntent } from "@/lib/store";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    sessionId?: string;
    intent?: string;
    intent_raw?: string;
  };

  const intentRaw = body.intent_raw ?? body.intent;
  if (!body.sessionId || !intentRaw) {
    return NextResponse.json(
      { error: "sessionId and intent are required." },
      { status: 400 },
    );
  }

  const session = updateSessionIntent(body.sessionId, intentRaw);
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
