# FocusForge Backend API

Next.js backend API for FocusForge session tracking and analysis.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your Supabase and Gemini credentials:
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (for admin operations)
- `GEMINI_API_KEY`: Your Gemini API key for analysis

3. Set up Supabase database:

Run these SQL commands in your Supabase SQL editor:

```sql
-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'ended', 'analyzed'))
);

-- Create events table
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  ts BIGINT NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create analysis table
CREATE TABLE IF NOT EXISTS analysis (
  session_id UUID PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  summary_json JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_session_id ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);

-- Disable RLS for hackathon (as per requirements)
ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE events DISABLE ROW LEVEL SECURITY;
ALTER TABLE analysis DISABLE ROW LEVEL SECURITY;
```

## API Endpoints

### POST /api/session/start
Creates a new session.

**Body (optional):**
```json
{
  "intent_text": "Optional user intent/goal"
}
```

**Response:**
```json
{
  "sessionId": "uuid"
}
```

### POST /api/session/pause
Pauses an active session.

**Body:**
```json
{
  "sessionId": "uuid"
}
```

### POST /api/session/resume
Resumes a paused session.

**Body:**
```json
{
  "sessionId": "uuid"
}
```

### POST /api/session/end
Ends a session and triggers analysis. Returns safe defaults if analysis fails.

**Body:**
```json
{
  "sessionId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Session ended and analyzed"
}
```

### POST /api/event
Stores a browser event. Automatically calculates duration and domain. Tolerant to duplicates/malformed data.

**Body:**
```json
{
  "sessionId": "uuid",
  "ts": 1730000000000,
  "url": "https://example.com",
  "title": "Example Page"
}
```

**Response:**
```json
{
  "success": true,
  "id": "event-uuid"
}
```

### GET /api/sessions
Gets all sessions, ordered by created_at descending.

**Response:**
```json
{
  "sessions": [
    {
      "id": "uuid",
      "status": "active",
      "started_at": "2024-01-01T00:00:00Z",
      "ended_at": null,
      "intent_text": "Optional intent",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### GET /api/session/:id
Gets session data with events and analysis. Analysis is sanitized for safety.

**Response:**
```json
{
  "session": {
    "id": "uuid",
    "status": "active",
    "started_at": "2024-01-01T00:00:00Z",
    "ended_at": null,
    "intent_text": "Optional intent",
    "created_at": "2024-01-01T00:00:00Z"
  },
  "events": [...],
  "analysis": {
    "resumeSummary": "...",
    "workspaces": [...],
    "nextActions": [...],
    "pendingDecisions": [...]
  }
}
```

### GET /api/session/:id/eventsWithDuration
Gets events with duration (uses stored duration_sec or calculates if missing).

**Response:**
```json
{
  "events": [
    {
      "id": "uuid",
      "session_id": "uuid",
      "ts": 1730000000000,
      "url": "https://example.com",
      "title": "Example",
      "duration_sec": 30,
      "domain": "example.com",
      "durationSec": 30
    }
  ]
}
```

## Development

```bash
npm run dev
```

Server runs on http://localhost:3000

## Deployment to Vercel

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
vercel
```

3. Set environment variables in Vercel dashboard:
- Go to your project settings
- Add all environment variables from `.env.local.example`

4. For Python analysis to work on Vercel, you may need to:
   - Deploy Python analyzer as a separate serverless function, OR
   - Use a Python HTTP service (e.g., deployed separately), OR
   - Rewrite analysis logic in TypeScript

**Note:** The current `/api/analyze` endpoint uses Python subprocess which may not work on Vercel. Consider deploying the Python analyzer as a separate service or rewriting it in TypeScript.

## Testing

Test endpoints using curl or Postman:

```bash
# Start session
curl -X POST http://localhost:3000/api/session/start

# Send event
curl -X POST http://localhost:3000/api/event \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"YOUR_SESSION_ID","ts":1730000000000,"url":"https://example.com","title":"Test"}'

# End session
curl -X POST http://localhost:3000/api/session/end \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"YOUR_SESSION_ID"}'

# Get session
curl http://localhost:3000/api/session/YOUR_SESSION_ID
```
