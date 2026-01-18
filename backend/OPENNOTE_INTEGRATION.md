# Opennote Integration

This document describes the Opennote integration for FocusForge, which allows users to export session summaries and generate practice sets directly to Opennote.

## Features

### 1. Export to Opennote Journal (MUST HAVE)
- Converts session analysis into a clean markdown journal
- Includes: intent, last stop, top pages, time breakdown, AI summary, next actions, pending decisions
- Has fallback if Gemini analysis fails (uses heuristic grouping)
- Stores journal ID and URL in database

### 2. Generate Practice Set (BONUS)
- Creates practice problems based on session content
- Extracts topics from URLs (e.g., LeetCode problem slugs)
- Uses webhook for async completion
- Appends problems + solutions to a new journal

## API Endpoints

### POST /api/opennote/journal/export
Exports a session to an Opennote journal.

**Request:**
```json
{
  "sessionId": "uuid"
}
```

**Response:**
```json
{
  "ok": true,
  "journalId": "journal-id",
  "journalUrl": "https://opennote.com/journals/...",
  "message": "Journal exported successfully"
}
```

### POST /api/opennote/practice/create
Initiates practice set generation.

**Request:**
```json
{
  "sessionId": "uuid"
}
```

**Response:**
```json
{
  "ok": true,
  "setId": "practice-set-id",
  "message": "Practice set creation initiated"
}
```

### POST /api/opennote/practice/webhook
Receives practice set completion from Opennote.

**Request (from Opennote):**
```json
{
  "set_id": "practice-set-id",
  "problems": [
    {
      "problem": "...",
      "solution": "...",
      "rubric": "...",
      "key_points": ["..."]
    }
  ]
}
```

**Response:**
```json
{
  "ok": true,
  "journalId": "journal-id",
  "journalUrl": "https://opennote.com/journals/...",
  "message": "Practice set journal created successfully"
}
```

## Environment Variables

Add these to your `.env.local`:

```bash
OPENNOTE_API_KEY=your-opennote-api-key
OPENNOTE_API_URL=https://api.opennote.com  # Optional, defaults to this
NEXT_PUBLIC_APP_URL=https://yourapp.vercel.app  # For webhook URL
```

## Database Schema

The `opennote_exports` table tracks exports:

```sql
CREATE TABLE opennote_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  journal_id TEXT,
  journal_url TEXT,
  practice_set_id TEXT,
  practice_set_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Markdown Template

The generated journal follows this structure:

```markdown
# FocusForge — Session Recap (Jan 17, 2:23 PM)

## Goal / Intent
[User's intent or inferred goal]

## Where You Left Off
[Last stop URL and label]

## What You Did
### Workspace 1
- [Top URLs]

## Time Breakdown
- **Workspace**: Xm Ys (Z%)

## AI Summary
[Resume summary from Gemini]

## Next Actions
- [Action items]

## Pending Decisions
- [Decision items]
```

## Reliability

- **Always works**: Markdown generation has fallback if Gemini fails
- **Heuristic fallback**: Groups by domain if AI analysis unavailable
- **Error handling**: Returns safe defaults, never crashes
- **Webhook safety**: Always returns 200 to Opennote (webhook received)

## Frontend Integration

The session detail page (`app/session/[id]/page.tsx`) includes two buttons:

1. **Export to Opennote Journal** - Exports immediately
2. **Generate Practice Problems (Opennote)** - Initiates async generation

Both buttons show loading states and success indicators.

## Demo Setup

For a reliable demo:

1. **Pre-recorded session**: Have a session with analysis already in DB
2. **Instant export**: Journal export should be instant (no waiting)
3. **Practice set**: Either pre-compute or use quick webhook simulation

## Implementation Files

- `backend/lib/opennote.ts` - Opennote API client and markdown generation
- `backend/pages/api/opennote/journal/export.ts` - Journal export endpoint
- `backend/pages/api/opennote/practice/create.ts` - Practice creation endpoint
- `backend/pages/api/opennote/practice/webhook.ts` - Webhook handler
- `app/session/_components/SessionDetail.tsx` - Frontend buttons
