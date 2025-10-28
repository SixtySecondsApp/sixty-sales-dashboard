# Generate Marketing Content Edge Function

## Overview

Generates high-quality marketing content (social posts, blog articles, video scripts, email newsletters) from meeting transcripts using Claude Sonnet 4.5.

## Features

- **4 Content Types**: Social, Blog, Video, Email
- **Smart Caching**: Returns existing content unless `regenerate=true`
- **Versioning**: Track content versions with parent-child relationships
- **Timestamp Links**: Inline Fathom video links at specific timestamps
- **Cost Tracking**: Detailed token usage and cost metrics
- **Topic Junction**: Links generated content to source topics

## API Specification

### Endpoint
```
POST /generate-marketing-content
```

### Authentication
Requires Supabase auth token in `Authorization` header.

### Request Body
```typescript
{
  meeting_id: string;              // UUID of meeting
  content_type: 'social' | 'blog' | 'video' | 'email';
  selected_topic_indices: number[]; // Indices in topics array (0-based)
  regenerate?: boolean;             // Force new generation (default: false)
}
```

### Success Response (200)
```typescript
{
  success: true,
  content: {
    id: string,            // UUID of generated content
    title: string,         // Extracted or generated title
    content: string,       // Markdown content with timestamp links
    content_type: string,  // 'social' | 'blog' | 'video' | 'email'
    version: number        // Version number (1, 2, 3, ...)
  },
  metadata: {
    model_used: string,    // 'claude-sonnet-4-5-20250929'
    tokens_used: number,   // Total tokens (input + output)
    cost_cents: number,    // Estimated cost in cents
    cached: boolean,       // Was this cached content?
    topics_used: number    // Number of topics referenced
  }
}
```

### Error Responses

**400 Bad Request**
```json
{
  "success": false,
  "error": "Invalid meeting_id: must be a valid UUID string"
}
```
```json
{
  "success": false,
  "error": "Invalid content_type: must be one of social, blog, video, email"
}
```
```json
{
  "success": false,
  "error": "Invalid selected_topic_indices: must be a non-empty array of non-negative integers"
}
```
```json
{
  "success": false,
  "error": "Invalid topic indices: 5, 7 (max index: 4)"
}
```

**401 Unauthorized**
```json
{
  "success": false,
  "error": "Missing authorization header"
}
```
```json
{
  "success": false,
  "error": "Authentication failed",
  "details": "Invalid JWT token"
}
```

**404 Not Found**
```json
{
  "success": false,
  "error": "Meeting not found or access denied"
}
```

**422 Unprocessable Entity**
```json
{
  "success": false,
  "error": "This meeting does not have a transcript yet",
  "details": "Please wait for the transcript to be processed"
}
```
```json
{
  "success": false,
  "error": "No topics extracted for this meeting yet",
  "details": "Please run topic extraction first"
}
```

**500 Internal Server Error**
```json
{
  "success": false,
  "error": "Failed to store content",
  "details": "Database error message"
}
```

**503 Service Unavailable**
```json
{
  "success": false,
  "error": "AI service temporarily unavailable",
  "details": "Please try again in a few moments"
}
```

**504 Gateway Timeout**
```json
{
  "success": false,
  "error": "Request timeout",
  "details": "AI processing took too long"
}
```

## Content Types

### Social Media Posts (200-300 words)

**Characteristics:**
- Hook opening line
- Key insight or takeaway
- Call to action
- 2-3 relevant hashtags
- Conversational tone
- LinkedIn/Twitter optimized

**Example Structure:**
```markdown
Just learned something fascinating about customer retention...

[2-3 paragraphs with insights and timestamp links]

The key takeaway: [main lesson]

What's your experience with this? Drop a comment below.

#Marketing #CustomerSuccess #BusinessGrowth
```

### Blog Articles (800-1500 words)

**Characteristics:**
- Compelling headline
- Introduction with hook
- 3-5 main sections with subheadings
- Actionable insights
- Conclusion with CTA
- Professional but accessible tone
- SEO-friendly structure

**Example Structure:**
```markdown
# How to Scale Customer Success Without Scaling Costs

Introduction paragraph with hook and preview...

## Understanding the Challenge

[Section content with insights and timestamp links]

## Three Key Strategies

[More sections...]

## Conclusion

Summary and call-to-action
```

### Video Scripts (300-500 words)

