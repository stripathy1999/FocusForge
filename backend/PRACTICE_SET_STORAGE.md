# Practice Set Storage Flow

## Where Practice Sets Are Saved

### 1. Initial Creation (Immediate)
**Location**: Database (`opennote_exports` table)

When you create a practice set:
- **`practice_set_id`** is stored in the `opennote_exports` table
- This links the session to the Opennote practice set ID
- Example: `practice_set_id = "5bf738ab-c635-4e30-a137-ea77d576d18d"`

**Database Table**: `opennote_exports`
```sql
CREATE TABLE opennote_exports (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL,
  journal_id TEXT,           -- For journal exports
  journal_url TEXT,          -- For journal exports
  practice_set_id TEXT,      -- ← Practice set ID stored here
  practice_set_url TEXT,     -- ← Practice set URL (filled later)
  created_at TIMESTAMP
);
```

### 2. After Generation (Webhook)
**Location**: Opennote Platform + Database (URL stored)

When Opennote finishes generating the problems (via webhook):
- The **practice problems are saved as an Opennote Journal**
- The **journal URL** is stored in `practice_set_url` in the database
- The problems themselves are in Opennote, not our database

**Flow:**
1. Opennote generates problems (async)
2. Opennote calls webhook: `/api/opennote/practice/webhook`
3. Webhook creates a journal in Opennote with problems + solutions
4. Database is updated: `practice_set_url = "https://opennote.com/journals/..."`

## How to Access Practice Sets

### Option 1: From Database
Query the `opennote_exports` table:
```sql
SELECT practice_set_id, practice_set_url 
FROM opennote_exports 
WHERE session_id = 'your-session-id';
```

### Option 2: Via API
Query the session's export record:
- Check if `practice_set_id` exists (practice set created)
- Check if `practice_set_url` exists (practice set ready)

### Option 3: From Opennote
- The practice problems are stored as a journal in Opennote
- Access via the `practice_set_url` stored in the database
- Or find it in your Opennote account directly

## Database Schema

```sql
-- Track all Opennote exports
opennote_exports:
  - session_id: Links to the session
  - practice_set_id: Opennote practice set ID (created immediately)
  - practice_set_url: Opennote journal URL (created after generation)
```

## Example Flow

1. **User clicks "Generate Practice Problems"**
   - API creates practice set in Opennote
   - `practice_set_id = "5bf738ab-..."` saved to DB

2. **Opennote generates problems** (takes time, async)

3. **Opennote calls webhook when ready**
   - Webhook creates journal in Opennote from problems
   - `practice_set_url = "https://opennote.com/journals/..."` saved to DB

4. **User can access practice set**
   - Via `practice_set_url` from database
   - Or directly in Opennote platform

## Important Notes

- ✅ **Practice set ID** is stored immediately in the database
- ⏳ **Practice problems** are generated asynchronously by Opennote
- ✅ **Practice set URL** is stored after webhook receives completed problems
- 📝 **Problems themselves** are in Opennote journals, not our database
- 🔗 **We only store the URL** to link back to the Opennote journal

## Checking Practice Set Status

To check if a practice set is ready:
```sql
SELECT 
  session_id,
  practice_set_id,    -- Always set if creation succeeded
  practice_set_url,   -- Only set if webhook completed
  created_at
FROM opennote_exports
WHERE session_id = 'your-session-id';
```

- If `practice_set_id` exists but `practice_set_url` is NULL: Still generating
- If `practice_set_url` exists: Practice set is ready! Open the URL
