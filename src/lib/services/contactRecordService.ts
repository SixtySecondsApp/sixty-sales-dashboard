/**
 * Contact Record Service
 * Fetches enhanced contact data including AI insights, meeting summaries, and health metrics
 */

import { getSupabaseHeaders } from '@/lib/utils/apiUtils';
import { API_BASE_URL } from '@/lib/config';
import { supabase } from '@/lib/supabase/clientV2';
import logger from '@/lib/utils/logger';
import type {
  ContactRecordData,
  DealHealth,
  ContactStats,
  MeetingSummary,
  ActionItem,
  Activity,
  AIInsight
} from '@/components/copilot/types';

export class ContactRecordService {
  /**
   * Get enhanced contact record data with all related information
   */
  static async getContactRecord(contactId: string): Promise<ContactRecordData | null> {
    try {
      const headers = await getSupabaseHeaders();

      // Fetch contact with company
      const { data: contact, error: contactError } = await supabase
        .from('contacts')
        .select(`
          *,
          companies:company_id (
            id,
            name,
            website,
            industry
          )
        `)
        .eq('id', contactId)
        .single();

      if (contactError || !contact) {
        logger.error('Error fetching contact:', contactError);
        return null;
      }

      // Fetch related data in parallel
      const [
        dealsResult,
        activitiesResult,
        meetingsResult,
        actionItemsResult,
        aiInsightsResult
      ] = await Promise.allSettled([
        // Deals for this contact
        supabase
          .from('deals')
          .select('*')
          .or(`primary_contact_id.eq.${contactId},contact_email.eq.${contact.email}`)
          .order('created_at', { ascending: false })
          .limit(10),

        // Recent activities
        supabase
          .from('activities')
          .select('*')
          .eq('contact_id', contactId)
          .order('date', { ascending: false })
          .limit(5),

        // Recent meetings
        supabase
          .from('meetings')
          .select('*')
          .eq('contact_id', contactId)
          .order('date', { ascending: false })
          .limit(1),

        // Action items
        supabase
          .from('action_items')
          .select('*')
          .eq('contact_id', contactId)
          .order('created_at', { ascending: false }),

        // AI insights
        supabase
          .from('ai_insights')
          .select('*')
          .eq('contact_id', contactId)
          .order('created_at', { ascending: false })
          .limit(3)
      ]);

      const deals = dealsResult.status === 'fulfilled' ? dealsResult.value.data || [] : [];
      const activities = activitiesResult.status === 'fulfilled' ? activitiesResult.value.data || [] : [];
      const meetings = meetingsResult.status === 'fulfilled' ? meetingsResult.value.data || [] : [];
      const actionItems = actionItemsResult.status === 'fulfilled' ? actionItemsResult.value.data || [] : [];
      const aiInsights = aiInsightsResult.status === 'fulfilled' ? aiInsightsResult.value.data || [] : [];

      // Calculate deal health
      const dealHealth = this.calculateDealHealth(deals, activities);

      // Calculate stats
      const stats = this.calculateStats(deals, activities, meetings);

      // Get last meeting summary
      const lastMeeting = meetings.length > 0
        ? this.formatMeetingSummary(meetings[0], actionItems.filter(ai => ai.meeting_id === meetings[0].id))
        : undefined;

      // Format activities
      const recentActivity = this.formatActivities(activities);

      // Format AI insights
      const formattedInsights = this.formatAIInsights(aiInsights);

      // Format action items
      const formattedActionItems = this.formatActionItems(actionItems);

      return {
        id: contact.id,
        firstName: contact.first_name || '',
        lastName: contact.last_name || '',
        fullName: contact.full_name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim(),
        email: contact.email,
        phone: contact.phone || undefined,
        title: contact.title || undefined,
        company: (contact.companies as any)?.name || undefined,
        companyId: contact.company_id || undefined,
        location: undefined, // Not in current schema
        avatar: undefined, // Not in current schema
        tags: [], // Could be derived from other data
        status: 'active' as const,
        dealHealth,
        stats,
        lastMeeting,
        recentActivity,
        aiInsights: formattedInsights,
        actionItems: formattedActionItems
      };
    } catch (error) {
      logger.error('Error fetching contact record:', error);
      throw error;
    }
  }

