# Backend Updates - Production Ready

## Summary

Updated backend to match production requirements: stable API contracts, safety features, auto-pause, and proper error handling.

## Database Schema Changes

### Updated Tables

**sessions:**
- `status`: Changed from `('running', 'ended', 'analyzed')` to `('active', 'paused', 'ended')`
- Added `intent_text` (TEXT, nullable) - stores user's goal/intent
- Added `created_at` timestamp

**events:**
- Added `duration_sec` (INTEGER) - calculated and stored on insert
- Added `domain` (TEXT) - extracted from URL on insert

**analysis:**
- No changes (already correct)

## New API Endpoints

1. **POST /api/session/pause** - Pauses an active session
2. **POST /api/session/resume** - Resumes a paused session  
3. **GET /api/sessions** - Lists all sessions (ordered by created_at desc)

## Updated API Endpoints

### POST /api/session/start
- Now accepts optional `intent_text` in body
- Sets status to `'active'` (was `'running'`)

### POST /api/event
- Now calculates and stores `duration_sec` (time since previous event)
- Extracts and stores `domain` from URL
- Auto-resumes paused sessions when new event arrives
- Triggers background idle check (non-blocking)

### POST /api/session/end
- Uses safe default analysis if Gemini fails
- Sanitizes analysis JSON before storing
- Never throws unhandled errors
- Returns success even if analysis fails

### GET /api/session/:id
- Returns full session object including `intent_text` and `created_at`
- Sanitizes analysis JSON before returning
- Always returns safe structure

### GET /api/session/:id/eventsWithDuration
- Uses stored `duration_sec` if available
- Falls back to calculation if missing

## Safety Features

### Safe Defaults
- If analysis fails → returns safe default JSON:
  ```json
  {
    "resumeSummary": "Session captured. Resume when ready.",
    "workspaces": [],
    "nextActions": [],
    "pendingDecisions": []
  }
  ```

### Error Handling
- All endpoints return safe responses (never crash)
- Malformed analysis JSON is sanitized
- Missing analysis returns safe defaults
- Tolerant to duplicate events, malformed data

### Auto-Pause Logic
- Sessions with no events for >30 minutes are auto-paused
- Status changes from `'active'` to `'paused'`
- Check runs in background (non-blocking) on event insert
- Can also be triggered via `POST /api/check-idle`

## Environment Variables

Required:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`

Optional:
- `ANALYZER_SERVICE_URL` - External Python service URL
- `NEXT_PUBLIC_APP_URL` - App URL for internal API calls

## Migration Notes

1. **Run updated schema**: Execute `supabase-schema.sql` in Supabase SQL editor
2. **Update frontend**: Ensure frontend uses new status values (`'active'`, `'paused'`, `'ended'`)
3. **Test endpoints**: Verify all endpoints return expected formats
4. **Deploy**: Backend is ready for Vercel deployment

## Demo Safety Guarantees

✅ No crashes on:
- Empty sessions
- Single-tab sessions
- Very short sessions
- Malformed analysis JSON
- Gemini API failures
- Database errors

✅ Always returns:
- Valid JSON responses
- Safe default analysis if needed
- Proper error messages (never unhandled)

✅ Persistence:
- Sessions survive refresh
- Events stored immediately
- Analysis cached (not re-run on session end if exists)
