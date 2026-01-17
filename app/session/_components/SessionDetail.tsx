"use client";

import Link from "next/link";
import { useState } from "react";

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
              <h2 className="text-lg font-semibold">Timeline</h2>
              <div className="mt-4 flex flex-col gap-4">
                {timeline.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    No events recorded yet.
                  </p>
                ) : (
                  timeline.map((event) => (
                    <div
                      key={`${event.ts}-${event.type}`}
                      className="rounded-xl border border-zinc-100 bg-zinc-50 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-zinc-600">
                        <span>{event.type}</span>
                        <span>{formatDate(event.ts)}</span>
                        <span>Duration: {formatDuration(event.durationSec)}</span>
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
                    </div>
                  ))
                )}
                {session.status === "ended" && (
                  <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-500">
                    Session ended {formatDate(session.ended_at)}.
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
            <h2 className="text-lg font-semibold">Resume Panel</h2>
            <div className="mt-4 space-y-6 text-sm text-zinc-700">
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Resume Summary
                </p>
                <p className="mt-2">{computedSummary.resumeSummary}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Next Actions
                </p>
                <ul className="mt-2 list-disc pl-5">
                  {computedSummary.nextActions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Quick Actions
                </p>
                <div className="mt-2 flex flex-col gap-2 text-xs">
                  <button
                    type="button"
                    className="rounded-md border border-zinc-200 px-3 py-2 text-left text-zinc-700 hover:bg-zinc-50"
                    onClick={() =>
                      computedSummary.lastStop?.url
                        ? handleReopen([computedSummary.lastStop.url])
                        : null
                    }
                    disabled={!computedSummary.lastStop?.url}
                  >
                    Resume: Open last stop tab
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-zinc-200 px-3 py-2 text-left text-zinc-700 hover:bg-zinc-50"
                    onClick={() =>
                      computedSummary.domains[0]?.topUrls?.length
                        ? handleReopen(computedSummary.domains[0].topUrls)
                        : null
                    }
                    disabled={!computedSummary.domains[0]?.topUrls?.length}
                  >
                    Continue in: {computedSummary.domains[0]?.label ?? "Top"}{" "}
                    workspace
                  </button>
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
