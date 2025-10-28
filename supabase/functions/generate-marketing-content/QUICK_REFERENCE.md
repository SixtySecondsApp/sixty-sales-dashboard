# Generate Marketing Content - Quick Reference

## 🚀 Quick Start

### Basic Request
```bash
curl -X POST https://your-project.supabase.co/functions/v1/generate-marketing-content \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "meeting_id": "550e8400-e29b-41d4-a716-446655440000",
    "content_type": "social",
    "selected_topic_indices": [0, 2]
  }'
```

### TypeScript Client
```typescript
const { data } = await supabase.functions.invoke('generate-marketing-content', {
  body: {
    meeting_id: meetingId,
    content_type: 'blog',
    selected_topic_indices: [0, 1, 2, 3],
  },
})
```

## 📋 Content Types

| Type | Words | Use Case | Cost |
|------|-------|----------|------|
| `social` | 200-300 | LinkedIn/Twitter posts | ~$0.02 |
| `blog` | 800-1500 | Long-form articles | ~$0.04 |
| `video` | 300-500 | YouTube/video scripts | ~$0.03 |
| `email` | 400-600 | Email newsletters | ~$0.03 |

## 🔑 Request Parameters

```typescript
{
  meeting_id: string             // Required: UUID of meeting
  content_type: string           // Required: 'social' | 'blog' | 'video' | 'email'
  selected_topic_indices: number[] // Required: [0, 1, 2] (0-based)
  regenerate?: boolean           // Optional: Force new generation (default: false)
}
```

## 📊 Response Structure

```typescript
{
  success: true,
  content: {
    id: string,           // UUID of generated content
    title: string,        // Extracted title
    content: string,      // Markdown with timestamp links
    content_type: string, // Content type
    version: number       // Version number (1, 2, 3...)
  },
  metadata: {
    model_used: string,   // 'claude-sonnet-4-5-20250929'
    tokens_used: number,  // Total tokens
    cost_cents: number,   // Cost in cents
    cached: boolean,      // Was this cached?
    topics_used: number   // Number of topics
  }
}
```

## ⚡ Performance

| Metric | Target | Notes |
|--------|--------|-------|
| Cache hit | <100ms | Instant return |
| Uncached | <5s | New generation |
| Timeout | 60s | Max wait time |

## 💰 Cost Cheat Sheet

| Usage | Gens/Day | Monthly |
|-------|----------|---------|
| Light | 10 | $9 |
| Medium | 50 | $45 |
| Heavy | 200 | $180 |

**Tip**: Use caching (don't set `regenerate: true`) to save 80-90% on costs!

## 🔄 Versioning Quick Reference

```typescript
// First generation (no regenerate)
version: 1, parent_id: null, is_latest: true

// Regenerate content
version: 2, parent_id: v1_id, is_latest: true
// Previous: version 1 becomes is_latest: false

// Regenerate again
version: 3, parent_id: v2_id, is_latest: true
// Previous: version 2 becomes is_latest: false
```

## 🔗 Timestamp Links

Generated content includes inline links:
```markdown
We discovered that [customer retention increased 40%](https://app.fathom.video/meetings/abc123?timestamp=245) when implementing this approach.
```

Format: `[insight text](fathom_url?timestamp=X)` where X = seconds

## 🚨 Common Errors

| Code | Error | Solution |
|------|-------|----------|
| 400 | Invalid content_type | Use: social, blog, video, or email |
| 400 | Invalid topic indices | Check indices exist in topics array |
| 401 | Missing auth | Include Authorization header |
| 404 | Meeting not found | Verify meeting_id and ownership |
| 422 | No topics extracted | Run extract-content-topics first |
| 422 | No transcript | Wait for transcript processing |

## 📖 Database Queries

### Get Latest Content
```sql
SELECT * FROM meeting_generated_content
WHERE meeting_id = 'uuid'
  AND content_type = 'social'
  AND is_latest = true
  AND deleted_at IS NULL;
```

### Get Version History
```sql
SELECT version, title, created_at, is_latest
FROM meeting_generated_content
WHERE meeting_id = 'uuid'
  AND content_type = 'blog'
  AND deleted_at IS NULL
ORDER BY version DESC;
```

### Track User Costs
```sql
SELECT
  content_type,
  COUNT(*) as generations,
  SUM(cost_cents) as total_cost_cents
FROM meeting_generated_content
WHERE user_id = 'uuid'
  AND created_at >= NOW() - INTERVAL '30 days'
  AND deleted_at IS NULL
GROUP BY content_type;
```

## 🎯 Best Practices

### ✅ Do
- Use caching (don't regenerate unnecessarily)
- Select 3-5 topics (not all)
- Choose appropriate content type
- Track costs via database queries
- Handle errors gracefully

### ❌ Don't
- Always set `regenerate: true` (costly!)
- Select too many topics (increases cost)
- Skip error handling
- Ignore version management
- Hard delete content (use soft delete)

## 🔧 Environment Variables

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=your-anthropic-api-key
```

## 📚 Full Documentation

- `README.md` - Complete API documentation
- `EXAMPLES.md` - 10 request/response examples
- `COST_AND_VERSIONING.md` - Detailed cost tracking and versioning
- `IMPLEMENTATION_SUMMARY.md` - Technical implementation details

## 🆘 Troubleshooting

| Issue | Check |
|-------|-------|
| No response | Verify endpoint URL and auth token |
| Wrong content | Check content_type parameter |
| Missing topics | Run extract-content-topics first |
| High costs | Enable caching, select fewer topics |
| Old version returned | Set regenerate: true |

## 💡 Tips & Tricks

1. **Test in order**: Extract topics → Generate social → Review → Generate blog
2. **Cache smartly**: Only regenerate when content needs improvement
3. **Select strategically**: Choose 3-5 most relevant topics
4. **Version wisely**: Keep history but don't regenerate excessively
5. **Monitor costs**: Track daily/monthly spending via SQL queries
6. **Content types matter**: Social is fastest/cheapest, blog is most expensive

## 🔗 Related Functions

- `extract-content-topics` - Must run before this function
- `ask-meeting-ai` - Alternative for Q&A instead of content generation
- `fetch-transcript` - Prerequisite for both functions

## 📞 Support

For issues:
1. Check error response details
2. Verify prerequisites (transcript + topics)
3. Review environment variables
4. Check database logs
5. Test with example requests

---

**Quick Links**:
- [Full README](./README.md)
- [Examples](./EXAMPLES.md)
- [Cost Details](./COST_AND_VERSIONING.md)
- [Implementation Summary](./IMPLEMENTATION_SUMMARY.md)
