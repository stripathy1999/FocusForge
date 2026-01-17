import { NextResponse } from "next/server";

import { updateSessionIntent } from "@/lib/store";

export async function POST(request: Request) {
  const body = (await request.json()) as { sessionId?: string; intent?: string };

  if (!body.sessionId || !body.intent) {
    return NextResponse.json(
      { error: "sessionId and intent are required." },
      { status: 400 },
    );
  }

  const session = updateSessionIntent(body.sessionId, body.intent);
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
