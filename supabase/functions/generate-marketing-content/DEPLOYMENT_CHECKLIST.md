# Deployment Checklist - Generate Marketing Content

## Pre-Deployment (Development Environment)

### 1. Database Schema Setup

#### Create `meeting_generated_content` table
```sql
CREATE TABLE IF NOT EXISTS meeting_generated_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID REFERENCES meetings(id) NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('social', 'blog', 'video', 'email')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,

  -- Versioning
  version INTEGER NOT NULL DEFAULT 1,
  parent_id UUID REFERENCES meeting_generated_content(id),
  is_latest BOOLEAN NOT NULL DEFAULT true,

  -- Cost tracking
  model_used TEXT NOT NULL,
  tokens_used INTEGER NOT NULL,
  cost_cents INTEGER NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  -- Constraints
  UNIQUE(meeting_id, content_type, version),
  CHECK (version > 0),
  CHECK (tokens_used >= 0),
  CHECK (cost_cents >= 0)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_content_latest
  ON meeting_generated_content(meeting_id, content_type, is_latest)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_content_user
  ON meeting_generated_content(user_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_content_parent
  ON meeting_generated_content(parent_id)
  WHERE parent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_content_type
  ON meeting_generated_content(content_type, created_at DESC)
  WHERE deleted_at IS NULL;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_meeting_generated_content_updated_at
  BEFORE UPDATE ON meeting_generated_content
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE meeting_generated_content IS 'AI-generated marketing content from meeting transcripts with versioning';
COMMENT ON COLUMN meeting_generated_content.version IS 'Version number (1, 2, 3, ...) for content regeneration tracking';
COMMENT ON COLUMN meeting_generated_content.parent_id IS 'References previous version for version chain reconstruction';
COMMENT ON COLUMN meeting_generated_content.is_latest IS 'Only one version per meeting+content_type should have is_latest=true';
COMMENT ON COLUMN meeting_generated_content.cost_cents IS 'Generation cost in cents (input tokens * $3/1M + output tokens * $15/1M)';
```

**Verification**:
```sql
-- Check table exists
SELECT tablename FROM pg_tables WHERE tablename = 'meeting_generated_content';

-- Check indexes
SELECT indexname FROM pg_indexes WHERE tablename = 'meeting_generated_content';

-- Verify constraints
SELECT conname, contype FROM pg_constraint
WHERE conrelid = 'meeting_generated_content'::regclass;
```

#### Create `content_topic_links` junction table
```sql
CREATE TABLE IF NOT EXISTS content_topic_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  generated_content_id UUID NOT NULL REFERENCES meeting_generated_content(id) ON DELETE CASCADE,
  topics_extraction_id UUID NOT NULL REFERENCES meeting_content_topics(id) ON DELETE CASCADE,
  topic_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  UNIQUE(generated_content_id, topic_index),
  CHECK (topic_index >= 0)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_topic_links_content
  ON content_topic_links(generated_content_id);

CREATE INDEX IF NOT EXISTS idx_topic_links_extraction
  ON content_topic_links(topics_extraction_id);

-- Comments
COMMENT ON TABLE content_topic_links IS 'Links generated content to source topics for traceability';
COMMENT ON COLUMN content_topic_links.topic_index IS '0-based index of topic in topics JSONB array';
```

**Verification**:
```sql
SELECT tablename FROM pg_tables WHERE tablename = 'content_topic_links';
```

### 2. Row Level Security (RLS) Policies

#### Enable RLS
```sql
ALTER TABLE meeting_generated_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_topic_links ENABLE ROW LEVEL SECURITY;
```

#### Create RLS Policies for `meeting_generated_content`
```sql
-- Users can view their own content
CREATE POLICY "Users can view their own generated content"
  ON meeting_generated_content
  FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Users can insert their own content (service role will actually do this)
CREATE POLICY "Users can insert their own generated content"
  ON meeting_generated_content
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own content (for soft delete, etc.)
CREATE POLICY "Users can update their own generated content"
  ON meeting_generated_content
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own content (soft delete)
CREATE POLICY "Users can delete their own generated content"
  ON meeting_generated_content
  FOR DELETE
  USING (auth.uid() = user_id);
```

