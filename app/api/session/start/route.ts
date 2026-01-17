import { NextResponse } from "next/server";

import { createSession } from "@/lib/store";

export async function POST() {
  const session = createSession();
  return NextResponse.json({ sessionId: session.id });
}
