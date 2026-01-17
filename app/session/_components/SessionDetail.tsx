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

export function SessionDetail({ session, computedSummary }: SessionDetailProps) {
  const timeline = computedSummary.timeline.filter(
    (event) => event.type !== "STOP",
  );
  const [showBackground, setShowBackground] = useState(false);
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
              style={{ fontFamily: 'var(--font-jura), sans-serif', color: '#2BB7D0' }}
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
              <div className="flex items-center justify-between">
                <h2 
                  className="text-lg font-semibold"
                  style={{ fontFamily: 'var(--font-jura), sans-serif', color: '#2BB7D0' }}
                >
                  Timeline
                </h2>
                <button
                  type="button"
                  className="text-xs underline-offset-4 hover:underline"
                  style={{ fontFamily: 'var(--font-jura), sans-serif', color: '#4AB5C9' }}
                  onClick={() => setShowFullTimeline((value) => !value)}
                >
                  {showFullTimeline ? "Show key moments" : "View full timeline"}
                </button>
              </div>
              {!showFullTimeline && (
                <p className="mt-1 text-xs text-zinc-500">
                  Showing key moments · View full timeline
                </p>
              )}
              <div className="mt-4 flex flex-col gap-4">
                {keyTimeline.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    No events recorded yet.
                  </p>
                ) : (
                  keyTimeline.map((event) => (
                    <div
                      key={`${event.ts}-${event.type}`}
                      className="rounded-xl border border-zinc-100 bg-zinc-50 p-4"
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
                          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-zinc-600">
                            <span>{event.type}</span>
                            <span>{formatDate(event.ts)}</span>
                            <span>
                              Duration: {formatDuration(event.durationSec)}
                            </span>
                          </div>
                          <div className="mt-2 text-sm font-medium font-jura" style={{ color: '#2BB7D0' }}>
                            {event.title || "Untitled tab"}
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                            {event.url ? (
                              <>
                                <span className="truncate">{event.url}</span>
                                <button
                                  type="button"
                                  className="flex-shrink-0 rounded p-1 hover:bg-zinc-200 transition-colors"
                                  title="Copy URL"
                                  onClick={() =>
                                    navigator.clipboard.writeText(event.url)
                                  }
                                >
                                  <svg 
                                    width="14" 
                                    height="14" 
                                    viewBox="0 0 16 16" 
                                    fill="none" 
                                    xmlns="http://www.w3.org/2000/svg"
                                    style={{ color: '#4AB5C9' }}
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

            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 
                className="text-lg font-semibold"
                style={{ fontFamily: 'var(--font-jura), sans-serif', color: '#2BB7D0' }}
              >
                Workspaces
              </h2>
              {computedSummary.background && (
                <label className="mt-3 inline-flex items-center gap-2 text-xs text-zinc-600">
                  <input
                    type="checkbox"
                    checked={showBackground}
                    onChange={(event) => setShowBackground(event.target.checked)}
                  />
                  Show Background/Auth (hidden by default)
                </label>
              )}
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {computedSummary.domains.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    No workspace data yet.
                  </p>
                ) : (
                  computedSummary.domains.map((domain) => (
                    <div
                      key={domain.domain}
                      className="rounded-xl border border-zinc-100 bg-zinc-50 p-4"
                    >
                      <div className="flex items-center justify-between text-sm">
                        <div>
                          <span className="font-semibold font-jura">{domain.label}</span>
                          <span className="ml-2 text-xs text-zinc-400">
                            {domain.domain}
                          </span>
                        </div>
                        <span className="text-zinc-600">
                          {formatDuration(domain.timeSec)}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-col gap-1 text-xs text-zinc-600">
                        {domain.topUrls.length === 0 ? (
                          <span>No URLs captured.</span>
                        ) : (
                          domain.topUrls.map((url) => (
                            <a
                              key={url}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="truncate underline-offset-4 hover:underline"
                              style={{ color: '#4AB5C9' }}
                            >
                              {url}
                            </a>
                          ))
                        )}
                      </div>
                      {domain.topUrls.length > 0 && (
                        <button
                          type="button"
                          className="mt-3 inline-flex items-center text-xs font-medium underline-offset-4 hover:underline"
                          style={{ fontFamily: 'var(--font-jura), sans-serif', color: '#4AB5C9' }}
                          onClick={() => handleReopen(domain.topUrls)}
                        >
                          Reopen workspace
                        </button>
                      )}
                    </div>
                  ))
                )}
                {showBackground && computedSummary.background && (
                  <div className="rounded-xl border border-dashed border-zinc-200 bg-white p-4">
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <span className="font-semibold font-jura">
                          {computedSummary.background.label}
                        </span>
                        <span className="ml-2 text-xs text-zinc-400">
                          {computedSummary.background.domains.join(", ")}
                        </span>
                      </div>
                      <span className="text-zinc-600">
                        {formatDuration(computedSummary.background.timeSec)}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-col gap-1 text-xs text-zinc-600">
                      {computedSummary.background.topUrls.length === 0 ? (
                        <span>No URLs captured.</span>
                      ) : (
                        computedSummary.background.topUrls.map((url) => (
                          <a
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="truncate underline-offset-4 hover:underline"
                            style={{ color: '#5BC5D9' }}
                          >
                            {url}
                          </a>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <aside className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 
                className="text-lg font-semibold"
                style={{ fontFamily: 'var(--font-jura), sans-serif', color: '#2BB7D0' }}
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
            <div className="mt-4 space-y-6 text-sm text-zinc-700">
                {session.status === "auto_ended" && (
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                    This session auto-ended after a long period of inactivity.
                  </div>
                )}
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">
                    Session Intent
                  </p>
                  {computedSummary.intent_tags.length > 0 ? (
                    <>
                      <p className="mt-2 text-sm text-zinc-800">
                        {computedSummary.intent_raw}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {computedSummary.intent_tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-zinc-100 px-2 py-1 text-[11px] text-zinc-700"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-zinc-500">
                        You were working across:{" "}
                        {computedSummary.intent_tags.join(", ")}.
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm" style={{ color: '#2BB7D0' }}>No intent set.</p>
                  )}
                </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
                  style={{ fontFamily: 'var(--font-jura), sans-serif', backgroundColor: '#2BB7D0', borderColor: '#2BB7D0' }}
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
                  className="text-left text-xs underline-offset-4 hover:underline disabled:text-zinc-400 disabled:no-underline"
                  style={{ fontFamily: 'var(--font-jura), sans-serif', color: '#4AB5C9' }}
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
              <p className="rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                {computedSummary.emotionalSummary}
              </p>
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Resume Summary
                </p>
                <p className="mt-2">{computedSummary.resumeSummary}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Quick Actions
                </p>
                <div className="mt-2 flex flex-col gap-2 text-xs">
                  <div className="text-zinc-700">
                    Resume:{" "}
                    <button
                      type="button"
                      className="underline-offset-4 hover:underline disabled:text-zinc-400 disabled:no-underline"
                      style={{ fontFamily: 'var(--font-jura), sans-serif', color: '#4AB5C9' }}
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
                      style={{ fontFamily: 'var(--font-jura), sans-serif', color: '#4AB5C9' }}
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
                    <div className="text-xs font-medium font-jura">
                      Review top 3 pages visited
                    </div>
                    <div className="mt-2 space-y-1 text-xs text-zinc-600">
                      {(computedSummary.topPages ?? []).length === 0 ? (
                        <p>No pages yet.</p>
                      ) : (
                        (computedSummary.topPages ?? []).map((page) => (
                          <button
                            key={page.url}
                            type="button"
                            className="block w-full truncate text-left underline-offset-4 hover:underline"
                            style={{ fontFamily: 'var(--font-jura), sans-serif', color: '#4AB5C9' }}
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
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Time Breakdown
                </p>
                <div className="mt-2 space-y-1 text-xs text-zinc-600">
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
                  {computedSummary.timeBreakdown.length === 0 ? (
                    <p>No time data yet.</p>
                  ) : (
                    computedSummary.timeBreakdown.map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center justify-between"
                      >
                        <span>{item.label}</span>
                        <span>{formatDuration(item.timeSec)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Intent Alignment
                </p>
                <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-xs text-zinc-600">
                  {computedSummary.focus.intentMissing ? (
                    <div className="text-sm font-semibold font-jura text-zinc-900">
                      Time split across different activities
                    </div>
                  ) : computedSummary.focus.tooShort ? (
                    <div className="text-sm font-semibold font-jura text-zinc-900">
                      Session too short to assess focus
                    </div>
                  ) : (
                    <div className="text-2xl font-semibold font-jura text-zinc-900">
                      {computedSummary.focus.displayFocusPct}% Aligned
                    </div>
                  )}
                  <div className="mt-1">
                    Aligned{" "}
                    {formatDuration(computedSummary.focus.alignedTimeSec)} •
                    Off-intent{" "}
                    {formatDuration(computedSummary.focus.offIntentTimeSec)} •
                    Neutral{" "}
                    {formatDuration(computedSummary.focus.neutralTimeSec)}
                  </div>
                  {computedSummary.focus.breakTimeSec > 0 && (
                    <div className="mt-1 text-[11px] text-zinc-500">
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
                          className="rounded-full bg-white px-2 py-1 text-[11px] text-zinc-700 shadow-sm"
                        >
                          {prettyDomain(source.domain)} (
                          {formatDuration(source.timeSec)})
                        </span>
                      ))
                    )}
                  </div>
                  <p className="mt-3 text-[11px] text-zinc-500">
                    No guilt, this just helps you snap back faster.
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Pending Decisions
                </p>
                <ul className="mt-2 list-disc pl-5">
                  {computedSummary.pendingDecisions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Last Stop
                </p>
                {computedSummary.lastStop ? (
                  <a
                    href={computedSummary.lastStop.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block underline-offset-4 hover:underline"
                    style={{ color: '#5BC5D9' }}
                  >
                    {computedSummary.lastStop.title ||
                      computedSummary.lastStop.url}
                  </a>
                ) : (
                  <p className="mt-2 text-zinc-500">No last stop recorded.</p>
                )}
              </div>
              <div className="pt-4 text-xs text-zinc-500">
                <Link href="/session/demo" className="underline" style={{ color: '#4AB5C9' }}>
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
