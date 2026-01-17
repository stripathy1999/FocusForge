import Link from "next/link";

import { SessionLiveClient } from "./SessionLiveClient";

export default function LiveSessionPage() {
  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-12 text-zinc-900">
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-zinc-500">
          Live Session
        </p>
        <h1 
          className="mt-2 text-2xl font-semibold"
          style={{ fontFamily: 'var(--font-jura), sans-serif' }}
        >
          Use the extension to start a session
        </h1>
        <p className="mt-3 text-sm text-zinc-600">
          Click <strong>Start</strong> in the extension popup, then browse
          normally. When you stop the session, paste the session ID here to view
          the timeline and resume summary.
        </p>

        <SessionLiveClient />

        <div className="mt-8 rounded-lg bg-zinc-50 p-4 text-sm text-zinc-600">
          <p>
            Want to test without the extension? Try the{" "}
            <Link href="/session/demo" className="underline" style={{ color: '#4777B9' }}>
              demo session
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
