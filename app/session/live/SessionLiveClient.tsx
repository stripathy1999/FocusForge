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
          onClick={() => sessionId && router.push(`/session/${sessionId}`)}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800"
        >
          Open Session
        </button>
      </div>
    </div>
  );
}
