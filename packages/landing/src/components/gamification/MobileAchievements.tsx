import { motion } from 'framer-motion';
import { Award, Share2, Users, Crown, Zap, Lock, Target, TrendingUp, Linkedin, Twitter } from 'lucide-react';
import type { MilestoneType } from '@/lib/types/waitlist';

interface Achievement {
  type: MilestoneType | 'linkedin_boost' | 'twitter_boost' | 'top_100' | 'referral_10';
  title: string;
  description: string;
  unlockCondition: string;
  icon: React.ReactNode;
  unlocked: boolean;
  progress: number;
  progressText: string;
  color: string;
}

interface MobileAchievementsProps {
  referralCount: number;
  effectivePosition: number;
  hasShared: boolean;
  linkedInBoostClaimed?: boolean;
  twitterBoostClaimed?: boolean;
  totalPoints?: number;
}

export function MobileAchievements({
  referralCount,
  effectivePosition,
  hasShared,
  linkedInBoostClaimed = false,
  twitterBoostClaimed = false,
  totalPoints = 0
}: MobileAchievementsProps) {
  const achievements: Achievement[] = [
    {
      type: 'first_share',
      title: 'Ambassador',
      description: 'Share your referral link',
      unlockCondition: 'Copy and share now!',
      icon: <Share2 className="w-8 h-8" />,
      unlocked: hasShared,
      progress: hasShared ? 100 : 0,
      progressText: hasShared ? '✓ Complete' : 'Start now',
      color: 'from-blue-500 to-blue-600'
    },
    {
      type: 'linkedin_boost',
      title: 'LinkedIn Pro',
      description: '+50 boost from LinkedIn',
      unlockCondition: 'Share on LinkedIn!',
      icon: <Linkedin className="w-8 h-8" />,
      unlocked: linkedInBoostClaimed,
      progress: linkedInBoostClaimed ? 100 : 0,
      progressText: linkedInBoostClaimed ? '+50!' : 'Get boost',
      color: 'from-yellow-500 to-orange-500'
    },
    {
      type: 'twitter_boost',
      title: 'X Influencer',
      description: '+50 boost from Twitter/X',
      unlockCondition: 'Share on X/Twitter!',
      icon: <Twitter className="w-8 h-8" />,
      unlocked: twitterBoostClaimed,
      progress: twitterBoostClaimed ? 100 : 0,
      progressText: twitterBoostClaimed ? '+50!' : 'Get boost',
      color: 'from-blue-400 to-sky-500'
    },
    {
      type: 'first_referral',
      title: 'Influencer',
      description: 'First successful referral',
      unlockCondition: 'Get 1 referral',
      icon: <Users className="w-8 h-8" />,
      unlocked: referralCount >= 1,
      progress: Math.min(100, (referralCount / 1) * 100),
      progressText: `${referralCount}/1`,
      color: 'from-emerald-500 to-green-600'
    },
    {
      type: 'referral_5',
      title: 'Legend',
      description: '5 successful referrals',
      unlockCondition: `${5 - Math.min(referralCount, 5)} more!`,
      icon: <Zap className="w-8 h-8" />,
      unlocked: referralCount >= 5,
      progress: Math.min(100, (referralCount / 5) * 100),
      progressText: `${referralCount}/5`,
      color: 'from-purple-500 to-pink-600'
    },
    {
      type: 'referral_10',
      title: 'Champion',
      description: '10 successful referrals',
      unlockCondition: `${10 - Math.min(referralCount, 10)} more!`,
      icon: <Target className="w-8 h-8" />,
      unlocked: referralCount >= 10,
      progress: Math.min(100, (referralCount / 10) * 100),
      progressText: `${referralCount}/10`,
      color: 'from-red-500 to-pink-500'
    },
    {
      type: 'top_100',
      title: 'Rising Star',
      description: 'Top 100 position',
      unlockCondition: effectivePosition > 100 ? `${effectivePosition - 100} spots!` : 'Keep going!',
      icon: <TrendingUp className="w-8 h-8" />,
      unlocked: effectivePosition <= 100,
      progress: effectivePosition > 100 ? Math.max(0, 100 - ((effectivePosition - 100) / effectivePosition * 100)) : 100,
      progressText: effectivePosition <= 100 ? 'Top 100!' : `#${effectivePosition}`,
      color: 'from-cyan-500 to-blue-500'
    },
    {
      type: 'top_50',
      title: 'VIP Access',
      description: 'VIP tier unlocked',
      unlockCondition: effectivePosition > 50 ? `${effectivePosition - 50} spots!` : 'VIP!',
      icon: <Crown className="w-8 h-8" />,
      unlocked: effectivePosition <= 50,
      progress: effectivePosition > 50 ? Math.max(0, 100 - ((effectivePosition - 50) / effectivePosition * 100)) : 100,
      progressText: effectivePosition <= 50 ? 'VIP!' : `#${effectivePosition}`,
      color: 'from-yellow-400 to-amber-600'
    }
  ];

  const unlockedCount = achievements.filter(a => a.unlocked).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 2.3, duration: 0.8 }}
      className="lg:hidden" // Only show on mobile/tablet
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Award className="w-5 h-5 text-purple-400" />
          Achievements
        </h3>
        <span className="text-sm text-gray-400">
          {unlockedCount} / {achievements.length}
        </span>
      </div>

      {/* Swipeable Carousel */}
      <div className="relative overflow-hidden">
        <motion.div
          drag="x"
          dragConstraints={{
            left: -(achievements.length - 1) * 140,
            right: 0
          }}
          dragElastic={0.1}
          dragMomentum={false}
          className="flex gap-4 cursor-grab active:cursor-grabbing pb-4"
        >
          {achievements.map((achievement) => (
            <motion.div
              key={achievement.type}
              className={`
                flex-shrink-0 w-36 rounded-xl p-4 text-center select-none transition-all
                ${achievement.unlocked
                  ? `bg-gradient-to-br ${achievement.color} shadow-lg`
                  : 'bg-white/5 hover:bg-white/10'
                }
              `}
              whileTap={{ scale: 0.95 }}
            >
              {/* Icon */}
              <div className={`
                w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center
                ${achievement.unlocked
                  ? 'bg-white/20 text-white'
                  : 'bg-white/10 text-gray-500 relative'
                }
              `}>
                {achievement.unlocked ? (
                  achievement.icon
                ) : (
                  <>
                    {achievement.icon}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full">
                      <Lock className="w-6 h-6 text-white/80" />
                    </div>
                  </>
                )}
              </div>

              {/* Title */}
              <h4 className={`font-bold text-sm mb-1 ${achievement.unlocked ? 'text-white' : 'text-gray-300'}`}>
                {achievement.title}
              </h4>

              {/* Description or Unlock Condition */}
              <p className={`text-xs line-clamp-2 mb-2 ${achievement.unlocked ? 'text-white/90' : 'text-gray-400'}`}>
                {achievement.unlocked ? achievement.description : achievement.unlockCondition}
              </p>

              {/* Progress Bar */}
              {!achievement.unlocked && achievement.progress > 0 && (
                <div className="mt-2">
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${achievement.color} transition-all duration-500`}
                      style={{ width: `${achievement.progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-300 mt-1 font-semibold">
                    {achievement.progressText}
                  </p>
                </div>
              )}

              {/* Progress Text for Unlocked */}
              {achievement.unlocked && (
                <div className="mt-2">
                  <span className="inline-block px-2 py-0.5 bg-white/20 text-white text-[10px] font-bold rounded-full">
                    {achievement.progressText}
                  </span>
                </div>
              )}

              {/* Unlock Glow Effect */}
              {achievement.unlocked && (
                <motion.div
                  className={`absolute inset-0 rounded-xl bg-gradient-to-br ${achievement.color} opacity-20 -z-10`}
                  animate={{
                    scale: [1, 1.05, 1],
                    opacity: [0.1, 0.3, 0.1]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut'
                  }}
                />
              )}
            </motion.div>
          ))}
        </motion.div>

        {/* Scroll Indicator Dots */}
        <div className="flex justify-center gap-1.5">
          {achievements.map((_, index) => (
            <div
              key={index}
              className="w-1.5 h-1.5 rounded-full bg-white/30"
            />
          ))}
        </div>
      </div>

      {/* Swipe Hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.8 }}
        className="text-center text-xs text-gray-500 mt-2"
      >
        ← Swipe to see all achievements →
      </motion.div>

      {/* Motivational Message */}
      {unlockedCount < achievements.length && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 3.0 }}
          className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-lg p-3 mt-4 text-center"
        >
          <p className="text-sm text-purple-300 font-semibold">
            🎯 {achievements.length - unlockedCount} to unlock!
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Share & refer to complete all
          </p>
        </motion.div>
      )}

      {/* All Complete Celebration */}
      {unlockedCount === achievements.length && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 3.0 }}
          className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-2 border-yellow-500/40 rounded-lg p-4 mt-4 text-center"
        >
          <Crown className="w-8 h-8 mx-auto mb-2 text-yellow-400" />
          <p className="text-lg font-bold text-yellow-300">
            🎉 All Unlocked!
          </p>
          <p className="text-xs text-gray-300 mt-1">
            {totalPoints} total points!
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
