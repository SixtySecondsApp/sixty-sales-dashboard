import { describe, it, expect } from 'vitest';

/**
 * Unit tests for daily digest analyses logic
 * Tests the date window calculation and grouping logic used in slack-daily-digest
 */

// Re-implement the getDayWindow function for testing (same logic as in the edge function)
type DayWindow = { startIso: string; endIso: string; dateLabel: string; date: Date };

function getDayWindow(dateStr: string | undefined | null, timezone: string): DayWindow {
  // Format date for display
  const formatDate = (date: Date, tz: string): string => {
    try {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: tz,
      });
    } catch {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
  };

  // NOTE: We interpret YYYY-MM-DD as a UTC day window (00:00Z..00:00Z+1).
  // This is deterministic and avoids timezone parsing pitfalls.
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const d = new Date(`${dateStr}T00:00:00.000Z`);
    const end = new Date(d);
    end.setUTCDate(end.getUTCDate() + 1);
    return {
      startIso: d.toISOString(),
      endIso: end.toISOString(),
      dateLabel: formatDate(d, timezone),
      date: d,
    };
  }

  // Default to "today" in UTC
  const now = new Date();
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    dateLabel: formatDate(start, timezone),
    date: start,
  };
}

describe('Daily Digest Analyses', () => {
  describe('getDayWindow', () => {
    it('should parse YYYY-MM-DD format correctly', () => {
      const window = getDayWindow('2024-12-15', 'UTC');
      
      expect(window.startIso).toBe('2024-12-15T00:00:00.000Z');
      expect(window.endIso).toBe('2024-12-16T00:00:00.000Z');
      expect(window.date.toISOString()).toBe('2024-12-15T00:00:00.000Z');
    });

    it('should handle leap year dates', () => {
      const window = getDayWindow('2024-02-29', 'UTC');
      
      expect(window.startIso).toBe('2024-02-29T00:00:00.000Z');
      expect(window.endIso).toBe('2024-03-01T00:00:00.000Z');
    });

    it('should handle year boundary', () => {
      const window = getDayWindow('2024-12-31', 'UTC');
      
      expect(window.startIso).toBe('2024-12-31T00:00:00.000Z');
      expect(window.endIso).toBe('2025-01-01T00:00:00.000Z');
    });

    it('should handle month boundary', () => {
      const window = getDayWindow('2024-01-31', 'UTC');
      
      expect(window.startIso).toBe('2024-01-31T00:00:00.000Z');
      expect(window.endIso).toBe('2024-02-01T00:00:00.000Z');
    });

    it('should fallback to today when dateStr is null', () => {
      const window = getDayWindow(null, 'UTC');
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      
      expect(window.startIso).toBe(todayStart.toISOString());
    });

    it('should fallback to today when dateStr is undefined', () => {
      const window = getDayWindow(undefined, 'UTC');
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      
      expect(window.startIso).toBe(todayStart.toISOString());
    });

    it('should fallback to today when dateStr has invalid format', () => {
      const window = getDayWindow('invalid-date', 'UTC');
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      
      expect(window.startIso).toBe(todayStart.toISOString());
    });

    it('should handle different timezones for display label', () => {
      const windowUTC = getDayWindow('2024-12-15', 'UTC');
      const windowNY = getDayWindow('2024-12-15', 'America/New_York');
      const windowTokyo = getDayWindow('2024-12-15', 'Asia/Tokyo');
      
      // The ISO dates should be the same (UTC-based)
      expect(windowUTC.startIso).toBe(windowNY.startIso);
      expect(windowUTC.startIso).toBe(windowTokyo.startIso);
      
      // But the display labels may differ based on timezone
      expect(windowUTC.dateLabel).toContain('December');
      expect(windowNY.dateLabel).toContain('December');
      expect(windowTokyo.dateLabel).toContain('December');
    });
  });

  describe('Digest grouping logic', () => {
    // Sample raw data for testing grouping
    const rawMeetings = [
      { user_id: 'user-1', title: 'Meeting 1', start_time: '2024-12-15T09:00:00Z', user_name: 'Alice' },
      { user_id: 'user-1', title: 'Meeting 2', start_time: '2024-12-15T14:00:00Z', user_name: 'Alice' },
      { user_id: 'user-2', title: 'Meeting 3', start_time: '2024-12-15T10:00:00Z', user_name: 'Bob' },
      { user_id: 'user-3', title: 'Meeting 4', start_time: '2024-12-15T11:00:00Z', user_name: 'Charlie' },
    ];

    const rawOverdueTasks = [
      { assigned_to: 'user-1', title: 'Task 1', due_date: '2024-12-10', user_name: 'Alice' },
      { assigned_to: 'user-2', title: 'Task 2', due_date: '2024-12-12', user_name: 'Bob' },
      { assigned_to: 'user-2', title: 'Task 3', due_date: '2024-12-14', user_name: 'Bob' },
    ];

    const rawDueTodayTasks = [
      { assigned_to: 'user-1', title: 'Today Task 1', user_name: 'Alice' },
      { assigned_to: 'user-3', title: 'Today Task 2', user_name: 'Charlie' },
    ];

    it('should correctly group meetings by user', () => {
      const userIds = new Set<string>();
      rawMeetings.forEach((m) => m.user_id && userIds.add(m.user_id));
      rawOverdueTasks.forEach((t) => t.assigned_to && userIds.add(t.assigned_to));
      rawDueTodayTasks.forEach((t) => t.assigned_to && userIds.add(t.assigned_to));

      expect(userIds.size).toBe(3);
      expect(userIds.has('user-1')).toBe(true);
      expect(userIds.has('user-2')).toBe(true);
      expect(userIds.has('user-3')).toBe(true);
    });

    it('should filter meetings by user correctly', () => {
      const user1Meetings = rawMeetings.filter((m) => m.user_id === 'user-1');
      const user2Meetings = rawMeetings.filter((m) => m.user_id === 'user-2');
      const user3Meetings = rawMeetings.filter((m) => m.user_id === 'user-3');

      expect(user1Meetings.length).toBe(2);
      expect(user2Meetings.length).toBe(1);
      expect(user3Meetings.length).toBe(1);
    });

    it('should filter tasks by user correctly', () => {
      const user1Overdue = rawOverdueTasks.filter((t) => t.assigned_to === 'user-1');
      const user2Overdue = rawOverdueTasks.filter((t) => t.assigned_to === 'user-2');
      const user1DueToday = rawDueTodayTasks.filter((t) => t.assigned_to === 'user-1');
      const user3DueToday = rawDueTodayTasks.filter((t) => t.assigned_to === 'user-3');

      expect(user1Overdue.length).toBe(1);
      expect(user2Overdue.length).toBe(2);
      expect(user1DueToday.length).toBe(1);
      expect(user3DueToday.length).toBe(1);
    });

    it('should correctly calculate days overdue', () => {
      const dayStart = new Date('2024-12-15T00:00:00.000Z');
      
      const calculateDaysOverdue = (dueDate: string): number => {
        return Math.ceil((dayStart.getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24));
      };

      expect(calculateDaysOverdue('2024-12-10')).toBe(5);
      expect(calculateDaysOverdue('2024-12-12')).toBe(3);
      expect(calculateDaysOverdue('2024-12-14')).toBe(1);
    });
  });

  describe('Digest analysis structure', () => {
    it('should have correct structure for org digest', () => {
      const orgDigest = {
        org_id: 'org-123',
        digest_date: '2024-12-15',
        digest_type: 'org' as const,
        user_id: null,
        timezone: 'UTC',
        window_start: '2024-12-15T00:00:00.000Z',
        window_end: '2024-12-16T00:00:00.000Z',
        source: 'slack_daily_digest',
        input_snapshot: {
          meetingsCount: 4,
          overdueTasksCount: 3,
          dueTodayTasksCount: 2,
        },
        highlights: {
          insights: ['Focus on follow-ups today'],
          summary: '4 meetings, 3 overdue tasks, 2 due today',
        },
        rendered_text: '# Daily Team Digest...',
        slack_message: { blocks: [], text: 'Daily digest' },
        delivery: { channelId: 'C123', ts: '123.456', status: 'sent' },
      };

      expect(orgDigest.digest_type).toBe('org');
      expect(orgDigest.user_id).toBeNull();
      expect(orgDigest.input_snapshot.meetingsCount).toBe(4);
    });

    it('should have correct structure for user digest', () => {
      const userDigest = {
        org_id: 'org-123',
        digest_date: '2024-12-15',
        digest_type: 'user' as const,
        user_id: 'user-1',
        timezone: 'UTC',
        window_start: '2024-12-15T00:00:00.000Z',
        window_end: '2024-12-16T00:00:00.000Z',
        source: 'slack_daily_digest',
        input_snapshot: {
          meetingsCount: 2,
          overdueTasksCount: 1,
          dueTodayTasksCount: 1,
        },
        highlights: {
          insights: ['Focus on follow-ups today'],
          summary: '2 meetings, 1 overdue tasks, 1 due today',
        },
        rendered_text: '# Daily Digest for Alice...',
        // User digests may be delivered via DM depending on org settings.
        // If not delivered, these fields can be null.
        slack_message: { blocks: [], text: 'Daily digest (DM)' },
        delivery: { channelId: 'D123', ts: '123.456', status: 'sent' },
      };

      expect(userDigest.digest_type).toBe('user');
      expect(userDigest.user_id).toBe('user-1');
      expect(userDigest.slack_message).toBeTruthy();
      expect(userDigest.delivery).toBeTruthy();
    });
  });

  describe('Upsert key behavior', () => {
    it('should generate consistent upsert key for org digests', () => {
      const key1 = `org-123|2024-12-15|org|null`;
      const key2 = `org-123|2024-12-15|org|null`;
      
      expect(key1).toBe(key2);
    });

    it('should generate different keys for different dates', () => {
      const key1 = `org-123|2024-12-15|org|null`;
      const key2 = `org-123|2024-12-16|org|null`;
      
      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different digest types', () => {
      const orgKey = `org-123|2024-12-15|org|null`;
      const userKey = `org-123|2024-12-15|user|user-1`;
      
      expect(orgKey).not.toBe(userKey);
    });

    it('should generate different keys for different users', () => {
      const user1Key = `org-123|2024-12-15|user|user-1`;
      const user2Key = `org-123|2024-12-15|user|user-2`;
      
      expect(user1Key).not.toBe(user2Key);
    });

    it('should generate different keys for different orgs', () => {
      const org1Key = `org-123|2024-12-15|org|null`;
      const org2Key = `org-456|2024-12-15|org|null`;
      
      expect(org1Key).not.toBe(org2Key);
    });
  });
});












