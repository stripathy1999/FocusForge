# Debugging Journal Export Internal Server Error

## Common Causes

### 1. Missing OPENNOTE_API_KEY
**Error**: "OPENNOTE_API_KEY environment variable is not set"

**Solution**: 
- Set `OPENNOTE_API_KEY` in your environment variables (`.env.local` or Vercel dashboard)
- Restart the server after adding

### 2. Backend Route Not Accessible
**Error**: "Failed to reach backend" or connection refused

**Causes**:
- App Router route can't reach Pages Router route on same host
- URL construction is wrong
- Backend server not running

**Solution**:
- Check server logs for fetch URL being used
- Ensure `BACKEND_API_URL` is set if backend is separate
- In same deployment, ensure URL is `http://localhost:3000/api/opennote/journal/export` (dev) or `https://yourdomain.com/api/opennote/journal/export` (prod)

### 3. Supabase Connection Issues
**Error**: "Session not found" or database errors

**Solution**:
- Check `SUPABASE_SERVICE_ROLE_KEY` is set
- Verify session ID exists in database
- Check Supabase project is active

### 4. Opennote API Errors
**Error**: "Opennote API error: 401" or similar

**Solution**:
- Verify `OPENNOTE_API_KEY` is valid
- Check Opennote API URL is correct (default: `https://api.opennote.com`)
- Ensure API key has journal export permissions

## How to Debug

### 1. Check Server Logs
When you click "Export to Opennote Journal", check your server console for:
- `[Journal Export] Using fetch URL: ...` - Shows which URL is being called
- `Opennote journal export - fetch error: ...` - Shows fetch failures
- `Opennote export error: ...` - Shows Opennote API errors

### 2. Check Browser Console
Look for:
- Network request to `/api/opennote/journal/export`
- Response status and error message
- Any CORS errors

### 3. Test Backend Route Directly
```bash
curl -X POST http://localhost:3000/api/opennote/journal/export \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"YOUR_SESSION_ID"}'
```

### 4. Verify Environment Variables
```bash
# In backend directory
echo $OPENNOTE_API_KEY
echo $SUPABASE_SERVICE_ROLE_KEY
```

## Quick Fixes

### If fetch URL is wrong:
The App Router route constructs the URL automatically. If it's wrong:
1. Set `BACKEND_API_URL=http://localhost:3000` (for local dev)
2. Or `BACKEND_API_URL=https://your-backend.vercel.app` (for prod)

### If missing API key:
```bash
# In .env.local (backend directory or root)
OPENNOTE_API_KEY=sk_opennote_...
```

### If session not found:
- Ensure session exists in Supabase database
- Check session ID is correct
- Verify Supabase credentials are set

## Expected Flow

1. **Frontend** → Calls `/api/opennote/journal/export` (App Router)
2. **App Router** → Proxies to `/api/opennote/journal/export` (Pages Router)
3. **Backend Route** → Fetches from Supabase:
   - Session data
   - Events
   - Analysis
4. **Backend Route** → Generates markdown
5. **Backend Route** → Calls Opennote API
6. **Backend Route** → Returns journal ID/URL

## Error Messages

- **"Missing sessionId"** → Frontend didn't send sessionId
- **"Failed to reach backend"** → Can't connect to Pages Router route
- **"Session not found"** → Session doesn't exist in database
- **"OPENNOTE_API_KEY environment variable is not set"** → Missing API key
- **"Opennote API error: 401"** → Invalid API key
- **"Opennote API error: 404"** → Wrong API endpoint

## Next Steps

1. Check server logs when clicking export button
2. Verify environment variables are set
3. Test backend route directly with curl
4. Check Supabase database for session data
