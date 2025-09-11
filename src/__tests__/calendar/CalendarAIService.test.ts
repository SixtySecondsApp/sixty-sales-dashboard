import { describe, it, expect, beforeEach } from 'vitest';
import {
  findOptimalMeetingTime,
  resolveCalendarConflicts,
  parseNaturalLanguageEvent,
  generateFollowUpSchedule,
  optimizeCalendarSchedule,
  suggestBufferTime,
  analyzeMeetingPatterns,
  getCalendarAnalytics,
  findAvailableSlots,
  suggestMeetingDuration
} from '@/lib/services/calendarAIService';

describe('CalendarAIService', () => {
  const sampleEvents = [
    {
      id: '1',
      title: 'Team Standup',
      start: new Date('2024-01-15T09:00:00'),
      end: new Date('2024-01-15T09:30:00'),
      type: 'meeting'
    },
    {
      id: '2',
      title: 'Client Call',
      start: new Date('2024-01-15T10:00:00'),
      end: new Date('2024-01-15T11:00:00'),
      type: 'call'
    },
    {
      id: '3',
      title: 'Lunch Break',
      start: new Date('2024-01-15T12:00:00'),
      end: new Date('2024-01-15T13:00:00'),
      type: 'break'
    }
  ];

  describe('findOptimalMeetingTime', () => {
    it('should find optimal meeting time avoiding conflicts', () => {
      const result = findOptimalMeetingTime({
        duration: 60,
        participants: ['user1@example.com', 'user2@example.com'],
        preferences: {
          preferredTimes: ['morning'],
          avoidBackToBack: true
        },
        existingEvents: sampleEvents,
        dateRange: {
          start: new Date('2024-01-15T08:00:00'),
          end: new Date('2024-01-15T18:00:00')
        }
      });

      expect(result.suggestions).toHaveLength(3);
      expect(result.suggestions[0].score).toBeGreaterThan(0.5);
      expect(result.suggestions[0].conflicts).toHaveLength(0);
    });

    it('should respect working hours preferences', () => {
      const result = findOptimalMeetingTime({
        duration: 30,
        participants: ['user@example.com'],
        preferences: {
          workingHours: {
            start: '09:00',
            end: '17:00'
          }
        },
        existingEvents: [],
        dateRange: {
          start: new Date('2024-01-15T00:00:00'),
          end: new Date('2024-01-15T23:59:59')
        }
      });

      result.suggestions.forEach(slot => {
        const hour = slot.start.getHours();
        expect(hour).toBeGreaterThanOrEqual(9);
        expect(hour).toBeLessThan(17);
      });
    });

    it('should avoid back-to-back meetings when requested', () => {
      const result = findOptimalMeetingTime({
        duration: 30,
        participants: ['user@example.com'],
        preferences: {
          avoidBackToBack: true,
          bufferTime: 15
        },
        existingEvents: sampleEvents,
        dateRange: {
          start: new Date('2024-01-15T08:00:00'),
          end: new Date('2024-01-15T18:00:00')
        }
      });

      result.suggestions.forEach(slot => {
        expect(slot.reasoning).toContain('buffer');
      });
    });
  });

  describe('resolveCalendarConflicts', () => {
    it('should detect and resolve simple conflicts', () => {
      const conflicts = [
        {
          event1: sampleEvents[0],
          event2: {
            id: '4',
            title: 'Overlapping Meeting',
            start: new Date('2024-01-15T09:15:00'),
            end: new Date('2024-01-15T09:45:00'),
            type: 'meeting'
          }
        }
      ];

      const result = resolveCalendarConflicts(conflicts);

      expect(result).toHaveLength(1);
      expect(result[0].solutions).toHaveLength(3);
      expect(result[0].solutions[0].type).toBe('reschedule');
    });

    it('should prioritize important meetings', () => {
      const conflicts = [
        {
          event1: { ...sampleEvents[0], priority: 'high' },
          event2: { ...sampleEvents[1], priority: 'low' }
        }
      ];

      const result = resolveCalendarConflicts(conflicts);
      const rescheduleOption = result[0].solutions.find(s => s.type === 'reschedule');
      
      expect(rescheduleOption?.targetEvent).toBe('2'); // Should reschedule the low priority event
    });
  });

  describe('parseNaturalLanguageEvent', () => {
    it('should parse simple meeting requests', () => {
      const result = parseNaturalLanguageEvent('Meeting with John tomorrow at 2pm');

      expect(result.title).toBe('Meeting with John');
      expect(result.parsedDate).toBeTruthy();
      expect(result.time).toBe('14:00');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should parse location information', () => {
      const result = parseNaturalLanguageEvent('Lunch at Starbucks on Friday at noon');

      expect(result.title).toContain('Lunch');
      expect(result.location).toBe('Starbucks');
      expect(result.time).toBe('12:00');
    });

    it('should parse duration information', () => {
      const result = parseNaturalLanguageEvent('Call with client for 30 minutes at 3pm');

      expect(result.duration).toBe(30);
      expect(result.time).toBe('15:00');
      expect(result.type).toBe('call');
    });

    it('should handle recurring events', () => {
      const result = parseNaturalLanguageEvent('Weekly team standup every Monday at 9am');

      expect(result.recurrence).toBe('weekly');
      expect(result.dayOfWeek).toBe('monday');
      expect(result.time).toBe('09:00');
    });
  });

  describe('generateFollowUpSchedule', () => {
    it('should generate follow-up schedule for meetings', () => {
      const meeting = {
        title: 'Sales Demo',
        date: new Date('2024-01-15T14:00:00'),
        type: 'demo',
        attendees: ['prospect@company.com']
      };

      const schedule = generateFollowUpSchedule(meeting);

      expect(schedule.tasks).toHaveLength(3);
      expect(schedule.tasks[0].type).toBe('email');
      expect(schedule.tasks[0].daysAfter).toBe(1);
      expect(schedule.tasks[1].type).toBe('call');
      expect(schedule.tasks[2].type).toBe('email');
    });

    it('should customize follow-ups based on meeting type', () => {
      const interview = {
        title: 'Job Interview',
        date: new Date('2024-01-15T10:00:00'),
        type: 'interview',
        attendees: ['candidate@email.com']
      };

      const schedule = generateFollowUpSchedule(interview);

      expect(schedule.tasks.some(t => t.description.includes('thank you'))).toBe(true);
      expect(schedule.tasks.some(t => t.description.includes('decision'))).toBe(true);
    });
  });

  describe('optimizeCalendarSchedule', () => {
    it('should suggest optimizations for calendar', () => {
      const suggestions = optimizeCalendarSchedule(sampleEvents, {
        preferFocusTime: true,
        minimizeMeetings: true
      });

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.type === 'consolidate' || s.type === 'batch')).toBe(true);
    });

    it('should identify meeting-heavy days', () => {
      const busyDay = [
        ...sampleEvents,
        {
          id: '4',
          title: 'Meeting 4',
          start: new Date('2024-01-15T14:00:00'),
          end: new Date('2024-01-15T15:00:00'),
          type: 'meeting'
        },
        {
          id: '5',
          title: 'Meeting 5',
          start: new Date('2024-01-15T15:00:00'),
          end: new Date('2024-01-15T16:00:00'),
          type: 'meeting'
        }
      ];

      const suggestions = optimizeCalendarSchedule(busyDay);
      
      expect(suggestions.some(s => s.reason.includes('meeting-heavy'))).toBe(true);
    });
  });

  describe('suggestBufferTime', () => {
    it('should suggest appropriate buffer time', () => {
      const event = {
        type: 'presentation',
        duration: 60,
        importance: 'high'
      };

      const buffer = suggestBufferTime(event);

      expect(buffer.before).toBeGreaterThanOrEqual(15);
      expect(buffer.after).toBeGreaterThanOrEqual(10);
      expect(buffer.reasoning).toContain('preparation');
    });

    it('should suggest minimal buffer for back-to-back internal meetings', () => {
      const event = {
        type: 'standup',
        duration: 15,
        importance: 'low'
      };

      const buffer = suggestBufferTime(event);

      expect(buffer.before).toBeLessThanOrEqual(5);
      expect(buffer.after).toBeLessThanOrEqual(5);
    });
  });

  describe('analyzeMeetingPatterns', () => {
    it('should identify meeting patterns', () => {
      const patterns = analyzeMeetingPatterns(sampleEvents);

      expect(patterns.averageDuration).toBe(40); // (30 + 60 + 60) / 3 for meetings
      expect(patterns.mostCommonTypes).toContain('meeting');
      expect(patterns.peakHours).toBeTruthy();
    });

    it('should calculate meeting density', () => {
      const patterns = analyzeMeetingPatterns(sampleEvents);

      expect(patterns.density).toBeGreaterThan(0);
      expect(patterns.density).toBeLessThanOrEqual(1);
    });
  });

  describe('getCalendarAnalytics', () => {
    it('should provide comprehensive analytics', () => {
      const analytics = getCalendarAnalytics(sampleEvents, {
        start: new Date('2024-01-15T00:00:00'),
        end: new Date('2024-01-15T23:59:59')
      });

      expect(analytics.totalMeetings).toBe(2); // Excluding lunch break
      expect(analytics.totalHours).toBeGreaterThan(0);
      expect(analytics.focusTime).toBeDefined();
      expect(analytics.utilizationRate).toBeLessThanOrEqual(1);
    });

    it('should calculate meeting efficiency metrics', () => {
      const analytics = getCalendarAnalytics(sampleEvents);

      expect(analytics.efficiency).toHaveProperty('backToBackPercentage');
      expect(analytics.efficiency).toHaveProperty('averageGapTime');
      expect(analytics.efficiency).toHaveProperty('fragmentedTime');
    });
  });

  describe('findAvailableSlots', () => {
    it('should find available time slots', () => {
      const slots = findAvailableSlots(sampleEvents, {
        start: new Date('2024-01-15T08:00:00'),
        end: new Date('2024-01-15T18:00:00'),
        minDuration: 30
      });

      expect(slots.length).toBeGreaterThan(0);
      expect(slots[0].duration).toBeGreaterThanOrEqual(30);
      expect(slots[0].start.getTime()).toBeGreaterThanOrEqual(new Date('2024-01-15T08:00:00').getTime());
    });

    it('should exclude lunch hours when requested', () => {
      const slots = findAvailableSlots(sampleEvents, {
        start: new Date('2024-01-15T08:00:00'),
        end: new Date('2024-01-15T18:00:00'),
        minDuration: 30,
        excludeLunch: true
      });

      slots.forEach(slot => {
        const startHour = slot.start.getHours();
        const endHour = slot.end.getHours();
        expect(!(startHour === 12 || endHour === 13)).toBe(true);
      });
    });
  });

  describe('suggestMeetingDuration', () => {
    it('should suggest appropriate duration based on type', () => {
      expect(suggestMeetingDuration('standup')).toBe(15);
      expect(suggestMeetingDuration('one-on-one')).toBe(30);
      expect(suggestMeetingDuration('presentation')).toBe(60);
      expect(suggestMeetingDuration('workshop')).toBeGreaterThanOrEqual(120);
    });

    it('should handle unknown meeting types', () => {
      expect(suggestMeetingDuration('unknown')).toBe(30); // Default duration
    });
  });
});