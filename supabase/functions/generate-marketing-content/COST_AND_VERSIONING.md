# Cost Tracking & Versioning Documentation

## Cost Estimation Model

### Claude Sonnet 4.5 Pricing
- **Input Tokens**: $3.00 per 1M tokens
- **Output Tokens**: $15.00 per 1M tokens
- **Model**: `claude-sonnet-4-5-20250929`

### Average Generation Costs

| Content Type | Word Count | Avg Input Tokens | Avg Output Tokens | Estimated Cost |
|-------------|-----------|------------------|-------------------|----------------|
| Social Post | 200-300 | 3,500 | 800 | $0.02 |
| Blog Article | 800-1500 | 5,000 | 1,800 | $0.04 |
| Video Script | 300-500 | 4,000 | 1,000 | $0.03 |
| Email Newsletter | 400-600 | 4,200 | 1,200 | $0.03 |

**Note**: Costs vary based on:
- Meeting transcript length
- Number of topics selected
- Complexity of content requested
- Temperature and generation parameters

### Cost Calculation Formula

```typescript
const inputCostPerToken = 3.0 / 1_000_000  // $3 per 1M tokens
const outputCostPerToken = 15.0 / 1_000_000 // $15 per 1M tokens

const costCents = Math.ceil(
  (inputTokens * inputCostPerToken * 100) +
  (outputTokens * outputCostPerToken * 100)
)

// Example:
// 4,000 input tokens + 1,000 output tokens
// = (4000 * 0.000003 * 100) + (1000 * 0.000015 * 100)
// = 1.2 + 1.5
// = 2.7 cents (rounded to 3 cents)
```

### Monthly Budget Projections

#### Low Usage (10 generations/day)
```
10 generations × $0.03 average = $0.30/day
$0.30 × 30 days = $9.00/month
```

#### Medium Usage (50 generations/day)
```
50 generations × $0.03 average = $1.50/day
$1.50 × 30 days = $45.00/month
```

#### High Usage (200 generations/day)
```
200 generations × $0.03 average = $6.00/day
$6.00 × 30 days = $180.00/month
```

#### Enterprise Usage (1,000 generations/day)
```
1,000 generations × $0.03 average = $30.00/day
$30.00 × 30 days = $900.00/month
```

### Cost Tracking in Database

Every generation is tracked in the `meeting_generated_content` table:

```sql
SELECT
  content_type,
  COUNT(*) as generation_count,
  SUM(tokens_used) as total_tokens,
  SUM(cost_cents) as total_cost_cents,
  ROUND(AVG(cost_cents)::numeric, 2) as avg_cost_cents
FROM meeting_generated_content
WHERE user_id = 'user-uuid'
  AND created_at >= NOW() - INTERVAL '30 days'
  AND deleted_at IS NULL
GROUP BY content_type;
```

**Example Output**:
| content_type | generation_count | total_tokens | total_cost_cents | avg_cost_cents |
|-------------|-----------------|--------------|------------------|----------------|
| social | 45 | 187,200 | 135 | 3.00 |
| blog | 12 | 84,000 | 48 | 4.00 |
| video | 23 | 115,000 | 69 | 3.00 |
| email | 18 | 97,200 | 54 | 3.00 |

### User Cost Dashboard Query

```sql
-- Daily cost for last 30 days
SELECT
  DATE(created_at) as date,
  COUNT(*) as generations,
  SUM(cost_cents) as cost_cents,
  ROUND((SUM(cost_cents) / 100.0)::numeric, 2) as cost_dollars
FROM meeting_generated_content
WHERE user_id = 'user-uuid'
  AND created_at >= NOW() - INTERVAL '30 days'
  AND deleted_at IS NULL
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### Cost Optimization Strategies

#### 1. Cache Aggressively
- Return cached content by default (`regenerate=false`)
- Only generate new content when explicitly requested
- **Savings**: 80-90% reduction in costs for repeated queries

#### 2. Smart Topic Selection
- Encourage users to select 3-5 topics (not all topics)
- Fewer topics = shorter input = lower cost
- **Savings**: 20-30% per generation

#### 3. Content Type Awareness
- Social posts are cheapest (~$0.02)
- Blog articles are most expensive (~$0.04)
- Guide users to appropriate content types
- **Savings**: 30-40% by choosing optimal format

#### 4. Batch Operations
- If generating multiple content types, batch the requests
- Reuse topic extraction across content types
- **Savings**: 15-20% through shared context

### Rate Limiting Recommendations

To control costs, consider implementing rate limits:

```typescript
// Per-user limits
const RATE_LIMITS = {
  social: 20,    // 20 social posts per day
  blog: 5,       // 5 blog articles per day
  video: 10,     // 10 video scripts per day
  email: 10,     // 10 email newsletters per day
}

// Query to check today's usage
SELECT
  content_type,
  COUNT(*) as today_count
FROM meeting_generated_content
WHERE user_id = 'user-uuid'
  AND created_at >= CURRENT_DATE
  AND deleted_at IS NULL
