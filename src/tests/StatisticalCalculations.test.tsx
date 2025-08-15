import { describe, test, expect } from 'vitest';

// Mock Activity type based on the actual implementation
interface Activity {
  id: string;
  type: 'sale' | 'proposal' | 'meeting' | 'outbound';
  status: 'completed' | 'pending' | 'cancelled' | 'no_show';
  amount?: number;
  deals?: {
    id: string;
    name: string;
    value: number;
    billing_cycle?: 'monthly' | 'annual' | 'one-time';
    contract_length?: number;
  };
  date: string;
  sales_rep: string;
  client_name: string;
  details?: string;
}

// Mock LTV calculation function from utils
const calculateLTVValue = (deals: Activity['deals'], fallbackAmount?: number): number => {
  if (!deals) return fallbackAmount || 0;
  
  const baseValue = deals.value || fallbackAmount || 0;
  
  if (!deals.billing_cycle || deals.billing_cycle === 'one-time') {
    return baseValue;
  }
  
  const contractLength = deals.contract_length || 12;
  
  if (deals.billing_cycle === 'monthly') {
    return baseValue * contractLength;
  } else if (deals.billing_cycle === 'annual') {
    return baseValue * Math.max(1, Math.floor(contractLength / 12));
  }
  
  return baseValue;
};

// Statistical calculation functions extracted from SalesTable
const calculateStats = (activities: Activity[]) => {
  // Calculate total revenue including LTV
  const totalRevenue = activities
    .filter(a => a.type === 'sale')
    .reduce((sum, a) => {
      const ltvValue = a.deals ? calculateLTVValue(a.deals, a.amount) : 0;
      const value = ltvValue > (a.amount || 0) ? ltvValue : (a.amount || 0);
      return sum + value;
    }, 0);

  const activeDeals = activities
    .filter(a => a.type === 'sale' && a.status === 'completed').length;
  
  const salesActivities = activities.filter(a => a.type === 'sale').length;
  const proposalActivities = activities.filter(a => a.type === 'proposal').length;
  const meetingActivities = activities.filter(a => a.type === 'meeting').length;
  
  // Calculate no-show rate with division by zero protection
  const noShowActivities = activities.filter(a => a.status === 'no_show').length;
  const totalScheduledActivities = activities
    .filter(a => ['meeting', 'proposal', 'sale'].includes(a.type)).length;
  const noShowRate = Math.round(
    (noShowActivities / Math.max(1, totalScheduledActivities)) * 100
  ) || 0;
  
  // Proposal win rate with division by zero protection
  const proposalWinRate = Math.round(
    (salesActivities / Math.max(1, proposalActivities)) * 100
  ) || 0;
  
  // Meeting to proposal rate with division by zero protection
  const meetingToProposalRate = Math.round(
    (proposalActivities / Math.max(1, meetingActivities)) * 100
  ) || 0;
  
  // Average deal with division by zero protection
  const avgDeal = totalRevenue / (salesActivities || 1);
  
  return {
    totalRevenue,
    activeDeals,
    proposalWinRate,
    meetingToProposalRate,
    avgDeal,
    noShowRate,
    noShowCount: noShowActivities,
    totalScheduledCount: totalScheduledActivities,
    salesActivities,
    proposalActivities,
    meetingActivities
  };
};

// Percentage change calculation with division by zero handling
const calculatePercentageChange = (current: number, previous: number): number => {
  if (previous === 0) {
    return current === 0 ? 0 : (current > 0 ? 100 : -100);
  }
  const change = ((current - previous) / previous) * 100;
  return Math.round(change);
};

