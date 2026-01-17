import { NextResponse } from "next/server";

import { createSession } from "@/lib/store";

export async function POST(request: Request) {
  let intent: string | undefined;
  try {
    const body = (await request.json()) as { intent?: string };
    intent = body.intent;
  } catch {
    intent = undefined;
  }
  const session = createSession(intent);
  return NextResponse.json({ sessionId: session.id });
}