GROUP BY content_type;
```

---

## Versioning System

### Overview

The versioning system tracks all content generations with full history and rollback capability.

### Key Concepts

1. **Version Number**: Auto-incrementing integer (1, 2, 3, ...)
2. **Parent ID**: Links to previous version (null for version 1)
3. **Latest Flag**: Only one version per meeting+content_type has `is_latest=true`
4. **Soft Delete**: Versions are never hard-deleted (use `deleted_at` for archival)

### Database Schema

```sql
CREATE TABLE meeting_generated_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID REFERENCES meetings(id) NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  content_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,

  -- Versioning fields
  version INTEGER NOT NULL DEFAULT 1,
  parent_id UUID REFERENCES meeting_generated_content(id),
  is_latest BOOLEAN NOT NULL DEFAULT true,

  -- Cost tracking
  model_used TEXT NOT NULL,
  tokens_used INTEGER NOT NULL,
  cost_cents INTEGER NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  UNIQUE(meeting_id, content_type, version)
);

CREATE INDEX idx_content_latest ON meeting_generated_content(meeting_id, content_type, is_latest);
CREATE INDEX idx_content_user ON meeting_generated_content(user_id, created_at);
CREATE INDEX idx_content_parent ON meeting_generated_content(parent_id);
```

### Version Chain Example

```
Version 1 (Initial Generation)
├─ id: abc-123
├─ version: 1
├─ parent_id: null
├─ is_latest: false  <-- Updated when v2 created
└─ created_at: 2025-01-15 10:00:00

Version 2 (First Regeneration)
├─ id: def-456
├─ version: 2
├─ parent_id: abc-123  <-- Links to v1
├─ is_latest: false  <-- Updated when v3 created
└─ created_at: 2025-01-15 14:30:00

Version 3 (Second Regeneration)
├─ id: ghi-789
├─ version: 3
├─ parent_id: def-456  <-- Links to v2
├─ is_latest: true  <-- Current version
└─ created_at: 2025-01-16 09:15:00
```

### Versioning Workflow

#### Initial Generation (`regenerate=false`, no existing content)
```typescript
// 1. Check for existing content
const existing = await findLatestContent(meeting_id, content_type)
// Result: null (no existing content)

// 2. Create version 1
await insertContent({
  meeting_id,
  content_type,
  title,
  content,
  version: 1,
  parent_id: null,
  is_latest: true,
})
```

#### Cached Return (`regenerate=false`, existing content found)
```typescript
// 1. Check for existing content
const existing = await findLatestContent(meeting_id, content_type)
// Result: { id, title, content, version: 1, is_latest: true }

// 2. Return cached content immediately (no new version)
return {
  success: true,
  content: existing,
  metadata: { cached: true }
}
```

#### Regeneration (`regenerate=true`, existing content found)
```typescript
// 1. Check for existing content
const existing = await findLatestContent(meeting_id, content_type)
// Result: { id: 'abc-123', version: 1, is_latest: true }

// 2. Mark old version as not latest
await updateContent('abc-123', { is_latest: false })

// 3. Create new version
await insertContent({
  meeting_id,
  content_type,
  title: newTitle,
  content: newContent,
  version: 2,  // Increment version
  parent_id: 'abc-123',  // Link to parent
  is_latest: true,  // Mark as current
})
```

### Querying Version History

#### Get Latest Version (Default Behavior)
```sql
SELECT id, title, content, version, created_at
FROM meeting_generated_content
WHERE meeting_id = 'meeting-uuid'
  AND content_type = 'social'
  AND is_latest = true
  AND deleted_at IS NULL;
```

#### Get All Versions (History View)
```sql
SELECT
  id,
  version,
  title,
  LEFT(content, 100) as content_preview,
  created_at,
  is_latest
FROM meeting_generated_content
WHERE meeting_id = 'meeting-uuid'
  AND content_type = 'blog'
  AND deleted_at IS NULL
ORDER BY version DESC;
```

**Example Output**:
| id | version | title | content_preview | created_at | is_latest |
|----|---------|-------|----------------|------------|-----------|
| ghi-789 | 3 | "How to Scale..." | "# How to Scale Customer Success..." | 2025-01-16 09:15 | true |
| def-456 | 2 | "Scaling Customer..." | "# Scaling Customer Success in..." | 2025-01-15 14:30 | false |
| abc-123 | 1 | "Customer Success..." | "# Customer Success Strategies..." | 2025-01-15 10:00 | false |

#### Get Specific Version
```sql
SELECT id, title, content, version
FROM meeting_generated_content
WHERE meeting_id = 'meeting-uuid'
  AND content_type = 'video'
  AND version = 2
  AND deleted_at IS NULL;
