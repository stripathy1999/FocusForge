import Link from "next/link";
import { headers } from "next/headers";

import { SessionDetail } from "@/app/session/_components/SessionDetail";
import { ComputedSummary, Event, Session } from "@/lib/types";

type SessionResponse = {
  session: Session;
  events: Event[];
  computedSummary: ComputedSummary;
};

async function getSessionData(id: string): Promise<SessionResponse | null> {
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const protocol = process.env.NODE_ENV === "development" ? "http" : "https";
  const response = await fetch(`${protocol}://${host}/api/session/${id}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as SessionResponse;
}

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getSessionData(id);

  if (!data) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-12 text-zinc-900">
        <div className="mx-auto w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold font-jura">Session not found</h1>
          <p className="mt-3 text-sm text-zinc-600">
            We could not find session {id}. Start a session from the
            extension and try again.
          </p>
          <Link
            href="/session/live"
            className="mt-4 inline-block text-blue-600 underline"
          >
            Go to Live Session
          </Link>
        </div>
      </div>
    );
  }

  return (
    <SessionDetail
      session={data.session}
      computedSummary={data.computedSummary}
    />
  );
}
