import { NextResponse } from "next/server";

import { computeSummary } from "@/lib/grouping";
import { getAnalysis, getEvents, getSession } from "@/lib/store";

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
  const analysis = getAnalysis(id);
  const computedSummary = computeSummary(session, events, analysis);

  return NextResponse.json({ session, events, computedSummary });
}
