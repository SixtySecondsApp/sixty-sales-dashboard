import React from 'react';
import { PoundSterling, Users, FileText, BarChart3, UserX } from 'lucide-react';
import { EnhancedStatCard } from './enhanced-stat-card';
import logger from '@/lib/utils/logger';

// Example data structure for Activity Log stats
interface ActivityStats {
  totalRevenue: number;
  previousRevenue: number;
  meetingToProposalRate: number;
  previousMeetingRate: number;
  proposalWinRate: number;
  previousWinRate: number;
  activeDeals: number;
  previousDeals: number;
  avgDealValue: number;
  previousAvgDeal: number;
  noShowRate: number;
  previousNoShowRate: number;
  totalMeetings: number;
  noShowCount: number;
}

interface ActivityStatsGridProps {
  stats: ActivityStats;
  period: string; // "vs last month", "vs last week", etc.
  onStatClick?: (statType: string) => void;
}

export function ActivityStatsGrid({ stats, period, onStatClick }: ActivityStatsGridProps) {
  // Calculate trend percentages
  const revenueTrend = stats.previousRevenue > 0 
    ? ((stats.totalRevenue - stats.previousRevenue) / stats.previousRevenue) * 100 
    : 0;
    
  const meetingTrend = stats.previousMeetingRate > 0
    ? stats.meetingToProposalRate - stats.previousMeetingRate
    : 0;
    
  const proposalTrend = stats.previousWinRate > 0
    ? stats.proposalWinRate - stats.previousWinRate
    : 0;
    
  const dealsTrend = stats.previousDeals > 0
    ? ((stats.activeDeals - stats.previousDeals) / stats.previousDeals) * 100
    : 0;
    
  const avgDealTrend = stats.previousAvgDeal > 0
    ? ((stats.avgDealValue - stats.previousAvgDeal) / stats.previousAvgDeal) * 100
    : 0;
    
  const noShowTrend = stats.previousNoShowRate > 0
    ? stats.noShowRate - stats.previousNoShowRate
    : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 md:gap-6">
      {/* Total Revenue */}
      <EnhancedStatCard
        title="Total Revenue"
        primaryValue={new Intl.NumberFormat('en-GB', {
          style: 'currency',
          currency: 'GBP',
          maximumFractionDigits: 0
        }).format(stats.totalRevenue)}
        percentageValue={75.3} // Could be vs target or vs total pipeline
        trendPercentage={revenueTrend}
        periodContext={period}
        icon={PoundSterling}
        color="emerald"
        onClick={() => onStatClick?.('revenue')}
      />

      {/* Meeting Conversion */}
      <EnhancedStatCard
        title="Meeting Conversion"
        primaryValue={`${stats.meetingToProposalRate}%`}
        secondaryValue="meetings → proposals"
        trendPercentage={meetingTrend}
        periodContext={period}
        icon={Users}
        color="cyan"
        onClick={() => onStatClick?.('meetings')}
      />

      {/* Proposal Win Rate */}
      <EnhancedStatCard
        title="Proposal Win Rate"
        primaryValue={`${stats.proposalWinRate}%`}
        secondaryValue="proposals → sales"
        trendPercentage={proposalTrend}
        periodContext={period}
        icon={FileText}
        color="blue"
        onClick={() => onStatClick?.('proposals')}
      />

      {/* Won Deals */}
      <EnhancedStatCard
        title="Won Deals"
        primaryValue={stats.activeDeals}
        secondaryValue="closed this period"
        trendPercentage={dealsTrend}
        periodContext={period}
        icon={BarChart3}
        color="violet"
        onClick={() => onStatClick?.('deals')}
      />

      {/* Average Deal Value */}
      <EnhancedStatCard
        title="Average Deal Value"
        primaryValue={new Intl.NumberFormat('en-GB', {
          style: 'currency',
          currency: 'GBP',
          maximumFractionDigits: 0
        }).format(stats.avgDealValue)}
        trendPercentage={avgDealTrend}
        periodContext={period}
        icon={PoundSterling}
        color="emerald"
        onClick={() => onStatClick?.('avgdeal')}
      />

      {/* No-Show Rate - NEW METRIC */}
      <EnhancedStatCard
        title="No-Show Rate"
        primaryValue={`${stats.noShowRate.toFixed(1)}%`}
        secondaryValue={`${stats.noShowCount} of ${stats.totalMeetings} meetings`}
        trendPercentage={noShowTrend}
        periodContext={period}
        icon={UserX}
        color="orange"
        variant="no-show"
        onClick={() => onStatClick?.('noshow')}
      />
    </div>
  );
}

