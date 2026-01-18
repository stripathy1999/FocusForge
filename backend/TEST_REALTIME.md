# Testing Opennote Integration with Real-Time Data

## Quick Start

### Option 1: Via API (Recommended - No database credentials needed)

1. **Start the backend server:**
   ```bash
   cd backend
   npm run dev
   ```

2. **List available sessions:**
   ```bash
   npx tsx backend/test-opennote-realtime-api.ts
   ```

3. **Test export for a specific session:**
   ```bash
   npx tsx backend/test-opennote-realtime-api.ts <session-id>
   ```

### Option 2: Direct Database Access

1. **Make sure `.env.local` has Supabase credentials:**
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=your-url
   SUPABASE_SERVICE_ROLE_KEY=your-key
   OPENNOTE_API_KEY=your-opennote-key
   ```

2. **List sessions:**
   ```bash
   npx tsx backend/test-opennote-realtime.ts
   ```

3. **Test export:**
   ```bash
   npx tsx backend/test-opennote-realtime.ts <session-id>
   ```

## What Gets Tested

1. ✅ Fetches real session from database/API
2. ✅ Fetches all events for that session
3. ✅ Fetches analysis (if available)
4. ✅ Generates markdown from real data
5. ✅ Exports to Opennote with real API
6. ✅ Returns journal URL

## Example Output

```
================================================================================
TESTING OPENNOTE EXPORT FOR SESSION: abc123-def456-...
================================================================================

1. Fetching session data from API...
   ✅ Session found: ended
   Started: 1/17/2024, 2:23:00 PM
   Intent: Practice LeetCode problems
   Events: 15
   Analysis: Yes

2. Generating markdown...
   ✅ Markdown generated (1205 characters)

Preview:
--------------------------------------------------------------------------------
# FocusForge — Session Recap (Jan 17, 2:23 PM)

## Goal / Intent

Practice LeetCode problems
...
--------------------------------------------------------------------------------

3. Exporting to Opennote via API...
   ✅ Journal exported successfully!

================================================================================
SUCCESS!
================================================================================
Journal ID: 28cbe117-fd8d-44bf-80be-f2bac1f5cf0e
Journal URL: https://opennote.com/journals/28cbe117-fd8d-44bf-80be-f2bac1f5cf0e

🎉 You can view the journal at the URL above!
================================================================================
```

## Troubleshooting

### "No sessions found"
- Start a session from the Chrome extension
- Make sure the backend is running and connected to Supabase
- Check that events are being recorded

### "API error: 404"
- Make sure the backend server is running
- Check that the session ID is correct
- Verify the API endpoint is accessible

### "Export failed"
- Check that `OPENNOTE_API_KEY` is set in `backend/.env.local`
- Verify the API key is valid
- Make sure you have internet connection

## Testing in the UI

You can also test directly in the UI:

1. Go to a session detail page: `http://localhost:3000/session/<session-id>`
2. Click "Export to Opennote Journal"
3. Check the browser console for any errors
4. The journal URL will appear if successful
