/**
 * Calendar AI Service
 * Smart calendar scheduling and optimization with AI-powered features
 */

export interface TimeSlot {
  start: Date;
  end: Date;
  available: boolean;
  bufferBefore?: number; // minutes
  bufferAfter?: number; // minutes
}

export interface MeetingPreferences {
  preferredTimes?: {
    start: string; // HH:mm format
    end: string;
  };
  preferredDays?: number[]; // 0-6, Sunday-Saturday
  minimumDuration?: number; // minutes
  maximumDuration?: number;
  bufferTime?: number; // minutes between meetings
  preferredMeetingTypes?: string[];
  avoidBackToBack?: boolean;
  lunchBreak?: {
    start: string;
    end: string;
  };
}

export interface OptimalMeetingTime {
  start: Date;
  end: Date;
  score: number;
  factors: string[];
  alternativeSlots?: Array<{
    start: Date;
    end: Date;
    score: number;
  }>;
  conflictResolution?: ConflictResolution;
}

export interface ConflictResolution {
  hasConflicts: boolean;
  conflicts: Array<{
    id: string;
    title: string;
    start: Date;
    end: Date;
    canReschedule: boolean;
    priority: number;
  }>;
  resolutionSuggestions: Array<{
    action: 'reschedule' | 'shorten' | 'cancel' | 'overlap';
    eventId: string;
    newTime?: { start: Date; end: Date };
    reason: string;
  }>;
}

export interface SmartSchedulingSuggestion {
  id: string;
  type: 'optimal_time' | 'reschedule' | 'buffer_adjustment' | 'conflict_resolution';
  title: string;
  description: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high';
  action: {
    type: string;
    data: any;
  };
}

export interface ParsedEvent {
  title: string;
  description?: string;
  start?: Date;
  end?: Date;
  duration?: number; // minutes
  attendees?: string[];
  location?: string;
  recurrence?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    interval?: number;
    until?: Date;
  };
  priority: number;
  confidence: number;
}

export interface CalendarAnalytics {
  meetingStats: {
    totalMeetings: number;
    averageDuration: number;
    meetingDensity: number; // meetings per day
    longestStreak: number; // consecutive days with meetings
  };
  timeAllocation: {
    focusTime: number; // minutes per day
    meetingTime: number;
    bufferTime: number;
    freeTime: number;
  };
  patterns: {
    busiestHours: number[];
    busiestDays: number[];
    meetingTypes: Record<string, number>;
    averageGapBetweenMeetings: number;
  };
  efficiency: {
    backToBackPercentage: number;
    bufferTimeUtilization: number;
    optimalTimeUsage: number;
    overlapCount: number;
  };
}

class CalendarAIService {
  private readonly defaultPreferences: MeetingPreferences = {
    preferredTimes: { start: '09:00', end: '17:00' },
    preferredDays: [1, 2, 3, 4, 5], // Monday to Friday
    minimumDuration: 15,
    maximumDuration: 120,
    bufferTime: 15,
    avoidBackToBack: true,
    lunchBreak: { start: '12:00', end: '13:00' },
  };

  private readonly timeExpressions = [
    // Relative times
    /\b(?:tomorrow|today|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/gi,
    /\b(?:this|next)\s+(?:week|month)\b/gi,
    /\bin\s+(\d+)\s+(?:hours?|days?|weeks?|months?)\b/gi,
    
    // Specific dates
    /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?\b/gi,
    /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g,
    /\b\d{4}-\d{2}-\d{2}\b/g,
    
    // Times
    /\b\d{1,2}:\d{2}\s*(?:am|pm)?\b/gi,
    /\b(?:morning|afternoon|evening|night)\b/gi,
    
    // Durations
    /\b(\d+)\s*(?:hours?|hrs?|minutes?|mins?)\b/gi,
  ];

  /**
   * Find optimal meeting times based on availability and preferences
   */
  async findOptimalMeetingTimes(
    duration: number, // minutes
    attendees: string[],
    dateRange: { start: Date; end: Date },
    preferences?: Partial<MeetingPreferences>,
    existingEvents?: Array<{ start: Date; end: Date; attendees: string[] }>
  ): Promise<OptimalMeetingTime[]> {
    const mergedPreferences = { ...this.defaultPreferences, ...preferences };
    const suggestions: OptimalMeetingTime[] = [];

    // Generate time slots within the date range
    const timeSlots = this.generateTimeSlots(dateRange, duration, mergedPreferences);
    
    // Score each time slot
    for (const slot of timeSlots) {
      const score = await this.scoreTimeSlot(
        slot,
        duration,
        attendees,
        mergedPreferences,
        existingEvents || []
      );

      if (score.score > 0.3) { // Only include reasonably good options
        suggestions.push({
          start: slot.start,
          end: slot.end,
          score: score.score,
          factors: score.factors,
          conflictResolution: await this.analyzeConflicts(slot, existingEvents || []),
        });
      }
    }

    // Sort by score and return top suggestions
    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, 10) // Return top 10 suggestions
      .map(suggestion => ({
        ...suggestion,
        alternativeSlots: this.generateAlternativeSlots(suggestion, timeSlots, 3),
      }));
  }

