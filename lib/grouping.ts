import { ComputedSummary, DomainSummary, Event, Session, TimelineEvent } from "@/lib/types";

const DEFAULT_RESUME_SUMMARY =
  "Resume insights will appear here once analysis is enabled.";

export function computeSummary(
  session: Session,
  events: Event[],
): ComputedSummary {
  const sorted = [...events].sort((a, b) => a.ts - b.ts);
  const timeline = addDurations(session, sorted);
  const domains = summarizeDomains(timeline);
  const lastStop = [...timeline]
    .reverse()
    .find((event) => event.type === "TAB_ACTIVE");

  return {
    timeline,
    domains,
    lastStop: lastStop
      ? { url: lastStop.url, title: lastStop.title, ts: lastStop.ts }
      : undefined,
    resumeSummary: DEFAULT_RESUME_SUMMARY,
    nextActions: ["(placeholder) Capture next actions after analysis."],
    pendingDecisions: ["(placeholder) Capture pending decisions after analysis."],
  };
}

function addDurations(session: Session, events: Event[]): TimelineEvent[] {
  const timeline: TimelineEvent[] = [];
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const entry: TimelineEvent = { ...event };

    if (event.type === "TAB_ACTIVE") {
      const nextEvent = events[index + 1];
      const durationMs = nextEvent
        ? nextEvent.ts - event.ts
        : resolveTailDuration(session, event.ts);
      entry.durationSec = Math.max(0, Math.round(durationMs / 1000));
      entry.domain = safeDomain(event.url);
    }

    timeline.push(entry);
  }
  return timeline;
}

function resolveTailDuration(session: Session, lastTs: number): number {
  if (session.status === "ended" && session.ended_at) {
    const diffMs = session.ended_at - lastTs;
    const diffSec = diffMs / 1000;
    const clamped = Math.min(60, Math.max(10, diffSec));
    return clamped * 1000;
  }

  return 30 * 1000;
}

function summarizeDomains(timeline: TimelineEvent[]): DomainSummary[] {
  const domainMap = new Map<string, DomainSummary>();
  const urlRecency = new Map<string, string[]>();

  for (const event of timeline) {
    if (event.type !== "TAB_ACTIVE") {
      continue;
    }

    const domain = event.domain ?? safeDomain(event.url);
    const duration = event.durationSec ?? 0;
    const summary = domainMap.get(domain) ?? {
      domain,
      timeSec: 0,
      topUrls: [],
    };
    summary.timeSec += duration;
    domainMap.set(domain, summary);

    const existing = urlRecency.get(domain) ?? [];
    if (event.url && !existing.includes(event.url)) {
      existing.unshift(event.url);
    }
    urlRecency.set(domain, existing);
  }

  for (const [domain, summary] of domainMap.entries()) {
    const urls = urlRecency.get(domain) ?? [];
    summary.topUrls = urls.slice(0, 5);
  }

  return Array.from(domainMap.values()).sort(
    (a, b) => b.timeSec - a.timeSec,
  );
}

function safeDomain(url: string): string {
  if (!url) {
    return "unknown";
  }

  try {
    return new URL(url).hostname || "unknown";
  } catch {
    return "unknown";
  }
}