```

#### Reconstruct Version Chain
```sql
WITH RECURSIVE version_chain AS (
  -- Start with latest version
  SELECT id, version, parent_id, title, created_at
  FROM meeting_generated_content
  WHERE meeting_id = 'meeting-uuid'
    AND content_type = 'email'
    AND is_latest = true

  UNION ALL

  -- Follow parent_id chain
  SELECT c.id, c.version, c.parent_id, c.title, c.created_at
  FROM meeting_generated_content c
  INNER JOIN version_chain vc ON c.id = vc.parent_id
)
SELECT * FROM version_chain
ORDER BY version;
```

### Rollback to Previous Version

To "rollback" to a previous version, create a new version copying the old content:

```typescript
async function rollbackToVersion(
  meetingId: string,
  contentType: string,
  targetVersion: number
) {
  // 1. Get target version content
  const targetContent = await getContentByVersion(
    meetingId,
    contentType,
    targetVersion
  )

  if (!targetContent) {
    throw new Error('Target version not found')
  }

  // 2. Get current latest version
  const currentLatest = await getLatestContent(meetingId, contentType)

  // 3. Mark current as not latest
  await updateContent(currentLatest.id, { is_latest: false })

  // 4. Create new version with old content
  await insertContent({
    meeting_id: meetingId,
    content_type: contentType,
    title: targetContent.title,
    content: targetContent.content,
    version: currentLatest.version + 1,  // New version number
    parent_id: currentLatest.id,  // Link to previous latest
    is_latest: true,
    model_used: 'rollback',  // Mark as rollback
    tokens_used: 0,  // No new generation
    cost_cents: 0,  // No cost
  })
}
```

### Soft Delete (Archive)

Never hard-delete content. Use soft delete for compliance and audit:

```sql
-- Archive a specific version
UPDATE meeting_generated_content
SET deleted_at = NOW()
WHERE id = 'version-uuid';

-- Archive all versions for a meeting+content_type
UPDATE meeting_generated_content
SET deleted_at = NOW()
WHERE meeting_id = 'meeting-uuid'
  AND content_type = 'social';

-- Restore archived version
UPDATE meeting_generated_content
SET deleted_at = NULL
WHERE id = 'version-uuid';
```

### Version Comparison

Compare two versions to see what changed:

```sql
SELECT
  v1.version as version_1,
  v2.version as version_2,
  v1.title as title_v1,
  v2.title as title_v2,
  LENGTH(v1.content) as length_v1,
  LENGTH(v2.content) as length_v2,
  v1.created_at as created_v1,
  v2.created_at as created_v2,
  v2.created_at - v1.created_at as time_between
FROM meeting_generated_content v1
CROSS JOIN meeting_generated_content v2
WHERE v1.meeting_id = 'meeting-uuid'
  AND v2.meeting_id = 'meeting-uuid'
  AND v1.content_type = 'blog'
  AND v2.content_type = 'blog'
  AND v1.version = 1
  AND v2.version = 2;
```

### Version Analytics

Track version creation patterns:

```sql
-- Average versions per meeting
SELECT
  content_type,
  AVG(version_count) as avg_versions_per_meeting
FROM (
  SELECT
    meeting_id,
    content_type,
    COUNT(*) as version_count
  FROM meeting_generated_content
  WHERE deleted_at IS NULL
  GROUP BY meeting_id, content_type
) subquery
GROUP BY content_type;
```

**Example Output**:
| content_type | avg_versions_per_meeting |
|-------------|--------------------------|
| social | 1.3 |
| blog | 2.1 |
| video | 1.8 |
| email | 1.5 |

```sql
-- Regeneration frequency
SELECT
  DATE(created_at) as date,
  COUNT(*) FILTER (WHERE version = 1) as new_generations,
  COUNT(*) FILTER (WHERE version > 1) as regenerations,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE version > 1) / COUNT(*),
    1
  ) as regeneration_rate_pct
FROM meeting_generated_content
WHERE deleted_at IS NULL
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### Best Practices

1. **Always Query with is_latest=true**: Unless explicitly showing version history
2. **Never Hard Delete**: Use soft delete for audit compliance
3. **Version Numbering**: Let the system auto-increment, never manually set
4. **Parent ID Chain**: Always maintain the chain for version reconstruction
5. **Cost Tracking**: Rollbacks should have 0 cost (no new generation)
6. **Timestamp Preservation**: Use created_at for version creation time

### Storage Considerations

Each version stores full content (not diffs):

**Storage Calculation**:
```
Average content size: 2-5 KB per version
Average versions per content: 1.5
Total content per meeting: 4 types × 1.5 versions × 3.5 KB = ~21 KB

1,000 meetings = 21 MB
10,000 meetings = 210 MB
100,000 meetings = 2.1 GB
```

**Storage is cheap**. Full content storage enables:
- Fast queries (no diff reconstruction)
- Complete rollback capability
- Version comparison
- Audit trail preservation

### Cleanup Policies (Optional)

For very high-volume systems, consider cleanup policies:

```sql
-- Archive versions older than 90 days (keep latest)
UPDATE meeting_generated_content
SET deleted_at = NOW()
WHERE created_at < NOW() - INTERVAL '90 days'
  AND is_latest = false;

-- Hard delete archived versions older than 1 year
DELETE FROM meeting_generated_content
WHERE deleted_at < NOW() - INTERVAL '365 days';
```

**Recommendation**: Only implement cleanup if storage becomes an issue (unlikely).
