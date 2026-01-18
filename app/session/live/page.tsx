import Link from "next/link";

import { SessionLiveClient } from "./SessionLiveClient";

export default function LiveSessionPage() {
  return (
    <div className="min-h-screen px-6 py-12 text-zinc-900" style={{ backgroundColor: '#BDE8F5' }}>
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Live Session
            </p>
            <h1 
              className="mt-2 text-2xl font-semibold"
              style={{ fontFamily: 'var(--font-jura), sans-serif' }}
            >
              Use the extension to start a session
            </h1>
          </div>
          <Link
            href="/"
            className="flex items-center justify-center rounded-lg p-3 text-white shadow-sm transition-colors hover:opacity-90 shrink-0"
            style={{ backgroundColor: '#32578E' }}
            aria-label="Return to home"
          >
            <svg 
              width="24" 
              height="24" 
              viewBox="0 0 24 24" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
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
        <p className="mt-3 text-sm text-zinc-600">
          Click <strong>Start</strong> in the extension popup, then browse
          normally. When you stop the session, paste the session ID here to view
          the timeline and resume summary.
        </p>

        <SessionLiveClient />

        <div className="mt-8 rounded-lg bg-zinc-50 p-4 text-sm text-zinc-600">
          <p>
            Want to test without the extension? Try the{" "}
            <Link href="/session/demo" className="underline" style={{ color: '#32578E' }}>
              demo session
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
