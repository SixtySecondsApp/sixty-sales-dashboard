# Deployment Guide - Extract Content Topics

Step-by-step guide for deploying the `extract-content-topics` edge function to Supabase.

## Prerequisites

### 1. Supabase CLI
```bash
# Install Supabase CLI
npm install -g supabase

# Verify installation
supabase --version

# Login to Supabase
supabase login
```

### 2. Environment Variables
Required secrets in your Supabase project:
- `ANTHROPIC_API_KEY` - Your Claude API key from anthropic.com
- `SUPABASE_URL` - Automatically provided by Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Automatically provided by Supabase
- `SUPABASE_ANON_KEY` - Automatically provided by Supabase

### 3. Database Setup
Ensure the migration has been run:
```bash
# Check if migration exists
supabase migrations list

# If migration 20250128_create_meeting_content_tables.sql is not applied:
supabase db push
```

## Deployment Steps

### Step 1: Link to Your Project
```bash
# Link to your Supabase project
supabase link --project-ref <your-project-ref>

# Verify linked project
supabase status
```

### Step 2: Set API Key Secret
```bash
# Set your Anthropic API key
supabase secrets set ANTHROPIC_API_KEY=sk-ant-api03-...

# Verify secret is set (will show redacted value)
supabase secrets list
```

### Step 3: Deploy the Function
```bash
# Deploy from project root
supabase functions deploy extract-content-topics

# Or deploy all functions
supabase functions deploy
```

### Step 4: Verify Deployment
```bash
# Check function logs
supabase functions logs extract-content-topics

# Test the function
curl -X POST \
  'https://your-project.supabase.co/functions/v1/extract-content-topics' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"meeting_id": "test-meeting-id"}'
```

## Testing

### Local Testing (Optional)
```bash
# Start local Supabase
supabase start

# Serve functions locally
supabase functions serve extract-content-topics --env-file .env.local

# Test locally
curl -X POST \
  'http://localhost:54321/functions/v1/extract-content-topics' \
  -H 'Authorization: Bearer YOUR_LOCAL_JWT' \
  -H 'Content-Type: application/json' \
  -d '{"meeting_id": "test-meeting-id"}'
```

### Environment File for Local Testing
Create `.env.local`:
```bash
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Monitoring

### View Real-Time Logs
```bash
# Tail logs for the function
supabase functions logs extract-content-topics --tail

# View logs with specific time range
supabase functions logs extract-content-topics --since 1h

# Filter for errors only
supabase functions logs extract-content-topics | grep ERROR
```

### Key Metrics to Monitor
- **Response Times**: Should be <100ms for cache hits, <3s for extraction
- **Error Rates**: Should be <0.5% excluding user errors (404, 422)
- **Cost**: Average ~$0.004 per extraction
- **Cache Hit Rate**: Target >60% for optimal cost efficiency

### Common Log Patterns
```bash
# Successful extraction (fresh)
[extract-content-topics] Processing meeting abc123... (force_refresh: false)
[extract-content-topics] Cache miss for meeting abc123...
[extract-content-topics] Claude API success (6500 input, 800 output tokens)
[extract-content-topics] Extracted 7 topics
[extract-content-topics] Completed in 2450ms

# Successful extraction (cached)
[extract-content-topics] Processing meeting abc123... (force_refresh: false)
[extract-content-topics] Cache hit for meeting abc123...
[extract-content-topics] Returned 7 cached topics in 43ms

# Error scenarios
[extract-content-topics] Meeting not found or access denied
[extract-content-topics] No transcript available for meeting
[extract-content-topics] Claude API error: 429 - Rate limit exceeded
```

## Troubleshooting

### Function Not Found
**Issue**: `Function not found: extract-content-topics`
```bash
# Verify deployment
supabase functions list

# If not listed, redeploy
supabase functions deploy extract-content-topics
```

### Authentication Errors
**Issue**: `Missing authorization header` or `Authentication failed`
```bash
# Verify JWT token is valid
curl -X GET \
  'https://your-project.supabase.co/rest/v1/meetings?limit=1' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'apikey: YOUR_ANON_KEY'

# If token is invalid, refresh it from your auth flow
```

### API Key Errors
**Issue**: `ANTHROPIC_API_KEY not configured` or `AI service not configured`
```bash
# Check if secret is set
supabase secrets list

# If missing, set it
supabase secrets set ANTHROPIC_API_KEY=sk-ant-api03-...

# Redeploy after setting secrets
supabase functions deploy extract-content-topics
```

### Database Errors
**Issue**: `Table meeting_content_topics does not exist`
```bash
# Check migrations status
supabase migrations list

# Apply missing migration
supabase db push

