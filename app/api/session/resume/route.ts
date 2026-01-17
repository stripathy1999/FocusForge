import { NextResponse } from "next/server";

import { addEvent, updateSessionStatus } from "@/lib/store";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    sessionId?: string;
    url?: string;
    title?: string;
  };

  if (!body.sessionId) {
    return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
  }

  const session = updateSessionStatus(body.sessionId, "running");
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  addEvent({
    sessionId: body.sessionId,
    ts: Date.now(),
    type: "RESUME",
    url: body.url ?? "",
    title: body.title ?? "",
  });

  return NextResponse.json({ ok: true });
}
