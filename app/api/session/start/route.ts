import { NextResponse } from "next/server";

import { createSession } from "@/lib/store";

export async function POST(request: Request) {
  let intentRaw: string | undefined;
  try {
    const body = (await request.json()) as { intent?: string; intent_raw?: string };
    intentRaw = body.intent_raw ?? body.intent;
  } catch {
    intentRaw = undefined;
  }
  const session = createSession(intentRaw);
  return NextResponse.json({ sessionId: session.id });
}