# Verify table exists
supabase db execute "SELECT * FROM meeting_content_topics LIMIT 1;"
```

### Rate Limiting
**Issue**: `429 Too Many Requests` from Claude API
- **Solution**: Implement exponential backoff in your client code
- **Prevention**: Use caching (avoid `force_refresh=true` unless necessary)
- **Alternative**: Consider upgrading Anthropic API tier

### Timeout Errors
**Issue**: `Request timeout` or `504 Gateway Timeout`
- **Cause**: Transcript is very large (>20K words)
- **Solution**:
  1. Verify transcript length isn't excessively long
  2. Consider chunking for transcripts >50K characters (future feature)
  3. Retry the request

## Performance Optimization

### Enable Caching
- **Default**: Caching is enabled by default
- **Cache Duration**: Indefinite until `force_refresh=true`
- **Best Practice**: Only use `force_refresh` when transcript content changes

### Batch Processing
For multiple meetings:
```typescript
// Good: Process in batches with delay
for (let i = 0; i < meetingIds.length; i += 5) {
  const batch = meetingIds.slice(i, i + 5)
  await Promise.all(batch.map(id => extractTopics(id)))
  await sleep(1000) // Delay between batches
}

// Bad: All at once (may hit rate limits)
await Promise.all(meetingIds.map(id => extractTopics(id)))
```

### Cost Optimization
- **Use Cache**: 60%+ cache hit rate = 60% cost savings
- **Avoid Unnecessary Refreshes**: Only refresh when transcript changes
- **Monitor Usage**: Track costs via `meeting_content_topics.cost_cents`

## Security

### RLS Policies
Verify Row Level Security is enabled:
```sql
-- Check RLS status
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'meeting_content_topics';

-- Should return: rowsecurity = true

-- Verify policies exist
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'meeting_content_topics';
```

### API Key Security
- **Never** commit API keys to version control
- Store in Supabase secrets management only
- Rotate keys periodically
- Monitor API usage for anomalies

### Access Control
- Function respects RLS via user authentication
- Service role used internally (safe, controlled scope)
- Users can only extract topics from meetings they own
- No cross-user data leakage possible

## Rollback Procedure

If deployment causes issues:

### Option 1: Redeploy Previous Version
```bash
# If you have the previous version in Git
git checkout <previous-commit>
supabase functions deploy extract-content-topics
git checkout main
```

### Option 2: Delete Function
```bash
# Remove the function entirely
supabase functions delete extract-content-topics

# Data in database remains intact (function is stateless)
```

### Option 3: Disable via Database
```sql
-- Create a kill switch in your application
UPDATE system_config
SET feature_flags = jsonb_set(
  feature_flags,
  '{extract_content_topics_enabled}',
  'false'
);
```

## Scaling Considerations

### Current Limits
- **Timeout**: 30 seconds per request
- **Concurrency**: Supabase handles automatically
- **Rate Limiting**: Claude API limits apply (~50 requests/minute)

### Future Scaling
If traffic increases significantly:
- Consider implementing a queue system
- Add Redis caching layer
- Batch process during off-peak hours
- Use webhook-based processing for async extraction

## Support & Maintenance

### Regular Maintenance Tasks
1. **Weekly**: Review error logs for patterns
2. **Monthly**: Analyze cost metrics and cache hit rates
3. **Quarterly**: Review API key security and rotate if needed

### Useful Dashboard Queries
```sql
-- Daily extraction volume
SELECT
  DATE(created_at) as date,
  COUNT(*) as extractions,
  SUM(cost_cents) as total_cost_cents,
  AVG(tokens_used) as avg_tokens
FROM meeting_content_topics
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Cache hit rate
SELECT
  COUNT(*) FILTER (WHERE extraction_version = 1) as first_extractions,
  COUNT(*) FILTER (WHERE extraction_version > 1) as re_extractions,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE extraction_version > 1) / NULLIF(COUNT(*), 0),
    2
  ) as cache_hit_rate
FROM meeting_content_topics
WHERE created_at >= NOW() - INTERVAL '30 days';

-- Cost by user (top 10)
SELECT
  u.email,
  COUNT(mct.id) as extractions,
  SUM(mct.cost_cents) as total_cost_cents
FROM meeting_content_topics mct
JOIN auth.users u ON mct.user_id = u.id
WHERE mct.created_at >= NOW() - INTERVAL '30 days'
GROUP BY u.id, u.email
ORDER BY total_cost_cents DESC
LIMIT 10;
```

## Next Steps

After successful deployment:
1. ✅ Verify function works with test meeting
2. ✅ Monitor logs for first 24 hours
3. ✅ Set up cost tracking dashboard
4. ✅ Document any organization-specific deployment notes
5. ✅ Train team on proper usage patterns

## Additional Resources

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Claude API Documentation](https://docs.anthropic.com/claude/reference)
- [Function README](./README.md)
- [Usage Examples](./examples.md)
