"use client";

import Link from "next/link";
import { useState } from "react";

import { classifyWorkspace } from "@/lib/classify";
import { ComputedSummary, Session } from "@/lib/types";

type SessionDetailProps = {
  session: Session;
  computedSummary: ComputedSummary;
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(ts?: number) {
  if (!ts) {
    return "—";
  }
  return dateFormatter.format(new Date(ts));
}

function formatDuration(seconds?: number) {
  if (seconds === undefined) {
    return "—";
  }
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s`;
}

function formatEventType(type: string) {
  if (type === "TAB_ACTIVE") {
    return "ACTIVE TAB";
  }
  return type;
}

function shortenUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    let hostname = urlObj.hostname.replace(/^www\./, "");
    let pathname = urlObj.pathname;
    
    // Remove trailing slash
    if (pathname === "/") {
      pathname = "";
    } else {
      // Keep only the first path segment if it exists
      const pathParts = pathname.split("/").filter(Boolean);
      if (pathParts.length > 0) {
        pathname = "/" + pathParts[0];
        // Truncate if the path segment is too long
        if (pathname.length > 20) {
          pathname = pathname.substring(0, 17) + "...";
        }
      }
    }
    
    const shortUrl = hostname + pathname;
    // Truncate entire URL if still too long
    if (shortUrl.length > 40) {
      return shortUrl.substring(0, 37) + "...";
    }
    return shortUrl;
  } catch {
    // If URL parsing fails, just truncate the original
    const cleaned = url.replace(/^https?:\/\//, "").replace(/^www\./, "");
    if (cleaned.length > 40) {
      return cleaned.substring(0, 37) + "...";
    }
    return cleaned;
  }
}

// Theme-aligned blue shades, ordered dark → light for visual distinction
const PIE_COLORS = [
  "#223758", // primary dark
  "#32578E", // primary
  "#3d6ba3",
  "#4777B9", // secondary
  "#669EE6", // light accent
  "#7db3f0",
  "#4a7fc4",
  "#9ED5FF", // primary light
];
const PIE_BREAK_COLOR = "#8b9ca6"; // slate, theme-adjacent

type PieSegment = { label: string; timeSec: number };

function TimeBreakdownPie({
  segments,
  formatDuration,
}: {
  segments: PieSegment[];
  formatDuration: (s?: number) => string;
}) {
  const [hovered, setHovered] = useState<{ label: string; pct: number } | null>(null);
  const total = segments.reduce((s, i) => s + i.timeSec, 0);
  if (total <= 0) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-[140px] w-[140px] items-center justify-center rounded-full bg-zinc-100">
          <span className="text-xs text-zinc-400">No data</span>
        </div>
      </div>
    );
  }

  const cx = 60;
  const cy = 60;
  const R = 52;
  const r = 34;
  const outlineWidth = 2; // outline between segments
  let cumulativeAngle = 0;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative h-[140px] w-[140px] shrink-0">
        <svg
          viewBox="0 0 120 120"
          className="h-full w-full"
          role="img"
          aria-label="Time breakdown by category"
        >
          {segments.map((seg, i) => {
            const fraction = Math.max(0, seg.timeSec / total);
            const pct = total > 0 ? Math.round((seg.timeSec / total) * 100) : 0;
            const a1 = cumulativeAngle;
            const a2 = cumulativeAngle + fraction * 2 * Math.PI;
            cumulativeAngle = a2;
            const isBreak = seg.label.toLowerCase().includes("break");
            const color = isBreak
              ? PIE_BREAK_COLOR
              : PIE_COLORS[i % PIE_COLORS.length];
            const x = (rad: number) => cx + R * Math.cos(rad);
            const y = (rad: number) => cy + R * Math.sin(rad);
            const xi = (rad: number) => cx + r * Math.cos(rad);
            const yi = (rad: number) => cy + r * Math.sin(rad);
            const large = a2 - a1 >= Math.PI ? 1 : 0;
            const d =
              `M ${x(a1)} ${y(a1)}` +
              ` A ${R} ${R} 0 ${large} 1 ${x(a2)} ${y(a2)}` +
              ` L ${xi(a2)} ${yi(a2)}` +
              ` A ${r} ${r} 0 ${large} 0 ${xi(a1)} ${yi(a1)} Z`;
            return (
              <path
                key={`${seg.label}-${i}`}
                d={d}
                fill={color}
                stroke="#e4e4e7"
                strokeWidth={outlineWidth}
                strokeLinejoin="round"
                className="cursor-pointer transition-opacity hover:opacity-90"
                onMouseEnter={() => setHovered({ label: seg.label, pct })}
                onMouseLeave={() => setHovered(null)}
              >
                <title>{`${seg.label}: ${pct}%`}</title>
              </path>
            );
          })}
        </svg>
        {hovered && (
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            aria-hidden
          >
            <span className="rounded-md bg-white px-2.5 py-1 text-sm font-medium text-zinc-800 shadow-md ring-1 ring-zinc-200/80">
              {hovered.label}: {hovered.pct}%
            </span>
          </div>
        )}
      </div>
      <div className="w-full space-y-1.5">
        {segments.map((seg, i) => {
          const isBreak = seg.label.toLowerCase().includes("break");
          const color = isBreak
            ? PIE_BREAK_COLOR
            : PIE_COLORS[i % PIE_COLORS.length];
          return (
            <div
              key={`${seg.label}-${i}`}
              className="flex items-center gap-2 text-sm text-zinc-700"
            >
              <span
                className="h-3 w-3 shrink-0 rounded-sm"
                style={{ backgroundColor: color }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate">{seg.label}</span>
              <span className="shrink-0 text-zinc-500">
                {formatDuration(seg.timeSec)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SessionDetail({ session, computedSummary }: SessionDetailProps) {
  const timeline = computedSummary.timeline.filter(
    (event) => event.type !== "STOP",
  );
  const [showFullTimeline, setShowFullTimeline] = useState(false);
  const keyTimeline = showFullTimeline
    ? timeline
    : buildKeyTimeline(timeline, computedSummary.lastStop?.ts);

  const handleReopen = (urls: string[]) => {
    window.postMessage({ type: "FOCUSFORGE_REOPEN", urls }, "*");
    urls.forEach((url) => window.open(url, "_blank", "noopener,noreferrer"));
  };


  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Session Detail
            </p>
            <h1 
              className="text-2xl font-semibold"
              style={{ fontFamily: 'var(--font-jura), sans-serif', color: '#32578E' }}
            >
              Session {session.id}
            </h1>
            <div className="flex flex-wrap gap-4 text-sm text-zinc-600">
              <span>Status: {session.status}</span>
              <span>Started: {formatDate(session.started_at)}</span>
              <span>Ended: {formatDate(session.ended_at)}</span>
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="flex flex-col gap-6">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 
                className="text-2xl font-semibold"
                style={{ fontFamily: 'var(--font-jura), sans-serif', color: '#32578E' }}
              >
                Workspaces
              </h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {computedSummary.domains.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    No workspace data yet.
                  </p>
                ) : (
                  computedSummary.domains.map((domain) => (
                    <div
                      key={domain.domain}
                      className={`group rounded-xl border border-zinc-100 bg-zinc-50 p-4 transition-all duration-200 ${
                        domain.topUrls.length > 0
                          ? "cursor-pointer hover:border-[#32578E] hover:bg-white hover:shadow-lg hover:scale-[1.02] hover:-translate-y-0.5"
                          : ""
                      }`}
                      onClick={() => {
                        if (domain.topUrls.length > 0) {
                          handleReopen(domain.topUrls);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between text-sm">
                        <div>
                          <span className="font-semibold" style={{ fontFamily: 'var(--font-jura), sans-serif', color: '#32578E', fontWeight: 700 }}>{domain.label}</span>
                        </div>
                        <span className="text-zinc-600">
                          {formatDuration(domain.timeSec)}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-col gap-1 text-xs text-zinc-400">
                        {domain.topUrls.length === 0 ? (
                          <span>No URLs captured.</span>
                        ) : (
                          domain.topUrls.map((url) => (
                            <a
                              key={url}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="truncate underline-offset-4 hover:underline text-zinc-400"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {url}
                            </a>
                          ))
                        )}
                      </div>
                      {domain.topUrls.length > 0 && (
                        <button
                          type="button"
                          className="mt-3 inline-flex items-center text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                          style={{ fontFamily: 'var(--font-jura), sans-serif', color: '#4777B9' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReopen(domain.topUrls);
                          }}
                        >
                          Click to reopen workspace
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 
                  className="text-2xl font-semibold"
                  style={{ fontFamily: 'var(--font-jura), sans-serif', color: '#32578E' }}
                >
                  Timeline
                </h2>
                <button
                  type="button"
                  className="text-xs underline-offset-4 hover:underline"
                  style={{ fontFamily: 'var(--font-jura), sans-serif', color: '#4777B9' }}
                  onClick={() => setShowFullTimeline((value) => !value)}
                >
                  {showFullTimeline ? "Show key moments" : "View full timeline"}
                </button>
              </div>
              <div className="mt-4 flex flex-col gap-4">
                {keyTimeline.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    No events recorded yet.
                  </p>
                ) : (
                  keyTimeline.map((event, index) => (
                    <div
                      key={`${event.ts}-${event.type}-${event.url || ''}-${index}`}
                      className={`rounded-xl border border-zinc-100 bg-zinc-50 p-4 transition-all duration-200 ${
                        event.url && event.type !== "BREAK"
                          ? "hover:border-[#32578E] hover:bg-white hover:shadow-lg hover:scale-[1.02] hover:-translate-y-0.5"
                          : "hover:border-zinc-200 hover:bg-white hover:shadow-md"
                      }`}
                    >
                      {event.type === "BREAK" ? (
                        <div className="text-xs text-zinc-500">
                          <div className="font-medium font-jura text-zinc-700">
                            Break detected ({formatDuration(event.durationSec)}) —
                            not counted
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                            <span className="font-semibold" style={{ fontFamily: 'var(--font-jura), sans-serif', color: '#32578E', fontWeight: 700 }}>
                              {event.title || "Untitled tab"}
                            </span>
                            <span className="text-sm text-zinc-600">{formatDate(event.ts)}</span>
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-xs text-zinc-500">
                              {event.url ? (
                                <>
                                  <span className="truncate" title={event.url}>{shortenUrl(event.url)}</span>
                                  <button
                                    type="button"
                                    className="flex-shrink-0 rounded p-1 hover:bg-zinc-200 transition-colors"
                                    title="Copy URL"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigator.clipboard.writeText(event.url);
                                    }}
                                  >
                                    <svg 
                                      width="14" 
                                      height="14" 
                                      viewBox="0 0 16 16" 
                                      fill="none" 
                                      xmlns="http://www.w3.org/2000/svg"
                                      style={{ color: '#4777B9' }}
                                    >
                                      <path 
                                        d="M5.5 4.5H3.5C2.67157 4.5 2 5.17157 2 6V12.5C2 13.3284 2.67157 14 3.5 14H10C10.8284 14 11.5 13.3284 11.5 12.5V10.5M5.5 4.5C5.5 3.67157 6.17157 3 7 3H11.5C12.3284 3 13 3.67157 13 4.5V9C13 9.82843 12.3284 10.5 11.5 10.5H7C6.17157 10.5 5.5 9.82843 5.5 9V4.5Z" 
                                        stroke="currentColor" 
                                        strokeWidth="1.2" 
                                        strokeLinecap="round" 
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                  </button>
                                </>
                              ) : (
                                <span>No URL</span>
                              )}
                            </div>
                            <span className="text-sm text-zinc-600">
                              Duration: {formatDuration(event.durationSec)}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
                {session.status === "ended" && (
                  <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-500">
                    Session ended {formatDate(session.ended_at)}.
                  </div>
                )}
                {session.status === "auto_ended" && (
                  <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-500">
                    Session auto-ended after inactivity.
                  </div>
                )}
              </div>
            </div>
          </div>

          <aside className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 
                className="text-2xl font-semibold"
                style={{ fontFamily: 'var(--font-jura), sans-serif', color: '#32578E' }}
              >
                Resume Panel
              </h2>
              {computedSummary.aiSummary && (
                <span
                  className="rounded-full bg-purple-100 px-2 py-1 text-[10px] font-semibold font-jura uppercase tracking-wide text-purple-700"
                  title="Generated using Gemini based on session activity (URLs + timing only). No content captured."
                >
                  ✨ AI-generated summary
                </span>
              )}
            </div>
            <div className="mt-4 space-y-6 text-base text-zinc-700">
                {session.status === "auto_ended" && (
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                    This session auto-ended after a long period of inactivity.
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide" style={{ fontFamily: 'var(--font-jura), sans-serif', color: '#32578E' }}>
                    Session Intent
                  </p>
                  {computedSummary.intent_tags.length > 0 ? (
                    <>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {computedSummary.intent_tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border px-2 py-1 text-xs"
                            style={{ fontFamily: 'var(--font-jura), sans-serif', backgroundColor: '#9ED5FF', borderColor: '#9ED5FF', color: '#32578E', fontWeight: 500 }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="mt-2 text-base text-zinc-600">No intent set.</p>
                  )}
                </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  className="rounded-lg px-4 py-2 text-base font-semibold text-white shadow-sm disabled:opacity-60"
                  style={{ fontFamily: 'var(--font-jura), sans-serif', backgroundColor: '#32578E', borderColor: '#32578E' }}
                  onClick={() =>
                    computedSummary.resumeUrls.length
                      ? handleReopen(computedSummary.resumeUrls)
                      : null
                  }
                  disabled={computedSummary.resumeUrls.length === 0}
                >
                  <span className="inline-flex items-center gap-1">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M3 8L6 11L13 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Resume where I left off
                  </span>
                </button>
                <button
                  type="button"
                  className="text-left text-sm underline-offset-4 hover:underline disabled:text-zinc-400 disabled:no-underline"
                  style={{ fontFamily: 'var(--font-jura), sans-serif', color: '#4777B9' }}
                  onClick={() =>
                    computedSummary.lastStop?.url
                      ? handleReopen([computedSummary.lastStop.url])
                      : null
                  }
                  disabled={!computedSummary.lastStop?.url}
                >
                  Open last stop only
                </button>
              </div>
              <p className="rounded-lg bg-zinc-50 px-3 py-2 text-base text-zinc-700">
                {computedSummary.emotionalSummary}
              </p>
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide" style={{ fontFamily: 'var(--font-jura), sans-serif', color: '#32578E' }}>
                  Resume Summary
                </p>
                <p className="mt-2 text-base">{computedSummary.resumeSummary}</p>
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide" style={{ fontFamily: 'var(--font-jura), sans-serif', color: '#32578E' }}>
                  Quick Actions
                </p>
                <div className="mt-2 flex flex-col gap-2 text-sm">
                  <div className="text-zinc-700">
                    Resume:{" "}
                    <button
                      type="button"
                      className="underline-offset-4 hover:underline disabled:text-zinc-400 disabled:no-underline"
                      style={{ fontFamily: 'var(--font-jura), sans-serif', color: '#4777B9' }}
                      onClick={() =>
                        computedSummary.lastStop?.url
                          ? handleReopen([computedSummary.lastStop.url])
                          : null
                      }
                      disabled={!computedSummary.lastStop?.url}
                    >
                      Open last stop tab
                    </button>
                  </div>
                  <div className="text-zinc-700">
                    Continue in:{" "}
                    <button
                      type="button"
                      className="underline-offset-4 hover:underline disabled:text-zinc-400 disabled:no-underline"
                      style={{ fontFamily: 'var(--font-jura), sans-serif', color: '#4777B9' }}
                      onClick={() =>
                        computedSummary.domains[0]?.topUrls?.length
                          ? handleReopen(computedSummary.domains[0].topUrls)
                          : null
                      }
                      disabled={!computedSummary.domains[0]?.topUrls?.length}
                    >
                      {computedSummary.domains[0]?.label ?? "Top"} workspace
                    </button>
                  </div>
                  <div className="rounded-md border border-zinc-200 px-3 py-2 text-zinc-700">
                    <div className="text-sm font-medium font-jura">
                      Review top 3 pages visited
                    </div>
                    <div className="mt-2 space-y-1 text-sm text-zinc-600">
                      {(computedSummary.topPages ?? []).length === 0 ? (
                        <p>No pages yet.</p>
                      ) : (
                        (computedSummary.topPages ?? []).map((page) => (
                          <button
                            key={page.url}
                            type="button"
                            className="block w-full truncate text-left underline-offset-4 hover:underline"
                            style={{ fontFamily: 'var(--font-jura), sans-serif', color: '#4777B9' }}
                            title={page.url}
                            onClick={() => handleReopen([page.url])}
                          >
                            {page.title}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide" style={{ fontFamily: 'var(--font-jura), sans-serif', color: '#32578E' }}>
                  Time Breakdown
                </p>
                <TimeBreakdownPie
                  formatDuration={formatDuration}
                  segments={[
                    ...computedSummary.timeBreakdown,
                    ...(computedSummary.focus.breakTimeSec > 0
                      ? [
                          {
                            label: "Break (not counted)",
                            timeSec: computedSummary.focus.breakTimeSec,
                          },
                        ]
                      : []),
                  ]}
                />
                <div className="mt-2 space-y-1 text-sm text-zinc-600">
                  <div className="flex items-center justify-between">
                    <span>Active time</span>
                    <span>{formatDuration(computedSummary.focus.totalTimeSec)}</span>
                  </div>
                  {computedSummary.focus.breakTimeSec > 0 && (
                    <div className="flex items-center justify-between text-zinc-500">
                      <span>Break time (not counted)</span>
                      <span>
                        {formatDuration(computedSummary.focus.breakTimeSec)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide" style={{ fontFamily: 'var(--font-jura), sans-serif', color: '#32578E' }}>
                  Intent Alignment
                </p>
                <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-600">
                  {computedSummary.focus.intentMissing ? (
                    <div className="text-base font-medium text-zinc-600" style={{ fontFamily: 'var(--font-lato), sans-serif' }}>
                      Time split across different activities
                    </div>
                  ) : computedSummary.focus.tooShort ? (
                    <div className="text-base font-semibold font-jura text-zinc-900">
                      Session too short to assess focus
                    </div>
                  ) : (
                    <div className="text-3xl font-semibold font-jura text-zinc-900">
                      {computedSummary.focus.displayFocusPct}% Aligned
                    </div>
                  )}
                  {(() => {
                    const a = computedSummary.focus.alignedTimeSec;
                    const o = computedSummary.focus.offIntentTimeSec;
                    const n = computedSummary.focus.neutralTimeSec;
                    const total = a + o + n;
                    const pctA = total > 0 ? (a / total) * 100 : 0;
                    const pctO = total > 0 ? (o / total) * 100 : 0;
                    const pctN = total > 0 ? (n / total) * 100 : 100;
                    return (
                      <div className="mt-3 space-y-2.5">
                        <div
                          className="flex min-h-[12px] w-full overflow-hidden rounded-full bg-zinc-200"
                          role="img"
                          aria-label={`Aligned ${formatDuration(a)}, Off-intent ${formatDuration(o)}, Neutral ${formatDuration(n)}`}
                        >
                          {total > 0 ? (
                            <>
                              <div
                                className="h-full shrink-0"
                                style={{
                                  flex: `0 0 ${pctA}%`,
                                  backgroundColor: "#32578E",
                                  minWidth: a > 0 ? "2px" : undefined,
                                }}
                                title={`Aligned: ${formatDuration(a)}`}
                              />
                              <div
                                className="h-full shrink-0"
                                style={{
                                  flex: `0 0 ${pctO}%`,
                                  backgroundColor: "#4a7fc4",
                                  minWidth: o > 0 ? "2px" : undefined,
                                }}
                                title={`Off-intent: ${formatDuration(o)}`}
                              />
                              <div
                                className="h-full shrink-0"
                                style={{
                                  flex: `0 0 ${pctN}%`,
                                  backgroundColor: "#94a3b8",
                                  minWidth: n > 0 ? "2px" : undefined,
                                }}
                                title={`Neutral: ${formatDuration(n)}`}
                              />
                            </>
                          ) : (
                            <div className="h-full min-h-[12px] w-full flex-1" style={{ backgroundColor: "#9ED5FF" }} />
                          )}
                        </div>
                        <div className="flex flex-nowrap gap-x-3 text-xs text-zinc-600">
                          <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap">
                            <span className="h-2 w-2 rounded-sm shrink-0" style={{ backgroundColor: "#32578E" }} />
                            Aligned {formatDuration(a)}
                          </span>
                          <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap">
                            <span className="h-2 w-2 rounded-sm shrink-0" style={{ backgroundColor: "#4a7fc4" }} />
                            Off-intent {formatDuration(o)}
                          </span>
                          <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap">
                            <span className="h-2 w-2 rounded-sm shrink-0" style={{ backgroundColor: "#94a3b8" }} />
                            Neutral {formatDuration(n)}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                  {computedSummary.focus.breakTimeSec > 0 && (
                    <div className="mt-1 text-xs text-zinc-500">
                      Breaks {formatDuration(computedSummary.focus.breakTimeSec)}{" "}
                      — not counted
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {computedSummary.focus.topDriftSources.length === 0 ? (
                      <span className="text-zinc-500">No off-intent tabs.</span>
                    ) : (
                      computedSummary.focus.topDriftSources.map((source) => (
                        <span
                          key={source.domain}
                          className="rounded-full bg-white px-2 py-1 text-xs text-zinc-700 shadow-sm"
                        >
                          {prettyDomain(source.domain)} (
                          {formatDuration(source.timeSec)})
                        </span>
                      ))
                    )}
                  </div>
                  <p className="mt-3 text-xs text-zinc-500">
                    No guilt, this just helps you snap back faster.
                  </p>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide" style={{ fontFamily: 'var(--font-jura), sans-serif', color: '#32578E' }}>
                  Pending Decisions
                </p>
                <ul className="mt-2 list-disc pl-5 text-base">
                  {computedSummary.pendingDecisions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide" style={{ fontFamily: 'var(--font-jura), sans-serif', color: '#32578E' }}>
                  Last Stop
                </p>
                {computedSummary.lastStop ? (
                  <a
                    href={computedSummary.lastStop.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-sm underline-offset-4 hover:underline"
                    style={{ fontFamily: 'var(--font-jura), sans-serif', color: '#4777B9' }}
                  >
                    {computedSummary.lastStop.title ||
                      computedSummary.lastStop.url}
                  </a>
                ) : (
                  <p className="mt-2 text-base text-zinc-500">No last stop recorded.</p>
                )}
              </div>
              <div className="pt-4 text-sm text-zinc-500">
                <Link href="/session/demo" className="underline" style={{ color: '#4777B9' }}>
                  View demo session →
                </Link>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}

function buildKeyTimeline(
  timeline: ComputedSummary["timeline"],
  lastStopTs?: number,
) {
  const meaningful = timeline.filter((event) => {
    if (event.type !== "TAB_ACTIVE") {
      return false;
    }
    const domain = event.domain ?? "unknown";
    return !classifyWorkspace(event.url ?? "", event.title ?? "", domain).ignore;
  });

  if (meaningful.length === 0) {
    return [];
  }

  const first = meaningful[0];
  const lastThree = meaningful.slice(-3);
  const lastStop = lastStopTs
    ? meaningful.find((event) => event.ts === lastStopTs)
    : undefined;

  const selected = [first, ...lastThree, ...(lastStop ? [lastStop] : [])];
  const keys = new Set(
    selected.map((event) => `${event.ts}-${event.url ?? ""}`),
  );

  return timeline.filter((event) =>
    keys.has(`${event.ts}-${event.url ?? ""}`),
  );
}

function prettyDomain(domain: string) {
  const map: Record<string, string> = {
    "youtube.com": "YouTube",
    "music.youtube.com": "YouTube Music",
    "reddit.com": "Reddit",
    "instagram.com": "Instagram",
    "x.com": "X",
    "twitter.com": "Twitter",
    "tiktok.com": "TikTok",
    "netflix.com": "Netflix",
  };

  return map[domain] ?? domain;
}
