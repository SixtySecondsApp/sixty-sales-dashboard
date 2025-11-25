# Bull Job Queue: Complete Guide for Your SaaS

**What:** Bull is a Redis-based job queue for Node.js
**Why:** Handle long-running tasks without blocking API responses
**When:** For tasks that take >100ms (video processing, AI, large imports, syncs)

---

## 1. WHAT IS BULL?

Think of Bull like a **restaurant waiting queue**:

```
Customer arrives (adds job)
    ↓
Waiter puts order in queue (job queued)
    ↓
Chef picks up order (worker processes job)
    ↓
Kitchen prepares (processing)
    ↓
Food is ready (job completed)
    ↓
Customer notified (event fired)
```

### How It Works Technically

```
Node.js Application (API)
    ↓
Bull Queue (in Redis)
├─ Job 1: Generate thumbnail (pending)
├─ Job 2: Generate proposal (pending)
├─ Job 3: Sync meetings (active - being processed)
├─ Job 4: Import activities (pending)
└─ Job 5: Extract action items (pending)
    ↓
Worker Process (Bull Worker)
├─ Pulls Job 3 from queue
├─ Processes it (30 seconds)
├─ Emits progress events
├─ Updates database
├─ Marks as completed
├─ Emits completion event
└─ Picks up Job 4 next
```

---

## 2. KEY CONCEPTS

### 2.1 Jobs
A "job" is a unit of work to be processed:
```typescript
// Example job
{
  id: '42',
  name: 'generateThumbnail',
  data: {
    meetingId: 'abc123',
    videoUrl: 'https://example.com/video.mp4'
  },
  state: 'active',
  progress: 45, // 45% done
  attempts: 1,
  maxAttempts: 3,
  timestamp: 1700900000,
  finishedOn: null
}
```

### 2.2 Queues
A queue holds multiple jobs waiting to be processed:
```typescript
const thumbnailQueue = new Queue('thumbnail-generation', {
  redis: { host: 'localhost', port: 6379 }
})

const proposalQueue = new Queue('proposal-generation', {
  redis: { host: 'localhost', port: 6379 }
})

// You can have many independent queues
```

### 2.3 Workers
A worker is code that **processes jobs from a queue**:
```typescript
// Worker pulls jobs and executes them
thumbnailQueue.process(4, async (job) => {
  console.log(`Processing job ${job.id}`)
  const result = await generateThumbnail(job.data.videoUrl)
  return result
})

// 4 = concurrency (process 4 jobs simultaneously)
```

### 2.4 Job States
Jobs move through states as they're processed:
```
pending → active → completed ✓
  ↓
failed (if error) → retry → active → completed ✓
  ↓
failed (max retries reached)
```

### 2.5 Events
You can listen for job events:
```typescript
queue.on('completed', (job, result) => {
  console.log(`Job ${job.id} completed with result:`, result)
})

queue.on('failed', (job, err) => {
  console.log(`Job ${job.id} failed:`, err.message)
})

queue.on('progress', (job, progress) => {
  console.log(`Job ${job.id} progress: ${progress}%`)
})
```

---

## 3. WHY YOU NEED BULL FOR YOUR APP

### Problem: Current Edge Functions (Blocking)

```typescript
// Current: User waits for entire operation
app.post('/api/v1/meetings/:id/generate-thumbnail', async (req, res) => {
  const { id } = req.params

  // This takes 30-60 seconds
  // User's browser waits the entire time ❌
  const video = await downloadVideo(req.body.videoUrl)
  const thumbnail = await generateThumbnail(video)

  await db.update('meetings', { thumbnail_url: thumbnail })

  // Finally, user gets response
  res.json({ thumbnail_url: thumbnail })
})

// User experience: Spinning wheel for 30-60 seconds 😞
```

### Solution: Bull Job Queue (Non-Blocking)

