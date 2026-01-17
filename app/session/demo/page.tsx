import { SessionDetail } from "@/app/session/_components/SessionDetail";
import { computeSummary } from "@/lib/grouping";
import { Event, Session } from "@/lib/types";

export default function DemoSessionPage() {
  const now = Date.now();
  const session: Session = {
    id: "demo-session",
    started_at: now - 45 * 60 * 1000,
    ended_at: now - 5 * 60 * 1000,
    status: "ended",
  };

  const events: Event[] = [
    {
      sessionId: session.id,
      ts: now - 44 * 60 * 1000,
      type: "TAB_ACTIVE",
      url: "https://docs.google.com/document/d/123",
      title: "FocusForge planning doc",
    },
    {
      sessionId: session.id,
      ts: now - 38 * 60 * 1000,
      type: "TAB_ACTIVE",
      url: "https://github.com/isschrack/FocusForge",
      title: "FocusForge repo",
    },
    {
      sessionId: session.id,
      ts: now - 30 * 60 * 1000,
      type: "PAUSE",
      url: "",
      title: "",
    },
    {
      sessionId: session.id,
      ts: now - 26 * 60 * 1000,
      type: "RESUME",
      url: "",
      title: "",
    },
    {
      sessionId: session.id,
      ts: now - 22 * 60 * 1000,
      type: "TAB_ACTIVE",
      url: "https://leetcode.com/problems/two-sum/",
      title: "Two Sum - LeetCode",
    },
    {
      sessionId: session.id,
      ts: now - 12 * 60 * 1000,
      type: "TAB_ACTIVE",
      url: "https://calendar.google.com",
      title: "Calendar",
    },
    {
      sessionId: session.id,
      ts: now - 5 * 60 * 1000,
      type: "STOP",
      url: "",
      title: "",
    },
  ];

  const computedSummary = computeSummary(session, events);

  return (
    <SessionDetail session={session} computedSummary={computedSummary} />
  );
}
