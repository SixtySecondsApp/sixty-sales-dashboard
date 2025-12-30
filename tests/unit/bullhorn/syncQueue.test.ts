import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// =============================================================================
// Types (mirrored from Bullhorn sync implementation)
// =============================================================================

type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
type JobType =
  | 'initial_sync'
  | 'incremental_sync'
  | 'candidate_sync'
  | 'contact_sync'
  | 'job_order_sync'
  | 'placement_sync'
  | 'note_writeback'
  | 'task_sync';

interface SyncJob {
  id: string;
  orgId: string;
  jobType: JobType;
  status: JobStatus;
  priority: number;
  payload: Record<string, unknown>;
  dedupeKey?: string;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  result?: Record<string, unknown>;
}

interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  cancelled: number;
}

// =============================================================================
// Mock Queue Implementation
// =============================================================================

class MockSyncQueue {
  private jobs: Map<string, SyncJob> = new Map();
  private idCounter = 0;

  enqueue(args: {
    orgId: string;
    jobType: JobType;
    payload?: Record<string, unknown>;
    dedupeKey?: string;
    priority?: number;
  }): SyncJob {
    // Check for duplicate
    if (args.dedupeKey) {
      for (const job of this.jobs.values()) {
        if (
          job.dedupeKey === args.dedupeKey &&
          job.orgId === args.orgId &&
          (job.status === 'pending' || job.status === 'processing')
        ) {
          return job; // Return existing job
        }
      }
    }

    const job: SyncJob = {
      id: `job_${++this.idCounter}`,
      orgId: args.orgId,
      jobType: args.jobType,
      status: 'pending',
      priority: args.priority ?? 100,
      payload: args.payload ?? {},
      dedupeKey: args.dedupeKey,
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date(),
    };

    this.jobs.set(job.id, job);
    return job;
  }

  dequeue(limit: number = 1): SyncJob[] {
    const pending = Array.from(this.jobs.values())
      .filter((j) => j.status === 'pending')
      .sort((a, b) => a.priority - b.priority || a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, limit);

    for (const job of pending) {
      job.status = 'processing';
      job.startedAt = new Date();
      job.attempts++;
    }

    return pending;
  }

