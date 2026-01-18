# Opennote API Endpoint Fix

## Current Status

✅ **API Key**: Valid (no 401 errors)
❌ **Endpoints**: Need to be corrected

## Errors Received

1. **Journal Import**: `405 Method Not Allowed` on `/v1/journals/editor/import_from_markdown`
2. **Practice Create**: `404 Not Found` on `/v1/practice/create`

## Next Steps

The API key is working, but we need to find the correct endpoint paths. The endpoints we're using might be:

1. **Incorrect paths** - The actual Opennote API might use different paths
2. **Different method** - Maybe it's not POST, or needs different parameters
3. **API version** - The API structure might have changed

## Possible Solutions

### Option 1: Check Opennote API Documentation
- Visit https://docs.opennote.com
- Find the actual endpoint paths for:
  - Creating/importing journals
  - Creating practice sets

### Option 2: Try Alternative Endpoints
Common alternatives to try:
- `/v1/journals` (POST) - Create journal
- `/v1/journals/import` (POST) - Import markdown
- `/v1/journals/create` (POST) - Create journal
- `/v1/practice` (POST) - Create practice set
- `/v1/practice-sets` (POST) - Create practice set

### Option 3: Contact Opennote Support
- Ask for the correct API endpoint paths
- Verify the API key has the right permissions
- Check if there are any API changes

## Current Implementation

The code in `backend/lib/opennote.ts` uses:
- Journal: `POST /v1/journals/editor/import_from_markdown`
- Practice: `POST /v1/practice/create`

These need to be updated once we have the correct endpoints.

## Testing

Once endpoints are corrected, run:
```bash
cd backend
npx tsx test-opennote-real.ts
```

This will test the real API with your key.
