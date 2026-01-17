# Deployment Guide

## Prerequisites

1. **Supabase Account**: Create a project at https://supabase.com
2. **Vercel Account**: Sign up at https://vercel.com
3. **Gemini API Key**: Get from https://makersuite.google.com/app/apikey

## Step 1: Set Up Supabase Database

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Run the SQL from `supabase-schema.sql`:

```sql
-- Copy and paste the entire contents of supabase-schema.sql
```

4. Verify tables are created:
   - Go to Table Editor
   - You should see: `sessions`, `events`, `analysis`

5. Get your Supabase credentials:
   - Go to Settings → API
   - Copy:
     - Project URL (for `NEXT_PUBLIC_SUPABASE_URL`)
     - `anon` key (for `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
     - `service_role` key (for `SUPABASE_SERVICE_ROLE_KEY`)

## Step 2: Deploy to Vercel

### Option A: Using Vercel CLI

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Navigate to backend directory:
```bash
cd backend
```

3. Deploy:
```bash
vercel
```

4. Follow prompts:
   - Link to existing project or create new
   - Set up environment variables (see below)

### Option B: Using Vercel Dashboard

1. Go to https://vercel.com/new
2. Import your Git repository
3. Set root directory to `backend`
4. Framework preset: Next.js
5. Add environment variables (see below)

## Step 3: Set Environment Variables

In Vercel dashboard → Project Settings → Environment Variables, add:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
GEMINI_API_KEY=your_gemini_api_key
```

**Important**: 
- Add these for all environments (Production, Preview, Development)
- After adding, redeploy for changes to take effect

## Step 4: Python Analysis on Vercel

**Note**: Vercel doesn't natively support Python serverless functions. You have two options:

### Option 1: Deploy Python Analyzer Separately (Recommended)

Deploy the Python analyzer as a separate service:

1. Use a service like:
   - **Railway** (https://railway.app) - Easy Python deployment
   - **Render** (https://render.com) - Free tier available
   - **Fly.io** (https://fly.io) - Good for serverless Python

2. Create a simple Flask/FastAPI server:
```python
# analyzer_server.py (create this)
from flask import Flask, request, jsonify
from gemini_analyzer import analyzeSessionWithGemini
import os

app = Flask(__name__)

@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.json
    goal = data.get('goal', '')
    events = data.get('events', [])
    result = analyzeSessionWithGemini(
        goal, 
        {'events': events}, 
        api_key=os.getenv('GEMINI_API_KEY'),
        use_gemini=True
    )
    return jsonify(result)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
```

3. Update `/api/analyze.ts` to call this service:
```typescript
const response = await fetch('https://your-python-service.railway.app/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ goal, events })
})
```

### Option 2: Use Vercel Serverless Functions with Python Runtime

Vercel supports Python via serverless functions, but requires a different structure:

1. Create `api/analyze.py` (not in `pages/api/`):
```python
from http.server import BaseHTTPRequestHandler
import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))
from gemini_analyzer import analyzeSessionWithGemini

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        data = json.loads(post_data.decode('utf-8'))
        
        goal = data.get('goal', '')
        events = data.get('events', [])
        
        result = analyzeSessionWithGemini(
            goal,
            {'events': events},
            api_key=os.getenv('GEMINI_API_KEY'),
            use_gemini=True
        )
        
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(result).encode())
```

2. Update `vercel.json`:
```json
{
  "functions": {
    "api/analyze.py": {
      "runtime": "python3.9"
    }
  }
}
```

## Step 5: Test Deployment

1. Get your Vercel deployment URL (e.g., `https://your-app.vercel.app`)

2. Test endpoints:
```bash
# Start session
curl -X POST https://your-app.vercel.app/api/session/start

# Send event
curl -X POST https://your-app.vercel.app/api/event \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"YOUR_SESSION_ID","ts":1730000000000,"url":"https://example.com","title":"Test"}'

# End session (triggers analysis)
curl -X POST https://your-app.vercel.app/api/session/end \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"YOUR_SESSION_ID"}'

# Get session
curl https://your-app.vercel.app/api/session/YOUR_SESSION_ID
```

## Troubleshooting

### Python Not Found on Vercel
- Use Option 1 (separate Python service) or Option 2 (Python serverless function)
- The current subprocess approach won't work on Vercel

### Environment Variables Not Working
- Make sure to add `NEXT_PUBLIC_` prefix for client-side variables
- Redeploy after adding environment variables
- Check Vercel logs for errors

### Database Connection Issues
- Verify Supabase URL and keys are correct
- Check Supabase project is active
- Ensure RLS is disabled (for hackathon)

### Analysis Failing
- Check Gemini API key is set correctly
- Verify Python dependencies are installed (if using separate service)
- Check logs for specific error messages

## Local Development

1. Copy `.env.local.example` to `.env.local`
2. Fill in your credentials
3. Run:
```bash
npm install
npm run dev
```

4. Test locally at http://localhost:3000
