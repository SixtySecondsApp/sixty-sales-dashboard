import { Users, Clock, CheckCircle, TrendingUp } from 'lucide-react';
import type { WaitlistStats } from '@/lib/types/waitlist';

interface WaitlistStatsProps {
  stats: WaitlistStats | null;
  isLoading: boolean;
}

export function WaitlistStatsComponent({ stats, isLoading }: WaitlistStatsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white/5 border border-white/10 rounded-lg p-6 animate-pulse">
            <div className="h-12 w-12 bg-white/10 rounded-lg mb-4" />
            <div className="h-4 bg-white/10 rounded mb-2" />
            <div className="h-8 bg-white/10 rounded" />
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
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-500/10'
    },
    {
      title: 'Pending',
      value: stats.pending_count,
      icon: Clock,
      color: 'from-yellow-500 to-yellow-600',
      bgColor: 'bg-yellow-500/10'
    },
    {
      title: 'Released',
      value: stats.released_count,
      icon: CheckCircle,
      color: 'from-emerald-500 to-emerald-600',
      bgColor: 'bg-emerald-500/10'
    },
    {
      title: 'Avg Referrals',
      value: stats.avg_referrals,
      icon: TrendingUp,
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-500/10'
    }
  ];

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {statCards.map((card, i) => (
          <div key={i} className="bg-white/5 border border-white/10 rounded-lg p-6 hover:bg-white/10 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 rounded-lg ${card.bgColor} flex items-center justify-center`}>
                <card.icon className={`w-6 h-6 bg-gradient-to-r ${card.color} bg-clip-text text-transparent`} />
              </div>
            </div>
            <div className="text-gray-400 text-sm mb-1">{card.title}</div>
            <div className="text-3xl font-bold text-white">{card.value}</div>
          </div>
        ))}
      </div>

      {/* Additional Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-1">Last 7 Days</div>
          <div className="text-2xl font-bold text-white">{stats.signups_last_7_days} signups</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-1">Last 30 Days</div>
          <div className="text-2xl font-bold text-white">{stats.signups_last_30_days} signups</div>
        </div>
      </div>
    </div>
  );
}
