import Link from "next/link";

import { RecentSessions } from "@/app/RecentSessions";

export default function Home() {

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-12 text-zinc-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            FocusForge
          </p>
          <h1 className="mt-2 text-3xl font-semibold">
            Auto-track browser sessions and resume faster.
          </h1>
          <p className="mt-4 max-w-2xl text-sm text-zinc-600">
            FocusForge only captures the active tab&apos;s URL, title, and
            timestamps. No page content, no keystrokes, and no personal data
            beyond what your browser already exposes.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/session/live"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800"
            >
              Open Session
            </Link>
            <Link
              href="/session/demo"
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              View Demo
            </Link>
          </div>
        </header>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Recent Sessions</h2>
          <RecentSessions />
        </section>
      </div>
    </div>
  );
}
