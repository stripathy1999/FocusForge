"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SessionListItem = {
  id: string;
  status: string;
  started_at: number;
  ended_at?: number;
  durationSec: number;
  topWorkspaces: string[];
};

const STORAGE_KEY = "focusforge_recent_sessions";

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDuration(seconds?: number) {
  if (!seconds) {
    return "—";
  }
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s`;
}

function buildTitle(session: SessionListItem) {
  const top = session.topWorkspaces.slice(0, 2).filter(Boolean);
  const label = top.length ? top.join(" + ") : "Focus session";
  return `${timeFormatter.format(new Date(session.started_at))} — ${label}`;
}

export function RecentSessions() {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as SessionListItem[];
        setSessions(parsed.slice(0, 3));
      } catch {
        setSessions([]);
      }
    }

    fetch("/api/sessions")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.sessions?.length) {
          return;
        }
        const nextSessions = (data.sessions as SessionListItem[]).slice(0, 3);
        setSessions(nextSessions);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSessions));
      })
      .catch(() => undefined);
  }, []);

  if (sessions.length === 0) {
    return <p>No sessions yet. Start one from the extension.</p>;
  }

  return (
    <div className="mt-4 flex flex-col gap-3 text-sm text-zinc-600">
      {sessions.map((session) => (
        <div
          key={session.id}
          className="flex flex-col gap-3 rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <div className="font-medium text-zinc-900">
              {buildTitle(session)}
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              Status: {session.status} · Duration:{" "}
              {formatDuration(session.durationSec)}
            </div>
          </div>
          <Link
            href={`/session/${session.id}`}
            className="text-blue-600 underline"
          >
            Open
          </Link>
        </div>
      ))}
    </div>
  );
}
