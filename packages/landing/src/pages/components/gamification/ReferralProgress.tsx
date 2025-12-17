import { motion } from 'framer-motion';
import { Crown, Star, Target, ArrowUp } from 'lucide-react';
import { getTierForPosition, getSpotsToNextTier, getProgressToNextTier, TIER_CONFIG } from '@/lib/types/waitlist';

interface ReferralProgressProps {
  currentPosition: number;
  referralCount: number;
}

export function ReferralProgress({ currentPosition, referralCount }: ReferralProgressProps) {
  const currentTier = getTierForPosition(currentPosition);
  const spotsToNext = getSpotsToNextTier(currentPosition);
  const progressPercent = getProgressToNextTier(currentPosition);

  const tierIcons = {
    VIP: Crown,
    Priority: Star,
    'Early Bird': Target
  };

  const tierColors = {
    VIP: {
      bg: 'bg-yellow-500/20',
      border: 'border-yellow-500/50',
      text: 'text-yellow-400',
      gradient: 'from-yellow-400 to-amber-500'
    },
    Priority: {
      bg: 'bg-gray-400/20',
      border: 'border-gray-400/50',
      text: 'text-gray-300',
      gradient: 'from-gray-300 to-gray-400'
    },
    'Early Bird': {
      bg: 'bg-orange-500/20',
      border: 'border-orange-500/50',
      text: 'text-orange-400',
      gradient: 'from-orange-400 to-amber-600'
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.0, duration: 0.8 }}
      className="space-y-4"
    >
      {/* Current Tier Card */}
      <div className={`${tierColors[currentTier.name].bg} border ${tierColors[currentTier.name].border} rounded-xl p-4`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${tierColors[currentTier.name].gradient} flex items-center justify-center shadow-lg`}>
              {tierIcons[currentTier.name] && (
                (() => {
                  const IconComponent = tierIcons[currentTier.name];
                  return <IconComponent className="w-5 h-5 text-white" />;
                })()
              )}
            </div>
            <div>
              <h3 className={`font-heading text-lg font-bold ${tierColors[currentTier.name].text}`}>
                {currentTier.name} Tier
              </h3>
              <p className="text-xs text-gray-400">Your current status</p>
            </div>
          </div>
          <div className="text-2xl">{currentTier.badge}</div>
        </div>

        {/* Benefits */}
        <div className="space-y-2">
          {currentTier.benefits.map((benefit, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.2 + (index * 0.1) }}
              className="flex items-center gap-2 text-sm text-gray-300"
            >
              <div className={`w-1.5 h-1.5 rounded-full ${tierColors[currentTier.name].gradient}`} />
              <span>{benefit}</span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Progress to Next Tier */}
      {spotsToNext !== null && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.3, duration: 0.8 }}
          className="bg-white/5 border border-white/10 rounded-xl p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ArrowUp className="w-4 h-4 text-blue-400" />
              <h4 className="font-heading text-sm font-bold text-white">Progress to Next Tier</h4>
            </div>
            <span className="text-xs text-gray-400">
              {spotsToNext} spots to go
            </span>
          </div>

          {/* Segmented Progress Bar */}
          <div className="relative h-2 bg-white/10 rounded-full overflow-hidden mb-2">
            {/* Tier Markers */}
            <div className="absolute inset-0 flex">
              {TIER_CONFIG.slice(0, -1).map((tier, index) => {
                const currentTierIndex = TIER_CONFIG.findIndex(t => t.name === currentTier.name);
                const isPassed = index < TIER_CONFIG.length - 1 - currentTierIndex;

                return (
                  <div
                    key={tier.name}
                    className="relative flex-1 border-r border-white/20 last:border-r-0"
                  >
                    {isPassed && (
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Animated Progress Fill */}
            <motion.div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-purple-500"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 1.5, ease: 'easeOut' }}
              style={{
                boxShadow: '0 0 20px rgba(59, 130, 246, 0.5)'
              }}
            />

            {/* Particle effects along progress */}
            <motion.div
              className="absolute inset-y-0 left-0 overflow-hidden"
              style={{ width: `${progressPercent}%` }}
            >
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-1 h-full bg-white/60"
                  initial={{ left: '-2%' }}
                  animate={{
                    left: '102%',
                    opacity: [0, 1, 0]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: i * 0.7,
                    ease: 'linear'
                  }}
                />
              ))}
            </motion.div>
          </div>

          {/* Next Tier Preview */}
          {TIER_CONFIG.findIndex(t => t.name === currentTier.name) > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Next:</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white">
                  {TIER_CONFIG[TIER_CONFIG.findIndex(t => t.name === currentTier.name) - 1].name}
                </span>
                <span className="text-2xl">
                  {TIER_CONFIG[TIER_CONFIG.findIndex(t => t.name === currentTier.name) - 1].badge}
                </span>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* At Top Tier Message */}
      {spotsToNext === null && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.3, duration: 0.5 }}
          className="bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-500/50 rounded-xl p-6 text-center"
        >
          <div className="text-4xl mb-2">🎉</div>
          <h4 className="font-heading text-xl font-bold text-yellow-400 mb-2">You're at the Top!</h4>
          <p className="text-sm text-gray-300">
            You're in the VIP tier with maximum priority access and benefits.
          </p>
        </motion.div>
      )}

      {/* Referral Impact */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6 }}
        className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center"
      >
        <p className="text-sm text-gray-300 mb-1">
          Refer friends to jump ahead faster
        </p>
        <p className="text-emerald-400 font-semibold">
          <span className="text-2xl">{referralCount}</span> referrals = <span className="text-2xl">{referralCount * 5}</span> spots gained
        </p>
      </motion.div>
    </motion.div>
  );
}
