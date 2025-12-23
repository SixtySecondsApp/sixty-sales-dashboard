# Integration Testing Fix Guide

This guide covers all the issues found in integration testing and how to resolve them.

## Code Fixes Applied

These fixes have already been applied to the codebase:

### 1. Google Integration - UUID "undefined" Error ✅ FIXED
**File**: `src/pages/admin/IntegrationsDashboard.tsx`

**Problem**: `createGoogleTests()` was called without the required `userId` parameter.

**Fix Applied**:
- Added `currentUserId` state and `useEffect` to fetch current user
- Updated test creator to pass `currentUserId` to `createGoogleTests()`

### 2. Fathom Meeting Data - Column Not Found ✅ FIXED
**File**: `src/lib/integrationTesting/suites/fathomTests.ts`

**Problem**: Test queried for `external_id` column which doesn't exist in `meetings` table.

**Fix Applied**: Changed query to use `fathom_recording_id` instead.

### 3. HubSpot API Connectivity - Function Not Found ✅ FIXED
**File**: `src/lib/integrationTesting/suites/hubspotTests.ts`

**Problem**: Tests called `hubspot-get-pipelines` and `hubspot-get-properties` which don't exist.

**Fix Applied**: Changed to call `hubspot-admin` with appropriate `action` parameter.

---

## Configuration Fixes Required

### HubSpot Integration

| Test | Issue | How to Fix |
|------|-------|------------|
| Pipeline Mapping Configuration | No HubSpot pipeline selected | Go to **Settings → Integrations → HubSpot** and select a deal pipeline to map |
| Form Ingestion Status | Forms enabled but none selected | Go to **Settings → Integrations → HubSpot → Forms** and select forms to ingest |
| AI Note Writeback Status | Enabled but no features selected | Go to **Settings → Integrations → HubSpot → AI Writeback** and configure features |

### Slack Integration

| Test | Issue | How to Fix |
|------|-------|------------|
| Daily Digest Configuration | No schedule time configured | Go to **Settings → Integrations → Slack → Daily Digest** and set schedule time |
| User Mappings Status | Only 9% users mapped (4/47) | Go to **Settings → Integrations → Slack → User Mappings** and map Slack users to CRM users |

### SavvyCal Integration

| Test | Issue | How to Fix |
|------|-------|------------|
| API Token Validation | No API token configured | Go to **Settings → Integrations → SavvyCal** and add your API token |
| Webhook Configuration | Webhook not verified | Complete webhook verification in SavvyCal dashboard |

### Google Integration

| Test | Issue | How to Fix |
|------|-------|------------|
| Connection Status | Not connected | User needs to authenticate via **Settings → Integrations → Google** |
| OAuth Scopes | Missing scopes | Re-authenticate with required permissions (Calendar is minimum) |

---

## Edge Function Deployment

If Edge Functions are returning `FunctionsFetchError`, verify they're deployed:

```bash
# Check which functions are deployed
supabase functions list

# Deploy all functions
supabase functions deploy

# Deploy specific function
supabase functions deploy hubspot-admin
supabase functions deploy google-test-connection
supabase functions deploy fathom-sync
supabase functions deploy slack-list-channels
supabase functions deploy savvycal-config
```

---

## Environment Variables

Verify these are set in your Supabase project:

