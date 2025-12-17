import { motion } from 'framer-motion';
import { Trophy, Gift, Zap, Crown, DollarSign, Calendar, Sparkles } from 'lucide-react';

export function LeaderboardRewards() {
  const rewards = [
    {
      position: 1,
      title: '$600 Cash Prize',
      subtitle: 'Plus free annual subscription',
      icon: DollarSign,
      gradient: 'from-yellow-500 to-amber-600',
      glow: 'shadow-yellow-500/50'
    },
    {
      position: 2,
      title: 'Free Annual Subscription',
      subtitle: 'Worth $1,200/year',
      icon: Crown,
      gradient: 'from-gray-300 to-gray-500',
      glow: 'shadow-gray-400/50'
    },
    {
      position: 3,
      title: 'Free 6-Month Subscription',
      subtitle: 'Worth $600',
      icon: Trophy,
      gradient: 'from-orange-500 to-orange-700',
      glow: 'shadow-orange-500/50'
    },
    {
      position: '4-6',
      title: 'Free 3-Month Subscription',
      subtitle: 'Worth $300',
      icon: Gift,
      gradient: 'from-blue-500 to-blue-700',
      glow: 'shadow-blue-500/30'
    },
    {
      position: '7-9',
      title: '60-Day Extended Trial',
      subtitle: 'Premium features included',
      icon: Zap,
      gradient: 'from-purple-500 to-purple-700',
      glow: 'shadow-purple-500/30'
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.6 }}
      className="relative overflow-hidden rounded-2xl"
      style={{
        background: 'rgba(17, 24, 39, 0.8)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(55, 65, 81, 0.5)'
      }}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-800 bg-gradient-to-r from-yellow-500/10 via-purple-500/10 to-blue-500/10">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-5 h-5 text-yellow-500" />
          <h3 className="font-heading text-lg font-bold text-gray-100">Top 9 Rewards</h3>
        </div>
        <p className="text-xs text-gray-400">
          Climb the leaderboard to win amazing prizes!
        </p>
      </div>

      {/* Rewards List */}
      <div className="p-4 space-y-3">
        {rewards.map((reward, index) => {
          const Icon = reward.icon;
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + (index * 0.1), duration: 0.4 }}
              className="relative group"
            >
              <div
                className={`p-3 rounded-xl bg-gradient-to-r ${reward.gradient} bg-opacity-10 border border-white/10 hover:border-white/20 transition-all duration-300`}
              >
                <div className="flex items-center gap-3">
                  {/* Position Badge */}
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br ${reward.gradient} flex items-center justify-center text-white font-bold text-sm shadow-lg ${reward.glow}`}>
                    {typeof reward.position === 'number' ? `#${reward.position}` : reward.position}
                  </div>

                  {/* Reward Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <h4 className="text-sm font-bold text-gray-100 truncate">
                        {reward.title}
                      </h4>
                    </div>
                    <p className="text-xs text-gray-500">
                      {reward.subtitle}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Disclaimer */}
      <div className="p-4 border-t border-gray-800 bg-gray-900/30">
        <div className="flex items-start gap-2">
          <div className="flex-shrink-0 w-1 h-1 bg-yellow-500 rounded-full mt-1.5"></div>
          <p className="text-[10px] text-gray-500 leading-relaxed">
            <span className="text-yellow-500 font-semibold">Important:</span> Shares and referrals will be verified before awarding prizes.
            Winners must have genuine engagement and active referrals to qualify.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
