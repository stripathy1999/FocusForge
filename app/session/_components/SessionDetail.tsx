"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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

function buildSessionTitle(
  session: Session,
  computedSummary: ComputedSummary,
): string {
  const startLabel = formatDate(session.started_at);
  const intentTags = (computedSummary.intent_tags ?? []).filter(Boolean);
  const workspaceLabels = computedSummary.domains
    .map((domain) => domain.label)
    .filter(Boolean);
  const focusLabels = (intentTags.length > 0 ? intentTags : workspaceLabels)
    .slice(0, 2)
    .join(" + ");
  const baseTitle = focusLabels ? `${focusLabels} Session` : "Focus Session";
  return `${baseTitle} — ${startLabel}`;
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
  
  // Filter out segments with zero or negative time
  const validSegments = segments.filter((seg) => seg.timeSec > 0);
  const total = validSegments.reduce((s, i) => s + i.timeSec, 0);
  
  if (total <= 0 || validSegments.length === 0) {
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
  let cumulativeAngle = -Math.PI / 2; // Start at top (12 o'clock)

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative h-[140px] w-[140px] shrink-0">
        <svg
          viewBox="0 0 120 120"
          width="140"
          height="140"
          className="h-full w-full"
          role="img"
          aria-label="Time breakdown by category"
          style={{ display: 'block' }}
        >
          {validSegments.map((seg, i) => {
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
            
            // Handle full circle case (single segment or 100% segment)
            let d: string;
            if (Math.abs(fraction - 1) < 0.0001 || validSegments.length === 1) {
              // Full circle - draw complete donut by going almost all the way around
              const a2_adjusted = a1 + 2 * Math.PI - 0.001;
              d =
                `M ${x(a1)} ${y(a1)}` +
                ` A ${R} ${R} 0 1 1 ${x(a2_adjusted)} ${y(a2_adjusted)}` +
                ` L ${xi(a2_adjusted)} ${yi(a2_adjusted)}` +
                ` A ${r} ${r} 0 1 0 ${xi(a1)} ${yi(a1)} Z`;
            } else {
              const large = a2 - a1 >= Math.PI ? 1 : 0;
              d =
                `M ${x(a1)} ${y(a1)}` +
                ` A ${R} ${R} 0 ${large} 1 ${x(a2)} ${y(a2)}` +
                ` L ${xi(a2)} ${yi(a2)}` +
                ` A ${r} ${r} 0 ${large} 0 ${xi(a1)} ${yi(a1)} Z`;
            }
            
            return (
              <path
                key={`${seg.label}-${i}`}
                d={d}
                fill={color}
                stroke="#ffffff"
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
        {validSegments.map((seg, i) => {
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
  const [activeTab, setActiveTab] = useState<"workspaces" | "timeline" | "tasks">("tasks");
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [taskSuggestions, setTaskSuggestions] = useState<string[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [shakeTimelineTab, setShakeTimelineTab] = useState(false);
  const [shakeResumeButton, setShakeResumeButton] = useState(false);
  const [hoveredAlignment, setHoveredAlignment] = useState<{ label: string; pct: number } | null>(null);
  const keyTimeline = showFullTimeline
    ? timeline
    : buildKeyTimeline(timeline, computedSummary.lastStop?.ts);
  const collapsedTimeline = showFullTimeline
    ? []
    : buildCollapsedTimeline(keyTimeline);

  const heuristic = buildHeuristicSummary(computedSummary);
  
  // Opennote export state
  const [exportingJournal, setExportingJournal] = useState(false);
  const [journalUrl, setJournalUrl] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const sessionTitle = buildSessionTitle(session, computedSummary);
  const shortSessionId = session.id.slice(0, 8);

  useEffect(() => {
    const topWorkspaces = computedSummary.domains
      .slice(0, 2)
      .map((domain) => domain.label);
    const entry = {
      id: session.id,
      status: session.status,
      started_at: session.started_at,
      ended_at: session.ended_at,
      durationSec: computedSummary.focus.totalTimeSec,
      topWorkspaces,
    };

    const raw = localStorage.getItem("focusforge_recent_sessions");
    const existing = raw ? (JSON.parse(raw) as typeof entry[]) : [];
    const next = [entry, ...existing.filter((item) => item.id !== entry.id)];
    localStorage.setItem(
      "focusforge_recent_sessions",
      JSON.stringify(next.slice(0, 3)),
    );
  }, [computedSummary, session]);

  // Load tasks when tasks tab is opened
  useEffect(() => {
    if (activeTab === 'tasks' && tasks.length === 0 && !loadingTasks) {
      loadTasks();
    }
  }, [activeTab]);

  const loadTasks = async () => {
    setLoadingTasks(true);
    try {
      const response = await fetch(`/api/session/${session.id}/plan`);
      if (response.ok) {
        const data = await response.json();
        if (data.taskPlan) {
          // Sort tasks by taskOrder if available
          const orderedTasks = data.taskPlan.taskOrder 
            ? data.taskPlan.taskOrder.map((taskId: string) => 
                data.taskPlan.prioritizedTasks.find((t: any) => t.id === taskId)
              ).filter(Boolean)
            : data.taskPlan.prioritizedTasks || [];
          
          setTasks(orderedTasks);
          setTaskSuggestions(data.taskPlan.suggestions || []);
        }
      }
    } catch (error) {
      console.error('Failed to load tasks:', error);
    } finally {
      setLoadingTasks(false);
    }
  };

  const handleReopen = (urls: string[]) => {
    window.postMessage({ type: "FOCUSFORGE_REOPEN", urls }, "*");
    urls.forEach((url) => window.open(url, "_blank", "noopener,noreferrer"));
  };

  const handleExportJournal = async () => {
    setExportingJournal(true);
    setExportError(null);
    try {
      const response = await fetch('/api/opennote/journal/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id }),
      });
      
      // Check if response is JSON before parsing
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Server returned HTML instead of JSON. Response: ${text.substring(0, 200)}`);
      }
      
      const data = await response.json();
      if (response.ok && data.ok) {
        setJournalUrl(data.journalUrl || `https://opennote.com/journal/${data.journalId}`);
      } else {
        setExportError(data.error || data.details || 'Failed to export journal');
      }
    } catch (error: any) {
      setExportError(error.message || 'Failed to export journal');
    } finally {
      setExportingJournal(false);
    }
  };


  return (
    <div 
      className="min-h-screen px-6 py-10 text-zinc-900" 
      style={{ 
        backgroundColor: '#BDE8F5',
        backgroundImage: `
          radial-gradient(circle, rgba(50, 87, 142, 0.2) 1.5px, transparent 1.5px),
          repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255, 255, 255, 0.03) 2px, rgba(255, 255, 255, 0.03) 4px),
          repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0, 0, 0, 0.02) 2px, rgba(0, 0, 0, 0.02) 4px)
        `,
        backgroundSize: "28px 28px, 3px 3px, 3px 3px",
      }}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                Session Detail
              </p>
              <h1 
                className="text-2xl font-semibold"
                style={{ fontFamily: 'var(--font-jura), sans-serif', color: '#32578E' }}
              >
                {sessionTitle}
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-xs" style={{ fontFamily: 'var(--font-lato), sans-serif', color: '#8f8f9f' }}>
                <span>Session ID:</span>
                <button
                  type="button"
                  className="rounded px-2 py-0.5 text-[11px] font-medium cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-105"
                  style={{ 
                    backgroundColor: copiedItem === `session-${session.id}` ? '#22c55e' : '#9ED5FF', 
                    color: copiedItem === `session-${session.id}` ? 'white' : '#32578E',
                    fontFamily: 'var(--font-lato), sans-serif'
                  }}
                  title={copiedItem === `session-${session.id}` ? "Copied!" : "Click to copy session ID"}
                  onClick={() => {
                    navigator.clipboard.writeText(session.id);
                    setCopiedItem(`session-${session.id}`);
                    setTimeout(() => setCopiedItem(null), 2000);
                  }}
                >
                  {copiedItem === `session-${session.id}` ? (
                    <span className="flex items-center gap-1">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 16 16"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        style={{ color: "white" }}
                      >
                        <path
                          d="M3 8L6 11L13 4"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Copied!
                    </span>
                  ) : (
                    shortSessionId
                  )}
                </button>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-zinc-600">
                <span>Status: {session.status}</span>
                <span>Started: {formatDate(session.started_at)}</span>
                <span>Ended: {formatDate(session.ended_at)}</span>
              </div>
            </div>
            <Link
              href="/"
              className="group flex items-center justify-center rounded-lg p-3 text-white shadow-sm transition-all duration-300 hover:opacity-90 hover:scale-110 shrink-0"
              style={{ backgroundColor: '#32578E' }}
              aria-label="Return to home"
            >
              <svg 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                className="transition-transform duration-300 group-hover:rotate-360"
              >
                <path 
                  d="M19 12H5M5 12L12 19M5 12L12 5" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[3fr_2fr]">
          <aside className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col items-center gap-2">
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
            <div className="mt-4 space-y-4 text-base text-zinc-700">
                {session.status === "auto_ended" && (
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                    This session auto-ended after a long period of inactivity.
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-center" style={{ fontFamily: 'var(--font-jura), sans-serif', color: '#32578E' }}>
                    Session Intent
                  </p>
                  {computedSummary.intent_tags.length > 0 ? (
                    <>
                      <div className="mt-2 flex flex-wrap gap-2 justify-center">
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
                    <p className="mt-2 text-base text-zinc-600 text-center">No intent set.</p>
                  )}
                </div>
              <div className="flex flex-col gap-2 mt-4">
                <button
                  type="button"
                  className="cursor-pointer rounded-full px-4 py-2 text-base font-semibold text-white shadow-sm transition-all duration-200 hover:scale-105 hover:shadow-lg hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-sm"
                  style={{ 
                    fontFamily: 'var(--font-jura), sans-serif', 
                    backgroundColor: '#32578E', 
                    borderColor: '#32578E',
                  }}
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
                    Resume Session
                  </span>
                </button>
                
                {/* Opennote Export Buttons */}
                {journalUrl ? (
                  <a
                    href={journalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full px-4 py-2 text-base font-semibold text-white shadow-sm text-center transition-all duration-200 hover:scale-105 hover:shadow-lg hover:opacity-90"
                    style={{ fontFamily: 'var(--font-jura), sans-serif', backgroundColor: '#4777B9', borderColor: '#4777B9' }}
                  >
                    ✅ Exported — Open in Opennote
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={handleExportJournal}
                    disabled={exportingJournal}
                    className="rounded-full px-4 py-2 text-base font-semibold text-white shadow-sm transition-all duration-200 hover:scale-105 hover:shadow-lg hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-sm"
                    style={{ fontFamily: 'var(--font-jura), sans-serif', backgroundColor: '#4777B9', borderColor: '#4777B9' }}
                  >
                    {exportingJournal ? 'Exporting...' : 'Export to Opennote Journal'}
                  </button>
                )}
                
                {exportError && (
                  <p className="text-xs text-red-600 mt-1">{exportError}</p>
                )}
              </div>
              <hr className="border-zinc-200 my-6" />
              {heuristic && (
                <div className="text-sm text-zinc-700">
                    <p className="text-base font-extrabold uppercase tracking-wide" style={{ fontFamily: 'var(--font-jura), sans-serif', color: '#32578E' }}>
                      Focus Recap
                    </p>
                  <div className="mt-4">
                    <p className="text-sm font-bold uppercase tracking-wide mb-2" style={{ fontFamily: 'var(--font-jura), sans-serif', color: '#4988C4' }}>
                      AI Summary
                    </p>
                    <p className="text-base text-zinc-700">{computedSummary.resumeSummary}</p>
                  </div>
                  <div className="mt-2 space-y-2">
                    <p>
                      <span className="font-semibold">You were doing:</span>{" "}
                      {(() => {
                        const doingUrls = computedSummary.domains[0]?.topUrls?.length
                          ? computedSummary.domains[0].topUrls
                          : computedSummary.lastStop?.url
                          ? [computedSummary.lastStop.url!]
                          : null;
                        return doingUrls ? (
                          <button
                            type="button"
                            className="cursor-pointer underline-offset-4 hover:underline"
                            style={{ fontFamily: 'var(--font-jura), sans-serif', color: '#4777B9' }}
                            onClick={() => handleReopen(doingUrls)}
                          >
                            {heuristic.doing}
                          </button>
                        ) : (
                          heuristic.doing
                        );
                      })()}
                    </p>
                    <p>
                      <span className="font-semibold">Where you left off:</span>{" "}
                      {computedSummary.lastStop?.url ? (
                        <button
                          type="button"
                          className="cursor-pointer underline-offset-4 hover:underline"
                          style={{ fontFamily: 'var(--font-jura), sans-serif', color: '#4777B9' }}
                          onClick={() => {
                            if (computedSummary.lastStop?.url) {
                              handleReopen([computedSummary.lastStop.url]);
                            }
                          }}
                        >
                          {heuristic.leftOff}
                        </button>
                      ) : (
                        heuristic.leftOff
                      )}
                    </p>
                  </div>
                  {heuristic.actions.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {heuristic.actions.map((action) => (
                        <button
                          key={action.label}
                          type="button"
                          className="cursor-pointer rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-700 transition-all duration-200 hover:bg-zinc-100 hover:scale-105 hover:shadow-md"
                          onClick={() => handleReopen(action.urls)}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="mt-4">
                    <p className="text-sm font-bold uppercase tracking-wide mb-2" style={{ fontFamily: 'var(--font-jura), sans-serif', color: '#4988C4' }}>
                      Top Pages Visited
                    </p>
                    <ul className="mt-2 list-disc pl-5 text-sm">
                      {(computedSummary.topPages ?? []).length === 0 ? (
                        <li className="text-zinc-600">No pages yet.</li>
                      ) : (
                        (computedSummary.topPages ?? []).map((page) => (
                          <li key={page.url}>
                            <button
                              type="button"
                              className="cursor-pointer truncate text-left underline-offset-4 hover:underline"
                              style={{ fontFamily: 'var(--font-jura), sans-serif', color: '#4777B9' }}
                              title={page.url}
                              onClick={() => handleReopen([page.url])}
                            >
                              {page.title}
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                </div>
              )}
              <hr className="border-zinc-200 my-6" />
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
              <hr className="border-zinc-200 my-6" />
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide" style={{ fontFamily: 'var(--font-jura), sans-serif', color: '#32578E' }}>
                  Intent Alignment
                </p>
                <div className="mt-2 text-sm text-zinc-600">
                  {computedSummary.focus.intentMissing ? (
                    <div className="text-base font-medium text-zinc-600" style={{ fontFamily: 'var(--font-lato), sans-serif' }}>
                      Time split across different activities
                    </div>
                  ) : !computedSummary.focus.tooShort && (
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
                    const roundedPctA = Math.round(pctA);
                    const roundedPctO = Math.round(pctO);
                    const roundedPctN = Math.round(pctN);
                    
                    return (
                      <div className="mt-3 space-y-2.5">
                        <div
                          className="relative min-h-[12px] w-full overflow-hidden rounded-full bg-zinc-200"
                          role="img"
                          aria-label={`Aligned ${formatDuration(a)}, Off-intent ${formatDuration(o)}, Neutral ${formatDuration(n)}`}
                        >
                          {total > 0 ? (
                            <>
                              {a > 0 && (
                                <div
                                  className="absolute left-0 top-0 h-full cursor-pointer transition-opacity hover:opacity-90"
                                  style={{
                                    width: `${pctA}%`,
                                    backgroundColor: "#32578E",
                                    minWidth: pctA < 1 ? "2px" : undefined,
                                  }}
                                  title={`Aligned: ${formatDuration(a)}`}
                                  onMouseEnter={() => setHoveredAlignment({ label: "Aligned", pct: roundedPctA })}
                                  onMouseLeave={() => setHoveredAlignment(null)}
                                />
                              )}
                              {o > 0 && (
                                <div
                                  className="absolute top-0 h-full cursor-pointer transition-opacity hover:opacity-90"
                                  style={{
                                    left: `${pctA}%`,
                                    width: `${pctO}%`,
                                    backgroundColor: "#4a7fc4",
                                    minWidth: pctO < 1 ? "2px" : undefined,
                                  }}
                                  title={`Off-intent: ${formatDuration(o)}`}
                                  onMouseEnter={() => setHoveredAlignment({ label: "Off-intent", pct: roundedPctO })}
                                  onMouseLeave={() => setHoveredAlignment(null)}
                                />
                              )}
                              {n > 0 && (
                                <div
                                  className="absolute top-0 h-full cursor-pointer transition-opacity hover:opacity-90"
                                  style={{
                                    left: `${pctA + pctO}%`,
                                    width: `${pctN}%`,
                                    backgroundColor: "#94a3b8",
                                  }}
                                  title={`Neutral: ${formatDuration(n)}`}
                                  onMouseEnter={() => setHoveredAlignment({ label: "Neutral", pct: roundedPctN })}
                                  onMouseLeave={() => setHoveredAlignment(null)}
                                />
                              )}
                              {hoveredAlignment && (
                                <div
                                  className="pointer-events-none absolute inset-0 flex items-center justify-center"
                                  aria-hidden
                                >
                                  <span className="rounded-md bg-white px-2.5 py-1 text-sm font-medium text-zinc-800 shadow-md ring-1 ring-zinc-200/80">
                                    {hoveredAlignment.label}: {hoveredAlignment.pct}%
                                  </span>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="h-full min-h-[12px] w-full" style={{ backgroundColor: "#9ED5FF" }} />
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
                </div>
              </div>
            </div>
          </aside>

          <div className="flex flex-col gap-6">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              {/* Tab Navigation */}
              <div className="flex items-center justify-between border-b border-zinc-200 pb-4 mb-4">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("tasks")}
                    className={`cursor-pointer w-28 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                      activeTab === "tasks"
                        ? "text-white hover:opacity-90"
                        : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 hover:scale-105"
                    }`}
                    style={{
                      fontFamily: 'var(--font-jura), sans-serif',
                      backgroundColor: activeTab === "tasks" ? '#32578E' : 'transparent',
                    }}
                  >
                    Tasks
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("workspaces")}
                    className={`cursor-pointer w-28 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                      activeTab === "workspaces"
                        ? "text-white hover:opacity-90"
                        : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 hover:scale-105"
                    }`}
                    style={{
                      fontFamily: 'var(--font-jura), sans-serif',
                      backgroundColor: activeTab === "workspaces" ? '#32578E' : 'transparent',
                    }}
                  >
                    Workspaces
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("timeline")}
                    className={`cursor-pointer w-28 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                      activeTab === "timeline"
                        ? "text-white hover:opacity-90"
                        : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 hover:scale-105"
                    }`}
                    style={{
                      fontFamily: 'var(--font-jura), sans-serif',
                      backgroundColor: activeTab === "timeline" ? '#32578E' : 'transparent',
                    }}
                  >
                    Timeline
                  </button>
                </div>
              </div>
              {/* Tab Content */}
              <div>
                {activeTab === "workspaces" && (
                  <div className="flex flex-col gap-4">
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
                              <span
                                className="font-semibold"
                                style={{
                                  fontFamily: "var(--font-jura), sans-serif",
                                  color: "#32578E",
                                  fontWeight: 700,
                                }}
                              >
                                {domain.label}
                              </span>
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
                                  title={url}
                                >
                                  {shortenUrl(url)}
                                </a>
                              ))
                            )}
                          </div>
                          {domain.topUrls.length > 0 && (
                            <button
                              type="button"
                              className="mt-3 inline-flex items-center text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                              style={{
                                fontFamily: "var(--font-jura), sans-serif",
                                color: "#4777B9",
                              }}
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
                )}

                {activeTab === "timeline" && (
                  <div className="flex flex-col gap-4">
                    {!showFullTimeline && (
                      <button
                        type="button"
                        className="cursor-pointer text-xs underline-offset-4 hover:underline"
                        style={{ fontFamily: 'var(--font-jura), sans-serif', color: '#4777B9' }}
                        onClick={() => setShowFullTimeline((value) => !value)}
                      >
                        View full timeline
                      </button>
                    )}
                    {showFullTimeline && (
                      <button
                        type="button"
                        className="cursor-pointer text-xs underline-offset-4 hover:underline"
                        style={{ fontFamily: 'var(--font-jura), sans-serif', color: '#4777B9' }}
                        onClick={() => setShowFullTimeline((value) => !value)}
                      >
                        View key moments
                      </button>
                    )}
                    {keyTimeline.length === 0 ? (
                      <p className="text-sm text-zinc-500">
                        No events recorded yet.
                      </p>
                    ) : showFullTimeline ? (
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
                                <span
                                  className="font-semibold"
                                  style={{
                                    fontFamily: "var(--font-jura), sans-serif",
                                    color: "#32578E",
                                    fontWeight: 700,
                                  }}
                                >
                                  {event.title || "Untitled tab"}
                                </span>
                                <span className="text-sm text-zinc-600">
                                  {formatDate(event.ts)}
                                </span>
                              </div>
                              <div className="mt-1 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 text-xs text-zinc-500">
                                  {event.url ? (
                                    <>
                                      <span className="truncate" title={event.url}>
                                        {shortenUrl(event.url)}
                                      </span>
                                      <button
                                        type="button"
                                        className="cursor-pointer flex-shrink-0 rounded p-1 hover:bg-zinc-200 transition-colors"
                                        title={copiedItem === `url-${event.url}` ? "Copied!" : "Copy URL"}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigator.clipboard.writeText(event.url);
                                          setCopiedItem(`url-${event.url}`);
                                          setTimeout(() => setCopiedItem(null), 2000);
                                        }}
                                      >
                                        {copiedItem === `url-${event.url}` ? (
                                          <svg
                                            width="14"
                                            height="14"
                                            viewBox="0 0 16 16"
                                            fill="none"
                                            xmlns="http://www.w3.org/2000/svg"
                                            style={{ color: "#22c55e" }}
                                          >
                                            <path
                                              d="M3 8L6 11L13 4"
                                              stroke="currentColor"
                                              strokeWidth="1.5"
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                            />
                                          </svg>
                                        ) : (
                                          <svg
                                            width="14"
                                            height="14"
                                            viewBox="0 0 16 16"
                                            fill="none"
                                            xmlns="http://www.w3.org/2000/svg"
                                            style={{ color: "#4777B9" }}
                                          >
                                            <path
                                              d="M5.5 4.5H3.5C2.67157 4.5 2 5.17157 2 6V12.5C2 13.3284 2.67157 14 3.5 14H10C10.8284 14 11.5 13.3284 11.5 12.5V10.5M5.5 4.5C5.5 3.67157 6.17157 3 7 3H11.5C12.3284 3 13 3.67157 13 4.5V9C13 9.82843 12.3284 10.5 11.5 10.5H7C6.17157 10.5 5.5 9.82843 5.5 9V4.5Z"
                                              stroke="currentColor"
                                              strokeWidth="1.2"
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                            />
                                          </svg>
                                        )}
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
                    ) : (
                      collapsedTimeline.map((item) => (
                        <div
                          key={item.key}
                          className={`rounded-xl border border-zinc-100 bg-zinc-50 p-4 transition-all duration-200 ${
                            item.type === "group" && item.url
                              ? "hover:border-[#32578E] hover:bg-white hover:shadow-lg hover:scale-[1.02] hover:-translate-y-0.5"
                              : "hover:border-zinc-200 hover:bg-white hover:shadow-md"
                          }`}
                        >
                          {item.type === "break" ? (
                            <div className="text-xs text-zinc-500">
                              <div className="font-medium text-zinc-700">
                                Break detected ({formatDuration(item.durationSec)}) —
                                not counted
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                <span
                                  className="font-semibold"
                                  style={{
                                    fontFamily: "var(--font-jura), sans-serif",
                                    color: "#32578E",
                                    fontWeight: 700,
                                  }}
                                >
                                  {item.title || "Untitled tab"}
                                </span>
                                <span className="text-sm text-zinc-600">
                                  {formatDate(item.ts)}
                                </span>
                              </div>
                              <div className="mt-1 flex items-center justify-between gap-2 text-xs text-zinc-500">
                                <div className="flex items-center gap-2">
                                  <span>{item.label}</span>
                                  {item.url && (
                                    <button
                                      type="button"
                                      className="cursor-pointer flex-shrink-0 rounded p-1 hover:bg-zinc-200 transition-colors"
                                      title={copiedItem === `url-${item.url}` ? "Copied!" : "Copy URL"}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigator.clipboard.writeText(item.url);
                                        setCopiedItem(`url-${item.url}`);
                                        setTimeout(() => setCopiedItem(null), 2000);
                                      }}
                                    >
                                      {copiedItem === `url-${item.url}` ? (
                                        <svg
                                          width="14"
                                          height="14"
                                          viewBox="0 0 16 16"
                                          fill="none"
                                          xmlns="http://www.w3.org/2000/svg"
                                          style={{ color: "#22c55e" }}
                                        >
                                          <path
                                            d="M3 8L6 11L13 4"
                                            stroke="currentColor"
                                            strokeWidth="1.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                        </svg>
                                      ) : (
                                        <svg
                                          width="14"
                                          height="14"
                                          viewBox="0 0 16 16"
                                          fill="none"
                                          xmlns="http://www.w3.org/2000/svg"
                                          style={{ color: "#4777B9" }}
                                        >
                                          <path
                                            d="M5.5 4.5H3.5C2.67157 4.5 2 5.17157 2 6V12.5C2 13.3284 2.67157 14 3.5 14H10C10.8284 14 11.5 13.3284 11.5 12.5V10.5M5.5 4.5C5.5 3.67157 6.17157 3 7 3H11.5C12.3284 3 13 3.67157 13 4.5V9C13 9.82843 12.3284 10.5 11.5 10.5H7C6.17157 10.5 5.5 9.82843 5.5 9V4.5Z"
                                            stroke="currentColor"
                                            strokeWidth="1.2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                        </svg>
                                      )}
                                    </button>
                                  )}
                                </div>
                                <span>
                                  {item.visits > 1
                                    ? `${item.visits} visits · ${formatDuration(
                                        item.durationSec,
                                      )}`
                                    : `Duration: ${formatDuration(item.durationSec)}`}
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
                )}

                {activeTab === "tasks" && (
                  <div className="flex flex-col gap-4">
                    {loadingTasks ? (
                      <p className="text-sm text-zinc-500">Loading tasks...</p>
                    ) : tasks.length === 0 ? (
                      <p className="text-sm text-zinc-500">
                        No tasks generated yet. Tasks will be generated from your session analysis.
                      </p>
                    ) : (
                      <>
                        {tasks.map((task: any, index: number) => (
                          <div
                            key={task.id || index}
                            className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 transition-all duration-200 hover:border-[#32578E] hover:bg-white hover:shadow-lg"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                  <span className="text-base font-semibold flex-shrink-0" style={{ fontFamily: 'var(--font-jura), sans-serif', color: '#32578E' }}>
                                    {task.title}
                                  </span>
                                  <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border whitespace-nowrap flex-shrink-0 ${
                                    task.priority === 'high' ? 'bg-red-100 text-red-700 border-red-300' :
                                    task.priority === 'medium' ? 'bg-yellow-200 text-yellow-900 border-yellow-400 border-2' :
                                    'bg-blue-100 text-blue-700 border-blue-300'
                                  }`} style={{ fontFamily: 'var(--font-lato), sans-serif' }}>
                                    Priority: {task.priority}
                                  </span>
                                </div>
                                {(task.description || task.reason) && (
                                  <p className="text-sm text-zinc-600 mb-2">
                                    {task.description || task.reason}
                                  </p>
                                )}
                                {task.context && (
                                  <p className="text-xs text-zinc-500 italic">{task.context}</p>
                                )}
                                {task.estimatedTime && (
                                  <p className="text-xs text-zinc-500 mt-2">
                                    Estimated: {task.estimatedTime}
                                  </p>
                                )}
                                {task.dependencies && task.dependencies.length > 0 && (
                                  <p className="text-xs text-zinc-500 mt-1">
                                    Depends on: {task.dependencies.join(', ')}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
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

type CollapsedItem =
  | {
      type: "break";
      key: string;
      durationSec?: number;
    }
  | {
      type: "group";
      key: string;
      ts: number;
      label: string;
      title: string;
      url: string;
      domain?: string;
      visits: number;
      durationSec: number;
    };

function buildCollapsedTimeline(timeline: ComputedSummary["timeline"]): CollapsedItem[] {
  const items: CollapsedItem[] = [];
  const grouped = new Map<string, CollapsedItem>();

  for (const event of timeline) {
    if (event.type === "BREAK") {
      items.push({
        type: "break",
        key: `break-${event.ts}`,
        durationSec: event.durationSec,
      });
      continue;
    }
    const url = event.url ?? "";
    if (!url) {
      continue;
    }
    const key = `${event.domain ?? "unknown"}|${url}`;
    const existing = grouped.get(key);
    if (existing && existing.type === "group") {
      existing.visits += 1;
      existing.durationSec += event.durationSec ?? 0;
      continue;
    }
    const label = event.domain ?? "Tab";
    const entry: CollapsedItem = {
      type: "group",
      key,
      ts: event.ts,
      label,
      title: event.title || "Untitled tab",
      url,
      domain: event.domain,
      visits: 1,
      durationSec: event.durationSec ?? 0,
    };
    grouped.set(key, entry);
    items.push(entry);
  }

  return items;
}

function buildHeuristicSummary(summary: ComputedSummary) {
  const lastStop = summary.lastStop;
  if (!lastStop?.url) {
    return null;
  }

  const leet = extractLeetCodeTitle(lastStop.url);
  const doing = leet
    ? `LeetCode “${leet}”`
    : summary.domains[0]?.label
      ? `${summary.domains[0].label}`
      : "your recent task";
  const leftOff = lastStop.title || lastStop.url;

  const actions: { label: string; urls: string[] }[] = [];
  const nextActions: string[] = [];

  if (leet) {
    actions.push({ label: "Open last problem", urls: [lastStop.url] });
    nextActions.push("Review sliding window approach");
    nextActions.push("Write final solution in Java");
  }

  const docPage = summary.topPages.find((page) =>
    page.domain.includes("docs.google.com"),
  );
  if (docPage) {
    const label = docPage.title || "Open doc";
    actions.push({ label: "Open Opennote doc", urls: [docPage.url] });
    nextActions.push(`Add notes to ${label}`);
  }

  const slidesPage = summary.topPages.find((page) =>
    page.url.includes("/presentation"),
  );
  if (slidesPage) {
    actions.push({ label: "Open hackathon slides", urls: [slidesPage.url] });
  }

  if (nextActions.length === 0) {
    nextActions.push("Review your recent tabs");
    nextActions.push("Continue where you left off");
  }

  return {
    doing,
    leftOff,
    actions,
    nextActions,
  };
}

function extractLeetCodeTitle(url: string): string | null {
  const match = url.match(/leetcode\.com\/problems\/([^/]+)/i);
  if (!match) {
    return null;
  }
  return match[1]
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
