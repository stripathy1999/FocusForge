import Link from "next/link";
import { headers } from "next/headers";

type SessionListItem = {
  id: string;
  status: string;
  started_at: number;
  ended_at?: number;
  durationSec: number;
  topWorkspaces: string[];
};

type SessionsResponse = {
  sessions: SessionListItem[];
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

async function getSessions(): Promise<SessionListItem[]> {
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const protocol = process.env.NODE_ENV === "development" ? "http" : "https";
  const response = await fetch(`${protocol}://${host}/api/sessions`, {
    cache: "no-store",
  });

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as SessionsResponse;
  return data.sessions ?? [];
}

export default async function Home() {
  const sessions = await getSessions();

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-12 text-zinc-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-[90px] w-[90px] rounded-full" style={{ backgroundColor: '#32578E' }}></div>
            <h1 
              className="text-[90px] font-semibold leading-none"
              style={{ fontFamily: 'var(--font-jura), sans-serif', color: '#32578E' }}
            >
              FocusForge
            </h1>
          </div>
          <h2 
            className="mt-4 text-3xl font-semibold"
            style={{ fontFamily: 'var(--font-jura), sans-serif', color: '#669EE6' }}
          >
            Auto-track browser sessions and resume faster.
          </h2>
          <p className="mt-4 max-w-2xl text-sm" style={{ color: '#8f8f9f' }}>
            FocusForge only captures the active tab&apos;s URL, title, and
            timestamps. No page content, no keystrokes, and no personal data
            beyond what your browser already exposes.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/session/live"
              className="rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm"
              style={{ fontFamily: 'var(--font-jura), sans-serif', backgroundColor: '#32578E', borderColor: '#32578E' }}
            >
              Open Session
            </Link>
            <Link
              href="/session/demo"
              className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-zinc-100"
              style={{ fontFamily: 'var(--font-jura), sans-serif', color: '#32578E', borderColor: '#32578E' }}
            >
              View Demo
            </Link>
          </div>
        </header>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 
            className="text-lg font-semibold"
            style={{ fontFamily: 'var(--font-jura), sans-serif', color: '#32578E' }}
          >
            Recent Sessions
          </h2>
          <div className="mt-4 flex flex-col gap-3 text-sm text-zinc-600">
            {sessions.length === 0 ? (
              <p>No sessions yet. Start one from the extension.</p>
            ) : (
              sessions.slice(0, 5).map((session) => (
                <div
                  key={session.id}
                  className="flex flex-col gap-3 rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3 transition-all duration-200 hover:border-[#32578E] hover:bg-white hover:shadow-lg hover:scale-[1.02] hover:-translate-y-0.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="font-medium font-jura" style={{ color: '#32578E' }}>
                      {session.id}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      Status: {session.status} · Started{" "}
                      {formatDate(session.started_at)}
                    </div>
                    <div className="mt-2 text-xs text-zinc-500">
                      Duration: {formatDuration(session.durationSec)} · Top
                      workspaces:{" "}
                      {session.topWorkspaces.length
                        ? session.topWorkspaces.join(", ")
                        : "—"}
                    </div>
                  </div>
                  <Link
                    href={`/session/${session.id}`}
                    className="underline"
                    style={{ color: '#4777B9' }}
                  >
                    Open
                  </Link>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