```typescript
// With Bull: User gets immediate response
app.post('/api/v1/meetings/:id/generate-thumbnail', async (req, res) => {
  const { id } = req.params

  // Queue the job (returns instantly) ⚡
  const job = await thumbnailQueue.add(
    { meetingId: id, videoUrl: req.body.videoUrl },
    { priority: 10, attempts: 3 }
  )

  // Send response immediately
  res.json({ jobId: job.id, status: 'queued' })

  // Processing happens in background 🔄
})

// Separate worker processes it
thumbnailQueue.process(async (job) => {
  const { meetingId, videoUrl } = job.data

  job.progress(0) // Start
  const video = await downloadVideo(videoUrl)
  job.progress(30)
  const thumbnail = await generateThumbnail(video)
  job.progress(80)
  await db.update('meetings', { thumbnail_url: thumbnail })
  job.progress(100)

  return { thumbnail_url: thumbnail }
})

// User experience: Instant response, gets notified when done 😊
```

---

## 4. INSTALLATION & SETUP

### 4.1 Install Dependencies

```bash
npm install bull redis

# OR use BullMQ (newer version)
npm install bullmq redis
```

### 4.2 Create Redis Connection

```typescript
// src/services/redis.ts
import Redis from 'redis'

export const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  db: 0
})

redis.on('connect', () => console.log('Redis connected'))
redis.on('error', (err) => console.error('Redis error:', err))

export default redis
```

### 4.3 Create Queue Instance

```typescript
// src/services/queue/index.ts
import Bull from 'bull'
import redis from '../redis'

// Create separate queues for different job types
export const thumbnailQueue = new Bull('thumbnail-generation', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379
  }
})

export const proposalQueue = new Bull('proposal-generation', {
  redis: { ... }
})

export const syncQueue = new Bull('meeting-sync', {
  redis: { ... }
})

export const importQueue = new Bull('bulk-import', {
  redis: { ... }
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  await thumbnailQueue.close()
  await proposalQueue.close()
  await syncQueue.close()
  await importQueue.close()
})
```

---

## 5. PRACTICAL EXAMPLES FOR YOUR APP

### 5.1 Video Thumbnail Generation

```typescript
// src/routes/api/meetings.ts
import express from 'express'
import { thumbnailQueue } from '@/services/queue'

const router = express.Router()

// API endpoint
router.post('/:id/generate-thumbnail', async (req, res) => {
  const { id } = req.params
  const { videoUrl } = req.body

  // Validate
  if (!videoUrl) {
    return res.status(400).json({ error: 'videoUrl required' })
  }

  try {
    // Add to queue
    const job = await thumbnailQueue.add(
      { meetingId: id, videoUrl },
      {
        priority: 10,        // Higher priority
        attempts: 3,         // Retry 3 times if fails
        backoff: {          // Wait longer between retries
          type: 'exponential',
          delay: 2000      // Start with 2s, doubles each retry
        },
        removeOnComplete: true, // Clean up job when done
        removeOnFail: false     // Keep failed jobs for debugging
      }
    )

    res.json({
      jobId: job.id,
      status: 'queued',
      message: 'Thumbnail generation started'
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router

// src/services/queue/jobs/thumbnail.job.ts
import Bull from 'bull'
import { thumbnailQueue } from '@/services/queue'
import { downloadVideo, generateThumbnail } from '@/services/video'
import { db } from '@/services/database'
import { logger } from '@/utils/logger'

export async function processThumbnailJob(job: Bull.Job) {
  const { meetingId, videoUrl } = job.data

  try {
    logger.info(`[Thumbnail] Starting job ${job.id}`, { meetingId })

    // Step 1: Download video
    job.progress(10)
    logger.info(`[Thumbnail] Downloading video from ${videoUrl}`)
    const videoBuffer = await downloadVideo(videoUrl)

    // Step 2: Generate thumbnail
    job.progress(50)
    logger.info(`[Thumbnail] Generating thumbnail`)
    const thumbnail = await generateThumbnail(videoBuffer)

    // Step 3: Upload to storage
    job.progress(80)
    logger.info(`[Thumbnail] Uploading thumbnail`)
    const thumbnailUrl = await uploadToS3(thumbnail)

    // Step 4: Update database
    job.progress(90)
    logger.info(`[Thumbnail] Updating database`)
    await db.query(
      'UPDATE meetings SET thumbnail_url = $1, thumbnail_status = $2 WHERE id = $3',
      [thumbnailUrl, 'completed', meetingId]
    )

    job.progress(100)
    logger.info(`[Thumbnail] Job completed`, { jobId: job.id, thumbnailUrl })

    return {
      thumbnailUrl,
      meetingId,
      status: 'completed'
    }
  } catch (error) {
    logger.error(`[Thumbnail] Job failed`, {
      jobId: job.id,
      error: error.message,
      attempt: job.attemptsMade,
      maxAttempts: job.opts.attempts
    })

    // Will automatically retry based on attempts config
    throw error
  }
}

// Register the job processor
export function registerThumbnailJobProcessor() {
  // Process 2 thumbnails concurrently (to avoid overwhelming system)
  thumbnailQueue.process(2, processThumbnailJob)

  // Listen for events
  thumbnailQueue.on('progress', (job, progress) => {
    logger.debug(`Job ${job.id} is ${progress}% complete`)
  })

  thumbnailQueue.on('completed', (job) => {
    logger.info(`Job ${job.id} completed`)
  })

  thumbnailQueue.on('failed', (job, err) => {
    logger.error(`Job ${job.id} failed:`, err)
  })
}
```

