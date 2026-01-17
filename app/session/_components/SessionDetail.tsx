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
  const [intentInput, setIntentInput] = useState(session.intent_raw ?? "");
  const [isSavingIntent, setIsSavingIntent] = useState(false);
  const keyTimeline = showFullTimeline
    ? timeline
    : buildKeyTimeline(timeline, computedSummary.lastStop?.ts);

  const handleReopen = (urls: string[]) => {
    window.postMessage({ type: "FOCUSFORGE_REOPEN", urls }, "*");
    urls.forEach((url) => window.open(url, "_blank", "noopener,noreferrer"));
  };

  const handleSaveIntent = async () => {
    if (!intentInput.trim()) {
      return;
    }
    setIsSavingIntent(true);
    try {
      await fetch("/api/session/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          intent_raw: intentInput.trim(),
        }),
      });
      window.location.reload();
    } finally {
      setIsSavingIntent(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Session Detail
            </p>
            <h1 className="text-2xl font-semibold">Session {session.id}</h1>
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
                <h2 className="text-lg font-semibold">Timeline</h2>
                <button
                  type="button"
                  className="text-xs text-blue-600 underline-offset-4 hover:underline"
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
                          <div className="font-medium text-zinc-700">
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
                          <div className="mt-2 text-sm font-medium text-zinc-900">
                            {event.title || "Untitled tab"}
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                            <span>{event.domain ?? "unknown"}</span>
                            {event.url ? (
                              <button
                                type="button"
                                className="text-blue-600 underline-offset-4 hover:underline"
                                title={event.url}
                                onClick={() =>
                                  navigator.clipboard.writeText(event.url)
                                }
                              >
                                Copy URL
                              </button>
                            ) : (
                              <span>No URL</span>
                            )}
                          </div>
                          {event.url && (
                            <div className="mt-1 truncate text-xs text-zinc-400">
                              {event.url}
                            </div>
                          )}
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
              <h2 className="text-lg font-semibold">Workspaces</h2>
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
                          <span className="font-semibold">{domain.label}</span>
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
                              className="truncate text-blue-600 underline-offset-4 hover:underline"
                            >
                              {url}
                            </a>
                          ))
                        )}
                      </div>
                      {domain.topUrls.length > 0 && (
                        <button
                          type="button"
                          className="mt-3 inline-flex items-center text-xs font-medium text-blue-600 underline-offset-4 hover:underline"
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
                        <span className="font-semibold">
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
                            className="truncate text-blue-600 underline-offset-4 hover:underline"
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
              <h2 className="text-lg font-semibold">Resume Panel</h2>
              {computedSummary.aiSummary && (
                <span
                  className="rounded-full bg-purple-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-purple-700"
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
                    <div className="mt-2 flex flex-col gap-2">
                      <input
                        value={intentInput}
                        onChange={(event) => setIntentInput(event.target.value)}
                        placeholder="What are you focusing on? (comma-separated)"
                        className="rounded-md border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none"
                      />
                      <button
                        type="button"
                        className="inline-flex w-fit items-center rounded-md bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
                        onClick={handleSaveIntent}
                        disabled={isSavingIntent || !intentInput.trim()}
                      >
                        Save intent
                      </button>
                    </div>
                  )}
                </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-60"
                  onClick={() =>
                    computedSummary.resumeUrls.length
                      ? handleReopen(computedSummary.resumeUrls)
                      : null
                  }
                  disabled={computedSummary.resumeUrls.length === 0}
                >
                  ✅ Resume where I left off
                </button>
                <button
                  type="button"
                  className="text-left text-xs text-blue-600 underline-offset-4 hover:underline disabled:text-zinc-400 disabled:no-underline"
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
                      className="text-blue-600 underline-offset-4 hover:underline disabled:text-zinc-400 disabled:no-underline"
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
                      className="text-blue-600 underline-offset-4 hover:underline disabled:text-zinc-400 disabled:no-underline"
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
                    <div className="text-xs font-medium">
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
                            className="block w-full truncate text-left text-blue-600 underline-offset-4 hover:underline"
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
                    <div className="text-sm font-semibold text-zinc-900">
                      Time split across different activities
                    </div>
                  ) : computedSummary.focus.tooShort ? (
                    <div className="text-sm font-semibold text-zinc-900">
                      Session too short to assess focus
                    </div>
                  ) : (
                    <div className="text-2xl font-semibold text-zinc-900">
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
                    className="mt-2 inline-block text-blue-600 underline-offset-4 hover:underline"
                  >
                    {computedSummary.lastStop.title ||
                      computedSummary.lastStop.url}
                  </a>
                ) : (
                  <p className="mt-2 text-zinc-500">No last stop recorded.</p>
                )}
              </div>
              <div className="pt-4 text-xs text-zinc-500">
                <Link href="/session/demo" className="underline">
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
