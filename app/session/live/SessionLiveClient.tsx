"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SessionLiveClient() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState("");

  return (
    <div className="mt-6 flex flex-col gap-3">
      <label className="text-sm font-medium text-zinc-700">
        Paste session ID (optional)
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={sessionId}
          onChange={(event) => setSessionId(event.target.value)}
          placeholder="e.g. 4a3f3c8e-..."
          className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm shadow-sm focus:border-zinc-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => {
            if (!sessionId) return;
            const cleaned = normalizeSessionId(sessionId);
            if (cleaned) {
              router.push(`/session/${cleaned}`);
            }
          }}
          className="cursor-pointer rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:scale-105 hover:shadow-lg hover:opacity-90"
          style={{ fontFamily: 'var(--font-jura), sans-serif', backgroundColor: '#32578E', borderColor: '#32578E' }}
        >
          Open Session
        </button>
      </div>
    </div>
  );
}

function normalizeSessionId(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http")) {
    try {
      const url = new URL(trimmed);
      const parts = url.pathname.split("/").filter(Boolean);
      if (!parts.length) return null;
      return parts[parts.length - 1];
    } catch {
      return null;
    }
  }
  return trimmed;
}
