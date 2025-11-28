/**
 * Usage Overview Component
 *
 * Shows aggregated usage statistics across all customers
 */

import { useMemo } from 'react';
import { Zap, Video, HardDrive, Users, TrendingUp, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CustomerWithDetails } from '@/lib/types/saasAdmin';

interface UsageOverviewProps {
  customers: CustomerWithDetails[];
  isLoading: boolean;
}

export function UsageOverview({ customers, isLoading }: UsageOverviewProps) {
  // Calculate aggregated stats
  const stats = useMemo(() => {
    const totals = {
      meetings: 0,
      ai_tokens: 0,
      storage_mb: 0,
      active_users: 0,
    };

    const overLimit: CustomerWithDetails[] = [];

    customers.forEach((customer) => {
      const usage = customer.current_usage;
      if (usage) {
        totals.meetings += usage.meetings_count;
        totals.ai_tokens += usage.ai_tokens_used;
        totals.storage_mb += usage.storage_used_mb;
        totals.active_users += usage.active_users_count;
      }

      // Check for customers over their limits
      const limits = {
        meetings:
          customer.subscription?.custom_max_meetings || customer.plan?.max_meetings_per_month,
        tokens:
          customer.subscription?.custom_max_ai_tokens || customer.plan?.max_ai_tokens_per_month,
        storage: customer.subscription?.custom_max_storage_mb || customer.plan?.max_storage_mb,
      };

      if (
        (limits.meetings && (usage?.meetings_count || 0) > limits.meetings) ||
        (limits.tokens && (usage?.ai_tokens_used || 0) > limits.tokens) ||
        (limits.storage && (usage?.storage_used_mb || 0) > limits.storage)
      ) {
        overLimit.push(customer);
      }
    });

    return { totals, overLimit };
  }, [customers]);

  // Sort customers by usage for top users lists
  const topByMeetings = useMemo(
    () =>
      [...customers]
        .sort((a, b) => (b.current_usage?.meetings_count || 0) - (a.current_usage?.meetings_count || 0))
        .slice(0, 5),
    [customers]
  );

  const topByTokens = useMemo(
    () =>
      [...customers]
        .sort((a, b) => (b.current_usage?.ai_tokens_used || 0) - (a.current_usage?.ai_tokens_used || 0))
        .slice(0, 5),
    [customers]
  );

  const topByStorage = useMemo(
    () =>
      [...customers]
        .sort((a, b) => (b.current_usage?.storage_used_mb || 0) - (a.current_usage?.storage_used_mb || 0))
        .slice(0, 5),
    [customers]
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800 animate-pulse"
            >
              <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/2 mb-4" />
              <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Aggregated Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          icon={Video}
          label="Total Meetings"
          value={stats.totals.meetings.toLocaleString()}
          color="text-blue-500"
          bgColor="bg-blue-500/10"
        />
        <StatCard
          icon={Zap}
          label="Total AI Tokens"
          value={stats.totals.ai_tokens.toLocaleString()}
          color="text-purple-500"
          bgColor="bg-purple-500/10"
        />
        <StatCard
          icon={HardDrive}
          label="Total Storage"
          value={`${(stats.totals.storage_mb / 1024).toFixed(1)} GB`}
          color="text-amber-500"
          bgColor="bg-amber-500/10"
        />
        <StatCard
          icon={Users}
          label="Active Users"
          value={stats.totals.active_users.toLocaleString()}
          color="text-emerald-500"
          bgColor="bg-emerald-500/10"
        />
      </div>

      {/* Over Limit Alert */}
      {stats.overLimit.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <div className="flex items-center gap-3 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="w-5 h-5" />
            <div>
              <p className="font-medium">{stats.overLimit.length} customers are over their limits</p>
              <p className="text-sm mt-1">
                {stats.overLimit.map((c) => c.name).join(', ')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Top Users Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <TopUsersCard
          title="Top by Meetings"
          icon={Video}
          customers={topByMeetings}
          getValue={(c) => c.current_usage?.meetings_count || 0}
          formatValue={(v) => `${v} meetings`}
        />
        <TopUsersCard
          title="Top by AI Tokens"
          icon={Zap}
          customers={topByTokens}
          getValue={(c) => c.current_usage?.ai_tokens_used || 0}
          formatValue={(v) => `${v.toLocaleString()} tokens`}
        />
        <TopUsersCard
          title="Top by Storage"
          icon={HardDrive}
          customers={topByStorage}
          getValue={(c) => c.current_usage?.storage_used_mb || 0}
          formatValue={(v) => `${v.toLocaleString()} MB`}
        />
      </div>
    </div>
  );
}

// Stat Card Component
interface StatCardProps {
  icon: typeof Video;
  label: string;
  value: string;
  color: string;
  bgColor: string;
}

function StatCard({ icon: Icon, label, value, color, bgColor }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <div className={cn('p-2 rounded-lg', bgColor)}>
          <Icon className={cn('w-5 h-5', color)} />
        </div>
        <TrendingUp className="w-4 h-4 text-emerald-500" />
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{value}</p>
    </div>
  );
}

// Top Users Card Component
interface TopUsersCardProps {
  title: string;
  icon: typeof Video;
  customers: CustomerWithDetails[];
  getValue: (customer: CustomerWithDetails) => number;
  formatValue: (value: number) => string;
}

function TopUsersCard({ title, icon: Icon, customers, getValue, formatValue }: TopUsersCardProps) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-5 h-5 text-gray-400" />
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      </div>
      <div className="space-y-3">
        {customers.map((customer, index) => {
          const value = getValue(customer);
          const maxValue = getValue(customers[0]) || 1;
          const percentage = (value / maxValue) * 100;

          return (
            <div key={customer.id} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700 dark:text-gray-300 truncate">
                  {index + 1}. {customer.name}
                </span>
                <span className="text-gray-500 dark:text-gray-400">{formatValue(value)}</span>
              </div>
              <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
        {customers.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
            No usage data available
          </p>
        )}
      </div>
    </div>
  );
}

export default UsageOverview;