**Characteristics:**
- Strong hook (first 5 seconds)
- Clear structure (intro/body/conclusion)
- Talking points format
- Visual cues (e.g., "[Show slide]")
- Engaging delivery notes
- Strong CTA at end
- 2-3 minute speaking time

**Example Structure:**
```markdown
# The Secret to 40% Better Customer Retention

## HOOK (0:00-0:05)
[VISUAL: Opening shot]
You're losing customers and you don't even know why...

## INTRO (0:05-0:25)
[VISUAL: Your on-screen presence]
In our latest strategy session, we discovered...

## MAIN CONTENT (0:25-2:00)
**First insight:**
[Talking points with timestamp references]

## CONCLUSION (2:00-2:30)
[Summary and CTA]
```

### Email Newsletters (400-600 words)

**Characteristics:**
- Attention-grabbing subject line
- Personal greeting
- Valuable content up front
- Scannable format (bullets, short paragraphs)
- Clear call-to-action
- Professional email tone
- Mobile-optimized

**Example Structure:**
```markdown
# Subject: The surprising customer retention strategy we just discovered

Hi there,

Quick question: What if you could improve retention by 40% without spending more on support?

## What We Learned

[Content with timestamp links]

**Key takeaways:**
- Insight 1
- Insight 2
- Insight 3

[CTA paragraph]

Talk soon!
```

## Timestamp Link Format

Generated content includes inline timestamp links to the original Fathom meeting:

```markdown
We discovered that [customer retention increased 40%](https://app.fathom.video/meetings/abc123?timestamp=245) when implementing this approach.
```

Format: `[insight text](fathom_url?timestamp=X)`
- `X` = timestamp in seconds
- Links jump directly to that moment in the video

## Versioning System

### Version Chain
- Each content generation creates a new version
- `version` increments: 1, 2, 3, ...
- `parent_id` links to previous version
- `is_latest` flag marks current version

### Regeneration Flow
1. User requests content with `regenerate=true`
2. Check existing content for `meeting_id` + `content_type`
3. If exists: mark `is_latest=false`, create new version with `parent_id`
4. If not exists: create version 1

### Version History Query
```sql
SELECT id, version, title, created_at, is_latest
FROM meeting_generated_content
WHERE meeting_id = 'uuid'
  AND content_type = 'blog'
  AND deleted_at IS NULL
ORDER BY version DESC;
```

## Cost Tracking

### Pricing Model
- **Claude Sonnet 4.5**: $3 per 1M input tokens, $15 per 1M output tokens
- **Average generation**: ~5K input + ~1K output = ~$0.03 per generation
- **Word counts**:
  - Social: 200-300 words (~$0.01-0.02)
  - Blog: 800-1500 words (~$0.03-0.05)
  - Video: 300-500 words (~$0.02-0.03)
  - Email: 400-600 words (~$0.02-0.03)

### Cost Calculation
```typescript
const costCents = Math.ceil(
  inputTokens * (3.0 / 1_000_000) * 100 +
  outputTokens * (15.0 / 1_000_000) * 100
)
```

### Monthly Budget Estimates
- **10 generations/day**: ~$9/month
- **50 generations/day**: ~$45/month
- **200 generations/day**: ~$180/month

## Database Schema

### meeting_generated_content
```sql
CREATE TABLE meeting_generated_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID REFERENCES meetings(id) NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  content_type TEXT NOT NULL, -- 'social' | 'blog' | 'video' | 'email'
  title TEXT NOT NULL,
  content TEXT NOT NULL, -- Markdown with timestamp links
  version INTEGER NOT NULL DEFAULT 1,
  parent_id UUID REFERENCES meeting_generated_content(id),
  is_latest BOOLEAN NOT NULL DEFAULT true,
  model_used TEXT NOT NULL,
  tokens_used INTEGER NOT NULL,
  cost_cents INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  UNIQUE(meeting_id, content_type, version)
);
```

### content_topic_links
```sql
CREATE TABLE content_topic_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  generated_content_id UUID REFERENCES meeting_generated_content(id) ON DELETE CASCADE,
  topics_extraction_id UUID REFERENCES meeting_content_topics(id) ON DELETE CASCADE,
  topic_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(generated_content_id, topic_index)
);
```

## Usage Examples