### 5.2 AI Proposal Generation

```typescript
// src/routes/api/deals.ts
router.post('/:id/generate-proposal', authMiddleware, async (req, res) => {
  const { id } = req.params
  const { dealData } = req.body

  const job = await proposalQueue.add(
    { dealId: id, dealData },
    { priority: 5, attempts: 2 } // Lower priority, fewer retries
  )

  res.json({ jobId: job.id, status: 'queued' })
})

// src/services/queue/jobs/proposal.job.ts
export async function processProposalJob(job: Bull.Job) {
  const { dealId, dealData } = job.data

  job.progress(10)

  // Call AI provider (OpenAI)
  const aiResponse = await openai.createCompletion({
    model: 'gpt-4',
    prompt: `Generate proposal for deal: ${JSON.stringify(dealData)}`,
    max_tokens: 2000
  })

  job.progress(50)

  const proposalContent = aiResponse.choices[0].text

  // Store proposal in database
  const proposal = await db.query(
    `INSERT INTO proposals (deal_id, content, status)
     VALUES ($1, $2, $3) RETURNING *`,
    [dealId, proposalContent, 'generated']
  )

  job.progress(100)

  return { proposalId: proposal.id }
}

// Register processor
proposalQueue.process(1, processProposalJob) // 1 at a time (expensive API calls)
```

### 5.3 Bulk Import Activities

```typescript
// src/routes/api/activities.ts
router.post('/bulk-import', authMiddleware, async (req, res) => {
  const { file } = req.body // CSV content
  const userId = req.user.id

  // Split large imports into chunks
  const activities = parseCSV(file)
  const chunkSize = 100

  const jobs = []
  for (let i = 0; i < activities.length; i += chunkSize) {
    const chunk = activities.slice(i, i + chunkSize)
    const job = await importQueue.add(
      { userId, activities: chunk },
      { priority: 1 } // Low priority, background task
    )
    jobs.push(job)
  }

  res.json({
    totalJobs: jobs.length,
    jobIds: jobs.map(j => j.id)
  })
})

// src/services/queue/jobs/import.job.ts
export async function processImportJob(job: Bull.Job) {
  const { userId, activities } = job.data

  for (let i = 0; i < activities.length; i++) {
    const activity = activities[i]

    // Insert into database
    await db.query(
      `INSERT INTO activities (user_id, type, contact_id, notes)
       VALUES ($1, $2, $3, $4)`,
      [userId, activity.type, activity.contactId, activity.notes]
    )

    // Update progress
    job.progress(Math.round((i / activities.length) * 100))
  }

  return { imported: activities.length }
}

importQueue.process(1, processImportJob) // 1 concurrent import
```