### Required for All Functions
```env
SUPABASE_URL=<your-project-url>
SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

### Required for Google Integration
```env
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
```

### Optional CORS Configuration
```env
# If tests run on custom domains not in the default allowlist
ALLOWED_ORIGINS=https://your-custom-domain.com,https://your-preview.vercel.app
FRONTEND_URL=https://your-app.com
```

To set environment variables:
```bash
supabase secrets set GOOGLE_CLIENT_ID=your-value
supabase secrets set GOOGLE_CLIENT_SECRET=your-value
```

---

## Timeout Issues

If tests are timing out (especially Fathom API Connectivity and Edge Function Health):

### Causes
1. **Cold start delays**: First function invocation after deployment can take 5-10 seconds
2. **Token refresh**: OAuth token refresh adds extra HTTP calls
3. **External API latency**: Fathom, Google, HubSpot APIs may be slow

### Solutions
1. **Warm up functions**: Run tests once to warm up, then run again
2. **Increase timeout**: In test definitions, increase timeout from 20000ms to 30000ms
3. **Check Supabase dashboard**: Go to Edge Functions → Logs to see if functions are running

---

## CORS Issues

If you see `FunctionsFetchError` in browser but functions work in Postman:

### Default Allowed Origins
The Edge Functions allow these origins by default:
- `http://localhost:5173`, `http://localhost:3000`
- `https://sixty.io`, `https://app.sixty.io`
- `https://use60.com`, `https://app.use60.com`
- `https://sixtyseconds.video`, `https://app.sixtyseconds.video`
- `https://sixty-sales-dashboard.vercel.app`
- `*.vercel.app` (pattern match)

### If Your Domain Isn't Listed
Set the `ALLOWED_ORIGINS` environment variable:
```bash
supabase secrets set ALLOWED_ORIGINS="https://your-domain.com,https://preview-*.vercel.app"
```

---

## Test-by-Test Resolution Guide

### Fathom Integration (Target: 7/7)

| Test | Current | Fix |
|------|---------|-----|
| Connection Status | ✅ Pass | N/A |
| OAuth Token Validation | ❌ Fail | Ensure Fathom is connected and tokens are valid |
| API Connectivity | ❌ Timeout | Wait for cold start, check Supabase logs |
| Sync State Health | ✅ Pass | N/A |
| Meeting Data Integrity | ❌ Error | **FIXED** - Code change applied |
| Webhook Configuration | ✅ Pass | N/A |
| Edge Function Health | ❌ Timeout | Wait for cold start, check function deployment |

### HubSpot Integration (Target: 15/15)

| Test | Current | Fix |
|------|---------|-----|
| Connection Status | ✅ Pass | N/A |
| OAuth Token Validation | ✅ Pass | N/A |
| OAuth Scopes Verification | ✅ Pass | N/A |
| API Connectivity | ❌ Fail | **FIXED** - Now calls correct function |
| Sync State Health | ✅ Pass | N/A |
| Queue Processing Health | ✅ Pass | N/A |
| Contact Sync Status | ✅ Pass | N/A |
| Deal Sync Status | ✅ Pass | N/A |
| Task Sync Status | ⏭️ Skip | Enable task sync if needed |
| Pipeline Mapping Config | ❌ Fail | **CONFIG**: Select a HubSpot pipeline |
| Webhook Configuration | ✅ Pass | N/A |
| Form Ingestion Status | ❌ Fail | **CONFIG**: Select forms to ingest |
| AI Note Writeback Status | ❌ Fail | **CONFIG**: Configure AI writeback features |
| Edge Function Health | ✅ Pass | N/A |
| Object Mapping Integrity | ✅ Pass | N/A |

### Slack Integration (Target: 13/13)

| Test | Current | Fix |
|------|---------|-----|
| Connection Status | ✅ Pass | N/A |
| Bot Token Validation | ✅ Pass | N/A |
| API Connectivity | ❌ Fail | Check Edge Function logs for error details |
| Channel Access | ✅ Pass | N/A |
| Meeting Debrief Config | ✅ Pass | N/A |
| Daily Digest Config | ❌ Fail | **CONFIG**: Set schedule time |
| Meeting Prep Config | ✅ Pass | N/A |
| Deal Rooms Config | ✅ Pass | N/A |
| User Mappings Status | ❌ Fail | **CONFIG**: Map more users (currently 4/47) |
| Notification Delivery | ✅ Pass | N/A |
| Deal Room Health | ✅ Pass | N/A |
| Edge Function Health | ✅ Pass | N/A |
| Features Summary | ✅ Pass | N/A |

### Google Integration (Target: 15/15)