### Example 1: Generate Social Post (First Time)
```typescript
const response = await fetch(
  'https://your-project.supabase.co/functions/v1/generate-marketing-content',
  {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_JWT_TOKEN',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      meeting_id: 'abc-123-def-456',
      content_type: 'social',
      selected_topic_indices: [0, 2, 5], // First, third, and sixth topics
    }),
  }
)

const data = await response.json()
// {
//   success: true,
//   content: {
//     id: 'xyz-789',
//     title: 'The Surprising Truth About Customer Retention',
//     content: 'Just learned something fascinating...\n\n[full content]',
//     content_type: 'social',
//     version: 1
//   },
//   metadata: {
//     model_used: 'claude-sonnet-4-5-20250929',
//     tokens_used: 4532,
//     cost_cents: 3,
//     cached: false,
//     topics_used: 3
//   }
// }
```

### Example 2: Get Cached Content
```typescript
// Same request without regenerate flag
const response = await fetch(url, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    meeting_id: 'abc-123-def-456',
    content_type: 'social',
    selected_topic_indices: [0, 2, 5],
    // regenerate: false (default)
  }),
})

const data = await response.json()
// {
//   success: true,
//   content: { ... same content ... },
//   metadata: {
//     ...
//     cached: true  // <-- No new API call, instant return
//   }
// }
```

### Example 3: Regenerate Content (New Version)
```typescript
const response = await fetch(url, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    meeting_id: 'abc-123-def-456',
    content_type: 'social',
    selected_topic_indices: [0, 2, 5],
    regenerate: true, // <-- Force new generation
  }),
})

const data = await response.json()
// {
//   success: true,
//   content: {
//     id: 'new-uuid',
//     title: 'Different title...',
//     content: '... different content ...',
//     content_type: 'social',
//     version: 2  // <-- Version incremented
//   },
//   metadata: {
//     ...
//     cached: false  // <-- New API call made
//   }
// }
```

### Example 4: Generate Blog Article
```typescript
const response = await fetch(url, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    meeting_id: 'abc-123-def-456',
    content_type: 'blog',
    selected_topic_indices: [0, 1, 2, 3, 4], // First 5 topics
  }),
})

const data = await response.json()
// {
//   success: true,
//   content: {
//     title: 'How to Scale Customer Success Without Scaling Costs',
//     content: '# How to Scale Customer Success...\n\nIntroduction...',
//     content_type: 'blog',
//     version: 1
//   },
//   metadata: {
//     tokens_used: 8234,
//     cost_cents: 5,
//     topics_used: 5
//   }
// }
```

## Environment Variables

Required environment variables:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=your-anthropic-api-key
```

## Development & Testing

### Local Testing
```bash
# Start Supabase locally
supabase start

# Deploy function locally
supabase functions serve generate-marketing-content --env-file .env.local

# Test with curl
curl -X POST http://localhost:54321/functions/v1/generate-marketing-content \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "meeting_id": "test-meeting-id",
    "content_type": "social",
    "selected_topic_indices": [0, 1]
  }'
```

### Production Deployment
```bash
# Deploy to production
supabase functions deploy generate-marketing-content

# Test production endpoint
curl -X POST https://your-project.supabase.co/functions/v1/generate-marketing-content \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

## Performance Characteristics

- **Target Response Time**: <5 seconds (uncached)
- **Cache Hit Response**: <100ms
- **Timeout**: 60 seconds
- **Token Limit**: 8192 output tokens
- **Temperature**: 0.7 (balanced creativity/consistency)

## Error Handling

The function implements comprehensive error handling:
- Input validation with specific error messages
- Authentication verification
- Meeting ownership validation
- Topic extraction verification
- Claude API timeout handling (60s)
- Retry-After headers for rate limits
- Graceful database error handling
- Detailed error logging

## Security

- **Authentication**: JWT token required
- **Authorization**: RLS enforces meeting ownership
- **Input Sanitization**: All inputs validated before processing
- **Service Role**: Used only for writes, not for queries
- **Rate Limiting**: Consider implementing per-user limits

## Monitoring & Observability

Key metrics to monitor:
- Generation success rate
- Average response time
- Cache hit rate
- Cost per generation
- Token usage trends
- Error rate by type

## Future Enhancements

Potential improvements:
- Streaming response for real-time content generation
- Batch generation for multiple content types
- Custom templates and style guides
- A/B testing different prompts
- Content quality scoring
- Multi-language support
- Brand voice customization
- SEO keyword optimization
- Content calendar integration

## Support

For issues or questions:
1. Check error response for specific details
2. Verify prerequisites (transcript, topics extracted)
3. Check environment variables
4. Review CloudWatch/Supabase logs
5. Test with example requests above