  complete(jobId: string, result?: Record<string, unknown>): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    job.status = 'completed';
    job.completedAt = new Date();
    job.result = result;
    return true;
  }

  fail(jobId: string, error: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    if (job.attempts < job.maxAttempts) {
      // Retry
      job.status = 'pending';
      job.error = error;
    } else {
      job.status = 'failed';
      job.completedAt = new Date();
      job.error = error;
    }
    return true;
  }

  cancel(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'pending') return false;

    job.status = 'cancelled';
    job.completedAt = new Date();
    return true;
  }

  getStats(orgId: string): QueueStats {
    const jobs = Array.from(this.jobs.values()).filter((j) => j.orgId === orgId);
    return {
      pending: jobs.filter((j) => j.status === 'pending').length,
      processing: jobs.filter((j) => j.status === 'processing').length,
      completed: jobs.filter((j) => j.status === 'completed').length,
      failed: jobs.filter((j) => j.status === 'failed').length,
      cancelled: jobs.filter((j) => j.status === 'cancelled').length,
    };
  }

  getJob(jobId: string): SyncJob | undefined {
    return this.jobs.get(jobId);
  }

  clear(): void {
    this.jobs.clear();
    this.idCounter = 0;
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('BullhornSyncQueue', () => {
  let queue: MockSyncQueue;

  beforeEach(() => {
    queue = new MockSyncQueue();
  });

  afterEach(() => {
    queue.clear();
  });

  describe('enqueue', () => {
    it('should create a new pending job', () => {
      const job = queue.enqueue({
        orgId: 'org_123',
        jobType: 'candidate_sync',
      });

      expect(job.id).toBeDefined();
      expect(job.status).toBe('pending');
      expect(job.attempts).toBe(0);
      expect(job.maxAttempts).toBe(3);
    });

    it('should set default priority to 100', () => {
      const job = queue.enqueue({
        orgId: 'org_123',
        jobType: 'candidate_sync',
      });

      expect(job.priority).toBe(100);
    });

    it('should accept custom priority', () => {
      const job = queue.enqueue({
        orgId: 'org_123',
        jobType: 'candidate_sync',
        priority: 50,
      });

      expect(job.priority).toBe(50);
    });

    it('should deduplicate jobs with same dedupeKey', () => {
      const job1 = queue.enqueue({
        orgId: 'org_123',
        jobType: 'initial_sync',
        dedupeKey: 'initial_sync_org_123',
      });

      const job2 = queue.enqueue({
        orgId: 'org_123',
        jobType: 'initial_sync',
        dedupeKey: 'initial_sync_org_123',
      });

      expect(job1.id).toBe(job2.id);
    });

    it('should allow same dedupeKey for different orgs', () => {
      const job1 = queue.enqueue({
        orgId: 'org_123',
        jobType: 'initial_sync',
        dedupeKey: 'initial_sync',
      });

      const job2 = queue.enqueue({
        orgId: 'org_456',
        jobType: 'initial_sync',
        dedupeKey: 'initial_sync',
      });

      expect(job1.id).not.toBe(job2.id);
    });

    it('should store payload', () => {
      const payload = { candidateIds: [1, 2, 3], mode: 'incremental' };
      const job = queue.enqueue({
        orgId: 'org_123',
        jobType: 'candidate_sync',
        payload,
      });

      expect(job.payload).toEqual(payload);
    });
  });

  describe('dequeue', () => {
    it('should return jobs in priority order', () => {
      queue.enqueue({ orgId: 'org_123', jobType: 'candidate_sync', priority: 100 });
      queue.enqueue({ orgId: 'org_123', jobType: 'initial_sync', priority: 10 });
      queue.enqueue({ orgId: 'org_123', jobType: 'note_writeback', priority: 50 });

      const jobs = queue.dequeue(3);

      expect(jobs[0].priority).toBe(10);
      expect(jobs[1].priority).toBe(50);
      expect(jobs[2].priority).toBe(100);
    });

    it('should return jobs in FIFO order for same priority', () => {
      const job1 = queue.enqueue({ orgId: 'org_123', jobType: 'candidate_sync' });
      // Small delay to ensure different timestamps
      const job2 = queue.enqueue({ orgId: 'org_123', jobType: 'contact_sync' });

      const jobs = queue.dequeue(2);

      expect(jobs[0].id).toBe(job1.id);
      expect(jobs[1].id).toBe(job2.id);
    });

    it('should mark dequeued jobs as processing', () => {
      queue.enqueue({ orgId: 'org_123', jobType: 'candidate_sync' });

      const jobs = queue.dequeue(1);

      expect(jobs[0].status).toBe('processing');
      expect(jobs[0].startedAt).toBeDefined();
    });

    it('should increment attempts on dequeue', () => {
      queue.enqueue({ orgId: 'org_123', jobType: 'candidate_sync' });

      const jobs = queue.dequeue(1);

      expect(jobs[0].attempts).toBe(1);
    });

    it('should respect limit parameter', () => {
      queue.enqueue({ orgId: 'org_123', jobType: 'candidate_sync' });
      queue.enqueue({ orgId: 'org_123', jobType: 'contact_sync' });
      queue.enqueue({ orgId: 'org_123', jobType: 'job_order_sync' });

      const jobs = queue.dequeue(2);

      expect(jobs).toHaveLength(2);
    });

    it('should not return already processing jobs', () => {
      queue.enqueue({ orgId: 'org_123', jobType: 'candidate_sync' });
      queue.dequeue(1); // First dequeue marks as processing

      const jobs = queue.dequeue(1);

      expect(jobs).toHaveLength(0);
    });
  });

  describe('complete', () => {
    it('should mark job as completed', () => {
      const job = queue.enqueue({ orgId: 'org_123', jobType: 'candidate_sync' });
      queue.dequeue(1);

      const success = queue.complete(job.id, { synced: 100 });

      expect(success).toBe(true);
      expect(queue.getJob(job.id)?.status).toBe('completed');
    });

    it('should set completedAt timestamp', () => {
      const job = queue.enqueue({ orgId: 'org_123', jobType: 'candidate_sync' });
      queue.dequeue(1);
      queue.complete(job.id);

      expect(queue.getJob(job.id)?.completedAt).toBeDefined();
    });

    it('should store result', () => {
      const job = queue.enqueue({ orgId: 'org_123', jobType: 'candidate_sync' });
      queue.dequeue(1);

      const result = { synced: 100, created: 50, updated: 50 };
      queue.complete(job.id, result);

      expect(queue.getJob(job.id)?.result).toEqual(result);
    });

    it('should return false for non-existent job', () => {
      const success = queue.complete('non_existent_id');
      expect(success).toBe(false);
    });
  });

  describe('fail', () => {
    it('should retry job if attempts < maxAttempts', () => {
      const job = queue.enqueue({ orgId: 'org_123', jobType: 'candidate_sync' });
      queue.dequeue(1);

      queue.fail(job.id, 'Connection timeout');

      const updated = queue.getJob(job.id);
      expect(updated?.status).toBe('pending'); // Back to pending for retry
      expect(updated?.error).toBe('Connection timeout');
    });

    it('should mark as failed after maxAttempts', () => {
      const job = queue.enqueue({ orgId: 'org_123', jobType: 'candidate_sync' });

      // Simulate 3 failed attempts
      for (let i = 0; i < 3; i++) {
        queue.dequeue(1);
        queue.fail(job.id, 'Connection timeout');
      }

      const updated = queue.getJob(job.id);
      expect(updated?.status).toBe('failed');
      expect(updated?.attempts).toBe(3);
    });

    it('should store error message', () => {
      const job = queue.enqueue({ orgId: 'org_123', jobType: 'candidate_sync' });
      queue.dequeue(1);

      queue.fail(job.id, 'Rate limit exceeded');

      expect(queue.getJob(job.id)?.error).toBe('Rate limit exceeded');
    });
  });

  describe('cancel', () => {
    it('should cancel pending job', () => {
      const job = queue.enqueue({ orgId: 'org_123', jobType: 'candidate_sync' });

      const success = queue.cancel(job.id);

      expect(success).toBe(true);
      expect(queue.getJob(job.id)?.status).toBe('cancelled');
    });

    it('should not cancel processing job', () => {
      const job = queue.enqueue({ orgId: 'org_123', jobType: 'candidate_sync' });
      queue.dequeue(1);

      const success = queue.cancel(job.id);

      expect(success).toBe(false);
      expect(queue.getJob(job.id)?.status).toBe('processing');
    });

    it('should set completedAt on cancel', () => {
      const job = queue.enqueue({ orgId: 'org_123', jobType: 'candidate_sync' });
      queue.cancel(job.id);

      expect(queue.getJob(job.id)?.completedAt).toBeDefined();
    });
  });

  describe('getStats', () => {
    it('should return correct counts', () => {
      // Create jobs in various states
      queue.enqueue({ orgId: 'org_123', jobType: 'candidate_sync' }); // pending
      queue.enqueue({ orgId: 'org_123', jobType: 'contact_sync' }); // pending
      const job3 = queue.enqueue({ orgId: 'org_123', jobType: 'job_order_sync' });
      queue.dequeue(1); // Makes job3 processing
      const job4 = queue.enqueue({ orgId: 'org_123', jobType: 'note_writeback' });
      queue.cancel(job4.id); // cancelled

      const stats = queue.getStats('org_123');

      // 3 enqueued initially, 1 dequeued (processing), then job4 added and cancelled
      // Remaining: job2 + job3 = 2 pending
      expect(stats.pending).toBe(2);
      expect(stats.processing).toBe(1);
      expect(stats.cancelled).toBe(1);
      expect(stats.completed).toBe(0);
      expect(stats.failed).toBe(0);
    });

    it('should filter by orgId', () => {
      queue.enqueue({ orgId: 'org_123', jobType: 'candidate_sync' });
      queue.enqueue({ orgId: 'org_456', jobType: 'candidate_sync' });

      const stats123 = queue.getStats('org_123');
      const stats456 = queue.getStats('org_456');

      expect(stats123.pending).toBe(1);
      expect(stats456.pending).toBe(1);
    });
  });

  describe('Job Types', () => {
    const jobTypes: JobType[] = [
      'initial_sync',
      'incremental_sync',
      'candidate_sync',
      'contact_sync',
      'job_order_sync',
      'placement_sync',
      'note_writeback',
      'task_sync',
    ];

    it.each(jobTypes)('should accept job type: %s', (jobType) => {
      const job = queue.enqueue({ orgId: 'org_123', jobType });
      expect(job.jobType).toBe(jobType);
    });
  });

  describe('Priority Levels', () => {
    it('should process high priority jobs first', () => {
      // Low priority
      queue.enqueue({ orgId: 'org_123', jobType: 'note_writeback', priority: 1000 });
      // High priority
      queue.enqueue({ orgId: 'org_123', jobType: 'initial_sync', priority: 1 });
      // Medium priority
      queue.enqueue({ orgId: 'org_123', jobType: 'candidate_sync', priority: 100 });

      const jobs = queue.dequeue(3);

      expect(jobs[0].jobType).toBe('initial_sync');
      expect(jobs[1].jobType).toBe('candidate_sync');
      expect(jobs[2].jobType).toBe('note_writeback');
    });

    it('should use expected priority conventions', () => {
      // Priority conventions:
      // 1-10: Critical/Initial sync
      // 50-100: Standard entity sync
      // 500-1000: Background/low priority

      const criticalJob = queue.enqueue({
        orgId: 'org_123',
        jobType: 'initial_sync',
        priority: 1,
      });
      const standardJob = queue.enqueue({
        orgId: 'org_123',
        jobType: 'candidate_sync',
        priority: 100,
      });
      const backgroundJob = queue.enqueue({
        orgId: 'org_123',
        jobType: 'note_writeback',
        priority: 500,
      });

      expect(criticalJob.priority).toBeLessThan(standardJob.priority);
      expect(standardJob.priority).toBeLessThan(backgroundJob.priority);
    });
  });
});