  /**
   * Resolve calendar conflicts intelligently
   */
  async resolveConflicts(
    proposedEvent: { start: Date; end: Date; priority: number },
    existingEvents: Array<{
      id: string;
      start: Date;
      end: Date;
      priority: number;
      canReschedule: boolean;
      title: string;
    }>
  ): Promise<ConflictResolution> {
    const conflicts = existingEvents.filter(event =>
      this.eventsOverlap(proposedEvent, event)
    );

    const resolutionSuggestions = [];

    for (const conflict of conflicts) {
      if (conflict.priority < proposedEvent.priority && conflict.canReschedule) {
        // Suggest rescheduling lower priority event
        const newSlot = await this.findAlternativeSlot(conflict, existingEvents);
        if (newSlot) {
          resolutionSuggestions.push({
            action: 'reschedule' as const,
            eventId: conflict.id,
            newTime: newSlot,
            reason: `Lower priority event can be moved to maintain schedule efficiency`,
          });
        }
      } else if (conflict.priority > proposedEvent.priority) {
        // Suggest rescheduling the new event
        resolutionSuggestions.push({
          action: 'reschedule' as const,
          eventId: 'new-event',
          reason: `Existing event has higher priority`,
        });
      } else {
        // Suggest shortening if possible
        const canShorten = this.calculateOverlapDuration(proposedEvent, conflict) < 
                          this.calculateEventDuration(conflict) * 0.5;
        
        if (canShorten) {
          resolutionSuggestions.push({
            action: 'shorten' as const,
            eventId: conflict.id,
            reason: `Minimal overlap allows for shortened meeting`,
          });
        }
      }
    }

    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
      resolutionSuggestions,
    };
  }

  /**
   * Parse natural language into calendar events
   */
  async parseNaturalLanguageEvent(text: string): Promise<ParsedEvent> {
    const lowerText = text.toLowerCase();
    
    // Extract title (first meaningful phrase)
    let title = text.trim();
    const meetingIndicators = ['meeting with', 'call with', 'sync with', 'interview with'];
    const titleMatch = meetingIndicators.find(indicator => lowerText.includes(indicator));
    
    if (titleMatch) {
      const index = lowerText.indexOf(titleMatch);
      title = text.substring(index).split(/[.!?]/)[0];
    }

    // Extract dates and times
    const dateTimeInfo = await this.extractDateTimeFromText(text);
    
    // Extract duration
    const duration = this.extractDurationFromText(text) || 30; // Default 30 minutes

    // Extract attendees (email addresses or names)
    const attendees = this.extractAttendeesFromText(text);
    
    // Extract location
    const location = this.extractLocationFromText(text);
    
    // Determine priority based on keywords
    const priority = this.calculateEventPriority(text);
    
    // Calculate confidence based on how much information we extracted
    let confidence = 0.5;
    if (dateTimeInfo.start) confidence += 0.3;
    if (duration !== 30) confidence += 0.1;
    if (attendees.length > 0) confidence += 0.1;

    return {
      title: title || 'Untitled Event',
      description: text.length > title.length ? text.substring(title.length).trim() : undefined,
      start: dateTimeInfo.start,
      end: dateTimeInfo.end || (dateTimeInfo.start ? 
        new Date(dateTimeInfo.start.getTime() + duration * 60000) : undefined),
      duration,
      attendees,
      location,
      priority,
      confidence: Math.min(confidence, 1),
    };
  }

  /**
   * Generate smart scheduling suggestions
   */
  async generateSchedulingSuggestions(
    events: Array<{
      id: string;
      start: Date;
      end: Date;
      title: string;
      attendees: string[];
    }>,
    preferences?: Partial<MeetingPreferences>
  ): Promise<SmartSchedulingSuggestion[]> {
    const suggestions: SmartSchedulingSuggestion[] = [];
    const mergedPreferences = { ...this.defaultPreferences, ...preferences };

    // Analyze current schedule
    const analytics = await this.analyzeCalendar(events);

    // Suggest optimal times for new meetings
    if (analytics.timeAllocation.freeTime > 60) {
      suggestions.push({
        id: 'optimal-time-suggestion',
        type: 'optimal_time',
        title: 'Optimal Focus Time Available',
        description: `You have ${Math.floor(analytics.timeAllocation.freeTime / 60)} hours of free time. Consider blocking focus time blocks.`,
        confidence: 0.8,
        impact: 'medium',
        action: {
          type: 'block_focus_time',
          data: { duration: 90, preferredTimes: mergedPreferences.preferredTimes },
        },
      });
    }

    // Suggest reducing back-to-back meetings
    if (analytics.efficiency.backToBackPercentage > 60) {
      suggestions.push({
        id: 'reduce-back-to-back',
        type: 'buffer_adjustment',
        title: 'Too Many Back-to-Back Meetings',
        description: `${analytics.efficiency.backToBackPercentage.toFixed(1)}% of your meetings are back-to-back. Consider adding buffer time.`,
        confidence: 0.9,
        impact: 'high',
        action: {
          type: 'add_buffer_time',
          data: { bufferMinutes: mergedPreferences.bufferTime },
        },
      });
    }

    // Suggest rescheduling for better time blocks
    const fragmentedSlots = this.findFragmentedTimeSlots(events);
    if (fragmentedSlots.length > 2) {
      suggestions.push({
        id: 'consolidate-meetings',
        type: 'reschedule',
        title: 'Consolidate Meeting Blocks',
        description: `You have ${fragmentedSlots.length} fragmented time slots. Consolidating meetings could improve focus time.`,
        confidence: 0.7,
        impact: 'medium',
        action: {
          type: 'consolidate_meetings',
          data: { fragmentedSlots },
        },
      });
    }

    return suggestions;
  }

  /**
   * Analyze calendar patterns and efficiency
   */
  async analyzeCalendar(
    events: Array<{
      id: string;
      start: Date;
      end: Date;
      title: string;
      attendees?: string[];
    }>
  ): Promise<CalendarAnalytics> {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentEvents = events.filter(event => event.start >= oneWeekAgo);

    // Calculate meeting stats
    const totalDuration = recentEvents.reduce(
      (sum, event) => sum + this.calculateEventDuration(event),
      0
    );
    const averageDuration = recentEvents.length > 0 ? totalDuration / recentEvents.length : 0;

    // Calculate time allocation (per day average)
    const meetingTimePerDay = totalDuration / 7;
    const workingHoursPerDay = 8 * 60; // 8 hours in minutes
    const freeTimePerDay = Math.max(0, workingHoursPerDay - meetingTimePerDay);

    // Analyze patterns
    const hourCounts = new Array(24).fill(0);
    const dayCounts = new Array(7).fill(0);
    const meetingTypes: Record<string, number> = {};

    recentEvents.forEach(event => {
      const hour = event.start.getHours();
      const day = event.start.getDay();
      
      hourCounts[hour]++;
      dayCounts[day]++;

      // Categorize meeting types
      const title = event.title.toLowerCase();
      const type = this.categorizeMeetingType(title);
      meetingTypes[type] = (meetingTypes[type] || 0) + 1;
    });

    // Find busiest hours and days
    const busiestHours = hourCounts
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(item => item.hour);

    const busiestDays = dayCounts
      .map((count, day) => ({ day, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(item => item.day);

    // Calculate efficiency metrics
    const backToBackCount = this.countBackToBackMeetings(recentEvents);
    const backToBackPercentage = recentEvents.length > 1 
      ? (backToBackCount / (recentEvents.length - 1)) * 100 
      : 0;

    const overlapCount = this.countOverlappingMeetings(recentEvents);

    return {
      meetingStats: {
        totalMeetings: recentEvents.length,
        averageDuration,
        meetingDensity: recentEvents.length / 7,
        longestStreak: this.calculateLongestMeetingStreak(recentEvents),
      },
      timeAllocation: {
        focusTime: Math.max(0, freeTimePerDay - 60), // Assume 1 hour for breaks
        meetingTime: meetingTimePerDay,
        bufferTime: 0, // Would need to calculate from actual buffer time
        freeTime: freeTimePerDay,
      },
      patterns: {
        busiestHours,
        busiestDays,
        meetingTypes,
        averageGapBetweenMeetings: this.calculateAverageGapBetweenMeetings(recentEvents),
      },
      efficiency: {
        backToBackPercentage,
        bufferTimeUtilization: 0, // Would need buffer time data
        optimalTimeUsage: Math.max(0, 100 - backToBackPercentage),
        overlapCount,
      },
    };
  }

  // Private helper methods

  private generateTimeSlots(
    dateRange: { start: Date; end: Date },
    duration: number,
    preferences: MeetingPreferences
  ): TimeSlot[] {
    const slots: TimeSlot[] = [];
    const current = new Date(dateRange.start);
    
    while (current <= dateRange.end) {
      const dayOfWeek = current.getDay();
      
      // Check if this day is preferred
      if (preferences.preferredDays?.includes(dayOfWeek)) {
        const [startHour, startMinute] = (preferences.preferredTimes?.start || '09:00').split(':').map(Number);
        const [endHour, endMinute] = (preferences.preferredTimes?.end || '17:00').split(':').map(Number);
        
        const dayStart = new Date(current);
        dayStart.setHours(startHour, startMinute, 0, 0);
        
        const dayEnd = new Date(current);
        dayEnd.setHours(endHour, endMinute, 0, 0);
        
        const slotStart = new Date(dayStart);
        
        while (slotStart.getTime() + duration * 60000 <= dayEnd.getTime()) {
          const slotEnd = new Date(slotStart.getTime() + duration * 60000);
          
          slots.push({
            start: new Date(slotStart),
            end: new Date(slotEnd),
            available: true,
            bufferBefore: preferences.bufferTime,
            bufferAfter: preferences.bufferTime,
          });
          
          slotStart.setMinutes(slotStart.getMinutes() + 15); // 15-minute intervals
        }
      }
      
      current.setDate(current.getDate() + 1);
    }
    
    return slots;
  }

  private async scoreTimeSlot(
    slot: TimeSlot,
    duration: number,
    attendees: string[],
    preferences: MeetingPreferences,
    existingEvents: Array<{ start: Date; end: Date; attendees: string[] }>
  ): Promise<{ score: number; factors: string[] }> {
    let score = 1.0;
    const factors: string[] = [];

    // Check for conflicts
    const hasConflict = existingEvents.some(event =>
      this.eventsOverlap(slot, event)
    );
    
    if (hasConflict) {
      score *= 0.1;
      factors.push('Conflicts with existing event');
    }

    // Preferred time bonus
    const hour = slot.start.getHours();
    const [prefStartHour] = (preferences.preferredTimes?.start || '09:00').split(':').map(Number);
    const [prefEndHour] = (preferences.preferredTimes?.end || '17:00').split(':').map(Number);
    
    if (hour >= prefStartHour && hour < prefEndHour) {
      score *= 1.2;
      factors.push('Within preferred hours');
    }

    // Lunch break avoidance
    if (preferences.lunchBreak) {
      const [lunchStart] = preferences.lunchBreak.start.split(':').map(Number);
      const [lunchEnd] = preferences.lunchBreak.end.split(':').map(Number);
      
      if (hour >= lunchStart && hour < lunchEnd) {
        score *= 0.3;
        factors.push('Overlaps with lunch break');
      }
    }

    // Buffer time consideration
    if (preferences.avoidBackToBack) {
      const hasBufferBefore = this.hasBufferTime(slot, existingEvents, true, preferences.bufferTime || 15);
      const hasBufferAfter = this.hasBufferTime(slot, existingEvents, false, preferences.bufferTime || 15);
      
      if (hasBufferBefore && hasBufferAfter) {
        score *= 1.3;
        factors.push('Has adequate buffer time');
      } else if (!hasBufferBefore || !hasBufferAfter) {
        score *= 0.7;
        factors.push('Limited buffer time');
      }
    }

    // Day of week preference
    const dayOfWeek = slot.start.getDay();
    if (preferences.preferredDays?.includes(dayOfWeek)) {
      score *= 1.1;
      factors.push('Preferred day of week');
    }

    return { score: Math.max(0, Math.min(1, score)), factors };
  }

  private eventsOverlap(
    event1: { start: Date; end: Date },
    event2: { start: Date; end: Date }
  ): boolean {
    return event1.start < event2.end && event1.end > event2.start;
  }

  private calculateEventDuration(event: { start: Date; end: Date }): number {
    return Math.floor((event.end.getTime() - event.start.getTime()) / (1000 * 60));
  }

  private calculateOverlapDuration(
    event1: { start: Date; end: Date },
    event2: { start: Date; end: Date }
  ): number {
    if (!this.eventsOverlap(event1, event2)) return 0;
    
    const overlapStart = new Date(Math.max(event1.start.getTime(), event2.start.getTime()));
    const overlapEnd = new Date(Math.min(event1.end.getTime(), event2.end.getTime()));
    
    return Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60));
  }

  private hasBufferTime(
    slot: TimeSlot,
    existingEvents: Array<{ start: Date; end: Date }>,
    checkBefore: boolean,
    bufferMinutes: number
  ): boolean {
    const checkTime = checkBefore 
      ? new Date(slot.start.getTime() - bufferMinutes * 60000)
      : new Date(slot.end.getTime() + bufferMinutes * 60000);
    
    const bufferSlot = checkBefore
      ? { start: checkTime, end: slot.start }
      : { start: slot.end, end: checkTime };
    
    return !existingEvents.some(event => this.eventsOverlap(bufferSlot, event));
  }

  private async findAlternativeSlot(
    event: { start: Date; end: Date },
    existingEvents: Array<{ start: Date; end: Date }>
  ): Promise<{ start: Date; end: Date } | null> {
    const duration = this.calculateEventDuration(event);
    const searchStart = new Date(event.start.getTime() - 24 * 60 * 60 * 1000); // 1 day before
    const searchEnd = new Date(event.end.getTime() + 7 * 24 * 60 * 60 * 1000); // 1 week after
    
    const slots = this.generateTimeSlots(
      { start: searchStart, end: searchEnd },
      duration,
      this.defaultPreferences
    );

    for (const slot of slots) {
      const hasConflict = existingEvents
        .filter(e => e.start !== event.start || e.end !== event.end) // Exclude the event being moved
        .some(e => this.eventsOverlap(slot, e));
      
      if (!hasConflict) {
        return { start: slot.start, end: slot.end };
      }
    }

    return null;
  }

  private generateAlternativeSlots(
    primarySlot: OptimalMeetingTime,
    allSlots: TimeSlot[],
    count: number
  ): OptimalMeetingTime['alternativeSlots'] {
    return allSlots
      .filter(slot => 
        slot.start.getTime() !== primarySlot.start.getTime() &&
        slot.available
      )
      .slice(0, count)
      .map(slot => ({
        start: slot.start,
        end: slot.end,
        score: Math.random() * 0.8 + 0.2, // Mock score
      }));
  }

  private async analyzeConflicts(
    slot: TimeSlot,
    existingEvents: Array<{ start: Date; end: Date }>
  ): Promise<ConflictResolution | undefined> {
    const conflicts = existingEvents
      .filter(event => this.eventsOverlap(slot, event))
      .map(event => ({
        id: `event-${event.start.getTime()}`,
        title: 'Existing Event',
        start: event.start,
        end: event.end,
        canReschedule: true,
        priority: 3,
      }));

    if (conflicts.length === 0) return undefined;

    return {
      hasConflicts: true,
      conflicts,
      resolutionSuggestions: [],
    };
  }

  private async extractDateTimeFromText(text: string): Promise<{ start?: Date; end?: Date }> {
    const now = new Date();
    let start: Date | undefined;
    let end: Date | undefined;

    // Simple date/time extraction
    if (text.toLowerCase().includes('tomorrow')) {
      start = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    } else if (text.toLowerCase().includes('today')) {
      start = new Date(now);
    }

    // Extract time if available
    const timeMatch = text.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/i);
    if (timeMatch && start) {
      let hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      const period = timeMatch[3]?.toLowerCase();

      if (period === 'pm' && hours < 12) hours += 12;
      if (period === 'am' && hours === 12) hours = 0;

      start.setHours(hours, minutes, 0, 0);
    }

    return { start, end };
  }

  private extractDurationFromText(text: string): number | undefined {
    const durationMatch = text.match(/(\d+)\s*(hours?|hrs?|minutes?|mins?)/i);
    if (durationMatch) {
      const value = parseInt(durationMatch[1]);
      const unit = durationMatch[2].toLowerCase();
      
      if (unit.startsWith('hour') || unit.startsWith('hr')) {
        return value * 60;
      } else {
        return value;
      }
    }
    
    return undefined;
  }

  private extractAttendeesFromText(text: string): string[] {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    return text.match(emailRegex) || [];
  }

  private extractLocationFromText(text: string): string | undefined {
    const locationKeywords = ['room', 'office', 'zoom', 'teams', 'meet', 'location', 'at'];
    
    for (const keyword of locationKeywords) {
      const regex = new RegExp(`${keyword}\\s+([\\w\\s-]+)`, 'i');
      const match = text.match(regex);
      if (match) {
        return match[1].trim();
      }
    }
    
    return undefined;
  }

  private calculateEventPriority(text: string): number {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('urgent') || lowerText.includes('asap')) return 5;
    if (lowerText.includes('important') || lowerText.includes('priority')) return 4;
    if (lowerText.includes('meeting') || lowerText.includes('call')) return 3;
    
    return 2; // Default medium priority
  }

  private categorizeMeetingType(title: string): string {
    if (title.includes('standup') || title.includes('daily')) return 'standup';
    if (title.includes('1:1') || title.includes('one-on-one')) return 'one-on-one';
    if (title.includes('interview')) return 'interview';
    if (title.includes('review')) return 'review';
    if (title.includes('planning')) return 'planning';
    
    return 'general';
  }

  private countBackToBackMeetings(events: Array<{ start: Date; end: Date }>): number {
    let count = 0;
    const sortedEvents = events.sort((a, b) => a.start.getTime() - b.start.getTime());
    
    for (let i = 1; i < sortedEvents.length; i++) {
      const prevEnd = sortedEvents[i - 1].end;
      const currentStart = sortedEvents[i].start;
      
      if (currentStart.getTime() - prevEnd.getTime() <= 5 * 60 * 1000) { // 5 minutes or less
        count++;
      }
    }
    
    return count;
  }

  private countOverlappingMeetings(events: Array<{ start: Date; end: Date }>): number {
    let count = 0;
    
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        if (this.eventsOverlap(events[i], events[j])) {
          count++;
        }
      }
    }
    
    return count;
  }

  private calculateLongestMeetingStreak(events: Array<{ start: Date; end: Date }>): number {
    const dates = [...new Set(events.map(event => 
      event.start.toISOString().split('T')[0]
    ))].sort();
    
    let maxStreak = 0;
    let currentStreak = 1;
    
    for (let i = 1; i < dates.length; i++) {
      const prevDate = new Date(dates[i - 1]);
      const currentDate = new Date(dates[i]);
      const dayDiff = Math.floor(
        (currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      if (dayDiff === 1) {
        currentStreak++;
      } else {
        maxStreak = Math.max(maxStreak, currentStreak);
        currentStreak = 1;
      }
    }
    
    return Math.max(maxStreak, currentStreak);
  }

  private calculateAverageGapBetweenMeetings(events: Array<{ start: Date; end: Date }>): number {
    if (events.length < 2) return 0;
    
    const sortedEvents = events.sort((a, b) => a.start.getTime() - b.start.getTime());
    const gaps: number[] = [];
    
    for (let i = 1; i < sortedEvents.length; i++) {
      const gap = sortedEvents[i].start.getTime() - sortedEvents[i - 1].end.getTime();
      gaps.push(gap / (1000 * 60)); // Convert to minutes
    }
    
    return gaps.length > 0 ? gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length : 0;
  }

  private findFragmentedTimeSlots(events: Array<{ start: Date; end: Date }>): Array<{ start: Date; end: Date; duration: number }> {
    const sortedEvents = events.sort((a, b) => a.start.getTime() - b.start.getTime());
    const fragments: Array<{ start: Date; end: Date; duration: number }> = [];
    
    for (let i = 1; i < sortedEvents.length; i++) {
      const prevEnd = sortedEvents[i - 1].end;
      const currentStart = sortedEvents[i].start;
      const duration = (currentStart.getTime() - prevEnd.getTime()) / (1000 * 60);
      
      if (duration > 15 && duration < 120) { // Fragments between 15 minutes and 2 hours
        fragments.push({
          start: prevEnd,
          end: currentStart,
          duration,
        });
      }
    }
    
    return fragments;
  }
}

export const calendarAIService = new CalendarAIService();