| Test | Current | Fix |
|------|---------|-----|
| Connection Status | ❌ Fail | **FIXED** - Was getting undefined userId |
| OAuth Token Validation | ❌ Fail | User needs to connect Google account |
| OAuth Scopes Validation | ❌ Fail | User needs to grant required scopes |
| Google API Connectivity | ❌ Fail | Connect Google first, then verify env vars |
| Gmail Labels Access | ⏭️ Skip | Grant Gmail scope |
| Gmail Messages Access | ⏭️ Skip | Grant Gmail scope |
| Calendar List Access | ❌ Fail | Connect Google, grant Calendar scope |
| Calendar Events Access | ❌ Fail | Connect Google, grant Calendar scope |
| Calendar Sync State | ❌ Error | Connect Google first |
| Tasks Lists Access | ⏭️ Skip | Grant Tasks scope |
| Tasks Sync State | ✅ Pass | N/A |
| Drive Access | ⏭️ Skip | Grant Drive scope |
| Database Health | ❌ Fail | Check RLS policies for calendar tables |
| Edge Functions Health | ✅ Pass | N/A |
| Services Summary | ❌ Fail | Connect Google to pass |

### SavvyCal Integration (Target: 11/11)

| Test | Current | Fix |
|------|---------|-----|
| Connection Status | ✅ Pass | N/A |
| API Token Validation | ❌ Fail | **CONFIG**: Add API token |
| API Connectivity | ✅ Pass | N/A |
| Webhook Configuration | ❌ Fail | **CONFIG**: Verify webhook in SavvyCal |
| Webhook Health | ⏭️ Skip | Configure webhook first |
| Sync State | ✅ Pass | N/A |
| Lead Data Integrity | ⏭️ Skip | Configure webhook first |
| Source Mappings | ✅ Pass | N/A |
| Database Health | ❌ Fail | Check RLS policies |
| Edge Functions Health | ✅ Pass | N/A |
| Integration Summary | ✅ Pass | N/A |

---

## Quick Action Checklist

### Immediate Code Fixes (Done)
- [x] Fix Google userId parameter in IntegrationsDashboard
- [x] Fix Fathom external_id column reference
- [x] Fix HubSpot function names (hubspot-admin)

### Configuration Required
- [ ] HubSpot: Select pipeline mapping
- [ ] HubSpot: Select forms for ingestion
- [ ] HubSpot: Configure AI writeback features
- [ ] Slack: Set daily digest schedule time
- [ ] Slack: Map more users (aim for >50%)
- [ ] SavvyCal: Add API token
- [ ] SavvyCal: Verify webhook
- [ ] Google: Have user connect and grant scopes

### Environment Verification
- [ ] Verify `GOOGLE_CLIENT_ID` is set
- [ ] Verify `GOOGLE_CLIENT_SECRET` is set
- [ ] Verify `ALLOWED_ORIGINS` includes your domains (if custom)

### Testing
- [ ] Re-run all integration tests after fixes
- [ ] Check Supabase Edge Function logs for any errors
- [ ] Verify cold start times aren't causing timeouts

---

## Expected Results After Fixes

| Integration | Before | After (Expected) |
|-------------|--------|------------------|
| Fathom | 3/7 | 6-7/7 |
| HubSpot | 10/15 | 14-15/15 |
| Slack | 10/13 | 12-13/13 |
| Google | 2/15 | 10-15/15 (depends on scopes granted) |
| SavvyCal | 6/11 | 9-11/11 |
| **Total** | 31/61 | 51-61/61 |

---

## Troubleshooting

### "Failed to send a request to the Edge Function"
1. Check if function is deployed: `supabase functions list`
2. Check function logs: Supabase Dashboard → Edge Functions → Logs
3. Verify CORS origins include your domain
4. Check for network/firewall issues

### "invalid input syntax for type uuid"
1. Verify userId/orgId is being passed correctly
2. Check if user is authenticated
3. Verify the test is using correct parameter names

### Timeouts (>20-30 seconds)
1. First run may be slow (cold start)
2. Check external API status (Fathom, Google, HubSpot)
3. Check Supabase Edge Function logs for slow operations
4. Consider increasing test timeout values

### Database Errors
1. Check RLS policies on relevant tables
2. Verify user has correct org membership
3. Check if required columns exist (run migrations)
