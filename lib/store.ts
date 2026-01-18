import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

import { supabaseAdmin, supabaseEnabled } from "@/lib/supabase";
import { AnalysisResult, Event, Session, SessionStatus } from "@/lib/types";

type StoreData = {
  sessions: Record<string, Session>;
  eventsBySession: Record<string, Event[]>;
  analysisBySession?: Record<string, AnalysisResult>;
};

const STORE_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(STORE_DIR, "store.json");
const USE_MEMORY_ONLY = Boolean(process.env.VERCEL && !supabaseEnabled);

const memoryStore: StoreData = {
  sessions: {},
  eventsBySession: {},
  analysisBySession: {},
};

function loadStore(): StoreData {
  if (USE_MEMORY_ONLY) {
    return memoryStore;
  }
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
  if (USE_MEMORY_ONLY) {
    return;
  }
  fs.mkdirSync(STORE_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
}

export async function createSession(intentRaw?: string): Promise<Session> {
  if (supabaseEnabled && supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from("sessions")
      .insert({
        status: "running",
        goal: intentRaw?.trim() || null,
      })
      .select()
      .single();
    if (error || !data) {
      throw error ?? new Error("Failed to create session");
    }
    return mapSession(data);
  }

  const store = loadStore();
  const id = randomUUID();
  const { intentRaw: cleanedRaw, intentTags } = parseIntent(intentRaw);
  const session: Session = {
    id,
    started_at: Date.now(),
    status: "running",
    intent_raw: cleanedRaw,
    intent_tags: intentTags,
  };

  store.sessions[id] = session;
  store.eventsBySession[id] = [];
  saveStore(store);
  return session;
}

export async function getSession(
  sessionId: string,
): Promise<Session | undefined> {
  if (supabaseEnabled && supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from("sessions")
      .select("*")
      .eq("id", sessionId)
      .maybeSingle();
    if (error || !data) {
      return undefined;
    }
    return mapSession(data);
  }

  const store = loadStore();
  return store.sessions[sessionId];
}

export async function listSessions(): Promise<Session[]> {
  if (supabaseEnabled && supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from("sessions")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(10);
    if (error || !data) {
      return [];
    }
    return data.map(mapSession);
  }

  const store = loadStore();
  return Object.values(store.sessions).sort(
    (a, b) => b.started_at - a.started_at,
  );
}

export async function getEvents(sessionId: string): Promise<Event[]> {
  if (supabaseEnabled && supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from("session_events")
      .select("*")
      .eq("session_id", sessionId)
      .order("ts", { ascending: true });
    if (error || !data) {
      return [];
    }
    return data.map((row) => ({
      sessionId: row.session_id,
      ts: row.ts,
      type: row.type ?? "TAB_ACTIVE",
      url: row.url ?? "",
      title: row.title ?? "",
    }));
  }

  const store = loadStore();
  return store.eventsBySession[sessionId] ?? [];
}

export async function addEvent(event: Event): Promise<void> {
  if (supabaseEnabled && supabaseAdmin) {
    const { error } = await supabaseAdmin.from("session_events").insert({
      session_id: event.sessionId,
      ts: event.ts,
      url: event.url,
      title: event.title,
      type: event.type,
    });
    if (error) {
      throw error;
    }
    return;
  }

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

export async function updateSessionStatus(
  sessionId: string,
  status: SessionStatus,
  endedAt?: number,
): Promise<Session | undefined> {
  if (supabaseEnabled && supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from("sessions")
      .update({
        status: mapStatusToDb(status),
        ended_at: endedAt ? new Date(endedAt).toISOString() : null,
      })
      .eq("id", sessionId)
      .select()
      .single();
    if (error || !data) {
      return undefined;
    }
    return mapSession(data);
  }

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

export async function updateSessionIntent(
  sessionId: string,
  intentRaw: string,
): Promise<Session | undefined> {
  if (supabaseEnabled && supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from("sessions")
      .update({ goal: intentRaw.trim() || null })
      .eq("id", sessionId)
      .select()
      .single();
    if (error || !data) {
      return undefined;
    }
    return mapSession(data);
  }

  const store = loadStore();
  const session = store.sessions[sessionId];
  if (!session) {
    return undefined;
  }
  const { intentRaw: cleanedRaw, intentTags } = parseIntent(intentRaw);
  const updated: Session = {
    ...session,
    intent_raw: cleanedRaw,
    intent_tags: intentTags,
  };
  store.sessions[sessionId] = updated;
  saveStore(store);
  return updated;
}

export async function getAnalysis(
  sessionId: string,
): Promise<AnalysisResult | undefined> {
  if (supabaseEnabled && supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from("analysis")
      .select("summary_json")
      .eq("session_id", sessionId)
      .maybeSingle();
    if (error || !data?.summary_json) {
      return undefined;
    }
    return data.summary_json as AnalysisResult;
  }

  const store = loadStore();
  return store.analysisBySession?.[sessionId];
}

export async function setAnalysis(
  sessionId: string,
  analysis: AnalysisResult,
): Promise<void> {
  if (supabaseEnabled && supabaseAdmin) {
    await supabaseAdmin.from("analysis").upsert({
      session_id: sessionId,
      summary_json: analysis,
    });
    return;
  }

  const store = loadStore();
  store.analysisBySession = store.analysisBySession ?? {};
  store.analysisBySession[sessionId] = analysis;
  saveStore(store);
}

function parseIntent(intentRaw?: string): {
  intentRaw?: string;
  intentTags?: string[];
} {
  if (!intentRaw) {
    return {};
  }
  const raw = intentRaw.trim();
  if (!raw) {
    return {};
  }
  const tags = raw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 5);
  return {
    intentRaw: raw,
    intentTags: tags,
  };
}

function mapSession(row: any): Session {
  const status = mapStatusFromDb(row.status);
  const startedAt = row.started_at
    ? new Date(row.started_at).getTime()
    : Date.now();
  const endedAt = row.ended_at ? new Date(row.ended_at).getTime() : undefined;
  const intentText = row.goal ?? row.intent_text ?? row.raw_context ?? undefined;
  const { intentRaw, intentTags } = parseIntent(intentText ?? undefined);
  return {
    id: row.id,
    started_at: startedAt,
    ended_at: endedAt,
    status,
    intent_raw: intentRaw,
    intent_tags: intentTags ?? [],
  };
}

function mapStatusFromDb(status: string): SessionStatus {
  if (status === "running") {
    return "running";
  }
  if (status === "active") {
    return "running";
  }
  if (status === "paused") {
    return "paused";
  }
  if (status === "auto_ended") {
    return "auto_ended";
  }
  if (status === "analyzed") {
    return "analyzed";
  }
  return "ended";
}

function mapStatusToDb(status: SessionStatus): string {
  if (status === "running") {
    return "running";
  }
  if (status === "paused") {
    return "paused";
  }
  if (status === "auto_ended") {
    return "auto_ended";
  }
  if (status === "analyzed") {
    return "analyzed";
  }
  return "ended";
}
