import {
  ComputedSummary,
  AnalysisResult,
  BackgroundSummary,
  DomainSummary,
  Event,
  Session,
  TimelineEvent,
  TopPage,
  TimeBreakdownItem,
} from "@/lib/types";

const DEFAULT_RESUME_SUMMARY =
  "Resume insights will appear here once analysis is enabled.";

const DOMAIN_LABELS: Record<string, string> = {
  "leetcode.com": "Interview Prep",
  "educative.io": "System Design",
  "hellointerview.com": "System Design",
  "docs.google.com": "Docs/Writing",
  "linkedin.com": "Job Search",
  "youtube.com": "Learning",
};

const IGNORE_DOMAIN_SUBSTRINGS = [
  "accounts.google.com",
  "oauth",
  "consent",
  "login",
];

const DOMAIN_ACTIONS: Record<string, string> = {
  "leetcode.com": "Continue LeetCode practice",
  "educative.io": "Continue system design prep",
  "hellointerview.com": "Continue system design prep",
  "docs.google.com": "Resume writing in Google Docs",
  "linkedin.com": "Review roles and shortlist applications",
};

export function computeSummary(
  session: Session,
  events: Event[],
  analysis?: AnalysisResult | null,
): ComputedSummary {
  const sorted = [...events].sort((a, b) => a.ts - b.ts);
  const timeline = addDurations(session, sorted);
  const { domains, background } = summarizeDomains(timeline);
  const recentEntries = getRecentEntries(timeline);
  const topPages = getTopPages(timeline, 3);
  const lastStop = [...timeline]
    .reverse()
    .find((event) => event.type === "TAB_ACTIVE");
  const topDomain = domains[0];
  const lastStopLabel = lastStop?.title || lastStop?.url || "your last tab";
  const fallbackResumeSummary = topDomain
    ? `You spent most time on ${topDomain.domain} and last stopped at ${lastStopLabel}.`
    : DEFAULT_RESUME_SUMMARY;
  const fallbackNextActions = topDomain
    ? [
        "Resume: Open last stop tab",
        `Continue in: ${topDomain.label} workspace`,
        "Review top 3 pages visited",
      ]
    : ["(placeholder) Capture next actions after analysis."];
  const timeBreakdown = buildTimeBreakdown(domains, background?.timeSec ?? 0);

  return {
    timeline,
    domains,
    background,
    timeBreakdown,
    topPages,
    lastStop: lastStop
      ? { url: lastStop.url, title: lastStop.title, ts: lastStop.ts }
      : undefined,
    resumeSummary: analysis?.resumeSummary ?? fallbackResumeSummary,
    nextActions: analysis?.nextActions?.length
      ? analysis.nextActions
      : fallbackNextActions,
    pendingDecisions: analysis?.pendingDecisions ?? [],
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

function summarizeDomains(timeline: TimelineEvent[]): {
  domains: DomainSummary[];
  background?: BackgroundSummary;
} {
  const domainMap = new Map<string, DomainSummary>();
  const urlRecency = new Map<string, string[]>();
  let backgroundTimeSec = 0;
  const backgroundUrls: string[] = [];
  const backgroundDomains = new Set<string>();

  for (const event of timeline) {
    if (event.type !== "TAB_ACTIVE") {
      continue;
    }

    const domain = event.domain ?? safeDomain(event.url);
    if (isIgnoredDomain(domain)) {
      backgroundTimeSec += event.durationSec ?? 0;
      backgroundDomains.add(domain);
      if (event.url && !backgroundUrls.includes(event.url)) {
        backgroundUrls.unshift(event.url);
      }
      continue;
    }
    const duration = event.durationSec ?? 0;
    const summary = domainMap.get(domain) ?? {
      domain,
      label: domainLabel(domain),
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

  const domains = Array.from(domainMap.values()).sort(
    (a, b) => b.timeSec - a.timeSec,
  );
  const background =
    backgroundTimeSec > 0
      ? {
          label: "Background/Auth",
          timeSec: backgroundTimeSec,
          topUrls: backgroundUrls.slice(0, 5),
          domains: Array.from(backgroundDomains),
        }
      : undefined;
  return { domains, background };
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

function domainLabel(domain: string): string {
  return DOMAIN_LABELS[domain] ?? domain;
}

function isIgnoredDomain(domain: string): boolean {
  return IGNORE_DOMAIN_SUBSTRINGS.some((value) => domain.includes(value));
}

function getRecentEntries(
  timeline: TimelineEvent[],
): Map<string, { title?: string; url?: string }> {
  const map = new Map<string, { title?: string; url?: string }>();
  for (const event of [...timeline].reverse()) {
    if (event.type !== "TAB_ACTIVE") {
      continue;
    }
    const domain = event.domain ?? safeDomain(event.url);
    if (isIgnoredDomain(domain)) {
      continue;
    }
    if (!map.has(domain)) {
      map.set(domain, { title: event.title, url: event.url });
    }
  }
  return map;
}

function formatAction(
  domain: string,
  label: string,
  timeSec: number,
  entry?: { title?: string; url?: string },
): string {
  if (domain === "docs.google.com" && entry?.url?.includes("/forms")) {
    return "Finish the form you opened";
  }
  if (domain === "youtube.com" && timeSec < 90) {
    return "Background media";
  }
  if (domain in DOMAIN_ACTIONS) {
    const base = DOMAIN_ACTIONS[domain];
    return entry?.title ? `${base}: ${entry.title}` : base;
  }
  if (entry?.title) {
    return `Continue ${label}: ${entry.title}`;
  }
  return `Resume ${label}`;
}

function buildTimeBreakdown(
  domains: DomainSummary[],
  backgroundTimeSec: number,
): TimeBreakdownItem[] {
  const items: TimeBreakdownItem[] = domains.map((domain) => ({
    label: domain.label,
    timeSec: domain.timeSec,
  }));
  if (backgroundTimeSec > 0) {
    items.push({ label: "Background", timeSec: backgroundTimeSec });
  }
  return items.slice(0, 4);
}

function getTopPages(timeline: TimelineEvent[], limit: number): TopPage[] {
  const pages: TopPage[] = [];
  const seen = new Set<string>();
  for (const event of [...timeline].reverse()) {
    if (event.type !== "TAB_ACTIVE") {
      continue;
    }
    const domain = event.domain ?? safeDomain(event.url);
    if (isIgnoredDomain(domain)) {
      continue;
    }
    if (!event.url || seen.has(event.url)) {
      continue;
    }
    seen.add(event.url);
    pages.push({
      url: event.url,
      title: event.title || event.url,
      domain,
    });
    if (pages.length >= limit) {
      break;
    }
  }
  return pages;
}