### 5.4 Scheduled Tasks (Cron Jobs)

```typescript
// src/services/queue/jobs/scheduled.job.ts

// Sync meetings from Fathom every hour
export async function registerScheduledJobs() {
  // Every hour at :00
  await syncQueue.add(
    { type: 'fathom-sync' },
    {
      repeat: {
        cron: '0 * * * *' // Cron expression (every hour)
      }
    }
  )

  // Every night at 2 AM
  await syncQueue.add(
    { type: 'generate-daily-report' },
    {
      repeat: {
        cron: '0 2 * * *' // 2 AM every day
      }
    }
  )

  // Every Monday at 9 AM
  await syncQueue.add(
    { type: 'weekly-summary' },
    {
      repeat: {
        cron: '0 9 * * 1' // 9 AM Monday
      }
    }
  )
}

// Process scheduled jobs
syncQueue.process(async (job) => {
  const { type } = job.data

  switch (type) {
    case 'fathom-sync':
      return await syncFathomMeetings()
    case 'generate-daily-report':
      return await generateDailyReport()
    case 'weekly-summary':
      return await generateWeeklySummary()
  }
})
```

---

## 6. MONITORING & MANAGEMENT

### 6.1 Monitor Job Status

```typescript
// Get job information
const job = await thumbnailQueue.getJob(jobId)
console.log({
  id: job.id,
  name: job.name,
  state: await job.getState(), // 'pending', 'active', 'completed', 'failed'
  progress: job.progress(),    // 0-100
  attempts: job.attemptsMade,
  stacktrace: job.stacktrace
})
```

### 6.2 Dashboard (Bull Board)

```typescript
// Add UI to monitor queues
import { createBullBoard } from '@bull-board/express'
import { BullAdapter } from '@bull-board/api/bullAdapter'

const { router } = createBullBoard({
  queues: [
    new BullAdapter(thumbnailQueue),
    new BullAdapter(proposalQueue),
    new BullAdapter(syncQueue),
    new BullAdapter(importQueue)
  ]
})

// Mount dashboard at /admin/queues
app.use('/admin/queues', authMiddleware, router)
```

Visit `http://localhost:3000/admin/queues` to see:
- Active jobs
- Pending jobs
- Completed jobs
- Failed jobs with error details
- Job progress
- Retry history

### 6.3 Metrics & Monitoring

```typescript
// Track queue metrics
async function getQueueMetrics() {
  const counts = await thumbnailQueue.getJobCounts()

  console.log({
    active: counts.active,      // Currently being processed
    pending: counts.pending,    // Waiting to be processed
    completed: counts.completed, // Finished successfully
    failed: counts.failed,      // Failed (and out of retries)
    delayed: counts.delayed     // Delayed (scheduled for later)
  })
}

// Set up metrics collection
setInterval(async () => {
  const metrics = await getQueueMetrics()

  // Send to monitoring system (Prometheus, DataDog, etc.)
  prometheus.gauge('queue_active_jobs', metrics.active)
  prometheus.gauge('queue_pending_jobs', metrics.pending)
  prometheus.gauge('queue_failed_jobs', metrics.failed)
}, 30000) // Every 30 seconds
```

---

## 7. ERROR HANDLING & RETRIES

### 7.1 Automatic Retries

```typescript
const job = await queue.add(
  { data: 'test' },
  {
    attempts: 3,        // Try 3 times total
    backoff: {
      type: 'exponential',
      delay: 2000       // Wait 2s, 4s, 8s between retries
    }
  }
)

// Job will automatically retry if it fails
// 1st attempt fails → wait 2s → retry
// 2nd attempt fails → wait 4s → retry
// 3rd attempt fails → job moved to failed
```

### 7.2 Custom Error Handling

