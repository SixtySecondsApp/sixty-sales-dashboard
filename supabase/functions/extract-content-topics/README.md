# Extract Content Topics Edge Function

AI-powered meeting transcript analysis that extracts 5-10 marketable discussion topics suitable for social media, blog posts, videos, and newsletters using Claude Haiku 4.5.

## Overview

This edge function analyzes meeting transcripts to identify compelling content opportunities with:
- **Smart Caching**: Retrieves cached topics unless `force_refresh` is specified
- **Timestamp Extraction**: Identifies approximate timestamps from transcript context
- **Fathom Integration**: Generates direct video links with timestamp parameters
- **Cost Tracking**: Monitors AI API usage and costs
- **Performance**: Target response time <3 seconds (cache hits <100ms)

## API Specification

### Endpoint
```
POST /functions/v1/extract-content-topics
```

### Authentication
Requires Supabase authentication token in `Authorization` header:
```
Authorization: Bearer <user-jwt-token>
```

### Request Body
```typescript
{
  meeting_id: string;      // UUID of the meeting (required)
  force_refresh?: boolean; // Skip cache and re-extract (optional, default: false)
}
```

### Success Response (200 OK)
```typescript
{
  success: true,
  topics: [
    {
      title: string;              // 5-8 words
      description: string;        // 20-40 words
      timestamp_seconds: number;  // Seconds from meeting start
      fathom_url: string;        // Direct video link with timestamp
    }
  ],
  metadata: {
    model_used: string;     // e.g., "claude-haiku-4-5-20251001"
    tokens_used: number;    // Total tokens consumed
    cost_cents: number;     // API cost in cents
    cached: boolean;        // Whether result was cached
  }
}
```

### Error Responses

**400 Bad Request** - Invalid input
```json
{
  "success": false,
  "error": "Invalid meeting_id: must be a valid UUID string"
}
```

**401 Unauthorized** - Missing or invalid authentication
```json
{
  "success": false,
  "error": "Missing authorization header"
}
```

**404 Not Found** - Meeting not found or access denied (RLS)
```json
{
  "success": false,
  "error": "Meeting not found or access denied"
}
```

**422 Unprocessable Entity** - No transcript available
```json
{
  "success": false,
  "error": "This meeting does not have a transcript yet",
  "details": "Please wait for the transcript to be processed"
}
```

**503 Service Unavailable** - Claude API failure (includes retry-after header)
```json
{
  "success": false,
  "error": "AI service temporarily unavailable",
  "details": "Please try again in a few moments"
}
```
**Headers**: `Retry-After: 10`

**504 Gateway Timeout** - Request timeout (30 second limit)
```json
{
  "success": false,
  "error": "Request timeout",
  "details": "AI processing took too long"
}
```

**500 Internal Server Error** - Unexpected error
```json
{
  "success": false,
  "error": "Internal server error",
  "details": "Error message"
}
```

## Setup

### Environment Variables
Required in Supabase project settings:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=your-claude-api-key
```

Optional:
```bash
CLAUDE_MODEL=claude-haiku-4-5-20251001  # Defaults to this if not set
```

### Deployment
```bash
# Deploy the function
supabase functions deploy extract-content-topics

# Set environment secrets
supabase secrets set ANTHROPIC_API_KEY=your-key-here
```

### Database Setup
Ensure the `meeting_content_topics` table exists (created by migration `20250128_create_meeting_content_tables.sql`):

```sql
-- Verify table exists
SELECT * FROM meeting_content_topics LIMIT 1;
```

## Usage Examples

### JavaScript/TypeScript (Supabase Client)
```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Extract topics (uses cache if available)
const { data, error } = await supabase.functions.invoke('extract-content-topics', {
  body: {
    meeting_id: '550e8400-e29b-41d4-a716-446655440000'
  }
})

if (error) {
  console.error('Error:', error.message)
} else {
  console.log(`Found ${data.topics.length} topics`)
  console.log(`Cost: $${(data.metadata.cost_cents / 100).toFixed(4)}`)
  console.log(`Cached: ${data.metadata.cached}`)

  data.topics.forEach((topic, index) => {
    console.log(`\n${index + 1}. ${topic.title}`)
    console.log(`   ${topic.description}`)
    console.log(`   Watch: ${topic.fathom_url}`)
  })
}