// Example usage with mock data
export function ActivityStatsExample() {
  const mockStats: ActivityStats = {
    totalRevenue: 124567,
    previousRevenue: 98432,
    meetingToProposalRate: 72.3,
    previousMeetingRate: 68.1,
    proposalWinRate: 45.2,
    previousWinRate: 41.8,
    activeDeals: 23,
    previousDeals: 18,
    avgDealValue: 5416,
    previousAvgDeal: 4982,
    noShowRate: 8.2,
    previousNoShowRate: 10.3,
    totalMeetings: 37,
    noShowCount: 3
  };

  const handleStatClick = (statType: string) => {
    logger.log(`Clicked on ${statType} stat`);
    // Implement filtering logic here
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Activity Overview</h2>
        <div className="text-sm text-gray-400">
          Click any card to filter activities
        </div>
      </div>
      
      <ActivityStatsGrid
        stats={mockStats}
        period="vs last month"
        onStatClick={handleStatClick}
      />
    </div>
  );
}

// Integration helper for existing SalesTable component
export function getEnhancedStatsFromActivities(
  currentActivities: any[], 
  previousActivities: any[]
) {
  // Calculate current stats
  const currentRevenue = currentActivities
    .filter(a => a.type === 'sale')
    .reduce((sum, a) => sum + (a.amount || 0), 0);
    
  const currentMeetings = currentActivities.filter(a => a.type === 'meeting');
  const currentProposals = currentActivities.filter(a => a.type === 'proposal');
  const currentSales = currentActivities.filter(a => a.type === 'sale');
  const currentNoShows = currentActivities.filter(a => a.status === 'no-show');
  
  // Calculate previous stats for comparison
  const previousRevenue = previousActivities
    .filter(a => a.type === 'sale')
    .reduce((sum, a) => sum + (a.amount || 0), 0);
    
  const previousMeetings = previousActivities.filter(a => a.type === 'meeting');
  const previousSales = previousActivities.filter(a => a.type === 'sale');
  const previousNoShows = previousActivities.filter(a => a.status === 'no-show');

  return {
    totalRevenue: currentRevenue,
    previousRevenue,
    meetingToProposalRate: currentMeetings.length > 0 
      ? (currentProposals.length / currentMeetings.length) * 100 
      : 0,
    previousMeetingRate: previousMeetings.length > 0
      ? (previousActivities.filter(a => a.type === 'proposal').length / previousMeetings.length) * 100
      : 0,
    proposalWinRate: currentProposals.length > 0
      ? (currentSales.length / currentProposals.length) * 100
      : 0,
    previousWinRate: previousActivities.filter(a => a.type === 'proposal').length > 0
      ? (previousSales.length / previousActivities.filter(a => a.type === 'proposal').length) * 100
      : 0,
    activeDeals: currentSales.length,
    previousDeals: previousSales.length,
    avgDealValue: currentSales.length > 0
      ? currentRevenue / currentSales.length
      : 0,
    previousAvgDeal: previousSales.length > 0
      ? previousRevenue / previousSales.length
      : 0,
    noShowRate: (currentMeetings.length + currentActivities.filter(a => a.type === 'call').length) > 0
      ? (currentNoShows.length / (currentMeetings.length + currentActivities.filter(a => a.type === 'call').length)) * 100
      : 0,
    previousNoShowRate: (previousMeetings.length + previousActivities.filter(a => a.type === 'call').length) > 0
      ? (previousNoShows.length / (previousMeetings.length + previousActivities.filter(a => a.type === 'call').length)) * 100
      : 0,
    totalMeetings: currentMeetings.length + currentActivities.filter(a => a.type === 'call').length,
    noShowCount: currentNoShows.length
  };
}