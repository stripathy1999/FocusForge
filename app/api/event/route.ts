import { corsHeaders, corsJson } from "@/app/api/cors";
import { addEvent, getEvents, getSession, updateSessionStatus } from "@/lib/store";
import { Event } from "@/lib/types";

const IDLE_THRESHOLD_MS = 60 * 1000;
const HARD_BREAK_THRESHOLD_MS = 2 * 60 * 1000;

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<Event>;

  if (!body.sessionId || !body.type || !body.ts) {
    return corsJson(
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

  const session = await getSession(body.sessionId);
  const events = await getEvents(body.sessionId);
  const lastEvent = events.length > 0 ? events[events.length - 1] : undefined;
  const lastRealEvent =
    lastEvent?.type === "BREAK" && events.length > 1
      ? events[events.length - 2]
      : lastEvent;
  if (lastRealEvent) {
    const gapMs = event.ts - lastRealEvent.ts;
    if (gapMs > HARD_BREAK_THRESHOLD_MS && session?.status === "running") {
      await updateSessionStatus(body.sessionId, "auto_ended", lastRealEvent.ts);
      await addEvent({
        sessionId: body.sessionId,
        ts: lastRealEvent.ts,
        type: "STOP",
        url: "",
        title: "Auto-ended due to inactivity",
      });
      return corsJson(
        { error: "Session auto-ended due to inactivity.", autoEnded: true },
        { status: 409 },
      );
    }
    if (gapMs > IDLE_THRESHOLD_MS) {
      await addEvent({
        sessionId: body.sessionId,
        ts: lastRealEvent.ts,
        type: "BREAK",
        url: "",
        title: "Break",
      });
    }
  }

  await addEvent(event);
  return corsJson({ ok: true });
}
