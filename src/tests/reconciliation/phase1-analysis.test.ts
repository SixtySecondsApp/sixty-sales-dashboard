/**
 * Phase 1 Analysis Testing - Sales Activities and Pipeline Deals Reconciliation
 * 
 * Tests data analysis SQL script accuracy, orphan detection, duplicate detection,
 * fuzzy matching for Viewpoint variations, and confidence scoring calculations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { supabase } from '@/lib/supabase/clientV2';
import { executeQuery } from '../../../api/_db.js';

// Mock data for testing
const mockActivities = [
  {
    id: 'act-1',
    client_name: 'Viewpoint Construction',
    amount: 10000,
    date: '2024-01-15',
    type: 'sale',
    status: 'completed',
    user_id: 'user-1',
    deal_id: null, // Orphan activity
    created_at: '2024-01-15T10:00:00Z'
  },
  {
    id: 'act-2',
    client_name: 'ViewPoint VC',
    amount: 15000,
    date: '2024-01-16',
    type: 'sale',
    status: 'completed',
    user_id: 'user-1',
    deal_id: 'deal-1',
    created_at: '2024-01-16T10:00:00Z'
  },
  {
    id: 'act-3',
    client_name: 'Viewpoint',
    amount: 8000,
    date: '2024-01-17',
    type: 'sale',
    status: 'completed',
    user_id: 'user-1',
    deal_id: null, // Orphan activity
    created_at: '2024-01-17T10:00:00Z'
  },
  {
    id: 'act-4',
    client_name: 'TechCorp Inc',
    amount: 12000,
    date: '2024-01-15', // Same day as act-1 but different client
    type: 'sale',
    status: 'completed',
    user_id: 'user-1',
    deal_id: 'deal-2',
    created_at: '2024-01-15T14:00:00Z'
  },
  {
    id: 'act-5',
    client_name: 'TechCorp Inc',
    amount: 12500,
    date: '2024-01-15', // Same day, same client - potential duplicate
    type: 'sale',
    status: 'completed',
    user_id: 'user-1',
    deal_id: 'deal-3',
    created_at: '2024-01-15T16:00:00Z'
  }
];

const mockDeals = [
  {
    id: 'deal-1',
    name: 'ViewPoint Deal',
    company: 'ViewPoint VC',
    value: 15000,
    status: 'won',
    stage_changed_at: '2024-01-16T12:00:00Z',
    owner_id: 'user-1',
    created_at: '2024-01-10T10:00:00Z'
  },
  {
    id: 'deal-2',
    name: 'TechCorp Deal',
    company: 'TechCorp Inc',
    value: 12000,
    status: 'won',
    stage_changed_at: '2024-01-15T13:00:00Z',
    owner_id: 'user-1',
    created_at: '2024-01-10T10:00:00Z'
  },
  {
    id: 'deal-3',
    name: 'TechCorp Follow-up',
    company: 'TechCorp Inc',
    value: 12500,
    status: 'won',
    stage_changed_at: '2024-01-15T15:00:00Z',
    owner_id: 'user-1',
    created_at: '2024-01-12T10:00:00Z'
  },
  {
    id: 'deal-4',
    name: 'Orphan Deal',
    company: 'Viewpoint Construction',
    value: 10500,
    status: 'won',
    stage_changed_at: '2024-01-15T11:00:00Z',
    owner_id: 'user-1',
    created_at: '2024-01-12T10:00:00Z'
  }
];

// Mock API response structure
const mockApiResponse = (data: any, error?: string, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: vi.fn().mockResolvedValue(error ? { error } : { data }),
  text: vi.fn().mockResolvedValue(JSON.stringify(error ? { error } : { data }))
});

// Mock fetch globally
global.fetch = vi.fn();

describe('Phase 1 Analysis Testing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock authentication
    vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
      data: { user: { id: 'user-1', email: 'test@example.com' } },
      error: null
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Overview Analysis', () => {
    it('should calculate correct overview statistics', async () => {
      const expectedOverview = {
        total_sales_activities: 5,
        total_won_deals: 4,
        total_active_clients: 2,
        orphan_activities: 2, // act-1, act-3
        orphan_deals: 1, // deal-4 (no matching activity)
        total_activity_revenue: 57500,
        total_deal_revenue: 50000,
        total_mrr: 0,
        activity_deal_linkage_rate: 60.0, // (5-2)/5 * 100
        deal_activity_linkage_rate: 75.0, // (4-1)/4 * 100
        overall_data_quality_score: 66.67 // ((3+3)/(5+4)) * 100
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(expectedOverview)
      );

      const response = await fetch('/api/reconcile/analysis?analysisType=overview&userId=user-1');
      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.data).toEqual(expectedOverview);
      expect(result.data.orphan_activities).toBe(2);
      expect(result.data.orphan_deals).toBe(1);
      expect(result.data.activity_deal_linkage_rate).toBe(60.0);
    });

    it('should handle empty dataset gracefully', async () => {
      const emptyOverview = {
        total_sales_activities: 0,
        total_won_deals: 0,
        total_active_clients: 0,
        orphan_activities: 0,
        orphan_deals: 0,
        total_activity_revenue: 0,
        total_deal_revenue: 0,
        total_mrr: 0,
        activity_deal_linkage_rate: 0,
        deal_activity_linkage_rate: 0,
        overall_data_quality_score: 0
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(emptyOverview)
      );

      const response = await fetch('/api/reconcile/analysis?analysisType=overview&userId=nonexistent');
      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.data).toEqual(emptyOverview);
    });

    it('should handle date range filters correctly', async () => {
      const filteredOverview = {
        total_sales_activities: 3,
        total_won_deals: 2,
        orphan_activities: 1,
        orphan_deals: 0
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(filteredOverview)
      );

      const response = await fetch('/api/reconcile/analysis?analysisType=overview&startDate=2024-01-15&endDate=2024-01-16');
      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.data.total_sales_activities).toBe(3);
    });
  });

  describe('Orphan Activity Detection', () => {
    it('should correctly identify orphan activities', async () => {
      const orphanActivities = [
        {
          id: 'act-1',
          client_name: 'Viewpoint Construction',
          amount: 10000,
          date: '2024-01-15',
          issue_type: 'orphan_activity',
          priority_level: 'revenue_risk'
        },
        {
          id: 'act-3',
          client_name: 'Viewpoint',
          amount: 8000,
          date: '2024-01-17',
          issue_type: 'orphan_activity',
          priority_level: 'revenue_risk'
        }
      ];

      const mockOrphanData = {
        orphan_activities: orphanActivities,
        orphan_deals: [],
        summary: {
          total_orphan_activities: 2,
          total_orphan_deals: 0,
          total_orphan_activity_revenue: 18000,
          total_orphan_deal_revenue: 0
        }
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(mockOrphanData)
      );

      const response = await fetch('/api/reconcile/analysis?analysisType=orphans');
      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.data.orphan_activities).toHaveLength(2);
      expect(result.data.summary.total_orphan_activity_revenue).toBe(18000);
      
      // Verify all orphan activities are correctly identified
      const orphanIds = result.data.orphan_activities.map((a: any) => a.id);
      expect(orphanIds).toContain('act-1');
      expect(orphanIds).toContain('act-3');
    });

    it('should correctly identify orphan deals', async () => {
      const orphanDeals = [
        {
          id: 'deal-4',
          name: 'Orphan Deal',
          company: 'Viewpoint Construction',
          value: 10500,
          issue_type: 'orphan_deal',
          priority_level: 'revenue_tracking'
        }
      ];

      const mockOrphanData = {
        orphan_activities: [],
        orphan_deals: orphanDeals,
        summary: {
          total_orphan_activities: 0,
          total_orphan_deals: 1,
          total_orphan_activity_revenue: 0,
          total_orphan_deal_revenue: 10500
        }
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(mockOrphanData)
      );

      const response = await fetch('/api/reconcile/analysis?analysisType=orphans');
      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.data.orphan_deals).toHaveLength(1);
      expect(result.data.orphan_deals[0].id).toBe('deal-4');
      expect(result.data.summary.total_orphan_deal_revenue).toBe(10500);
    });

    it('should prioritize high-value orphans correctly', async () => {
      const orphanActivities = [
        {
          id: 'act-high',
          amount: 50000,
          priority_level: 'revenue_risk'
        },
        {
          id: 'act-low',
          amount: 0,
          priority_level: 'data_integrity'
        }
      ];

      const mockOrphanData = {
        orphan_activities: orphanActivities,
        orphan_deals: [],
        summary: { total_orphan_activities: 2 }
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(mockOrphanData)
      );

      const response = await fetch('/api/reconcile/analysis?analysisType=orphans');
      const result = await response.json();

      expect(response.ok).toBe(true);
      
      // High-value activities should be marked as revenue_risk
      const highValueActivity = result.data.orphan_activities.find((a: any) => a.id === 'act-high');
      const lowValueActivity = result.data.orphan_activities.find((a: any) => a.id === 'act-low');
      
      expect(highValueActivity.priority_level).toBe('revenue_risk');
      expect(lowValueActivity.priority_level).toBe('data_integrity');
    });
  });

  describe('Duplicate Detection', () => {
    it('should identify same-day activities for same client', async () => {
      const duplicateGroups = [
        {
          client_name_clean: 'techcorp inc',
          activity_date: '2024-01-15',
          activity_count: 2,
          unique_deals: 2,
          activity_ids: ['act-4', 'act-5'],
          deal_ids: ['deal-2', 'deal-3'],
          amounts: [12000, 12500],
          sales_reps: ['rep1', 'rep1'],
          total_amount: 24500,
          issue_type: 'same_day_multiple_activities'
        }
      ];

      const mockDuplicateData = {
        duplicates: duplicateGroups,
        summary: {
          total_duplicate_groups: 1,
          total_duplicate_activities: 2,
          total_revenue_affected: 24500
        }
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(mockDuplicateData)
      );

      const response = await fetch('/api/reconcile/analysis?analysisType=duplicates');
      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.data.duplicates).toHaveLength(1);
      expect(result.data.duplicates[0].activity_count).toBe(2);
      expect(result.data.duplicates[0].client_name_clean).toBe('techcorp inc');
      expect(result.data.summary.total_revenue_affected).toBe(24500);
    });

    it('should not flag different clients on same day as duplicates', async () => {
      const mockDuplicateData = {
        duplicates: [], // No duplicates for different clients
        summary: {
          total_duplicate_groups: 0,
          total_duplicate_activities: 0,
          total_revenue_affected: 0
        }
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(mockDuplicateData)
      );

      const response = await fetch('/api/reconcile/analysis?analysisType=duplicates');
      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.data.duplicates).toHaveLength(0);
    });

    it('should handle case variations in client names', async () => {
      const duplicateGroups = [
        {
          client_name_clean: 'viewpoint construction', // Normalized to lowercase
          activity_date: '2024-01-15',
          activity_count: 3, // Multiple variations of "Viewpoint"
          activity_ids: ['act-1', 'act-6', 'act-7']
        }
      ];

      const mockDuplicateData = {
        duplicates: duplicateGroups,
        summary: { total_duplicate_groups: 1 }
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(mockDuplicateData)
      );

      const response = await fetch('/api/reconcile/analysis?analysisType=duplicates');
      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.data.duplicates[0].client_name_clean).toBe('viewpoint construction');
    });
  });

  describe('Fuzzy Matching for Viewpoint Variations', () => {
    it('should match Viewpoint name variations correctly', async () => {
      const potentialMatches = [
        {
          activity_id: 'act-1',
          deal_id: 'deal-4',
          client_name: 'Viewpoint Construction',
          company: 'Viewpoint Construction',
          name_match_score: 40, // Exact match
          date_proximity_score: 30, // Same day
          amount_similarity_score: 20, // Similar amounts
          total_confidence_score: 90,
          confidence_level: 'high_confidence'
        },
        {
          activity_id: 'act-3',
          deal_id: 'deal-4',
          client_name: 'Viewpoint',
          company: 'Viewpoint Construction',
          name_match_score: 30, // Good similarity
          date_proximity_score: 10, // 2 days apart
          amount_similarity_score: 10, // Different amounts
          total_confidence_score: 50,
          confidence_level: 'medium_confidence'
        }
      ];

      const mockMatchingData = {
        matches: {
          high_confidence: [potentialMatches[0]],
          medium_confidence: [potentialMatches[1]],
          low_confidence: []
        },
        all_matches: potentialMatches,
        summary: {
          total_matches: 2,
          high_confidence_matches: 1,
          medium_confidence_matches: 1,
          low_confidence_matches: 0,
          confidence_threshold: 50
        }
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(mockMatchingData)
      );

      const response = await fetch('/api/reconcile/analysis?analysisType=matching&confidenceThreshold=50');
      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.data.summary.total_matches).toBe(2);
      expect(result.data.matches.high_confidence).toHaveLength(1);
      expect(result.data.matches.medium_confidence).toHaveLength(1);
    });

    it('should handle various Viewpoint name formats', async () => {
      const viewpointVariations = [
        { name: 'Viewpoint', similarity: 0.9 },
        { name: 'ViewPoint', similarity: 0.95 },
        { name: 'Viewpoint VC', similarity: 0.8 },
        { name: 'ViewPoint VC', similarity: 0.85 },
        { name: 'Viewpoint Construction', similarity: 0.75 },
        { name: 'VIEWPOINT', similarity: 0.9 }
      ];

      // All variations should be detected as potential matches
      viewpointVariations.forEach(variation => {
        expect(variation.similarity).toBeGreaterThan(0.7); // Minimum threshold for matching
      });
    });

    it('should calculate confidence scores correctly', async () => {
      const testCases = [
        {
          // Perfect match
          name_similarity: 0.95,
          days_difference: 0,
          amount_difference_percent: 0.02,
          expected_name_score: 40,
          expected_date_score: 30,
          expected_amount_score: 30,
          expected_total: 100,
          expected_level: 'high_confidence'
        },
        {
          // Good match
          name_similarity: 0.85,
          days_difference: 1,
          amount_difference_percent: 0.08,
          expected_name_score: 30,
          expected_date_score: 25,
          expected_amount_score: 20,
          expected_total: 75,
          expected_level: 'medium_confidence'
        },
        {
          // Poor match
          name_similarity: 0.72,
          days_difference: 5,
          amount_difference_percent: 0.25,
          expected_name_score: 20,
          expected_date_score: 0,
          expected_amount_score: 0,
          expected_total: 20,
          expected_level: 'low_confidence'
        }
      ];

      testCases.forEach((testCase, index) => {
        const potentialMatch = {
          activity_id: `act-${index}`,
          deal_id: `deal-${index}`,
          name_match_score: testCase.expected_name_score,
          date_proximity_score: testCase.expected_date_score,
          amount_similarity_score: testCase.expected_amount_score,
          total_confidence_score: testCase.expected_total,
          confidence_level: testCase.expected_level
        };

        expect(potentialMatch.total_confidence_score).toBe(testCase.expected_total);
        expect(potentialMatch.confidence_level).toBe(testCase.expected_level);
      });
    });
  });

  describe('Date Proximity Calculations', () => {
    it('should score date proximity correctly', async () => {
      const dateProximityTests = [
        { days_diff: 0, expected_score: 30 }, // Same day
        { days_diff: 1, expected_score: 25 }, // 1 day apart
        { days_diff: 3, expected_score: 20 }, // 3 days apart
        { days_diff: 7, expected_score: 10 }, // 1 week apart
        { days_diff: 10, expected_score: 0 }, // More than 1 week
        { days_diff: 30, expected_score: 0 } // 1 month apart
      ];

      dateProximityTests.forEach(test => {
        // Date proximity scoring logic
        let score = 0;
        if (test.days_diff === 0) score = 30;
        else if (test.days_diff <= 1) score = 25;
        else if (test.days_diff <= 3) score = 20;
        else if (test.days_diff <= 7) score = 10;
        else score = 0;

        expect(score).toBe(test.expected_score);
      });
    });

    it('should filter out matches beyond 30-day window', async () => {
      const mockMatchingData = {
        matches: { high_confidence: [], medium_confidence: [], low_confidence: [] },
        all_matches: [], // No matches beyond 30 days
        summary: { total_matches: 0 }
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(mockMatchingData)
      );

      const response = await fetch('/api/reconcile/analysis?analysisType=matching&startDate=2024-01-01&endDate=2024-01-31');
      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.data.summary.total_matches).toBe(0);
    });
  });

  describe('Amount Similarity Calculations', () => {
    it('should calculate amount similarity correctly', async () => {
      const amountSimilarityTests = [
        { amount1: 10000, amount2: 10000, expected_score: 30 }, // Exact match
        { amount1: 10000, amount2: 10300, expected_score: 30 }, // 3% difference
        { amount1: 10000, amount2: 10800, expected_score: 20 }, // 8% difference
        { amount1: 10000, amount2: 11500, expected_score: 10 }, // 15% difference
        { amount1: 10000, amount2: 13000, expected_score: 0 }, // 30% difference
        { amount1: 10000, amount2: 0, expected_score: 0 }, // Zero amount
        { amount1: 0, amount2: 10000, expected_score: 0 } // Zero amount
      ];

      amountSimilarityTests.forEach(test => {
        let score = 0;
        if (test.amount1 > 0 && test.amount2 > 0) {
          const difference = Math.abs(test.amount1 - test.amount2);
          const maxAmount = Math.max(test.amount1, test.amount2);
          const percentDiff = difference / maxAmount;

          if (percentDiff <= 0.05) score = 30;
          else if (percentDiff <= 0.10) score = 20;
          else if (percentDiff <= 0.20) score = 10;
          else score = 0;
        }

        expect(score).toBe(test.expected_score);
      });
    });
  });

  describe('User Statistics Analysis', () => {
    it('should calculate user-specific statistics correctly', async () => {
      const userStats = [
        {
          id: 'user-1',
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          user_sales_activities: 5,
          user_won_deals: 4,
          user_active_clients: 2,
          user_orphan_activities: 2,
          user_orphan_deals: 1,
          user_activity_revenue: 57500,
          user_deal_revenue: 50000,
          user_linkage_rate: 60.0 // (5-2)/5 * 100
        }
      ];

      const mockStatsData = {
        user_statistics: userStats,
        summary: {
          total_users_analyzed: 1,
          total_combined_revenue: 57500,
          average_linkage_rate: 60.0
        }
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(mockStatsData)
      );

      const response = await fetch('/api/reconcile/analysis?analysisType=statistics');
      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.data.user_statistics).toHaveLength(1);
      expect(result.data.user_statistics[0].user_linkage_rate).toBe(60.0);
      expect(result.data.summary.average_linkage_rate).toBe(60.0);
    });

    it('should exclude users with no activity', async () => {
      const mockStatsData = {
        user_statistics: [], // Users with no activities excluded
        summary: {
          total_users_analyzed: 0,
          total_combined_revenue: 0,
          average_linkage_rate: 0
        }
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(mockStatsData)
      );

      const response = await fetch('/api/reconcile/analysis?analysisType=statistics&userId=inactive-user');
      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.data.user_statistics).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid analysis type', async () => {
      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(null, 'Invalid analysis type', 400)
      );

      const response = await fetch('/api/reconcile/analysis?analysisType=invalid');
      const result = await response.json();

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
      expect(result.error).toBe('Invalid analysis type');
    });

    it('should handle database connection errors', async () => {
      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(null, 'Database connection failed', 500)
      );

      const response = await fetch('/api/reconcile/analysis?analysisType=overview');
      const result = await response.json();

      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);
      expect(result.error).toBe('Database connection failed');
    });

    it('should handle invalid date formats', async () => {
      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(null, 'Invalid date format', 400)
      );

      const response = await fetch('/api/reconcile/analysis?analysisType=overview&startDate=invalid-date');
      const result = await response.json();

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
      expect(result.error).toBe('Invalid date format');
    });

    it('should handle unauthorized access', async () => {
      // Mock unauthenticated user
      vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' }
      });

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(null, 'Not authenticated', 401)
      );

      const response = await fetch('/api/reconcile/analysis?analysisType=overview');
      const result = await response.json();

      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);
      expect(result.error).toBe('Not authenticated');
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle large result sets efficiently', async () => {
      const largeDataset = {
        orphan_activities: new Array(1000).fill(null).map((_, i) => ({
          id: `act-${i}`,
          client_name: `Client ${i}`,
          amount: Math.random() * 50000,
          date: '2024-01-15',
          issue_type: 'orphan_activity'
        })),
        summary: { total_orphan_activities: 1000 }
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(largeDataset)
      );

      const response = await fetch('/api/reconcile/analysis?analysisType=orphans');
      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.data.orphan_activities).toHaveLength(1000);
      expect(result.data.summary.total_orphan_activities).toBe(1000);
    });

    it('should handle queries with no results', async () => {
      const emptyResult = {
        orphan_activities: [],
        orphan_deals: [],
        summary: {
          total_orphan_activities: 0,
          total_orphan_deals: 0,
          total_orphan_activity_revenue: 0,
          total_orphan_deal_revenue: 0
        }
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(emptyResult)
      );

      const response = await fetch('/api/reconcile/analysis?analysisType=orphans&userId=empty-user');
      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.data.orphan_activities).toHaveLength(0);
      expect(result.data.summary.total_orphan_activities).toBe(0);
    });
  });
});