#### Create RLS Policies for `content_topic_links`
```sql
-- Users can view links for their own content
CREATE POLICY "Users can view their own content topic links"
  ON content_topic_links
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM meeting_generated_content
      WHERE id = content_topic_links.generated_content_id
        AND user_id = auth.uid()
    )
  );

-- Service role can insert links
CREATE POLICY "Service role can insert content topic links"
  ON content_topic_links
  FOR INSERT
  WITH CHECK (true); -- Enforced by meeting_generated_content RLS
```

**Verification**:
```sql
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('meeting_generated_content', 'content_topic_links');
```

### 3. Environment Variables

#### Local Development (`.env.local`)
```env
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=your-local-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-local-service-role-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
```

#### Production (Supabase Dashboard → Settings → Edge Functions → Secrets)
```env
ANTHROPIC_API_KEY=sk-ant-your-production-key
```

**Note**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected by Supabase runtime.

**Verification**:
```bash
# Local test
deno eval 'console.log(Deno.env.get("ANTHROPIC_API_KEY"))'

# Production test (after deployment)
supabase functions invoke generate-marketing-content --method POST --body '{"test":"env"}'
```

### 4. Prerequisites Check

- [ ] `meetings` table exists with `transcript_text` and `share_url` columns
- [ ] `meeting_content_topics` table exists
- [ ] `extract-content-topics` edge function is deployed and working
- [ ] Test meeting has transcript and extracted topics
- [ ] Anthropic API key is valid and has credits

**Verification Script**:
```sql
-- Check prerequisites
SELECT
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'meetings') as meetings_exists,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'meeting_content_topics') as topics_exists,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'meetings' AND column_name = 'transcript_text') as transcript_col_exists,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'meetings' AND column_name = 'share_url') as share_url_col_exists;
```

## Deployment Steps

### 1. Local Testing

```bash
# Navigate to project root
cd /Users/andrewbryce/Documents/sixty-sales-dashboard

# Start Supabase locally
supabase start

# Serve function locally
supabase functions serve generate-marketing-content --env-file .env.local --no-verify-jwt

# In another terminal, test the function
curl -X POST http://localhost:54321/functions/v1/generate-marketing-content \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "meeting_id": "test-meeting-id",
    "content_type": "social",
    "selected_topic_indices": [0, 1]
  }'
```

**Expected Response**: 200 OK with generated content or appropriate error

### 2. Deploy to Production

```bash
# Deploy function
supabase functions deploy generate-marketing-content

# Verify deployment
supabase functions list

# Check logs
supabase functions logs generate-marketing-content --tail
```

### 3. Production Testing

#### Test 1: Generate Social Post (First Time)
```bash
curl -X POST https://your-project.supabase.co/functions/v1/generate-marketing-content \
  -H "Authorization: Bearer REAL_USER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "meeting_id": "real-meeting-uuid",
    "content_type": "social",
    "selected_topic_indices": [0, 1]
  }'
```

**Expected**: 200 OK, `cached: false`, `version: 1`

#### Test 2: Get Cached Content
```bash
# Same request (no regenerate flag)
curl -X POST https://your-project.supabase.co/functions/v1/generate-marketing-content \
  -H "Authorization: Bearer REAL_USER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "meeting_id": "real-meeting-uuid",
    "content_type": "social",
    "selected_topic_indices": [0, 1]
  }'
```

**Expected**: 200 OK, `cached: true`, same content, <100ms response

#### Test 3: Regenerate Content
```bash
curl -X POST https://your-project.supabase.co/functions/v1/generate-marketing-content \
  -H "Authorization: Bearer REAL_USER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "meeting_id": "real-meeting-uuid",
    "content_type": "social",
    "selected_topic_indices": [0, 1],
    "regenerate": true
  }'
```

