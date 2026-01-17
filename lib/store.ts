import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

import { AnalysisResult, Event, Session, SessionStatus } from "@/lib/types";

type StoreData = {
  sessions: Record<string, Session>;
  eventsBySession: Record<string, Event[]>;
  analysisBySession?: Record<string, AnalysisResult>;
};

const STORE_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(STORE_DIR, "store.json");

function loadStore(): StoreData {
  try {
    const raw = fs.readFileSync(STORE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as StoreData;
    return {
      sessions: parsed.sessions ?? {},
      eventsBySession: parsed.eventsBySession ?? {},
      analysisBySession: parsed.analysisBySession ?? {},
    };
  } catch {
    return { sessions: {}, eventsBySession: {}, analysisBySession: {} };
  }
}

function saveStore(store: StoreData): void {
  fs.mkdirSync(STORE_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
}

export function createSession(): Session {
  const store = loadStore();
  const id = randomUUID();
  const session: Session = {
    id,
    started_at: Date.now(),
    status: "running",
  };

  store.sessions[id] = session;
  store.eventsBySession[id] = [];
  saveStore(store);
  return session;
}

export function getSession(sessionId: string): Session | undefined {
  const store = loadStore();
  return store.sessions[sessionId];
}

export function listSessions(): Session[] {
  const store = loadStore();
  return Object.values(store.sessions).sort(
    (a, b) => b.started_at - a.started_at,
  );
}

export function getEvents(sessionId: string): Event[] {
  const store = loadStore();
  return store.eventsBySession[sessionId] ?? [];
}

export function addEvent(event: Event): void {
  const store = loadStore();
  if (!store.sessions[event.sessionId]) {
    const session: Session = {
      id: event.sessionId,
      started_at: event.ts,
      status: "running",
    };
    store.sessions[event.sessionId] = session;
  }

  const events = store.eventsBySession[event.sessionId] ?? [];
  events.push(event);
  store.eventsBySession[event.sessionId] = events;
  saveStore(store);
}

export function updateSessionStatus(
  sessionId: string,
  status: SessionStatus,
  endedAt?: number,
): Session | undefined {
  const store = loadStore();
  const session = store.sessions[sessionId];
  if (!session) {
    return undefined;
  }

  const updated: Session = {
    ...session,
    status,
    ended_at: endedAt ?? session.ended_at,
  };
  store.sessions[sessionId] = updated;
  saveStore(store);
  return updated;
}

export function getAnalysis(sessionId: string): AnalysisResult | undefined {
  const store = loadStore();
  return store.analysisBySession?.[sessionId];
}

export function setAnalysis(
  sessionId: string,
  analysis: AnalysisResult,
): void {
  const store = loadStore();
  store.analysisBySession = store.analysisBySession ?? {};
  store.analysisBySession[sessionId] = analysis;
  saveStore(store);
}
