import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp, Crown, BarChart2, DollarSign, Gift, Zap, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase/clientV2';
import { getTierForPosition } from '@/lib/types/waitlist';

interface LeaderboardEntry {
  id: string;
  full_name: string;
  referral_count: number;
  linkedin_boost_claimed: boolean;
  twitter_boost_claimed: boolean;
  total_points: number;
  effective_position: number;
  profile_image_url: string | null;
}

interface LeaderboardProps {
  currentUserId: string;
}

export function Leaderboard({ currentUserId }: LeaderboardProps) {
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [currentUserEntry, setCurrentUserEntry] = useState<LeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLeaderboard();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`leaderboard:${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meetings_waitlist'
        },
        () => {
          // Debounce to avoid too many refreshes
          setTimeout(() => {
            loadLeaderboard();
          }, 300);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  const loadLeaderboard = async () => {
    try {
      // Load top 10
      const { data: topData, error: topError } = await (supabase as any)
        .from('meetings_waitlist')
        .select('id, full_name, referral_count, linkedin_boost_claimed, twitter_boost_claimed, total_points, effective_position, profile_image_url')
        .order('total_points', { ascending: false })
        .limit(10);

      if (topError) throw topError;

      setLeaders(topData || []);

      // Check if current user is in top 10
      const userInTop10 = topData?.some((entry: any) => entry.id === currentUserId);

      // If not in top 10, fetch current user's data
      if (!userInTop10 && currentUserId) {
        const { data: userData, error: userError } = await (supabase as any)
          .from('meetings_waitlist')
          .select('id, full_name, referral_count, linkedin_boost_claimed, twitter_boost_claimed, total_points, effective_position, profile_image_url')
          .eq('id', currentUserId)
          .single();

        if (!userError && userData) {
          setCurrentUserEntry(userData);
        }
      } else {
        setCurrentUserEntry(null);
      }
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const anonymizeName = (fullName: string) => {
    const parts = fullName.trim().split(' ');
    if (parts.length === 0) return 'Anonymous';
    const firstName = parts[0];
    const lastInitial = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return `${firstName} ${lastInitial}.`;
  };

  const getMedalIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return `#${rank}`;
    }
  };

  const getPrizeInfo = (rank: number) => {
    switch (rank) {
      case 1:
        return { icon: DollarSign, text: '$600 + Annual', color: 'text-yellow-400', bg: 'bg-yellow-500/10' };
      case 2:
        return { icon: Crown, text: 'Annual Sub', color: 'text-gray-300', bg: 'bg-gray-500/10' };
      case 3:
        return { icon: Trophy, text: '6-Month Sub', color: 'text-orange-400', bg: 'bg-orange-500/10' };
      case 4:
      case 5:
      case 6:
        return { icon: Gift, text: '3-Month Sub', color: 'text-blue-400', bg: 'bg-blue-500/10' };
      case 7:
      case 8:
      case 9:
        return { icon: Zap, text: '60-Day Trial', color: 'text-purple-400', bg: 'bg-purple-500/10' };
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div
        className="rounded-xl overflow-hidden flex flex-col h-full max-h-[600px] bg-white dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 shadow-sm dark:shadow-none transition-colors duration-300"
      >
        <div className="p-5 text-center">
          <div className="animate-pulse text-gray-500 dark:text-gray-400 text-sm">Loading leaderboard...</div>
        </div>
      </div>
    );
  }

  if (leaders.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.2, duration: 0.8 }}
      className="rounded-xl overflow-hidden flex flex-col h-full max-h-[600px] bg-white dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 shadow-sm dark:shadow-none transition-colors duration-300"
    >
      {/* Header */}
      <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-yellow-500" />
          Top Referrers
        </h3>
        <span className="text-xs text-gray-500 flex items-center gap-1">
          <BarChart2 className="w-3 h-3" />
          Live
        </span>
      </div>

      {/* Leaderboard List */}
      <div className="p-2 space-y-1 overflow-y-auto" style={{ maxHeight: '450px' }}>
        {leaders.map((leader, index) => {
          const tier = getTierForPosition(leader.effective_position);
          const isCurrentUser = leader.id === currentUserId;
          const prizeInfo = getPrizeInfo(index + 1);

          return (
            <motion.div
              key={leader.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.3 + (index * 0.05) }}
              className={`
                flex items-center justify-between p-3 rounded-lg transition-colors group
                ${isCurrentUser
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500/50 relative overflow-hidden shadow-lg shadow-blue-500/20'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800/50'
                }
              `}
            >
              {/* Gradient Overlay for current user */}
              {isCurrentUser && (
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-transparent"></div>
              )}

              {/* Rank & Name */}
              <div className="flex items-center gap-3 relative z-10">
                {/* Profile Initials */}
                <div className="relative">
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${isCurrentUser ? 'from-blue-500 to-blue-600 ring-2 ring-blue-400/50' : 'from-blue-500 to-purple-600'} flex items-center justify-center text-white font-semibold text-sm`}>
                    {leader.full_name.split(' ').map(n => n[0]).join('')}
                  </div>
                  {/* Rank Badge */}
                  <div className={`
                    absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold
                    ${index === 0
                      ? 'bg-yellow-500 text-yellow-900'
                      : index === 1
                      ? 'bg-gray-300 text-gray-800'
                      : index === 2
                      ? 'bg-orange-600 text-white'
                      : isCurrentUser
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }
                  `}>
                    {index + 1}
                  </div>
                </div>
                <div className="flex-1">
                  <div className={`text-sm font-medium ${isCurrentUser ? 'text-blue-700 dark:text-blue-100' : 'text-gray-800 dark:text-gray-200'}`}>
                    {anonymizeName(leader.full_name)}
                    {isCurrentUser && (
                      <span className="ml-2 text-xs text-blue-600 dark:text-blue-300 font-bold">(You)</span>
                    )}
                  </div>
                  <div className={`text-xs flex items-center gap-1 ${isCurrentUser ? 'text-blue-500/70 dark:text-blue-300/70' : 'text-gray-500'}`}>
                    {index === 0 && <Crown className="w-3 h-3 text-yellow-500/50" />}
                    {tier.name}
                  </div>
                  {/* Prize Badge for Top 9 */}
                  {prizeInfo && (
                    <div className={`text-[10px] flex items-center gap-1 mt-1 ${prizeInfo.color}`}>
                      <prizeInfo.icon className="w-3 h-3" />
                      <span className="font-medium">{prizeInfo.text}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Stats: Shares + Referrals = Total Points */}
              <div className="text-right relative z-10 space-y-1 flex-shrink-0">
                <div className="hidden sm:flex items-center justify-end gap-2">
                  <div className="text-xs text-gray-500">
                    {(leader.linkedin_boost_claimed ? 1 : 0) + (leader.twitter_boost_claimed ? 1 : 0)} shares
                  </div>
                  <div className="text-gray-400 dark:text-gray-600">•</div>
                  <div className="text-xs text-gray-500">
                    {leader.referral_count} referrals
                  </div>
                </div>
                <div className="sm:hidden text-[10px] text-gray-500">
                  {leader.referral_count} refs
                </div>
                <div className={`text-base sm:text-lg font-bold ${isCurrentUser ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {leader.total_points} pts
                </div>
              </div>
            </motion.div>
          );
        })}

        {/* Your Position Card - Shows when user is outside top 10 */}
        {currentUserEntry && (
          <>
            {/* Separator */}
            <div className="flex items-center gap-2 py-2">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-700 to-transparent"></div>
              <span className="text-xs text-gray-500 font-medium">Your Position</span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-700 to-transparent"></div>
            </div>

            {/* Current User Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.8, duration: 0.5, type: 'spring' }}
              className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-blue-100 dark:from-blue-900/30 to-blue-50 dark:to-blue-800/20 border-2 border-blue-500/50 relative overflow-hidden shadow-lg shadow-blue-500/20"
            >
              {/* Animated Gradient Overlay */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-blue-500/5 to-transparent"
                animate={{
                  x: ['-100%', '100%']
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: 'linear'
                }}
              ></motion.div>

              {/* Rank & Name */}
              <div className="flex items-center gap-3 relative z-10">
                {/* Profile Initials with pulsing effect */}
                <div className="relative">
                  <motion.div
                    className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold text-sm ring-2 ring-blue-400/50"
                    animate={{
                      boxShadow: [
                        '0 0 0 0 rgba(59, 130, 246, 0.4)',
                        '0 0 0 8px rgba(59, 130, 246, 0)',
                        '0 0 0 0 rgba(59, 130, 246, 0)'
                      ]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'easeInOut'
                    }}
                  >
                    {currentUserEntry.full_name.split(' ').map(n => n[0]).join('')}
                  </motion.div>
                  {/* Position Badge */}
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-white dark:ring-gray-900">
                    #{currentUserEntry.effective_position}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-blue-700 dark:text-blue-100">
                    {anonymizeName(currentUserEntry.full_name)}
                    <span className="ml-2 text-xs text-blue-600 dark:text-blue-300 font-bold">(You)</span>
                  </div>
                  <div className="text-xs text-blue-500/70 dark:text-blue-300/70 flex items-center gap-1">
                    {getTierForPosition(currentUserEntry.effective_position).name}
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="text-right relative z-10 space-y-1 flex-shrink-0">
                <div className="hidden sm:flex items-center justify-end gap-2">
                  <div className="text-xs text-blue-500/70 dark:text-blue-300/70">
                    {(currentUserEntry.linkedin_boost_claimed ? 1 : 0) + (currentUserEntry.twitter_boost_claimed ? 1 : 0)} shares
                  </div>
                  <div className="text-blue-400/50">•</div>
                  <div className="text-xs text-blue-500/70 dark:text-blue-300/70">
                    {currentUserEntry.referral_count} referrals
                  </div>
                </div>
                <div className="sm:hidden text-[10px] text-blue-500/70 dark:text-blue-300/70">
                  {currentUserEntry.referral_count} refs
                </div>
                <div className="text-base sm:text-lg font-bold text-blue-600 dark:text-blue-400">
                  {currentUserEntry.total_points} pts
                </div>
              </div>
            </motion.div>
          </>
        )}
      </div>

      {/* Footer Message with Disclaimer */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30 space-y-2">
        <p className="text-xs text-gray-500 text-center">Keep referring to climb the leaderboard</p>
        <div className="flex items-start gap-2 justify-center">
          <div className="flex-shrink-0 w-1 h-1 bg-yellow-500 rounded-full mt-1"></div>
          <p className="text-[10px] text-gray-500 text-center max-w-xs">
            <span className="text-yellow-500 font-semibold">Note:</span> All shares and referrals will be verified before awarding prizes
          </p>
        </div>
      </div>
    </motion.div>
  );
}
