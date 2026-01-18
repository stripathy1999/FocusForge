# Quick Start Guide

## 1. Install Dependencies

```bash
cd backend
npm install
```

## 2. Set Up Environment Variables

Copy `.env.local.example` to `.env.local` and fill in:

```bash
cp .env.local.example .env.local
```

Required variables:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `GEMINI_API_KEY` - Gemini API key for analysis

## 3. Set Up Database

1. Go to Supabase SQL Editor
2. Run the SQL from `supabase-schema.sql`
3. Verify tables: `sessions`, `events`, `analysis`

## 4. Run Locally

```bash
npm run dev
```

Server runs on http://localhost:3000

## 5. Test API

```bash
# Start session
curl -X POST http://localhost:3000/api/session/start

# Send event (replace SESSION_ID)
curl -X POST http://localhost:3000/api/event \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"SESSION_ID","ts":1730000000000,"url":"https://example.com","title":"Test"}'

# End session (triggers analysis)
curl -X POST http://localhost:3000/api/session/end \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"SESSION_ID"}'

# Get session data
curl http://localhost:3000/api/session/SESSION_ID
```

## 6. Deploy to Vercel

See `DEPLOYMENT.md` for detailed instructions.

**Quick deploy:**
```bash
npm i -g vercel
vercel
```

Then set environment variables in Vercel dashboard.

## Python Analyzer Options

### Option 1: Local (Development)
Works automatically if Python 3 is installed and analyzer files are in parent directory.

### Option 2: External Service (Production)
Deploy `analyzer_server.py` separately (Railway, Render, etc.) and set `ANALYZER_SERVICE_URL` in environment variables.

See `DEPLOYMENT.md` for details.
