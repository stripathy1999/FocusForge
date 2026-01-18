# Environment Variables Setup

## Required for Journal Export

The journal export feature requires Supabase environment variables to be set.

### Required Variables

Create a `.env.local` file in the **root directory** (same level as `package.json`) with:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
OPENNOTE_API_KEY=your_opennote_api_key
```

### Where to Get Supabase Credentials

1. Go to your Supabase project: https://supabase.com/dashboard
2. Select your project
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ Keep this secret!)

### File Location

**Important**: The `.env.local` file should be in the **root directory** of the project:
```
FocusForge-1/
├── .env.local          ← HERE (root level)
├── package.json
├── app/
├── backend/
└── lib/
```

### After Setting Variables

1. **Restart your dev server** (if running):
   ```bash
   # Stop the server (Ctrl+C)
   npm run dev
   ```

2. **Verify variables are loaded**:
   The error message will now tell you which variables are missing.

### Quick Check

Run this to verify your setup:
```bash
# Check if variables are set (without exposing values)
node -e "console.log('SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING'); console.log('SUPABASE_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'MISSING');"
```

### Troubleshooting

**Error: "Supabase not configured"**
- Check `.env.local` exists in root directory
- Verify variable names are correct (case-sensitive)
- Restart dev server after adding variables
- Check `.env.local` is not in `.gitignore` (it should be ignored, but file should exist locally)

**Error: "Session not found"**
- Supabase is configured, but session doesn't exist in database
- Check session ID is correct
- Verify database tables are created (run `backend/supabase-schema.sql`)

**Error: "OPENNOTE_API_KEY environment variable is not set"**
- Add `OPENNOTE_API_KEY=sk_opennote_...` to `.env.local`
- Restart dev server
