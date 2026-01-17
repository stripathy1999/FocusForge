export type EventType = "TAB_ACTIVE" | "PAUSE" | "RESUME" | "STOP";

export type Event = {
  sessionId: string;
  ts: number;
  type: EventType;
  url: string;
  title: string;
};

export type SessionStatus = "running" | "paused" | "ended" | "analyzed";

export type Session = {
  id: string;
  started_at: number;
  ended_at?: number;
  status: SessionStatus;
};

export type TimelineEvent = Event & {
  durationSec?: number;
  domain?: string;
};

export type DomainSummary = {
  domain: string;
  timeSec: number;
  topUrls: string[];
};

export type ComputedSummary = {
  timeline: TimelineEvent[];
  domains: DomainSummary[];
  lastStop?: { url: string; title: string; ts: number };
  resumeSummary: string;
  nextActions: string[];
  pendingDecisions: string[];
};