describe('Statistical Calculations', () => {
  
  describe('Division by Zero Handling', () => {
    test('handles zero denominator in no-show rate calculation', () => {
      const activities: Activity[] = [
        {
          id: '1',
          type: 'outbound', // Not a scheduled activity
          status: 'completed',
          date: '2024-01-01',
          sales_rep: 'John Doe',
          client_name: 'Client A'
        }
      ];
      
      const stats = calculateStats(activities);
      expect(stats.noShowRate).toBe(0);
      expect(stats.totalScheduledCount).toBe(0);
    });

    test('handles zero denominator in proposal win rate', () => {
      const activities: Activity[] = [
        {
          id: '1',
          type: 'meeting',
          status: 'completed',
          date: '2024-01-01',
          sales_rep: 'John Doe',
          client_name: 'Client A'
        }
      ];
      
      const stats = calculateStats(activities);
      expect(stats.proposalWinRate).toBe(0);
      expect(stats.proposalActivities).toBe(0);
    });

    test('handles zero denominator in meeting to proposal rate', () => {
      const activities: Activity[] = [
        {
          id: '1',
          type: 'sale',
          status: 'completed',
          amount: 1000,
          date: '2024-01-01',
          sales_rep: 'John Doe',
          client_name: 'Client A'
        }
      ];
      
      const stats = calculateStats(activities);
      expect(stats.meetingToProposalRate).toBe(0);
      expect(stats.meetingActivities).toBe(0);
    });

    test('handles zero denominator in average deal calculation', () => {
      const activities: Activity[] = [
        {
          id: '1',
          type: 'meeting',
          status: 'completed',
          date: '2024-01-01',
          sales_rep: 'John Doe',
          client_name: 'Client A'
        }
      ];
      
      const stats = calculateStats(activities);
      expect(stats.avgDeal).toBe(0); // 0 revenue / 1 (protected denominator)
      expect(stats.salesActivities).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    test('handles empty activity list', () => {
      const activities: Activity[] = [];
      
      const stats = calculateStats(activities);
      expect(stats.totalRevenue).toBe(0);
      expect(stats.activeDeals).toBe(0);
      expect(stats.proposalWinRate).toBe(0);
      expect(stats.meetingToProposalRate).toBe(0);
      expect(stats.avgDeal).toBe(0);
      expect(stats.noShowRate).toBe(0);
    });

    test('handles activities with undefined amounts', () => {
      const activities: Activity[] = [
        {
          id: '1',
          type: 'sale',
          status: 'completed',
          // amount is undefined
          date: '2024-01-01',
          sales_rep: 'John Doe',
          client_name: 'Client A'
        }
      ];
      
      const stats = calculateStats(activities);
      expect(stats.totalRevenue).toBe(0);
      expect(stats.avgDeal).toBe(0); // 0 revenue / 1 = 0
    });

    test('handles activities with zero amounts', () => {
      const activities: Activity[] = [
        {
          id: '1',
          type: 'sale',
          status: 'completed',
          amount: 0,
          date: '2024-01-01',
          sales_rep: 'John Doe',
          client_name: 'Client A'
        }
      ];
      
      const stats = calculateStats(activities);
      expect(stats.totalRevenue).toBe(0);
      expect(stats.avgDeal).toBe(0);
    });

    test('handles negative amounts', () => {
      const activities: Activity[] = [
        {
          id: '1',
          type: 'sale',
          status: 'completed',
          amount: -100,
          date: '2024-01-01',
          sales_rep: 'John Doe',
          client_name: 'Client A'
        }
      ];
      
      const stats = calculateStats(activities);
      expect(stats.totalRevenue).toBe(-100);
      expect(stats.avgDeal).toBe(-100);
    });

    test('handles all no-show activities', () => {
      const activities: Activity[] = [
        {
          id: '1',
          type: 'meeting',
          status: 'no_show',
          date: '2024-01-01',
          sales_rep: 'John Doe',
          client_name: 'Client A'
        },
        {
          id: '2',
          type: 'proposal',
          status: 'no_show',
          date: '2024-01-01',
          sales_rep: 'John Doe',
          client_name: 'Client B'
        }
      ];
      
      const stats = calculateStats(activities);
      expect(stats.noShowRate).toBe(100);
      expect(stats.noShowCount).toBe(2);
      expect(stats.totalScheduledCount).toBe(2);
    });

    test('handles very large numbers', () => {
      const activities: Activity[] = [
        {
          id: '1',
          type: 'sale',
          status: 'completed',
          amount: 999999999,
          date: '2024-01-01',
          sales_rep: 'John Doe',
          client_name: 'Client A'
        }
      ];
      
      const stats = calculateStats(activities);
      expect(stats.totalRevenue).toBe(999999999);
      expect(stats.avgDeal).toBe(999999999);
    });
  });

  describe('LTV Calculations', () => {
    test('calculates monthly LTV correctly', () => {
      const deals = {
        id: '1',
        name: 'Test Deal',
        value: 100,
        billing_cycle: 'monthly' as const,
        contract_length: 12
      };
      
      const ltv = calculateLTVValue(deals, 50);
      expect(ltv).toBe(1200); // 100 * 12
    });

    test('calculates annual LTV correctly', () => {
      const deals = {
        id: '1',
        name: 'Test Deal',
        value: 1200,
        billing_cycle: 'annual' as const,
        contract_length: 24
      };
      
      const ltv = calculateLTVValue(deals, 50);
      expect(ltv).toBe(2400); // 1200 * 2 years
    });

    test('handles one-time deals', () => {
      const deals = {
        id: '1',
        name: 'Test Deal',
        value: 500,
        billing_cycle: 'one-time' as const
      };
      
      const ltv = calculateLTVValue(deals, 50);
      expect(ltv).toBe(500);
    });

    test('handles deals without billing cycle', () => {
      const deals = {
        id: '1',
        name: 'Test Deal',
        value: 500
      };
      
      const ltv = calculateLTVValue(deals, 50);
      expect(ltv).toBe(500);
    });

    test('handles deals with zero value', () => {
      const deals = {
        id: '1',
        name: 'Test Deal',
        value: 0,
        billing_cycle: 'monthly' as const,
        contract_length: 12
      };
      
      const ltv = calculateLTVValue(deals, 50);
      expect(ltv).toBe(0);
    });

    test('uses fallback amount when deals value is missing', () => {
      const deals = {
        id: '1',
        name: 'Test Deal'
        // value is missing
      };
      
      const ltv = calculateLTVValue(deals, 250);
      expect(ltv).toBe(250);
    });
  });

  describe('Percentage Change Calculations', () => {
    test('calculates positive percentage change correctly', () => {
      const result = calculatePercentageChange(120, 100);
      expect(result).toBe(20);
    });

    test('calculates negative percentage change correctly', () => {
      const result = calculatePercentageChange(80, 100);
      expect(result).toBe(-20);
    });

    test('handles zero current value', () => {
      const result = calculatePercentageChange(0, 100);
      expect(result).toBe(-100);
    });

    test('handles zero previous value with positive current', () => {
      const result = calculatePercentageChange(100, 0);
      expect(result).toBe(100);
    });

    test('handles zero previous value with negative current', () => {
      const result = calculatePercentageChange(-50, 0);
      expect(result).toBe(-100);
    });

    test('handles both values being zero', () => {
      const result = calculatePercentageChange(0, 0);
      expect(result).toBe(0);
    });

    test('rounds to nearest integer', () => {
      const result = calculatePercentageChange(105.7, 100);
      expect(result).toBe(6); // 5.7 rounds to 6
    });

    test('handles very large percentage changes', () => {
      const result = calculatePercentageChange(10000, 1);
      expect(result).toBe(999900);
    });
  });

  describe('Complex Scenarios', () => {
    test('calculates statistics for mixed activity types correctly', () => {
      const activities: Activity[] = [
        // Meetings
        {
          id: '1',
          type: 'meeting',
          status: 'completed',
          date: '2024-01-01',
          sales_rep: 'John Doe',
          client_name: 'Client A'
        },
        {
          id: '2',
          type: 'meeting',
          status: 'no_show',
          date: '2024-01-02',
          sales_rep: 'Jane Smith',
          client_name: 'Client B'
        },
        // Proposals
        {
          id: '3',
          type: 'proposal',
          status: 'completed',
          amount: 1000,
          date: '2024-01-03',
          sales_rep: 'John Doe',
          client_name: 'Client A'
        },
        // Sales
        {
          id: '4',
          type: 'sale',
          status: 'completed',
          amount: 2000,
          date: '2024-01-04',
          sales_rep: 'John Doe',
          client_name: 'Client A'
        },
        {
          id: '5',
          type: 'sale',
          status: 'pending',
          amount: 500,
          date: '2024-01-05',
          sales_rep: 'Jane Smith',
          client_name: 'Client C'
        },
        // Outbound (not scheduled)
        {
          id: '6',
          type: 'outbound',
          status: 'completed',
          date: '2024-01-06',
          sales_rep: 'John Doe',
          client_name: 'Client D'
        }
      ];
      
      const stats = calculateStats(activities);
      
      // Total revenue from completed sales only
      expect(stats.totalRevenue).toBe(2000);
      
      // Active deals (completed sales)
      expect(stats.activeDeals).toBe(1);
      
      // No-show rate: 1 no-show out of 4 scheduled activities (2 meetings + 1 proposal + 2 sales)
      expect(stats.noShowRate).toBe(20); // 1/5 * 100 = 20%
      expect(stats.noShowCount).toBe(1);
      expect(stats.totalScheduledCount).toBe(5);
      
      // Proposal win rate: 2 sales out of 1 proposal = 200%
      expect(stats.proposalWinRate).toBe(200);
      
      // Meeting to proposal rate: 1 proposal out of 2 meetings = 50%
      expect(stats.meetingToProposalRate).toBe(50);
      
      // Average deal: 2000 / 2 = 1000
      expect(stats.avgDeal).toBe(1000);
    });

    test('handles LTV calculations in revenue totals', () => {
      const activities: Activity[] = [
        {
          id: '1',
          type: 'sale',
          status: 'completed',
          amount: 100,
          deals: {
            id: 'deal1',
            name: 'Monthly Subscription',
            value: 100,
            billing_cycle: 'monthly',
            contract_length: 12
          },
          date: '2024-01-01',
          sales_rep: 'John Doe',
          client_name: 'Client A'
        }
      ];
      
      const stats = calculateStats(activities);
      
      // Should use LTV (1200) instead of amount (100)
      expect(stats.totalRevenue).toBe(1200);
      expect(stats.avgDeal).toBe(1200);
    });

    test('handles rounding correctly in percentage calculations', () => {
      const activities: Activity[] = [
        // Create scenario where percentages need rounding
        { id: '1', type: 'meeting', status: 'completed', date: '2024-01-01', sales_rep: 'John', client_name: 'A' },
        { id: '2', type: 'meeting', status: 'completed', date: '2024-01-01', sales_rep: 'John', client_name: 'B' },
        { id: '3', type: 'meeting', status: 'completed', date: '2024-01-01', sales_rep: 'John', client_name: 'C' },
        { id: '4', type: 'proposal', status: 'completed', date: '2024-01-01', sales_rep: 'John', client_name: 'A' },
        { id: '5', type: 'sale', status: 'completed', amount: 1000, date: '2024-01-01', sales_rep: 'John', client_name: 'A' }
      ];
      
      const stats = calculateStats(activities);
      
      // 1 proposal from 3 meetings = 33.33...% → rounds to 33%
      expect(stats.meetingToProposalRate).toBe(33);
      
      // 1 sale from 1 proposal = 100%
      expect(stats.proposalWinRate).toBe(100);
    });
  });
});

// Test data generation utilities for large dataset testing
export const generateTestActivities = (count: number, options: Partial<Activity> = {}): Activity[] => {
  const activityTypes: Activity['type'][] = ['sale', 'proposal', 'meeting', 'outbound'];
  const statuses: Activity['status'][] = ['completed', 'pending', 'cancelled', 'no_show'];
  const salesReps = ['John Doe', 'Jane Smith', 'Bob Johnson', 'Alice Brown'];
  const clients = ['Client A', 'Client B', 'Client C', 'Client D', 'Client E'];
  
  return Array.from({ length: count }, (_, index) => ({
    id: `activity-${index + 1}`,
    type: activityTypes[index % activityTypes.length],
    status: statuses[index % statuses.length],
    amount: Math.random() > 0.5 ? Math.floor(Math.random() * 5000) + 100 : undefined,
    date: new Date(2024, 0, (index % 28) + 1).toISOString(),
    sales_rep: salesReps[index % salesReps.length],
    client_name: clients[index % clients.length],
    details: `Activity ${index + 1} details`,
    ...options
  }));
};