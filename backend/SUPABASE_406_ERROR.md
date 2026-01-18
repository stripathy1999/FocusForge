# Supabase 406 Error - Troubleshooting

## Error Description

You're seeing 406 "Not Acceptable" errors for:
- `/rest/v1/subscriptions`
- `/rest/v1/team_subscriptions`

These are **Supabase system tables**, not your application tables.

## Possible Causes

### 1. Opennote Client-Side Code (Most Likely)

If the errors show `www.opennote.com` in the URL, these are from **Opennote's website**, not your backend:
- Opennote's frontend might be checking subscriptions
- This is unrelated to your practice set creation
- These errors are harmless and can be ignored

### 2. Supabase Client Configuration

If these errors are from your code, it might be:
- Missing Accept headers
- Wrong API version in headers
- Supabase client library trying to query system tables

## Solution: Fix Supabase Client Headers

If the errors are from your backend, ensure proper headers:

```typescript
import { createClient } from '@supabase/supabase-js'

export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseKey,
  {
    db: {
      schema: 'public' // Explicitly use public schema
    },
    global: {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'apikey': supabaseKey
      }
    }
  }
)
```

## Check If It's Your Code

1. **Open browser DevTools → Network tab**
2. **Filter by "subscriptions"**
3. **Check the Request URL**:
   - If it shows `www.opennote.com`: It's Opennote's code (ignore)
   - If it shows your domain: It's your code (needs fix)

## Quick Check

Look at the browser console for the full error URL:
- `www.opennote.com` = Opennote's client-side (safe to ignore)
- `your-domain.com` = Your code (needs investigation)

## Practice Set Creation

The practice set creation should still work even if Opennote's client shows these errors. These are likely:
- Opennote dashboard checking user subscriptions
- Unrelated to the API calls your backend makes
- Client-side JavaScript errors, not API failures

## Next Steps

1. **Check if practice set creation actually fails**
   - Does it create the practice set?
   - Does it return a `setId`?

2. **If practice creation works**: These 406 errors are harmless (Opennote's client code)

3. **If practice creation fails**: Check our Supabase client configuration