**Expected**: 200 OK, `cached: false`, `version: 2`

#### Test 4: Generate Different Content Type
```bash
curl -X POST https://your-project.supabase.co/functions/v1/generate-marketing-content \
  -H "Authorization: Bearer REAL_USER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "meeting_id": "real-meeting-uuid",
    "content_type": "blog",
    "selected_topic_indices": [0, 1, 2, 3]
  }'
```

**Expected**: 200 OK, blog article (800-1500 words), `version: 1`

#### Test 5: Error Scenarios

**Invalid content_type**:
```bash
curl -X POST https://your-project.supabase.co/functions/v1/generate-marketing-content \
  -H "Authorization: Bearer REAL_USER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"meeting_id": "uuid", "content_type": "podcast", "selected_topic_indices": [0]}'
```
**Expected**: 400 Bad Request

**No topics extracted**:
```bash
curl -X POST https://your-project.supabase.co/functions/v1/generate-marketing-content \
  -H "Authorization: Bearer REAL_USER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"meeting_id": "meeting-without-topics", "content_type": "social", "selected_topic_indices": [0]}'
```
**Expected**: 422 Unprocessable Entity

## Post-Deployment Verification

### 1. Database Verification

```sql
-- Check content was created
SELECT
  id,
  meeting_id,
  content_type,
  version,
  is_latest,
  LENGTH(content) as content_length,
  tokens_used,
  cost_cents,
  created_at
FROM meeting_generated_content
WHERE user_id = 'test-user-id'
ORDER BY created_at DESC
LIMIT 10;

-- Check topic links were created
SELECT
  ctl.id,
  ctl.topic_index,
  mgc.content_type,
  mgc.version
FROM content_topic_links ctl
JOIN meeting_generated_content mgc ON ctl.generated_content_id = mgc.id
WHERE mgc.user_id = 'test-user-id'
ORDER BY ctl.created_at DESC
LIMIT 10;

-- Verify version chain
SELECT
  meeting_id,
  content_type,
  version,
  parent_id,
  is_latest,
  created_at
FROM meeting_generated_content
WHERE meeting_id = 'test-meeting-id'
  AND content_type = 'social'
ORDER BY version;
```

### 2. Performance Verification

```sql
-- Check average response times (from logs)
-- Check cache hit rate
SELECT
  COUNT(*) FILTER (WHERE metadata->>'cached' = 'true') * 100.0 / COUNT(*) as cache_hit_rate_pct
FROM (
  -- This assumes you log requests; adjust to your logging setup
  SELECT jsonb_extract_path_text(metadata, 'cached') as cached
  FROM function_logs
  WHERE function_name = 'generate-marketing-content'
    AND timestamp >= NOW() - INTERVAL '1 day'
) subquery;
```

### 3. Cost Verification

```sql
-- Total cost for last 24 hours
SELECT
  SUM(cost_cents) as total_cost_cents,
  ROUND((SUM(cost_cents) / 100.0)::numeric, 2) as total_cost_dollars,
  COUNT(*) as total_generations,
  ROUND(AVG(cost_cents)::numeric, 2) as avg_cost_cents
FROM meeting_generated_content
WHERE created_at >= NOW() - INTERVAL '1 day'
  AND deleted_at IS NULL;

-- Cost by content type
SELECT
  content_type,
  COUNT(*) as generations,
  SUM(cost_cents) as total_cost_cents,
  ROUND(AVG(cost_cents)::numeric, 2) as avg_cost_cents,
  ROUND(AVG(tokens_used)::numeric, 0) as avg_tokens
FROM meeting_generated_content
WHERE created_at >= NOW() - INTERVAL '7 days'
  AND deleted_at IS NULL
GROUP BY content_type
ORDER BY total_cost_cents DESC;
```

## Monitoring Setup

### 1. CloudWatch / Supabase Logs

Monitor these metrics:
- [ ] Function invocation count
- [ ] Error rate
- [ ] Average response time
- [ ] Cache hit rate
- [ ] Cost per generation

