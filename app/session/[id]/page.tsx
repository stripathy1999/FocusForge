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
      <div 
        className="min-h-screen px-6 py-12 text-zinc-900" 
        style={{ 
          backgroundColor: '#BDE8F5',
          backgroundImage: `
            radial-gradient(circle, rgba(50, 87, 142, 0.2) 1.5px, transparent 1.5px),
            repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255, 255, 255, 0.03) 2px, rgba(255, 255, 255, 0.03) 4px),
            repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0, 0, 0, 0.02) 2px, rgba(0, 0, 0, 0.02) 4px)
          `,
          backgroundSize: "28px 28px, 3px 3px, 3px 3px",
        }}
      >
        <div className="mx-auto w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          <h1
            className="text-2xl font-semibold"
            style={{
              fontFamily: "var(--font-jura), sans-serif",
              color: "#32578E",
            }}
          >
            Session not found
          </h1>
          <p className="mt-3 text-sm text-zinc-600">
            We could not find session {id}. Start a session from the
            extension and try again.
          </p>
          <Link
            href="/session/live"
            className="mt-4 inline-block cursor-pointer rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:scale-105 hover:shadow-lg hover:opacity-90"
            style={{
              fontFamily: "var(--font-jura), sans-serif",
              backgroundColor: "#32578E",
              borderColor: "#32578E",
            }}
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