```typescript
queue.on('failed', async (job, error) => {
  logger.error(`Job ${job.id} failed after ${job.attemptsMade} attempts`, {
    error: error.message,
    stack: error.stack
  })

  // Send alert if critical
  if (job.name === 'proposal-generation') {
    await sendAlert('Proposal generation failed', error)
  }

  // Store failed job info for debugging
  await db.query(
    `INSERT INTO failed_jobs (job_id, queue_name, data, error)
     VALUES ($1, $2, $3, $4)`,
    [job.id, job.queue.name, JSON.stringify(job.data), error.message]
  )
})
```

### 7.3 Dead-Letter Queue

```typescript
// Move jobs that fail permanently to a separate queue
const deadLetterQueue = new Queue('dead-letter')

queue.on('failed', async (job, error) => {
  if (job.attemptsMade >= job.opts.attempts) {
    // Move to DLQ for manual inspection
    await deadLetterQueue.add({
      originalQueue: queue.name,
      jobId: job.id,
      data: job.data,
      error: error.message,
      failedAt: new Date()
    })
  }
})
```

---

## 8. BULL VS SUPABASE EDGE FUNCTIONS

| Aspect | Edge Functions | Bull Queue |
|--------|---|---|
| **Duration** | <5s timeout | Unlimited (async) |
| **Response** | Blocks user | Instant (non-blocking) |
| **Retries** | Manual | Automatic |
| **Concurrency** | Limited | Scalable |
| **Monitoring** | Via Supabase dash | Via Bull board |
| **Scaling** | Managed | Horizontal (add workers) |
| **Cost** | $0.00001/invocation | Compute only |
| **Use Case** | Quick operations | Long-running tasks |

---

## 9. DOCKER SETUP FOR BULL

### 9.1 docker-compose.yml

```yaml
version: '3.8'

services:
  # Your main API server
  backend:
    build: .
    ports:
      - "3000:3000"
    environment:
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - DATABASE_URL=postgresql://user:password@postgres:5432/db
    depends_on:
      - redis
      - postgres
    volumes:
      - ./src:/app/src

  # Redis for job queue
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  # PostgreSQL database
  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "user"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  redis_data:
  postgres_data:
```

### 9.2 Running With Bull

```bash
# Start all services
docker-compose up

# View logs
docker-compose logs -f backend

# Access Bull dashboard
# Open http://localhost:3000/admin/queues in browser

# Scale workers (run in separate container)
docker-compose run backend npm run worker
```

---

## 10. WHEN TO USE BULL

### Use Bull When:
✅ Task takes >100ms
✅ Task might fail (needs retry)
✅ Task is resource-intensive (CPU/memory)
✅ Task needs to be scheduled (cron)
✅ Want non-blocking API responses
✅ Need to process large amounts of data

### DON'T Use Bull When:
❌ Task <100ms (overhead not worth it)
❌ Task must complete immediately (for user response)
❌ Simple database queries (direct DB is faster)
❌ Need real-time response (use WebSocket instead)

---

## 11. PRACTICAL ROADMAP FOR YOUR APP

**Week 1:** Set up Redis + Bull locally
- Install Bull, Redis
- Create queue instances
- Test with simple job

**Week 2:** Convert thumbnail generation
- Create thumbnail job processor
- Add to API route
- Test with file upload

**Week 3:** Convert AI functions
- Proposal generation
- Content generation
- Meeting analysis

**Week 4:** Scheduled tasks
- Fathom sync (hourly)
- Backfill jobs
- Daily reports

**Week 5:** Monitoring & optimization
- Set up Bull Board dashboard
- Add metrics collection
- Performance tuning

---

## SUMMARY

**Bull Job Queue is:**
- A Redis-backed system for queuing tasks
- Non-blocking (users get instant response)
- Automatic retry support
- Perfect for long-running operations
- Scales horizontally (add more workers)

**In your case:**
- Replace 20+ long-running Edge Functions with Bull jobs
- Generate thumbnails, AI content in background
- Users get immediate response (jobId returned)
- Progress tracked in database
- Notifications sent when complete

**Cost:** Free (just Redis overhead on Docker)
**Complexity:** Medium (but worth it)
**ROI:** Huge (10x better UX, easier maintenance)