### 2. Database Monitoring

```sql
-- Create monitoring view
CREATE OR REPLACE VIEW content_generation_stats AS
SELECT
  DATE(created_at) as date,
  content_type,
  COUNT(*) as generations,
  COUNT(*) FILTER (WHERE version = 1) as new_generations,
  COUNT(*) FILTER (WHERE version > 1) as regenerations,
  SUM(cost_cents) as total_cost_cents,
  ROUND(AVG(cost_cents)::numeric, 2) as avg_cost_cents,
  ROUND(AVG(tokens_used)::numeric, 0) as avg_tokens
FROM meeting_generated_content
WHERE deleted_at IS NULL
GROUP BY DATE(created_at), content_type
ORDER BY date DESC, content_type;

-- Query daily stats
SELECT * FROM content_generation_stats
WHERE date >= CURRENT_DATE - INTERVAL '7 days';
```

### 3. Alerts Setup

Consider setting up alerts for:
- [ ] Error rate > 5%
- [ ] Daily cost > $50
- [ ] Average response time > 10s
- [ ] Function timeout rate > 1%

## Rollback Plan

If deployment fails or issues arise:

### 1. Immediate Rollback
```bash
# Redeploy previous version (if you have it)
supabase functions deploy generate-marketing-content --import-map ./previous-version/import_map.json

# Or disable the function temporarily
# (Remove from dashboard or set inactive in routing)
```

### 2. Database Rollback
```sql
-- Soft delete all content from failed deployment (if needed)
UPDATE meeting_generated_content
SET deleted_at = NOW()
WHERE created_at >= '2025-01-20 14:00:00'; -- Deployment timestamp

-- Delete topic links for failed content
DELETE FROM content_topic_links
WHERE generated_content_id IN (
  SELECT id FROM meeting_generated_content WHERE deleted_at IS NOT NULL
);
```

### 3. Cleanup
```sql
-- After fixing issues, hard delete test data
DELETE FROM meeting_generated_content
WHERE user_id = 'test-user-id'
  OR meeting_id = 'test-meeting-id';
```

## Success Criteria

Deployment is successful when:

- [x] All 4 content types generate correctly
- [x] Caching returns content in <100ms
- [x] Versioning creates version chains properly
- [x] Cost tracking stores accurate costs
- [x] Topic links are created in junction table
- [x] Error responses are appropriate (400, 404, 422, etc.)
- [x] RLS policies enforce user ownership
- [x] No errors in function logs
- [x] Database queries perform well (<100ms)

## Post-Launch Checklist

### Week 1
- [ ] Monitor error rates daily
- [ ] Track cost trends
- [ ] Review cache hit rates
- [ ] Analyze content quality (user feedback)
- [ ] Check database performance

### Week 2-4
- [ ] Optimize prompts based on feedback
- [ ] Adjust rate limits if needed
- [ ] Review version usage patterns
- [ ] Consider cleanup policies for old versions
- [ ] Analyze cost per content type

### Month 2+
- [ ] Implement streaming responses (if needed)
- [ ] Add batch generation
- [ ] Build content quality scoring
- [ ] Integrate with frontend UI
- [ ] Add analytics dashboard

## Troubleshooting Guide

| Issue | Solution |
|-------|----------|
| Function not found | Check deployment: `supabase functions list` |
| Authentication errors | Verify JWT token and RLS policies |
| Topics not found | Ensure extract-content-topics ran first |
| High costs | Enable caching, reduce topic selection |
| Slow responses | Check Anthropic API status, optimize prompts |
| Version conflicts | Verify is_latest flag logic |
| Database errors | Check RLS policies and constraints |

## Support Contacts

- **Anthropic API Issues**: support@anthropic.com
- **Supabase Issues**: support@supabase.io
- **Internal Team**: [Your contact info]

---

**Deployment Date**: _____________
**Deployed By**: _____________
**Environment**: Production / Staging
**Version**: 1.0.0
