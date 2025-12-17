import { useEffect, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import { TrendingUp, Crown, Star, Target } from 'lucide-react';
import { getTierForPosition } from '@/lib/types/waitlist';
import type { WaitlistEntry } from '@/lib/types/waitlist';

interface PositionDisplayProps {
  entry: WaitlistEntry;
  previousPosition?: number;
  onMilestone?: (type: string) => void;
}

export function PositionDisplay({ entry, previousPosition, onMilestone }: PositionDisplayProps) {
  const [displayPosition, setDisplayPosition] = useState(entry.effective_position || 0);
  const tier = getTierForPosition(entry.effective_position || 0);

  // Animated position counter
  const springValue = useSpring(displayPosition, {
    stiffness: 50,
    damping: 20,
    mass: 1
  });

  const roundedPosition = useTransform(springValue, (value) => Math.round(value));

  useEffect(() => {
    if (previousPosition && previousPosition !== entry.effective_position) {
      // Trigger top 50 milestone when crossing the threshold
      if (entry.effective_position && entry.effective_position <= 50 && previousPosition > 50 && onMilestone) {
        onMilestone('top_50');
      }
    }

    springValue.set(entry.effective_position || 0);
    setDisplayPosition(entry.effective_position || 0);
  }, [entry.effective_position, previousPosition, springValue, onMilestone]);

  // Tier-specific colors
  const tierColors = {
    VIP: {
      gradient: 'from-yellow-400 via-yellow-500 to-amber-600',
      glow: 'shadow-yellow-500/50',
      ring: 'stroke-yellow-400',
      bg: 'from-yellow-500/10 to-amber-500/10'
    },
    Priority: {
      gradient: 'from-gray-300 via-gray-400 to-gray-500',
      glow: 'shadow-gray-400/50',
      ring: 'stroke-gray-300',
      bg: 'from-gray-400/10 to-gray-500/10'
    },
    'Early Bird': {
      gradient: 'from-orange-400 via-amber-600 to-orange-700',
      glow: 'shadow-orange-500/50',
      ring: 'stroke-orange-400',
      bg: 'from-orange-500/10 to-amber-600/10'
    }
  };

  const colors = tierColors[tier.name];

  const getTierIcon = () => {
    switch (tier.name) {
      case 'VIP':
        return <Crown className="w-6 h-6 text-yellow-400" />;
      case 'Priority':
        return <Star className="w-6 h-6 text-gray-300" />;
      case 'Early Bird':
        return <Target className="w-6 h-6 text-orange-400" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.8 }}
      className="relative overflow-hidden group rounded-2xl p-6 md:p-8 bg-white dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 shadow-sm dark:shadow-none transition-all duration-300"
    >
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-50"></div>

      <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-6">
        {/* Rank Circle */}
        <div className="flex-shrink-0">
          <div className="w-24 h-24 rounded-full flex flex-col items-center justify-center border-2 border-yellow-400/30 dark:border-yellow-500/30 bg-gradient-to-b from-yellow-400/10 dark:from-yellow-500/10 to-transparent shadow-lg shadow-yellow-500/10 dark:shadow-yellow-500/20">
            <span className="text-xs text-yellow-600 dark:text-yellow-500/80 font-medium uppercase tracking-wider">Rank</span>
            <span className="text-4xl font-bold text-yellow-600 dark:text-yellow-500">
              #<motion.span>{roundedPosition}</motion.span>
            </span>
          </div>
        </div>

        {/* Tier Info */}
        <div className="flex-1 text-center md:text-left space-y-4">
          <div>
            <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
              {getTierIcon()}
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{tier.name} Tier</h2>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Your current status grants maximum priority.</p>
          </div>

          {/* Points and Referrals Stats */}
          <div className="grid grid-cols-2 gap-4 py-3 border-y border-gray-200 dark:border-gray-800">
            <div className="text-center md:text-left">
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{entry.total_points || 0}</div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">Total Points</div>
            </div>
            <div className="text-center md:text-left">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{entry.referral_count}</div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">Referrals</div>
            </div>
          </div>

          {/* Benefits Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {tier.benefits.map((benefit, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + (idx * 0.1) }}
                className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
              >
                <div className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                </div>
                <span>{benefit}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Position Change Indicator */}
      {previousPosition && previousPosition !== entry.effective_position && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="mt-4 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20"
        >
          <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
            Jumped {previousPosition - (entry.effective_position || 0)} points!
          </span>
        </motion.div>
      )}

      {/* Original Position Note */}
      {entry.signup_position && entry.signup_position !== entry.effective_position && (
        <div className="mt-4 text-center text-xs text-gray-500">
          Original position: #{entry.signup_position}
        </div>
      )}
    </motion.div>
  );
}
