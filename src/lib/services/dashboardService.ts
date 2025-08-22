import { API_BASE_URL } from '@/lib/config';
import logger from '@/lib/utils/logger';

export interface DashboardMetrics {
  revenue: number;
  outbound: number;
  meetings: number;
  proposals: number;
}

export interface ActivityData {
  date: string;
  type: string;
  count: number;
  amount?: number;
}

export interface RecentDeal {
  id: string;
  client_name: string;
  amount: number;
  date: string;
  details: string;
}

export class DashboardService {
  // Get dashboard metrics for a user within a date range
  static async getMetrics(userId: string, startDate: Date, endDate: Date): Promise<DashboardMetrics> {
    try {
      const params = new URLSearchParams({
        ownerId: userId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        includeRelationships: 'true'
      });

      // Fetch activities for outbound, meetings, proposals
      const activitiesResponse = await fetch(`${API_BASE_URL}/activities?${params}`);
      if (!activitiesResponse.ok) {
        throw new Error('Failed to fetch activities');
      }
      
      const activitiesResult = await activitiesResponse.json();
      const activities = activitiesResult.data || [];

      // Fetch deals for revenue (sales)
      const dealsResponse = await fetch(`${API_BASE_URL}/deals?${params}`);
      if (!dealsResponse.ok) {
        throw new Error('Failed to fetch deals');
      }
      
      const dealsResult = await dealsResponse.json();
      const deals = dealsResult.data || [];

      // Calculate metrics
      const revenue = deals
        .filter((deal: any) => deal.status === 'won' || (deal.type && deal.type === 'sale'))
        .reduce((sum: number, deal: any) => sum + (deal.value || deal.amount || 0), 0);

      const outbound = activities
        .filter((activity: any) => activity.type === 'outbound')
        .length;

      const meetings = activities
        .filter((activity: any) => activity.type === 'meeting')
        .length;

      const proposals = activities
        .filter((activity: any) => activity.type === 'proposal')
        .length;

      return {
        revenue,
        outbound,
        meetings,
        proposals
      };
    } catch (error) {
      logger.error('Error fetching dashboard metrics:', error);
      throw error;
    }
  }

  // Get activity data for charts
  static async getActivityData(userId: string, startDate: Date, endDate: Date): Promise<ActivityData[]> {
    try {
      const params = new URLSearchParams({
        ownerId: userId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        includeRelationships: 'true'
      });

      const response = await fetch(`${API_BASE_URL}/activities?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch activity data');
      }
      
      const result = await response.json();
      const activities = result.data || [];

      // Group activities by date and type
      const activityMap = new Map<string, Map<string, { count: number; amount: number }>>();

      activities.forEach((activity: any) => {
        const date = new Date(activity.date).toISOString().split('T')[0];
        const type = activity.type;
        
        if (!activityMap.has(date)) {
          activityMap.set(date, new Map());
        }
        
        const dateMap = activityMap.get(date)!;
        if (!dateMap.has(type)) {
          dateMap.set(type, { count: 0, amount: 0 });
        }
        
        const typeData = dateMap.get(type)!;
        typeData.count += 1;
        typeData.amount += activity.amount || 0;
      });

      // Convert to array format
      const result_data: ActivityData[] = [];
      activityMap.forEach((dateMap, date) => {
        dateMap.forEach((data, type) => {
          result_data.push({
            date,
            type,
            count: data.count,
            amount: data.amount
          });
        });
      });

      return result_data.sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
      logger.error('Error fetching activity data:', error);
      throw error;
    }
  }

  // Get recent deals (sales activities)
  static async getRecentDeals(userId: string, limit: number = 10): Promise<RecentDeal[]> {
    try {
      const params = new URLSearchParams({
        ownerId: userId,
        type: 'sale',
        limit: limit.toString()
      });

      const response = await fetch(`${API_BASE_URL}/activities?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch recent deals');
      }
      
      const result = await response.json();
      const activities = result.data || [];

      return activities.map((activity: any) => ({
        id: activity.id,
        client_name: activity.client_name || 'Unknown Client',
        amount: activity.amount || 0,
        date: activity.date,
        details: activity.details || 'Sale activity'
      }));
    } catch (error) {
      logger.error('Error fetching recent deals:', error);
      throw error;
    }
  }

  // Get trends by comparing current period to previous period
  static async getTrends(userId: string, currentStart: Date, currentEnd: Date): Promise<{
    revenue: string;
    outbound: string;
    meetings: string;
    proposals: string;
  }> {
    try {
      const periodLength = currentEnd.getTime() - currentStart.getTime();
      const previousStart = new Date(currentStart.getTime() - periodLength);
      const previousEnd = new Date(currentEnd.getTime() - periodLength);

      const [currentMetrics, previousMetrics] = await Promise.all([
        this.getMetrics(userId, currentStart, currentEnd),
        this.getMetrics(userId, previousStart, previousEnd)
      ]);

      const calculateTrend = (current: number, previous: number): string => {
        if (previous === 0) return current > 0 ? '+100%' : '0%';
        const change = ((current - previous) / previous) * 100;
        return change >= 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;
      };

      return {
        revenue: calculateTrend(currentMetrics.revenue, previousMetrics.revenue),
        outbound: calculateTrend(currentMetrics.outbound, previousMetrics.outbound),
        meetings: calculateTrend(currentMetrics.meetings, previousMetrics.meetings),
        proposals: calculateTrend(currentMetrics.proposals, previousMetrics.proposals)
      };
    } catch (error) {
      logger.error('Error calculating trends:', error);
      return {
        revenue: '0%',
        outbound: '0%',
        meetings: '0%',
        proposals: '0%'
      };
    }
  }
} 