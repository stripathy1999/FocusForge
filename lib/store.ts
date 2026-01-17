import { randomUUID } from "crypto";

import { Event, Session, SessionStatus } from "@/lib/types";

const sessions = new Map<string, Session>();
const eventsBySession = new Map<string, Event[]>();

export function createSession(): Session {
  const id = randomUUID();
  const session: Session = {
    id,
    started_at: Date.now(),
    status: "running",
  };

  sessions.set(id, session);
  eventsBySession.set(id, []);
  return session;
}

export function getSession(sessionId: string): Session | undefined {
  return sessions.get(sessionId);
}

export function listSessions(): Session[] {
  return Array.from(sessions.values()).sort(
    (a, b) => b.started_at - a.started_at,
  );
}

export function getEvents(sessionId: string): Event[] {
  return eventsBySession.get(sessionId) ?? [];
}

export function addEvent(event: Event): void {
  if (!sessions.has(event.sessionId)) {
    const session: Session = {
      id: event.sessionId,
      started_at: event.ts,
      status: "running",
    };
    sessions.set(event.sessionId, session);
  }

  const events = eventsBySession.get(event.sessionId) ?? [];
  events.push(event);
  eventsBySession.set(event.sessionId, events);
}

export function updateSessionStatus(
  sessionId: string,
  status: SessionStatus,
  endedAt?: number,
): Session | undefined {
  const session = sessions.get(sessionId);
  if (!session) {
    return undefined;
  }

  const updated: Session = {
    ...session,
    status,
    ended_at: endedAt ?? session.ended_at,
  };
  sessions.set(sessionId, updated);
  return updated;
}
