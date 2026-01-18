import Image from "next/image";
import Link from "next/link";

import { RecentSessions } from "@/app/RecentSessions";

export default function Home() {
  return (
    <div
      className="min-h-screen px-6 py-12 text-zinc-900"
      style={{ backgroundColor: "#BDE8F5" }}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-3">
            <Image
              src="/focus_forge_logo.png"
              alt="FocusForge"
              width={90}
              height={90}
              className="h-[90px] w-[90px]"
            />
            <h1
              className="text-[90px] font-semibold leading-none"
              style={{
                fontFamily: "var(--font-jura), sans-serif",
                color: "#32578E",
              }}
            >
              FocusForge
            </h1>
          </div>
          <h2
            className="mt-4 text-3xl font-semibold"
            style={{
              fontFamily: "var(--font-jura), sans-serif",
              color: "#669EE6",
            }}
          >
            Auto-track browser sessions and resume faster.
          </h2>
          <p className="mt-4 max-w-2xl text-sm" style={{ color: "#8f8f9f" }}>
            FocusForge only captures the active tab&apos;s URL, title, and
            timestamps. No page content, no keystrokes, and no personal data
            beyond what your browser already exposes.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/session/live"
              className="rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm"
              style={{
                fontFamily: "var(--font-jura), sans-serif",
                backgroundColor: "#32578E",
                borderColor: "#32578E",
              }}
            >
              Open Session
            </Link>
            <Link
              href="/session/demo"
              className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-zinc-100"
              style={{
                fontFamily: "var(--font-jura), sans-serif",
                color: "#32578E",
                borderColor: "#32578E",
              }}
            >
              View Demo
            </Link>
          </div>
        </header>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2
            className="text-lg font-semibold"
            style={{
              fontFamily: "var(--font-jura), sans-serif",
              color: "#669EE6",
            }}
          >
            Recent Sessions
          </h2>
          <RecentSessions />
        </section>
      </div>
    </div>
  );
}
