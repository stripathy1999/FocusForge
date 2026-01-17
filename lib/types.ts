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
  intent?: string;
};

export type TimelineEvent = Event & {
  durationSec?: number;
  domain?: string;
};

export type DomainSummary = {
  domain: string;
  label: string;
  type: "primary" | "support" | "drift";
  timeSec: number;
  topUrls: string[];
};

export type BackgroundSummary = {
  label: string;
  timeSec: number;
  topUrls: string[];
  domains: string[];
};

export type TimeBreakdownItem = {
  label: string;
  timeSec: number;
};

export type TopPage = {
  url: string;
  title: string;
  domain: string;
};

export type AnalysisResult = {
  source: "gemini";
  resumeSummary: string;
  nextActions: string[];
  pendingDecisions: string[];
};

export type ComputedSummary = {
  timeline: TimelineEvent[];
  domains: DomainSummary[];
  background?: BackgroundSummary;
  timeBreakdown: TimeBreakdownItem[];
  topPages: TopPage[];
  lastStop?: { url: string; title: string; ts: number; label?: string };
  resumeUrls: string[];
  focus: {
    totalTimeSec: number;
    alignedTimeSec: number;
    offIntentTimeSec: number;
    neutralTimeSec: number;
    focusScorePct: number;
    displayFocusPct: number | null;
    tooShort: boolean;
    intentMissing: boolean;
    topDriftSources: { domain: string; timeSec: number }[];
  };
  intent: string | null;
  emotionalSummary: string;
  aiSummary: boolean;
  resumeSummary: string;
  nextActions: string[];
  pendingDecisions: string[];
};