  /**
   * Calculate deal health score and metrics
   */
  private static calculateDealHealth(
    deals: any[],
    activities: any[]
  ): DealHealth {
    if (deals.length === 0) {
      return {
        score: 50,
        metrics: {
          engagement: { value: 50, label: 'Neutral' },
          momentum: { value: 50, label: 'Neutral' },
          responseTime: { value: 50, label: 'Neutral' }
        }
      };
    }

    // Calculate engagement (based on activity frequency)
    const recentActivityCount = activities.filter(a => {
      const activityDate = new Date(a.date);
      const daysAgo = (Date.now() - activityDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysAgo <= 30;
    }).length;
    const engagementValue = Math.min(100, (recentActivityCount / 30) * 100);
    const engagementLabel = engagementValue >= 70 ? 'High' : engagementValue >= 40 ? 'Medium' : 'Low';

    // Calculate momentum (based on deal progression)
    const activeDeals = deals.filter(d => d.status === 'active');
    const avgProbability = activeDeals.length > 0
      ? activeDeals.reduce((sum, d) => sum + (d.probability || 0), 0) / activeDeals.length
      : 0;
    const momentumValue = avgProbability;
    const momentumLabel = momentumValue >= 70 ? 'Strong' : momentumValue >= 40 ? 'Moderate' : 'Weak';

    // Calculate response time (simplified - would need email tracking)
    const responseTimeValue = 75; // Placeholder
    const responseTimeLabel = 'Fast';

    // Overall health score
    const healthScore = Math.round(
      (engagementValue * 0.4) + (momentumValue * 0.4) + (responseTimeValue * 0.2)
    );

    return {
      score: healthScore,
      metrics: {
        engagement: { value: Math.round(engagementValue), label: engagementLabel },
        momentum: { value: Math.round(momentumValue), label: momentumLabel },
        responseTime: { value: responseTimeValue, label: responseTimeLabel }
      }
    };
  }

  /**
   * Calculate contact statistics
   */
  private static calculateStats(
    deals: any[],
    activities: any[],
    meetings: any[]
  ): ContactStats {
    const totalMeetings = meetings.length;
    const emailsSent = activities.filter(a => a.type === 'outbound' || a.type === 'email').length;
    
    // Calculate average response time (placeholder - would need email tracking)
    const avgResponseTime = '2.3 hours';
    
    // Calculate total deal value
    const dealValue = deals.reduce((sum, d) => sum + (d.value || 0), 0);
    
    // Calculate close probability (average of all active deals)
    const activeDeals = deals.filter(d => d.status === 'active');
    const closeProbability = activeDeals.length > 0
      ? Math.round(activeDeals.reduce((sum, d) => sum + (d.probability || 0), 0) / activeDeals.length)
      : 0;

    return {
      totalMeetings,
      emailsSent,
      avgResponseTime,
      dealValue,
      closeProbability
    };
  }

  /**
   * Format meeting summary
   */
  private static formatMeetingSummary(meeting: any, actionItems: any[]): MeetingSummary {
    return {
      id: meeting.id,
      date: new Date(meeting.date || meeting.meeting_start),
      duration: meeting.duration_minutes || 30,
      discussionPoints: meeting.summary_json?.discussionPoints || [],
      actionItems: actionItems.map(ai => ({
        id: ai.id,
        text: ai.text,
        completed: ai.completed || false,
        assignee: ai.assignee_id || undefined,
        assigneeId: ai.assignee_id || undefined,
        dueDate: ai.due_date ? new Date(ai.due_date) : undefined,
        meetingId: ai.meeting_id
      })),
      sentiment: meeting.sentiment || 'neutral',
      sentimentScore: meeting.sentiment_score || 3,
      transcriptUrl: meeting.transcript_url || undefined,
      recordingUrl: meeting.recording_url || undefined
    };
  }

  /**
   * Format activities
   */
  private static formatActivities(activities: any[]): Activity[] {
    return activities.map(activity => ({
      id: activity.id,
      type: this.mapActivityType(activity.type),
      title: activity.details || activity.subject || `${activity.type} activity`,
      timestamp: this.formatTimestamp(activity.date || activity.created_at),
      metadata: {
        dealId: activity.deal_id,
        companyId: activity.company_id
      }
    }));
  }

  /**
   * Map activity type
   */
  private static mapActivityType(type: string): Activity['type'] {
    switch (type) {
      case 'outbound':
      case 'email':
        return 'email';
      case 'meeting':
        return 'meeting';
      case 'proposal':
        return 'email';
      default:
        return 'note';
    }
  }

  /**
   * Format timestamp to relative time
   */
  private static formatTimestamp(date: string): string {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return `${Math.floor(diffDays / 7)} weeks ago`;
  }

  /**
   * Format AI insights
   */
  private static formatAIInsights(insights: any[]): AIInsight[] {
    return insights.map(insight => ({
      id: insight.id,
      type: insight.insight_type || 'custom',
      content: insight.insight_text,
      priority: insight.priority || 'medium',
      suggestedActions: insight.metadata?.suggestedActions || [],
      metadata: insight.metadata,
      expiresAt: insight.expires_at ? new Date(insight.expires_at) : undefined
    }));
  }

  /**
   * Format action items
   */
  private static formatActionItems(actionItems: any[]): ActionItem[] {
    return actionItems.map(item => ({
      id: item.id,
      text: item.text,
      completed: item.completed || false,
      assignee: item.assignee_id || undefined,
      assigneeId: item.assignee_id || undefined,
      dueDate: item.due_date ? new Date(item.due_date) : undefined,
      meetingId: item.meeting_id
    }));
  }

  /**
   * Update action item completion status
   */
  static async updateActionItem(
    contactId: string,
    actionItemId: string,
    completed: boolean
  ): Promise<void> {
    try {
      const headers = await getSupabaseHeaders();

      const response = await fetch(
        `${API_BASE_URL}/contacts/${contactId}/action-items/${actionItemId}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ completed })
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to update action item: ${response.status}`);
      }
    } catch (error) {
      logger.error('Error updating action item:', error);
      throw error;
    }
  }

  /**
   * Generate AI insights for a contact
   */
  static async generateInsights(contactId: string): Promise<AIInsight[]> {
    try {
      const headers = await getSupabaseHeaders();

      const response = await fetch(`${API_BASE_URL}/contacts/${contactId}/insights`, {
        method: 'POST',
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to generate insights: ${response.status}`);
      }

      const data = await response.json();
      return this.formatAIInsights(data.insights || []);
    } catch (error) {
      logger.error('Error generating insights:', error);
      throw error;
    }
  }
}






