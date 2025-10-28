# Extract Content Topics - Usage Examples

Comprehensive examples for integrating the `extract-content-topics` edge function into your application.

## Table of Contents
1. [Basic Usage](#basic-usage)
2. [React Integration](#react-integration)
3. [Error Handling](#error-handling)
4. [Caching Strategy](#caching-strategy)
5. [Cost Tracking](#cost-tracking)
6. [Bulk Operations](#bulk-operations)
7. [UI Components](#ui-components)

---

## Basic Usage

### Simple Extraction
```typescript
import { supabase } from '@/lib/supabase'

async function extractTopics(meetingId: string) {
  const { data, error } = await supabase.functions.invoke('extract-content-topics', {
    body: { meeting_id: meetingId }
  })

  if (error) {
    console.error('Failed to extract topics:', error)
    return null
  }

  return data
}

// Usage
const result = await extractTopics('550e8400-e29b-41d4-a716-446655440000')
console.log(`Found ${result.topics.length} topics`)
console.log(`Cost: $${(result.metadata.cost_cents / 100).toFixed(4)}`)
```

### Force Refresh
```typescript
async function refreshTopics(meetingId: string) {
  const { data, error } = await supabase.functions.invoke('extract-content-topics', {
    body: {
      meeting_id: meetingId,
      force_refresh: true // Bypass cache
    }
  })

  if (error) throw error
  return data
}
```

### Check Cache Status
```typescript
async function getCachedTopics(meetingId: string) {
  const { data } = await supabase.functions.invoke('extract-content-topics', {
    body: { meeting_id: meetingId }
  })

  if (data?.metadata.cached) {
    console.log('Using cached topics (fast response)')
  } else {
    console.log('Fresh extraction (may take a few seconds)')
  }

  return data
}
```

---

## React Integration

### Custom Hook with Loading States
```typescript
import { useState, useEffect } from 'react'
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

interface UseTopicsResult {
  topics: Topic[]
  metadata: Metadata | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useContentTopics(meetingId: string): UseTopicsResult {
  const [topics, setTopics] = useState<Topic[]>([])
  const [metadata, setMetadata] = useState<Metadata | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTopics = async (forceRefresh = false) => {
    if (!meetingId) return

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
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('Failed to extract topics:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTopics()
  }, [meetingId])

  const refresh = async () => {
    await fetchTopics(true)
  }

  return { topics, metadata, loading, error, refresh }
}
```

### Component Using Hook
```typescript
import { useContentTopics } from '@/hooks/useContentTopics'

export function MeetingContentTopics({ meetingId }: { meetingId: string }) {
  const { topics, metadata, loading, error, refresh } = useContentTopics(meetingId)

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        <span className="ml-3">Extracting topics...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Error: {error}</p>
        <button
          onClick={refresh}
          className="mt-2 text-sm text-red-600 hover:text-red-800"
        >
          Try again
        </button>
      </div>
    )
  }

  if (topics.length === 0) {
    return (
      <div className="text-gray-500 p-4">
        No topics extracted from this meeting.
      </div>
    )
  }

  return (
    <div>
      {/* Header with metadata */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Content Topics ({topics.length})</h2>
        <div className="flex items-center gap-4">
          {metadata?.cached && (
            <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
              Cached
            </span>
          )}
          {metadata && (
            <span className="text-xs text-gray-500">
              Cost: ${(metadata.cost_cents / 100).toFixed(4)}
            </span>
          )}
          <button
            onClick={refresh}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Topics list */}
      <div className="space-y-4">
        {topics.map((topic, index) => (
          <div
            key={index}
            className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <h3 className="font-semibold text-lg mb-2">{topic.title}</h3>
            <p className="text-gray-600 mb-3">{topic.description}</p>
            <a
              href={topic.fathom_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-blue-500 hover:text-blue-700"
            >
              <span>Watch at {formatTimestamp(topic.timestamp_seconds)}</span>
              <svg
                className="ml-1 w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatTimestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}
```

---

## Error Handling

### Comprehensive Error Handler
```typescript
import { supabase } from '@/lib/supabase'

interface ExtractResult {
  topics: Topic[]
  metadata: Metadata
  fromCache: boolean
}

async function extractTopicsWithRetry(
  meetingId: string,
  maxRetries = 3
): Promise<ExtractResult> {
  let attempt = 0
  let lastError: Error | null = null

  while (attempt < maxRetries) {
    try {
      const { data, error } = await supabase.functions.invoke(
        'extract-content-topics',
        {
          body: { meeting_id: meetingId },
        }
      )

      if (error) throw error

      if (!data.success) {
        // Handle specific error codes
        switch (true) {
          case data.error.includes('not found'):
            throw new Error('Meeting not found. Please verify the meeting ID.')

          case data.error.includes('transcript'):
            throw new Error('Transcript is not available yet. Please try again in a moment.')

          case data.error.includes('temporarily unavailable'):
            // Retry for temporary errors
            if (attempt < maxRetries - 1) {
              await sleep(Math.pow(2, attempt) * 1000) // Exponential backoff
              attempt++
              continue
            }
            throw new Error('AI service is currently unavailable. Please try again later.')

          default:
            throw new Error(data.error)
        }
      }

      return {
        topics: data.topics,
        metadata: data.metadata,
        fromCache: data.metadata.cached,
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Unknown error')

      // Don't retry for certain errors
      if (
        lastError.message.includes('not found') ||
        lastError.message.includes('access denied')
      ) {
        throw lastError
      }

      attempt++
      if (attempt < maxRetries) {
        await sleep(Math.pow(2, attempt) * 1000) // Exponential backoff
      }
    }
  }

  throw lastError || new Error('Failed to extract topics after multiple attempts')
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Usage
try {
  const result = await extractTopicsWithRetry('550e8400-e29b-41d4-a716-446655440000')
  console.log(`Successfully extracted ${result.topics.length} topics`)
} catch (error) {
  console.error('Fatal error:', error.message)
}
```

### User-Friendly Error Messages
```typescript
function getErrorMessage(error: any): string {
  const message = error?.message || error?.error || 'Unknown error'

  const errorMappings: Record<string, string> = {
    'Missing authorization': 'Please log in to continue',
    'not found': 'Meeting not found or you don\'t have access',
    'transcript': 'Transcript is still processing. This usually takes 1-2 minutes.',
    'temporarily unavailable': 'Our AI service is currently busy. Please try again in a moment.',
    'timeout': 'This transcript is taking longer than expected. Please try again.',
    'Internal server error': 'Something went wrong on our end. Please try again.',
  }

  for (const [key, friendlyMessage] of Object.entries(errorMappings)) {
    if (message.toLowerCase().includes(key.toLowerCase())) {
      return friendlyMessage
    }
  }

  return 'An unexpected error occurred. Please try again or contact support.'
}
```

---

## Caching Strategy

### Smart Cache Management
```typescript
import { supabase } from '@/lib/supabase'

interface CacheInfo {
  hasCachedTopics: boolean
  cacheAge: number // in seconds
  topicsCount: number
}

async function getCacheInfo(meetingId: string): Promise<CacheInfo> {
  const { data, error } = await supabase
    .from('meeting_content_topics')
    .select('created_at, topics')
    .eq('meeting_id', meetingId)
    .is('deleted_at', null)
    .order('extraction_version', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) {
    return { hasCachedTopics: false, cacheAge: 0, topicsCount: 0 }
  }

  const cacheAge = Math.floor(
    (Date.now() - new Date(data.created_at).getTime()) / 1000
  )
  const topics = Array.isArray(data.topics) ? data.topics : []

  return {
    hasCachedTopics: true,
    cacheAge,
    topicsCount: topics.length,
  }
}

// Usage
const cacheInfo = await getCacheInfo(meetingId)

if (cacheInfo.hasCachedTopics) {
  const ageMinutes = Math.floor(cacheInfo.cacheAge / 60)
  console.log(`Cached topics from ${ageMinutes} minutes ago (${cacheInfo.topicsCount} topics)`)

  // Refresh if cache is old (e.g., > 24 hours)
  if (cacheInfo.cacheAge > 24 * 60 * 60) {
    console.log('Cache is stale, refreshing...')
    await extractTopics(meetingId, true)
  }
} else {
  console.log('No cached topics, extracting fresh...')
  await extractTopics(meetingId, false)
}
```

### Conditional Refresh
```typescript
async function extractWithSmartRefresh(
  meetingId: string,
  transcriptUpdatedAt: Date
): Promise<ExtractResult> {
  // Check if topics exist and when they were created
  const { data: cached } = await supabase
    .from('meeting_content_topics')
    .select('created_at')
    .eq('meeting_id', meetingId)
    .is('deleted_at', null)
    .order('extraction_version', { ascending: false })
    .limit(1)
    .single()

  // If topics exist but transcript was updated after extraction, refresh
  const shouldRefresh =
    cached &&
    new Date(cached.created_at) < transcriptUpdatedAt

  const { data } = await supabase.functions.invoke('extract-content-topics', {
    body: {
      meeting_id: meetingId,
      force_refresh: shouldRefresh,
    },
  })

  return data
}
```

---

## Cost Tracking

### Cost Analytics Dashboard
```typescript
import { supabase } from '@/lib/supabase'

interface CostAnalytics {
  totalCostCents: number
  totalExtractions: number
  cachedHits: number
  cacheHitRate: number
  averageCostCents: number
}

async function getTopicCostAnalytics(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<CostAnalytics> {
  const { data, error } = await supabase
    .from('meeting_content_topics')
    .select('cost_cents, extraction_version')
    .eq('user_id', userId)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
    .is('deleted_at', null)

  if (error || !data) {
    return {
      totalCostCents: 0,
      totalExtractions: 0,
      cachedHits: 0,
      cacheHitRate: 0,
      averageCostCents: 0,
    }
  }

  const totalCostCents = data.reduce((sum, item) => sum + item.cost_cents, 0)
  const totalExtractions = data.length

  // Count re-extractions (version > 1) as cached hits
  const cachedHits = data.filter((item) => item.extraction_version > 1).length

  const cacheHitRate =
    totalExtractions > 0 ? (cachedHits / totalExtractions) * 100 : 0

  const averageCostCents =
    totalExtractions > 0 ? totalCostCents / totalExtractions : 0

  return {
    totalCostCents,
    totalExtractions,
    cachedHits,
    cacheHitRate,
    averageCostCents,
  }
}

// Usage
const analytics = await getTopicCostAnalytics(
  userId,
  new Date('2025-01-01'),
  new Date('2025-01-31')
)

console.log(`Total spent: $${(analytics.totalCostCents / 100).toFixed(2)}`)
console.log(`Extractions: ${analytics.totalExtractions}`)
console.log(`Cache hit rate: ${analytics.cacheHitRate.toFixed(1)}%`)
console.log(`Average cost: $${(analytics.averageCostCents / 100).toFixed(4)}`)
```

### Cost Tracking Component
```typescript
function CostTracker({ userId }: { userId: string }) {
  const [analytics, setAnalytics] = useState<CostAnalytics | null>(null)

  useEffect(() => {
    const loadAnalytics = async () => {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const data = await getTopicCostAnalytics(userId, thirtyDaysAgo, new Date())
      setAnalytics(data)
    }

    loadAnalytics()
  }, [userId])

  if (!analytics) return null

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Topic Extraction Costs (Last 30 Days)</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-gray-600">Total Spent</p>
          <p className="text-2xl font-bold">
            ${(analytics.totalCostCents / 100).toFixed(2)}
          </p>
        </div>

        <div>
          <p className="text-sm text-gray-600">Extractions</p>
          <p className="text-2xl font-bold">{analytics.totalExtractions}</p>
        </div>

        <div>
          <p className="text-sm text-gray-600">Cache Hit Rate</p>
          <p className="text-2xl font-bold">{analytics.cacheHitRate.toFixed(1)}%</p>
        </div>

        <div>
          <p className="text-sm text-gray-600">Avg Cost/Extract</p>
          <p className="text-2xl font-bold">
            ${(analytics.averageCostCents / 100).toFixed(4)}
          </p>
        </div>
      </div>
    </div>
  )
}
```

---

## Bulk Operations

### Extract Topics for Multiple Meetings
```typescript
async function extractTopicsForMeetings(
  meetingIds: string[],
  onProgress?: (completed: number, total: number) => void
): Promise<Map<string, ExtractResult>> {
  const results = new Map<string, ExtractResult>()
  let completed = 0

  // Process in batches to avoid rate limits
  const batchSize = 5
  for (let i = 0; i < meetingIds.length; i += batchSize) {
    const batch = meetingIds.slice(i, i + batchSize)

    await Promise.all(
      batch.map(async (meetingId) => {
        try {
          const { data } = await supabase.functions.invoke('extract-content-topics', {
            body: { meeting_id: meetingId },
          })

          if (data.success) {
            results.set(meetingId, {
              topics: data.topics,
              metadata: data.metadata,
              fromCache: data.metadata.cached,
            })
          }
        } catch (error) {
          console.error(`Failed to extract topics for ${meetingId}:`, error)
        }

        completed++
        onProgress?.(completed, meetingIds.length)
      })
    )

    // Small delay between batches
    if (i + batchSize < meetingIds.length) {
      await sleep(1000)
    }
  }

  return results
}

// Usage
const meetingIds = ['meeting-1', 'meeting-2', 'meeting-3']
const results = await extractTopicsForMeetings(meetingIds, (completed, total) => {
  console.log(`Progress: ${completed}/${total}`)
})

console.log(`Successfully extracted topics for ${results.size} meetings`)
```

---

## UI Components

### Full-Featured Topics Card
```typescript
import { useState } from 'react'
import { useContentTopics } from '@/hooks/useContentTopics'

export function ContentTopicsCard({ meetingId }: { meetingId: string }) {
  const { topics, metadata, loading, error, refresh } = useContentTopics(meetingId)
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Content Topics</h2>
          {metadata && (
            <div className="flex items-center gap-2">
              {metadata.cached && (
                <span className="text-xs bg-white/20 text-white px-2 py-1 rounded">
                  ⚡ Cached
                </span>
              )}
              <button
                onClick={refresh}
                className="text-white hover:bg-white/20 px-3 py-1 rounded transition"
              >
                Refresh
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4" />
            <p className="text-gray-600">Extracting marketable topics...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4">
            <p className="text-red-800 font-medium">Failed to extract topics</p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
            <button
              onClick={refresh}
              className="mt-3 text-sm text-red-600 hover:text-red-800 underline"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && topics.length === 0 && (
          <p className="text-gray-500 text-center py-8">
            No topics found in this meeting.
          </p>
        )}

        {!loading && !error && topics.length > 0 && (
          <>
            {/* Metadata */}
            {metadata && (
              <div className="mb-6 pb-4 border-b flex items-center justify-between text-sm text-gray-600">
                <span>{topics.length} topics extracted</span>
                <span>Cost: ${(metadata.cost_cents / 100).toFixed(4)}</span>
              </div>
            )}

            {/* Topics Grid */}
            <div className="space-y-3">
              {topics.map((topic, index) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-all"
                >
                  <button
                    onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50"
                  >
                    <div className="flex items-start justify-between">
                      <h3 className="font-semibold text-gray-900 flex-1">
                        {index + 1}. {topic.title}
                      </h3>
                      <span className="text-xs text-gray-500 ml-2">
                        {formatTimestamp(topic.timestamp_seconds)}
                      </span>
                    </div>
                  </button>

                  {expandedIndex === index && (
                    <div className="px-4 pb-4 bg-gray-50 border-t">
                      <p className="text-gray-700 mt-3 mb-4">{topic.description}</p>
                      <a
                        href={topic.fathom_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium"
                      >
                        <svg
                          className="w-5 h-5 mr-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        Watch this moment
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function formatTimestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}
```

---

## Next Steps

- Explore the [README.md](./README.md) for API documentation
- Review error handling patterns for production use
- Implement cost tracking in your analytics dashboard
- Consider batch operations for processing multiple meetings
