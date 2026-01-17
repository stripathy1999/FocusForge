import { NextResponse } from "next/server";

import { computeSummary } from "@/lib/grouping";
import { getEvents, getSession } from "@/lib/store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const session = getSession(id);

  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  const events = getEvents(id);
  const computedSummary = computeSummary(session, events);

  return NextResponse.json({ session, events, computedSummary });
}
