import { Users, Clock, CheckCircle, TrendingUp } from 'lucide-react';
import type { WaitlistStats } from '@/lib/types/waitlist';

interface WaitlistStatsProps {
  stats: WaitlistStats | null;
  isLoading: boolean;
}

export function WaitlistStats({ stats, isLoading }: WaitlistStatsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div 
            key={i} 
            className="bg-white dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 rounded-xl p-6 animate-pulse shadow-sm dark:shadow-none"
          >
            <div className="h-12 w-12 bg-gray-200 dark:bg-gray-800 rounded-lg mb-4" />
            <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded mb-2 w-20" />
            <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const statCards = [
    {
      title: 'Total Signups',
      value: stats.total_signups,
      icon: Users,
      iconColor: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-500/10'
    },
    {
      title: 'Pending',
      value: stats.pending_count,
      icon: Clock,
      iconColor: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-50 dark:bg-yellow-500/10'
    },
    {
      title: 'Released',
      value: stats.released_count,
      icon: CheckCircle,
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-50 dark:bg-emerald-500/10'
    },
    {
      title: 'Avg Referrals',
      value: stats.avg_referrals,
      icon: TrendingUp,
      iconColor: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-50 dark:bg-purple-500/10'
    }
  ];

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {statCards.map((card, i) => (
          <div 
            key={i} 
            className="bg-white dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 rounded-xl p-6 shadow-sm dark:shadow-none hover:shadow-md dark:hover:shadow-none transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 rounded-lg ${card.bgColor} flex items-center justify-center`}>
                <card.icon className={`w-6 h-6 ${card.iconColor}`} />
              </div>
            </div>
            <div className="text-gray-500 dark:text-gray-400 text-sm mb-1">{card.title}</div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">{card.value}</div>
          </div>
        ))}
      </div>

      {/* Additional Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 rounded-xl p-4 shadow-sm dark:shadow-none">
          <div className="text-gray-500 dark:text-gray-400 text-sm mb-1">Last 7 Days</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.signups_last_7_days} signups</div>
        </div>
        <div className="bg-white dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 rounded-xl p-4 shadow-sm dark:shadow-none">
          <div className="text-gray-500 dark:text-gray-400 text-sm mb-1">Last 30 Days</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.signups_last_30_days} signups</div>
        </div>
      </div>
    </div>
  );
}

// Keep the old name for backwards compatibility
export { WaitlistStats as WaitlistStatsComponent };