// Force re-extraction (bypasses cache)
const { data: freshData } = await supabase.functions.invoke('extract-content-topics', {
  body: {
    meeting_id: '550e8400-e29b-41d4-a716-446655440000',
    force_refresh: true
  }
})
```

### cURL
```bash
# Extract topics (with cache)
curl -X POST \
  'https://your-project.supabase.co/functions/v1/extract-content-topics' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "meeting_id": "550e8400-e29b-41d4-a716-446655440000"
  }'

# Force re-extraction
curl -X POST \
  'https://your-project.supabase.co/functions/v1/extract-content-topics' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "meeting_id": "550e8400-e29b-41d4-a716-446655440000",
    "force_refresh": true
  }'
```

### React Hook Example
```typescript
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Topic {
  title: string
  description: string
  timestamp_seconds: number
  fathom_url: string
}

interface Metadata {
  model_used: string
  tokens_used: number
  cost_cents: number
  cached: boolean
}

export function useExtractTopics(meetingId: string) {
  const [topics, setTopics] = useState<Topic[]>([])
  const [metadata, setMetadata] = useState<Metadata | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const extractTopics = async (forceRefresh = false) => {
    setLoading(true)
    setError(null)

    try {
      const { data, error: invocationError } = await supabase.functions.invoke(
        'extract-content-topics',
        {
          body: {
            meeting_id: meetingId,
            force_refresh: forceRefresh,
          },
        }
      )

      if (invocationError) throw invocationError

      if (!data.success) {
        throw new Error(data.error || 'Failed to extract topics')
      }

      setTopics(data.topics)
      setMetadata(data.metadata)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return { topics, metadata, loading, error, extractTopics }
}

// Usage in component
function MeetingTopics({ meetingId }: { meetingId: string }) {
  const { topics, metadata, loading, error, extractTopics } = useExtractTopics(meetingId)

  useEffect(() => {
    extractTopics()
  }, [meetingId])

  if (loading) return <div>Extracting topics...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2>Content Topics ({topics.length})</h2>
        {metadata?.cached && (
          <button onClick={() => extractTopics(true)}>Refresh</button>
        )}
      </div>

      {metadata && (
        <div className="text-sm text-gray-500 mb-4">
          Cost: ${(metadata.cost_cents / 100).toFixed(4)} |
          Cached: {metadata.cached ? 'Yes' : 'No'}
        </div>
      )}

      <div className="space-y-4">
        {topics.map((topic, index) => (
          <div key={index} className="border p-4 rounded">
            <h3 className="font-bold">{topic.title}</h3>
            <p className="text-gray-600 mt-2">{topic.description}</p>
            <a
              href={topic.fathom_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline mt-2 inline-block"
            >
              Watch at {Math.floor(topic.timestamp_seconds / 60)}:
              {(topic.timestamp_seconds % 60).toString().padStart(2, '0')} →
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}
```

## Cost Estimation

### Pricing Model
Claude Haiku 4.5 pricing (as of Jan 2025):
- **Input tokens**: $0.25 per 1M tokens
- **Output tokens**: $1.25 per 1M tokens

### Typical Costs
| Transcript Length | Input Tokens | Output Tokens | Cost (USD) |
|-------------------|--------------|---------------|------------|
| 5,000 words       | ~6,500       | ~800          | $0.0026    |
| 10,000 words      | ~13,000      | ~1,000        | $0.0045    |
| 20,000 words      | ~26,000      | ~1,200        | $0.0080    |

**Average cost per extraction**: ~$0.004 (0.4 cents)

### Cost Optimization
- **Caching**: First extraction costs ~$0.004, subsequent requests are free
- **Smart refresh**: Only use `force_refresh=true` when content significantly changes
- **Batch processing**: Extract topics for multiple meetings in bulk (future feature)

## Performance Metrics

### Target Benchmarks
- **Cache hit**: <100ms response time
- **First extraction**: <3 seconds response time
- **Success rate**: >99.5% (excluding user errors)
- **Timeout**: 30 seconds maximum

### Monitoring
```typescript
// Track performance in your application
const startTime = Date.now()
const { data } = await supabase.functions.invoke('extract-content-topics', {
  body: { meeting_id }
})
const responseTime = Date.now() - startTime

console.log(`Response time: ${responseTime}ms`)
console.log(`Cached: ${data.metadata.cached}`)
console.log(`Tokens used: ${data.metadata.tokens_used}`)
```

## Security

### Row Level Security (RLS)
- Users can only extract topics from meetings they own
- RLS enforced through Supabase authentication
- Service role used internally for database writes (bypasses RLS safely)

### Access Control
- Meeting ownership verified before extraction
- Cached topics respect RLS policies
- No cross-user data leakage

### Input Validation
- Meeting ID validated as proper UUID
- Transcript length validated (minimum 50 characters)
- Force refresh boolean type checked

## Error Handling

### Retry Strategy
For `503` errors (AI service unavailable):
1. Wait for `Retry-After` header duration (default: 10 seconds)
2. Retry request with exponential backoff
3. Maximum 3 retry attempts recommended

### User-Friendly Messages
Map error codes to user-facing messages:
- **400**: "Invalid meeting ID provided"
- **404**: "Meeting not found or you don't have access"
- **422**: "Transcript is still being processed, please wait"
- **503**: "AI service is temporarily busy, retrying..."
- **504**: "This transcript is taking longer than expected"
- **500**: "Something went wrong, please try again"

### Logging
All errors logged with context:
```typescript
[extract-content-topics] <timestamp> <level> <message>
```

Example logs:
```
[extract-content-topics] Processing meeting 550e8400... (force_refresh: false)
[extract-content-topics] Cache hit for meeting 550e8400...
[extract-content-topics] Returned 7 cached topics in 43ms
```

## Testing

### Manual Testing
```bash
# Test with valid meeting
curl -X POST \
  'http://localhost:54321/functions/v1/extract-content-topics' \
  -H 'Authorization: Bearer YOUR_LOCAL_JWT' \
  -H 'Content-Type: application/json' \
  -d '{"meeting_id": "550e8400-e29b-41d4-a716-446655440000"}'

# Test force refresh
curl -X POST \
  'http://localhost:54321/functions/v1/extract-content-topics' \
  -H 'Authorization: Bearer YOUR_LOCAL_JWT' \
  -H 'Content-Type: application/json' \
  -d '{
    "meeting_id": "550e8400-e29b-41d4-a716-446655440000",
    "force_refresh": true
  }'

# Test error handling
curl -X POST \
  'http://localhost:54321/functions/v1/extract-content-topics' \
  -H 'Authorization: Bearer YOUR_LOCAL_JWT' \
  -H 'Content-Type: application/json' \
  -d '{"meeting_id": "invalid-uuid"}'
```

### Unit Tests (Future)
```typescript
import { assertEquals } from 'https://deno.land/std/testing/asserts.ts'

Deno.test('parseClaudeResponse validates topic structure', () => {
  const input = JSON.stringify({
    topics: [
      {
        title: 'Test Topic',
        description: 'Test description',
        timestamp_seconds: 120
      }
    ]
  })

  const result = parseClaudeResponse(input)
  assertEquals(result.topics.length, 1)
  assertEquals(result.topics[0].title, 'Test Topic')
})
```

## Troubleshooting

### Common Issues

**Issue**: "Meeting not found or access denied"
- **Cause**: User doesn't own the meeting or meeting doesn't exist
- **Solution**: Verify meeting_id and user authentication

**Issue**: "This meeting does not have a transcript yet"
- **Cause**: Transcript hasn't been fetched or is empty
- **Solution**: Run `fetch-transcript` edge function first

**Issue**: "AI service temporarily unavailable"
- **Cause**: Claude API rate limit or downtime
- **Solution**: Retry after 10 seconds with exponential backoff

**Issue**: Topics seem incorrect
- **Cause**: Transcript quality or AI interpretation
- **Solution**: Use `force_refresh=true` or manually edit topics in database

### Debug Mode
Enable verbose logging:
```typescript
// Check Supabase logs for detailed information
supabase functions logs extract-content-topics --tail
```

## Roadmap

### Planned Features
- [ ] Batch extraction for multiple meetings
- [ ] Custom topic count (5-15 range)
- [ ] Topic filtering by category (business, technical, etc.)
- [ ] Multilingual support
- [ ] Topic voting/ranking system
- [ ] Automatic topic regeneration when transcript updates

### Future Optimizations
- [ ] Streaming responses for large transcripts
- [ ] Topic clustering and deduplication
- [ ] Integration with content generation pipeline
- [ ] Cost analytics dashboard

## Support

For issues or questions:
1. Check Supabase function logs: `supabase functions logs extract-content-topics`
2. Verify database table schema and RLS policies
3. Test with smaller transcripts first
4. Review error messages for specific guidance

## Related Functions

- `fetch-transcript` - Fetches transcript from Fathom API
- `extract-action-items` - Extracts action items from transcripts
- `ask-meeting-ai` - Q&A interface for meeting transcripts
- `generate-video-thumbnail` - Creates visual thumbnails for meetings
