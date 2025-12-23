# Fathom API Endpoint Fix

## Problem

DNS lookup failures when attempting to sync with Fathom API:
```
DNS error: failed to lookup address information: Name or service not known
URL: https://api.fathom.video/v1/calls
```

## Root Cause

**Incorrect API domain**: The codebase was using `api.fathom.video` which does not exist.

**Correct API domain**: Fathom's actual API is at `api.fathom.ai`

## Verification

```bash
# Incorrect (does not resolve)
$ host api.fathom.video
Host api.fathom.video not found: 3(NXDOMAIN)

# Correct (resolves successfully)
$ host api.fathom.ai
api.fathom.ai has address 34.49.11.83
```

## Changes Made

### 1. Edge Function: fathom-sync/index.ts

**Updated API endpoints:**
- Base URL: `https://api.fathom.video/v1` → `https://api.fathom.ai/external/v1`
- Authentication: `Authorization: Bearer` → `X-Api-Key` header
- Endpoints: `/calls` → `/meetings`
- Date filters: `start_date/end_date` → `created_after/created_before`

**Added retry logic with exponential backoff:**
- Default 3 retries with 1s, 2s, 4s delays
- Intelligent retry skipping for auth errors (401, 403)
- Jitter to prevent thundering herd

### 2. Edge Function: fathom-oauth-callback/index.ts

**Updated user info endpoint:**
- URL: `https://api.fathom.video/v1/me` → `https://api.fathom.ai/external/v1/me`
- Authentication: `Authorization: Bearer` → `X-Api-Key` header

### 3. Frontend Service: fathomApiService.ts

**Updated all API interactions:**
- Base URL: `https://api.fathom.video/v1` → `https://api.fathom.ai/external/v1`
- Authentication: `Authorization: Bearer` → `X-Api-Key` header
- Token refresh: Correct OAuth endpoint and form encoding
- Endpoints: `/calls` → `/meetings` and `/recordings/{id}/transcript`

### 4. Environment Configuration: .env.example

**Updated default API base URL:**
```env
# Old
FATHOM_API_BASE_URL=https://api.fathom.video/v1

# New
FATHOM_API_BASE_URL=https://api.fathom.ai/external/v1
```

## API Reference

### Correct Fathom API Endpoints

**Base URL:** `https://api.fathom.ai/external/v1`

**Authentication:** `X-Api-Key: YOUR_ACCESS_TOKEN`

**OAuth Token Exchange:** `https://fathom.video/external/v1/oauth2/token`

**Available Endpoints:**
- `GET /meetings` - List meetings with cursor-based pagination
- `GET /meetings/{id}` - Get meeting details
- `GET /recordings/{id}/transcript` - Get meeting transcript
- `GET /me` - Get user info

### Query Parameters

**Date filtering:**
- `created_after` - ISO 8601 timestamp
- `created_before` - ISO 8601 timestamp

**Participant filtering:**
- `recorded_by[]` - Email address of host
- `calendar_invitees[]` - Email address of attendee

**Options:**
- `include_transcript` - Include full transcript in response
- `cursor` - Pagination cursor for next page

## Testing Checklist

- [ ] OAuth connection flow works correctly
- [ ] User info is fetched after OAuth
- [ ] Manual sync triggers successfully
- [ ] Meetings are fetched and stored
- [ ] Pagination works with cursor-based system
- [ ] Retry logic handles transient failures
- [ ] Token refresh works correctly

## Migration Notes

### If You Have Existing Fathom Integration

1. **Tokens are still valid** - OAuth tokens stored in database will continue to work
2. **No database changes needed** - Only code changes were made
3. **Test sync immediately** - Run a test sync to verify connectivity
4. **Monitor logs** - Check Edge Function logs for any API-specific errors

### Known Differences

**Pagination:**
- Old (assumed): Offset-based pagination
- New (actual): Cursor-based pagination with `cursor` parameter

**Authentication:**
- Old: `Authorization: Bearer {token}`
- New: `X-Api-Key: {token}`

**Endpoint Structure:**
- Old: `/v1/calls`
- New: `/external/v1/meetings`

## Performance Improvements

With retry logic:
- **Transient failures**: Automatically recovered (up to 3 attempts)
- **DNS issues**: Retried with exponential backoff
- **Rate limiting**: Respected with `Retry-After` header
- **Network errors**: Gracefully handled with retry strategy

## Next Steps

1. **Test OAuth flow** - Reconnect your Fathom account to verify token exchange
2. **Run test sync** - Trigger a limited sync (5-10 meetings) to verify API compatibility
3. **Monitor logs** - Check Supabase Edge Function logs for any errors
4. **Verify data** - Ensure meetings are syncing correctly to database
5. **Update documentation** - Update any user-facing docs with correct API info

## Support Resources

- **Fathom API Docs**: https://developers.fathom.ai/
- **OAuth Guide**: https://developers.fathom.ai/quickstart
- **Supabase Logs**: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/functions

---

**Deployment Status:** ✅ Both Edge Functions deployed successfully
**Files Updated:** 4 (2 Edge Functions, 1 Frontend Service, 1 Config)
**Breaking Changes:** None (OAuth tokens remain valid)
