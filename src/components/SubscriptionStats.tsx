import React, { useEffect } from 'react';
import { Building2, Users, TrendingUp, DollarSign } from 'lucide-react';
import { EnhancedStatCard } from '@/components/ui/enhanced-stat-card';
import { useMRR, MRRSummary } from '@/lib/hooks/useClients';
import { useUser } from '@/lib/hooks/useUser';
import { safeParseFinancial } from '@/lib/utils/financialValidation';

interface SubscriptionStatsProps {
  className?: string;
  onClick?: (cardTitle: string) => void;
}

export function SubscriptionStats({ className, onClick }: SubscriptionStatsProps) {
  const { userData } = useUser();
  const { mrrSummary, isLoading, error, fetchMRRSummary } = useMRR(userData?.id);

  useEffect(() => {
    if (userData?.id) {
      fetchMRRSummary();
    }
  }, [userData?.id, fetchMRRSummary]);

  // Default values when no data is available
  const defaultMRR: MRRSummary = {
    total_clients: 0,
    active_clients: 0,
    churned_clients: 0,
    paused_clients: 0,
    total_mrr: 0,
    avg_mrr: 0,
    min_mrr: 0,
    max_mrr: 0,
    churn_rate: 0,
    active_rate: 100
  };

  // SECURITY: Validate all financial data before display
  const rawStats = mrrSummary || defaultMRR;
  const stats = {
    total_clients: Math.max(0, Math.floor(rawStats.total_clients || 0)),
    active_clients: Math.max(0, Math.floor(rawStats.active_clients || 0)),
    churned_clients: Math.max(0, Math.floor(rawStats.churned_clients || 0)),
    paused_clients: Math.max(0, Math.floor(rawStats.paused_clients || 0)),
    total_mrr: safeParseFinancial(rawStats.total_mrr || 0, 0, { fieldName: 'total_mrr', allowZero: true }),
    avg_mrr: safeParseFinancial(rawStats.avg_mrr || 0, 0, { fieldName: 'avg_mrr', allowZero: true }),
    min_mrr: safeParseFinancial(rawStats.min_mrr || 0, 0, { fieldName: 'min_mrr', allowZero: true }),
    max_mrr: safeParseFinancial(rawStats.max_mrr || 0, 0, { fieldName: 'max_mrr', allowZero: true }),
    churn_rate: Math.max(0, Math.min(100, safeParseFinancial(rawStats.churn_rate || 0, 0, { fieldName: 'churn_rate', allowZero: true }))),
    active_rate: Math.max(0, Math.min(100, safeParseFinancial(rawStats.active_rate || 100, 100, { fieldName: 'active_rate', allowZero: false })))
  };

  // Calculate trends (placeholder for now - would need historical data)
  const mrrTrend = 12; // +12% month over month
  const clientTrend = 8;  // +8% new clients
  const churnTrend = -15; // -15% churn rate (improvement)
  const avgTrend = 5;     // +5% average value

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', { 
      style: 'currency', 
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-5 border border-gray-800/50 animate-pulse">
            <div className="h-4 bg-gray-700 rounded w-3/4 mb-3"></div>
            <div className="h-8 bg-gray-700 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-500/10 border border-red-500/20 rounded-xl p-4 ${className}`}>
        <p className="text-red-400 text-sm">Error loading subscription stats: {error}</p>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
      <EnhancedStatCard
        title="Total MRR"
        primaryValue={formatCurrency(stats.total_mrr)}
        trendPercentage={mrrTrend}
        periodContext="vs last month"
        icon={DollarSign}
        color="emerald"
        onClick={() => onClick?.('Total MRR')}
      />
      
      <EnhancedStatCard
        title="Active Clients"
        primaryValue={stats.active_clients}
        secondaryValue={`${stats.total_clients} total clients`}
        percentageValue={stats.active_rate}
        trendPercentage={clientTrend}
        periodContext="vs last month"
        icon={Users}
        color="blue"
        onClick={() => onClick?.('Active Clients')}
      />
      
      <EnhancedStatCard
        title="Avg Client Value"
        primaryValue={formatCurrency(stats.avg_mrr)}
        secondaryValue={`Range: ${formatCurrency(stats.min_mrr)} - ${formatCurrency(stats.max_mrr)}`}
        trendPercentage={avgTrend}
        periodContext="vs last month"
        icon={TrendingUp}
        color="violet"
        onClick={() => onClick?.('Avg Client Value')}
      />
      
      <EnhancedStatCard
        title="Monthly Churn"
        primaryValue={`${stats.churn_rate.toFixed(1)}%`}
        secondaryValue={`${stats.churned_clients} churned clients`}
        trendPercentage={churnTrend}
        periodContext="vs last month"
        icon={Building2}
        color="orange"
        variant="no-show"
        onClick={() => onClick?.('Monthly Churn')}
      />
    </div>
  );
}