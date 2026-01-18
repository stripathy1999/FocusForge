# FocusForge

Resume work without rethinking.

FocusForge preserves intent and decision context across browser sessions so you
can resume meaningful work instantly. It is not a task manager, not a note app,
and not a productivity tracker. It is intent memory.

## Problem

When people return to work, their files are still open but their thinking is
gone. Re-orienting costs 10 to 20 minutes per session. Existing tools preserve
content, not decision context.

## What FocusForge Is / Is Not

FocusForge is:
- A session-based intent memory
- A system that extracts next actions and decisions
- A way to resume work without cognitive reload

FocusForge is not:
- A task manager
- A note app
- A productivity tracker or habit app
- A ChatGPT wrapper

## Core User Flow

1) Start a focus session (enter a goal).
2) Auto-capture lightweight context (active tab URL, title, timestamps).
3) End session and run analysis (next actions, decisions, resume summary).
4) Resume session on one clean screen (goal, actions, decisions, grouped links).

## Key Differentiators

- Intent memory: "You were drafting a resume bullet for backend roles."
- Decision awareness: "Need to decide whether to apply via referral."
- Cognitive compression: one goal, 3 to 5 actions, grouped links.

## Privacy Stance

- Only active tab URL + title + timestamps.
- No page content, no keystrokes.
- Pause/Resume anytime.

## Architecture (High Level)

Chrome Extension (MV3) -> Next.js API -> Supabase -> Analysis -> UI

The extension sends tab activation events. The app computes durations, groups
workspaces, and calls an LLM to generate next actions, pending decisions, and a
resume summary.

## Data Model

Session
```
{
  "id": "uuid",
  "goal": "Apply to SWE roles",
  "started_at": "...",
  "ended_at": "...",
  "raw_context": "...",
  "resume_summary": "...",
  "next_actions": [],
  "pending_decisions": [],
  "link_groups": []
}
```

Event payload (from extension)
```
{
  "sessionId": "uuid",
  "ts": 1730000000000,
  "type": "TAB_ACTIVE",
  "url": "https://leetcode.com/problems/two-sum",
  "title": "Two Sum - LeetCode"
}
```

## API Endpoints

- POST `/api/session/start` -> `{ sessionId }`
- POST `/api/event` -> stores activity events
- POST `/api/session/pause` / `/api/session/resume`
- POST `/api/session/end` -> triggers analysis
- GET `/api/session/:id` -> session + analysis + timeline
- POST `/api/opennote/journal/export` -> optional journal export

## Analysis Pipeline

1) Deterministic summary:
   - Sort events, compute duration per tab
   - Extract domains
   - Aggregate workspaces and top URLs
   - Identify last stop
2) LLM enrichment:
   - Resume summary (1 to 2 sentences)
   - Next actions (3 to 5, verb-leading)
   - Pending decisions (1 to 3)

## UI Screens

- `/` Dashboard (recent sessions, open session, demo)
- `/session/[id]` Resume screen (main demo view)
- `/session/demo` Demo fallback
- `/session/live` Live session view

## Repo Structure

- `app/` Next.js App Router UI + API routes
- `lib/` Analysis, grouping, and data helpers
- `extension/` Chrome extension (MV3) that sends events
- `backend/` Legacy Pages Router API (kept for reference)
- `public/` Static assets

## Getting Started

### Prereqs

- Node 18+
- Supabase project (or local fallback)
- Optional: Opennote API key for journal export

### Install

```
npm install
```

### Environment

Create `.env.local` in the project root:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENNOTE_API_KEY=... (optional)
```

See `ENV_SETUP.md` for details.

### Run

```
npm run dev
```

Open `http://localhost:3000`.

## Chrome Extension (MV3)

1) Open Chrome -> Extensions -> Enable Developer mode.
2) Load unpacked -> select `extension/`.
3) In the popup, set intent and start session.
4) Browse normally; events are posted to the web app.

The extension defaults to `http://localhost:3000` and auto-detects Vercel
domains when available.

## Deployment

- Deploy with Vercel.
- Ensure env vars are set in the Vercel project.

## Demo Tips

- Preload 2 to 3 sessions (job apps, interview prep, hackathon planning).
- Show messy browsing, end session, then open resume screen instantly.
- Use the "resume summary" line: "Last time, you were working on X..."

## Non-Negotiables

- Keep scope tight
- Do not add features outside intent memory
- UI must feel finished
- Demo must be instant