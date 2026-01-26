# Sentry Configuration Verification Guide

## Environment Configuration

Sentry is now configured to **only run in production**.

| Environment | VITE_ENVIRONMENT | Sentry Status |
|-------------|------------------|---------------|
| Production | `production` | ✅ ENABLED - Sends errors |
| Staging/Preview | `staging` | 🚫 DISABLED - No data sent |
| Development/Local | `development` | 🚫 DISABLED - No data sent |

## Verification Steps

### 1. Check Vercel Environment Variables

```bash
# Verify all environments have VITE_ENVIRONMENT set
vercel env ls | grep VITE_ENVIRONMENT

# Should show:
# VITE_ENVIRONMENT  production  Production
# VITE_ENVIRONMENT  staging     Preview
# VITE_ENVIRONMENT  development Development
```

### 2. Verify Production Build

After deploying to production:

1. Open browser console on https://app.use60.com
2. Look for: `[Sentry] Initialized successfully { environment: 'production' }`
3. Test error reporting:
   ```javascript
   // In browser console
   window.testSentryFatal('Production verification test')
   ```
4. Check Sentry dashboard for the test error

### 3. Verify Staging Build

After deploying to staging/preview:

1. Open browser console on your staging URL
2. Look for one of:
   - `[Sentry] No SENTRY_DSN provided - error monitoring disabled`
   - Sentry initialized but with `enabled: false`
3. Verify no errors are sent:
   ```javascript
   // This should NOT appear in Sentry
   throw new Error('Staging test - should NOT be in Sentry')
   ```
4. Check Sentry dashboard - should NOT see this error

### 4. Verify Local Development

In local development:

1. Start dev server: `npm run dev`
2. Open browser console on http://localhost:5175
3. Should see: `[Sentry] No SENTRY_DSN provided - error monitoring disabled`
4. Errors logged to console only, not sent to Sentry

## Troubleshooting

### Production: Sentry Not Initializing

**Symptom**: Console shows "No SENTRY_DSN provided"

**Check**:
```bash
# Verify production env vars on Vercel
vercel env pull .env.production-check
grep VITE_ENVIRONMENT .env.production-check
grep VITE_SENTRY_DSN .env.production-check
rm .env.production-check
```

**Should be**:
- `VITE_ENVIRONMENT="production"`
- `VITE_SENTRY_DSN="https://..."`

### Staging: Sentry Still Sending Errors

**Symptom**: Errors from staging appear in Sentry dashboard

**Check**:
```bash
# Verify preview env vars
vercel env ls | grep -A 1 "VITE_ENVIRONMENT"
```

**Should show**:
- Preview environment: `staging`
- NOT `production`

**Fix**:
```bash
vercel env rm VITE_ENVIRONMENT preview
echo "staging" | vercel env add VITE_ENVIRONMENT preview
```

### Build Warnings

If you see build warnings about Sentry:
- This is normal - Sentry plugin only runs in production builds
- Staging builds may show: "Sentry plugin skipped (not production)"

## Configuration Files

### Source Code
- Main config: `src/lib/sentry.ts`
- Vite plugin: `vite.config.ts` (lines 49-74)

### Environment Files
- Production: `.env.production` (`VITE_ENVIRONMENT=production`)
- Staging: `.env.staging` (`VITE_ENVIRONMENT=staging`)
- Local: `.env` (`VITE_ENVIRONMENT=development`)

### Vercel Dashboard
- Project: sixty-seconds/sixty-app
- Environment Variables: Settings → Environment Variables
- Required vars:
  - `VITE_ENVIRONMENT` (production/staging/development)
  - `VITE_SENTRY_DSN` (production only)

## Expected Sentry Data

### Production Only
- User errors and exceptions
- Performance traces (10% sample rate)
- Session replays (1% sample rate, 100% on errors)
- Failed HTTP requests (401, 403, 429, 5xx)

### Staging/Development (None)
- No data sent
- All errors logged to console only
- No session replays
- No performance tracking

## Rollback Plan

If issues occur, you can temporarily disable Sentry in production:

```bash
# Option 1: Remove DSN from production
vercel env rm VITE_SENTRY_DSN production

# Option 2: Change environment to disable
vercel env rm VITE_ENVIRONMENT production
echo "staging" | vercel env add VITE_ENVIRONMENT production
```

Then redeploy:
```bash
git commit --allow-empty -m "Trigger Vercel deploy"
git push origin main
```

## Success Criteria

✅ Production: Sentry dashboard shows recent errors
✅ Staging: No staging errors in Sentry dashboard
✅ Development: Console shows Sentry disabled message
✅ No build errors or warnings
✅ All environments deploy successfully
