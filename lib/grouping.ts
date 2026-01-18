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
import { classifyWorkspace } from "@/lib/classify";

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
  const breakTimeSec = timeline
    .filter((event) => event.type === "BREAK")
    .reduce((sum, event) => sum + (event.durationSec ?? 0), 0);
  const focus = buildFocusSummary(
    domains,
    session.intent_tags ?? [],
    breakTimeSec,
  );
  const resumeUrls = buildResumeUrls(lastStop, domains);
  const lastStopDomain = lastStop?.domain ?? safeDomain(lastStop?.url ?? "");
  const lastStopWorkspace = domains.find((domain) => domain.domain === lastStopDomain);

  return {
    timeline,
    domains,
    background,
    timeBreakdown,
    topPages,
    lastStop: lastStop
      ? {
          url: lastStop.url,
          title: lastStop.title,
          ts: lastStop.ts,
          label: lastStopWorkspace?.label,
        }
      : undefined,
    resumeUrls,
    focus,
    intent_raw: session.intent_raw ?? null,
    intent_tags: session.intent_tags ?? [],
    emotionalSummary: buildEmotionalSummary(domains),
    aiSummary: analysis?.source === "gemini",
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

    if (event.type === "TAB_ACTIVE" || event.type === "BREAK") {
      const nextEvent = events[index + 1];
      const durationMs = nextEvent
        ? nextEvent.ts - event.ts
        : resolveTailDuration(session, event.ts);
      entry.durationSec = Math.max(0, Math.round(durationMs / 1000));
      if (event.type === "TAB_ACTIVE") {
        entry.domain = safeDomain(event.url);
      }
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
    const classification = classifyWorkspace(event.url, event.title, domain);
    if (classification.ignore) {
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
      type: classification.type,
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

function getRecentEntries(
  timeline: TimelineEvent[],
): Map<string, { title?: string; url?: string }> {
  const map = new Map<string, { title?: string; url?: string }>();
  for (const event of [...timeline].reverse()) {
    if (event.type !== "TAB_ACTIVE") {
      continue;
    }
    const domain = event.domain ?? safeDomain(event.url);
    if (classifyWorkspace(event.url, event.title, domain).ignore) {
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

function buildEmotionalSummary(domains: DomainSummary[]): string {
  const first = domains[0];
  const second = domains[1];
  if (!first) {
    return "You were in the middle of something important — want to continue?";
  }
  const label = first.label.toLowerCase();
  if (label.includes("job")) {
    return "Looks like you were job hunting and comparing roles.";
  }
  if (label.includes("interview") || label.includes("system design")) {
    return "You were deep in prep mode — want to pick up where you left off?";
  }
  if (label.includes("docs") || label.includes("writing")) {
    return "You were drafting something important — want to continue?";
  }
  if (second) {
    return `You were switching between ${first.label} and ${second.label} — want to pick one to resume?`;
  }
  return "You were in the middle of something important — want to continue?";
}

function getTopPages(timeline: TimelineEvent[], limit: number): TopPage[] {
  const pages: TopPage[] = [];
  const seen = new Set<string>();
  for (const event of [...timeline].reverse()) {
    if (event.type !== "TAB_ACTIVE") {
      continue;
    }
    const domain = event.domain ?? safeDomain(event.url);
    if (classifyWorkspace(event.url, event.title, domain).ignore) {
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

function buildFocusSummary(
  domains: DomainSummary[],
  intentTags: string[],
  breakTimeSec: number,
) {
  const totalTimeSec = domains.reduce((sum, domain) => sum + domain.timeSec, 0);
  const intentMissing = intentTags.length === 0;
  const alignedTimeSec = domains
    .filter((domain) => alignmentForDomain(intentTags, domain) === "aligned")
    .reduce((sum, domain) => sum + domain.timeSec, 0);
  const neutralTimeSec = domains
    .filter((domain) => alignmentForDomain(intentTags, domain) === "neutral")
    .reduce((sum, domain) => sum + domain.timeSec, 0);
  const offIntentTimeSec = domains
    .filter((domain) => alignmentForDomain(intentTags, domain) === "off-intent")
    .reduce((sum, domain) => sum + domain.timeSec, 0);
  const focusScorePct =
    totalTimeSec > 0 ? Math.round((alignedTimeSec / totalTimeSec) * 100) : 0;
  const tooShort = totalTimeSec < 300;
  const displayFocusPct = tooShort || intentMissing
    ? null
    : Math.max(25, Math.min(focusScorePct, 95));
  const topDriftSources = domains
    .filter((domain) => alignmentForDomain(intentTags, domain) === "off-intent")
    .sort((a, b) => b.timeSec - a.timeSec)
    .slice(0, 3)
    .map((domain) => ({ domain: domain.domain, timeSec: domain.timeSec }));

  return {
    totalTimeSec,
    alignedTimeSec,
    offIntentTimeSec,
    neutralTimeSec,
    breakTimeSec,
    focusScorePct,
    displayFocusPct,
    tooShort,
    intentMissing,
    topDriftSources,
  };
}

function alignmentForDomain(
  intentTags: string[],
  domain: DomainSummary,
): "aligned" | "neutral" | "off-intent" {
  if (intentTags.length === 0) {
    return "neutral";
  }

  const normalized = intentTags.join(" ").toLowerCase();
  const mode = inferIntentMode(normalized);

  if (mode === "relax") {
    if (domain.type === "drift") {
      return "aligned";
    }
    if (domain.type === "primary") {
      return "off-intent";
    }
    return "neutral";
  }

  if (mode === "content") {
    if (domain.domain === "youtube.com" || domain.domain === "music.youtube.com") {
      return "aligned";
    }
    if (domain.domain === "netflix.com") {
      return "off-intent";
    }
    return "neutral";
  }

  if (domain.type === "primary") {
    return "aligned";
  }
  if (domain.type === "drift") {
    return "off-intent";
  }
  return "neutral";
}

function inferIntentMode(intent: string): "relax" | "content" | "general" {
  const relaxHints = ["relax", "unwind", "break", "chill", "rest"];
  const contentHints = ["video", "edit", "youtube", "content", "stream"];

  if (relaxHints.some((hint) => intent.includes(hint))) {
    return "relax";
  }
  if (contentHints.some((hint) => intent.includes(hint))) {
    return "content";
  }
  return "general";
}

function buildResumeUrls(
  lastStop: TimelineEvent | undefined,
  domains: DomainSummary[],
): string[] {
  if (!lastStop?.url) {
    return [];
  }
  const domain = lastStop.domain ?? safeDomain(lastStop.url);
  const workspace = domains.find((entry) => entry.domain === domain);
  const urls = workspace?.topUrls ?? [];
  const filtered = urls.filter((url) => url !== lastStop.url);
  return [lastStop.url, ...filtered.slice(0, 2)];
}
