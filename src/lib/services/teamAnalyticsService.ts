/**
 * Team Analytics Service
 * Provides team-level meeting analytics and comparisons
 */

import { supabase } from '@/lib/supabase/clientV2';

export interface TeamMemberMetrics {
  user_id: string;
  full_name: string;
  email: string;
  total_meetings: number;
  avg_sentiment: number | null;
  avg_talk_time: number | null;
  avg_coach_rating: number | null;
  positive_meetings: number;
  negative_meetings: number;
  total_duration_minutes: number | null;
  last_meeting_date: string | null;
  first_meeting_date: string | null;
}

export interface TeamAggregates {
  totalMeetings: number;
  avgSentiment: number;
  avgTalkTime: number;
  avgCoachRating: number;
  totalTeamMembers: number;
  totalDurationMinutes: number;
}

export interface LeaderboardEntry {
  userId: string;
  name: string;
  value: number;
  rank: number;
  trend?: 'up' | 'down' | 'stable';
}

export class TeamAnalyticsService {
  /**
   * Get team metrics for all team members
   */
  static async getTeamMetrics(userId: string): Promise<TeamMemberMetrics[]> {
    try {
      // For now, get all users in the organization
      // In the future, this should filter by team/organization
      const { data, error } = await supabase
        .from('team_meeting_analytics')
        .select('*')
        .order('total_meetings', { ascending: false });

      if (error) throw error;
      return (data || []) as TeamMemberMetrics[];
    } catch (error) {
      console.error('Error fetching team metrics:', error);
      throw error;
    }
  }

  /**
   * Get aggregate team statistics
   */
  static async getTeamAggregates(userId: string): Promise<TeamAggregates> {
    try {
      const metrics = await this.getTeamMetrics(userId);
      
      const totalMeetings = metrics.reduce((sum, m) => sum + m.total_meetings, 0);
      const membersWithSentiment = metrics.filter(m => m.avg_sentiment !== null);
      const membersWithTalkTime = metrics.filter(m => m.avg_talk_time !== null);
      const membersWithRating = metrics.filter(m => m.avg_coach_rating !== null);

      const avgSentiment = membersWithSentiment.length > 0
        ? membersWithSentiment.reduce((sum, m) => sum + (m.avg_sentiment || 0), 0) / membersWithSentiment.length
        : 0;

      const avgTalkTime = membersWithTalkTime.length > 0
        ? membersWithTalkTime.reduce((sum, m) => sum + (m.avg_talk_time || 0), 0) / membersWithTalkTime.length
        : 0;

      const avgCoachRating = membersWithRating.length > 0
        ? membersWithRating.reduce((sum, m) => sum + (m.avg_coach_rating || 0), 0) / membersWithRating.length
        : 0;

      const totalDurationMinutes = metrics.reduce((sum, m) => sum + (m.total_duration_minutes || 0), 0);

      return {
        totalMeetings,
        avgSentiment,
        avgTalkTime,
        avgCoachRating,
        totalTeamMembers: metrics.length,
        totalDurationMinutes,
      };
    } catch (error) {
      console.error('Error calculating team aggregates:', error);
      throw error;
    }
  }

  /**
   * Get talk time leaderboard
   */
  static async getTalkTimeLeaderboard(userId: string, limit: number = 10): Promise<LeaderboardEntry[]> {
    try {
      const metrics = await this.getTeamMetrics(userId);
      
      const withTalkTime = metrics
        .filter(m => m.avg_talk_time !== null && m.total_meetings > 0)
        .map((m, index) => ({
          userId: m.user_id,
          name: m.full_name || m.email,
          value: m.avg_talk_time || 0,
          rank: index + 1,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, limit)
        .map((entry, index) => ({ ...entry, rank: index + 1 }));

      return withTalkTime;
    } catch (error) {
      console.error('Error fetching talk time leaderboard:', error);
      throw error;
    }
  }

  /**
   * Get sentiment rankings
   */
  static async getSentimentRankings(userId: string, limit: number = 10): Promise<LeaderboardEntry[]> {
    try {
      const metrics = await this.getTeamMetrics(userId);
      
      const withSentiment = metrics
        .filter(m => m.avg_sentiment !== null && m.total_meetings > 0)
        .map((m, index) => ({
          userId: m.user_id,
          name: m.full_name || m.email,
          value: m.avg_sentiment || 0,
          rank: index + 1,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, limit)
        .map((entry, index) => ({ ...entry, rank: index + 1 }));

      return withSentiment;
    } catch (error) {
      console.error('Error fetching sentiment rankings:', error);
      throw error;
    }
  }

  /**
   * Get meeting volume rankings
   */
  static async getMeetingVolumeRankings(userId: string, limit: number = 10): Promise<LeaderboardEntry[]> {
    try {
      const metrics = await this.getTeamMetrics(userId);
      
      const rankings = metrics
        .filter(m => m.total_meetings > 0)
        .map((m, index) => ({
          userId: m.user_id,
          name: m.full_name || m.email,
          value: m.total_meetings,
          rank: index + 1,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, limit)
        .map((entry, index) => ({ ...entry, rank: index + 1 }));

      return rankings;
    } catch (error) {
      console.error('Error fetching meeting volume rankings:', error);
      throw error;
    }
  }

  /**
   * Get individual rep metrics vs team average
   */
  static async getRepComparison(userId: string, repUserId: string): Promise<{
    rep: TeamMemberMetrics | null;
    teamAverage: {
      avgSentiment: number;
      avgTalkTime: number;
      avgCoachRating: number;
      totalMeetings: number;
    };
  }> {
    try {
      const metrics = await this.getTeamMetrics(userId);
      const aggregates = await this.getTeamAggregates(userId);
      
      const rep = metrics.find(m => m.user_id === repUserId) || null;

      return {
        rep,
        teamAverage: {
          avgSentiment: aggregates.avgSentiment,
          avgTalkTime: aggregates.avgTalkTime,
          avgCoachRating: aggregates.avgCoachRating,
          totalMeetings: Math.round(aggregates.totalMeetings / aggregates.totalTeamMembers),
        },
      };
    } catch (error) {
      console.error('Error fetching rep comparison:', error);
      throw error;
    }
  }
}

