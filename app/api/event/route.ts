import { NextResponse } from "next/server";

import { addEvent } from "@/lib/store";
import { Event } from "@/lib/types";

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<Event>;

  if (!body.sessionId || !body.type || !body.ts) {
    return NextResponse.json(
      { error: "sessionId, type, and ts are required." },
      { status: 400 },
    );
  }

  const event: Event = {
    sessionId: body.sessionId,
    ts: body.ts,
    type: body.type,
    url: body.url ?? "",
    title: body.title ?? "",
  };

  addEvent(event);
  return NextResponse.json({ ok: true });
}
