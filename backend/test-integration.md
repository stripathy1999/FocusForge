# Integration Test: Backend ↔ AI Analyzer

## Data Flow Verification

### 1. Backend → Python Analyzer

**Backend sends** (`/api/session/end` → `/api/analyze`):
```json
{
  "goal": "string",
  "events": [
    {
      "ts": 1730000000000,
      "url": "https://example.com",
      "title": "Example Page",
      "durationSec": 30
    }
  ]
}
```

**Python script receives** (`scripts/analyze.py`):
- Reads from stdin: `{ goal, events }`
- Wraps as: `{ 'events': events }`
- Calls: `analyzeSessionWithGemini(goal, {'events': events}, ...)`

**Python analyzer expects** (`gemini_analyzer.py`):
- `eventsWithDuration: Dict` with `"events"` key
- Each event has: `ts`, `url`, `title`, `durationSec` ✓

### 2. Python Analyzer → Backend

**Python analyzer returns**:
```json
{
  "goalInferred": "string",
  "workspaces": [{"label": "string", "timeSec": 0, "topUrls": ["string"]}],
  "resumeSummary": "string",
  "lastStop": {"label": "string", "url": "string"},
  "nextActions": ["string"],
  "pendingDecisions": ["string"]
}
```

**Backend receives**:
- Parses JSON from stdout
- Sanitizes via `sanitizeAnalysis()`
- Stores in `analysis.summary_json`

### 3. Field Name Mapping

**Database (snake_case)**:
- `duration_sec` (stored in events table)

**API/JSON (camelCase)**:
- `durationSec` (sent to analyzer, expected by analyzer)

**Conversion**: Backend correctly converts `duration_sec` → `durationSec` when preparing events for analysis.

## Potential Issues & Fixes

### ✅ Verified Working:
1. Field name conversion (`duration_sec` → `durationSec`) ✓
2. Data structure wrapping (`events` → `{'events': events}`) ✓
3. Error handling (safe defaults on failure) ✓
4. JSON parsing and sanitization ✓

### ⚠️ Things to Watch:
1. **Empty events**: Handled with safe defaults ✓
2. **Missing durationSec**: Backend calculates if missing ✓
3. **Gemini API failures**: Falls back to safe defaults ✓
4. **Malformed JSON**: Sanitized before storage ✓

## Test Cases

### Test 1: Normal Flow
```bash
# 1. Start session
POST /api/session/start
→ Returns: { sessionId: "uuid" }

# 2. Send events
POST /api/event
Body: { sessionId, ts, url, title }
→ Events stored with duration_sec calculated

# 3. End session
POST /api/session/end
→ Calls /api/analyze
→ Analyzer receives: { goal, events: [{ ts, url, title, durationSec }] }
→ Analyzer returns: { goalInferred, workspaces, resumeSummary, ... }
→ Stored in analysis table
```

### Test 2: Empty Session
```bash
POST /api/session/start
POST /api/session/end
→ Returns safe default analysis (no events)
```

### Test 3: Analysis Failure
```bash
# If Gemini API fails or returns invalid JSON
→ Backend catches error
→ Returns safe default analysis
→ Session still marked as ended
```
