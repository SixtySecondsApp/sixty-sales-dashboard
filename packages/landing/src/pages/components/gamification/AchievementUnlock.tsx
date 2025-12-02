import { motion, AnimatePresence } from 'framer-motion';
import { Award, Share2, Users, Crown, Zap, Target, TrendingUp, Linkedin, Twitter, Lock } from 'lucide-react';
import type { MilestoneType } from '@/lib/types/waitlist';

interface Achievement {
  type: MilestoneType | 'linkedin_boost' | 'twitter_boost' | 'top_100' | 'referral_10';
  title: string;
  description: string;
  callToAction: string;
  icon: React.ReactNode;
  unlocked: boolean;
  progress: number; // 0-100
  progressText: string;
  color: string;
}

interface AchievementUnlockProps {
  referralCount: number;
  effectivePosition: number;
  hasShared: boolean;
  linkedInBoostClaimed?: boolean;
  twitterBoostClaimed?: boolean;
  totalPoints?: number;
}

export function AchievementUnlock({
  referralCount,
  effectivePosition,
  hasShared,
  linkedInBoostClaimed = false,
  twitterBoostClaimed = false,
  totalPoints = 0
}: AchievementUnlockProps) {
  const achievements: Achievement[] = [
    {
      type: 'first_share',
      title: 'Ambassador',
      description: 'Share your referral link',
      callToAction: 'Copy your link and share it!',
      icon: <Share2 className="w-6 h-6" />,
      unlocked: hasShared,
      progress: hasShared ? 100 : 0,
      progressText: hasShared ? 'Complete!' : 'Share now',
      color: 'from-blue-500 to-blue-600'
    },
    {
      type: 'linkedin_boost',
      title: 'LinkedIn Pro',
      description: 'Share on LinkedIn for +50 boost',
      callToAction: 'Share on LinkedIn to jump 50 spots!',
      icon: <Linkedin className="w-6 h-6" />,
      unlocked: linkedInBoostClaimed,
      progress: linkedInBoostClaimed ? 100 : 0,
      progressText: linkedInBoostClaimed ? '+50 Boost!' : 'Unlock now',
      color: 'from-yellow-500 to-orange-500'
    },
    {
      type: 'twitter_boost',
      title: 'X Influencer',
      description: 'Share on Twitter/X for +50 boost',
      callToAction: 'Share on X to jump 50 more spots!',
      icon: <Twitter className="w-6 h-6" />,
      unlocked: twitterBoostClaimed,
      progress: twitterBoostClaimed ? 100 : 0,
      progressText: twitterBoostClaimed ? '+50 Boost!' : 'Unlock now',
      color: 'from-blue-400 to-sky-500'
    },
    {
      type: 'first_referral',
      title: 'Influencer',
      description: 'Get your first successful referral',
      callToAction: 'Share your link to get referrals!',
      icon: <Users className="w-6 h-6" />,
      unlocked: referralCount >= 1,
      progress: Math.min(100, (referralCount / 1) * 100),
      progressText: `${referralCount} / 1`,
      color: 'from-emerald-500 to-green-600'
    },
    {
      type: 'referral_5',
      title: 'Legend',
      description: 'Achieve 5 successful referrals',
      callToAction: `${5 - Math.min(referralCount, 5)} more to go!`,
      icon: <Zap className="w-6 h-6" />,
      unlocked: referralCount >= 5,
      progress: Math.min(100, (referralCount / 5) * 100),
      progressText: `${referralCount} / 5`,
      color: 'from-purple-500 to-pink-600'
    },
    {
      type: 'referral_10',
      title: 'Champion',
      description: 'Get 10 successful referrals',
      callToAction: `${10 - Math.min(referralCount, 10)} more referrals needed!`,
      icon: <Target className="w-6 h-6" />,
      unlocked: referralCount >= 10,
      progress: Math.min(100, (referralCount / 10) * 100),
      progressText: `${referralCount} / 10`,
      color: 'from-red-500 to-pink-500'
    },
    {
      type: 'top_100',
      title: 'Rising Star',
      description: 'Reach top 100 position',
      callToAction: effectivePosition > 100 ? `${effectivePosition - 100} spots to go!` : 'Keep climbing!',
      icon: <TrendingUp className="w-6 h-6" />,
      unlocked: effectivePosition <= 100,
      progress: effectivePosition > 100 ? Math.max(0, 100 - ((effectivePosition - 100) / effectivePosition * 100)) : 100,
      progressText: effectivePosition <= 100 ? 'Top 100!' : `#${effectivePosition}`,
      color: 'from-cyan-500 to-blue-500'
    },
    {
      type: 'top_50',
      title: 'VIP Access',
      description: 'Reach top 50 position',
      callToAction: effectivePosition > 50 ? `${effectivePosition - 50} spots to VIP!` : 'VIP unlocked!',
      icon: <Crown className="w-6 h-6" />,
      unlocked: effectivePosition <= 50,
      progress: effectivePosition > 50 ? Math.max(0, 100 - ((effectivePosition - 50) / effectivePosition * 100)) : 100,
      progressText: effectivePosition <= 50 ? 'VIP Tier!' : `#${effectivePosition}`,
      color: 'from-yellow-400 to-amber-600'
    }
  ];

  const unlockedCount = achievements.filter(a => a.unlocked).length;

  // Always show achievements section to encourage engagement

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 2.0, duration: 0.8 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Award className="w-5 h-5 text-purple-400" />
          Achievements
        </h3>
        <span className="text-sm font-semibold text-purple-400">
          {unlockedCount} / {achievements.length}
        </span>
      </div>

      {/* Achievement Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <AnimatePresence>
          {achievements.map((achievement, index) => (
            <motion.div
              key={achievement.type}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 2.1 + (index * 0.05) }}
              className={`
                relative rounded-xl p-3 text-center transition-all duration-300 cursor-pointer
                hover:scale-105 group
                ${achievement.unlocked
                  ? `bg-gradient-to-br ${achievement.color} shadow-lg shadow-${achievement.color}/20 border-2 border-white/30`
                  : 'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20'
                }
              `}
            >
              {/* Badge Icon */}
              <div className={`
                w-12 h-12 mx-auto mb-2 rounded-full flex items-center justify-center transition-transform
                ${achievement.unlocked
                  ? 'bg-white/20 text-white'
                  : 'bg-white/10 text-gray-500 relative'
                }
                ${!achievement.unlocked && 'group-hover:scale-110'}
              `}>
                {achievement.unlocked ? (
                  achievement.icon
                ) : (
                  <>
                    {achievement.icon}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full">
                      <Lock className="w-5 h-5 text-white/80" />
                    </div>
                  </>
                )}
              </div>

              {/* Title */}
              <h4 className={`font-bold text-sm mb-1 ${achievement.unlocked ? 'text-white' : 'text-gray-300'}`}>
                {achievement.title}
              </h4>

              {/* Description or Call to Action */}
              <p className={`text-xs mb-2 ${achievement.unlocked ? 'text-white/90' : 'text-gray-400'}`}>
                {achievement.unlocked ? achievement.description : achievement.callToAction}
              </p>

              {/* Progress Bar */}
              {!achievement.unlocked && achievement.progress > 0 && (
                <div className="mt-2">
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${achievement.progress}%` }}
                      transition={{ duration: 1, delay: 2.2 + (index * 0.05) }}
                      className={`h-full bg-gradient-to-r ${achievement.color}`}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1 font-semibold">
                    {achievement.progressText}
                  </p>
                </div>
              )}

              {/* Complete Badge */}
              {achievement.unlocked && (
                <div className="mt-2">
                  <span className="inline-block px-2 py-0.5 bg-white/20 text-white text-[10px] font-bold rounded-full">
                    {achievement.progressText}
                  </span>
                </div>
              )}

              {/* Unlocked Glow */}
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
        </AnimatePresence>
      </div>

      {/* Motivational Message */}
      {unlockedCount < achievements.length && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.5 }}
          className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-lg p-3 text-center"
        >
          <p className="text-sm text-purple-300 font-semibold">
            🎯 {achievements.length - unlockedCount} achievements remaining!
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Share on social media and refer friends to unlock them all
          </p>
        </motion.div>
      )}

      {/* All Complete Celebration */}
      {unlockedCount === achievements.length && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 2.5 }}
          className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-2 border-yellow-500/40 rounded-lg p-4 text-center"
        >
          <Crown className="w-8 h-8 mx-auto mb-2 text-yellow-400" />
          <p className="text-lg font-bold text-yellow-300">
            🎉 All Achievements Unlocked!
          </p>
          <p className="text-sm text-gray-300 mt-1">
            You're a true waitlist champion! {totalPoints} points earned.
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
