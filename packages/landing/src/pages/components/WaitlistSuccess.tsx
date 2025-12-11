import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { WaitlistEntry } from '@/lib/types/waitlist';
import { ConfettiService } from '@/lib/services/confettiService';
import { getTierForPosition } from '@/lib/types/waitlist';
import { useWaitlistRealtime } from '@/lib/hooks/useWaitlistRealtime';
import { ThemeToggle } from '@/components/ThemeToggle';

// Import gamification components
import { PositionDisplay } from './gamification/PositionDisplay';
import { ReferralProgress } from './gamification/ReferralProgress';
import { ShareCenter } from './gamification/ShareCenter';
import { AchievementUnlock } from './gamification/AchievementUnlock';
import { Leaderboard } from './gamification/Leaderboard';
import { LiveFeed } from './gamification/LiveFeed';
import { MobileAchievements } from './gamification/MobileAchievements';
import { EmailInviteForm } from './gamification/EmailInviteForm';

interface WaitlistSuccessProps {
  entry: WaitlistEntry;
}

export function WaitlistSuccess({ entry: initialEntry }: WaitlistSuccessProps) {
  const [hasShared, setHasShared] = useState(false);
  const [celebratedMilestones, setCelebratedMilestones] = useState<Set<string>>(new Set());

  // Real-time position updates
  const { entry, previousPosition, isConnected, updateEntry } = useWaitlistRealtime(initialEntry.id, initialEntry);

  // Generate referral URL
  const referralUrl = `${window.location.origin}/product/meetings/waitlist?ref=${entry.referral_code}`;

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  // Initial celebration
  useEffect(() => {
    setTimeout(() => {
      ConfettiService.celebrate();
    }, 200);
  }, []);

  // Handle milestone celebrations
  const handleMilestone = useCallback((type: string) => {
    if (celebratedMilestones.has(type)) return;

    setCelebratedMilestones(prev => new Set(prev).add(type));

    switch (type) {
      case 'first_share':
        ConfettiService.milestone('first_share');
        break;
      case 'first_referral':
        ConfettiService.milestone('first_referral');
        break;
      case 'top_50':
        ConfettiService.milestone('top_50');
        break;
    }
  }, [celebratedMilestones, entry.effective_position, previousPosition]);

  // Monitor for tier changes
  useEffect(() => {
    if (previousPosition && previousPosition !== entry.effective_position) {
      const oldTier = getTierForPosition(previousPosition);
      const newTier = getTierForPosition(entry.effective_position || 0);

      if (oldTier.name !== newTier.name) {
        const tierType = newTier.name === 'VIP' ? 'gold' : newTier.name === 'Priority' ? 'silver' : 'bronze';
        ConfettiService.tierUnlock(tierType);
        handleMilestone('tier_upgrade');
      }
    }
  }, [entry.effective_position, previousPosition, handleMilestone]);

  // Monitor for referral milestones
  useEffect(() => {
    if (entry.referral_count === 1 && !celebratedMilestones.has('first_referral')) {
      handleMilestone('first_referral');
    }
    if (entry.referral_count === 5 && !celebratedMilestones.has('referral_5')) {
      handleMilestone('referral_5');
    }
    if (entry.effective_position && entry.effective_position <= 50 && !celebratedMilestones.has('top_50')) {
      handleMilestone('top_50');
    }
  }, [entry.referral_count, entry.effective_position, celebratedMilestones, handleMilestone]);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-white dark:bg-gray-950 transition-colors duration-300">
      {/* Theme Toggle - Fixed in top right corner */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      {/* Subtle Ambient Background Glow (Clean, no noise) */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-blue-200/30 dark:bg-blue-900/10 blur-[100px] rounded-full pointer-events-none -z-10" />

      {/* Content */}
      <div className="relative z-10 max-w-6xl w-full mx-auto px-4 md:px-8 py-8">
        {/* Success Header */}
        <div className="text-center lg:text-left space-y-2 mb-8">
          {/* Realtime Connection Indicator */}
          {isConnected && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-500 text-xs font-medium mb-2"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Live updates enabled
            </motion.div>
          )}

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100 tracking-tight"
          >
            You're on the list!
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="text-gray-700 dark:text-gray-400 text-lg"
          >
            Welcome, {entry.full_name.split(' ')[0]}! You've secured priority access to reclaim 10+ hours every week.
          </motion.p>
        </div>

        {/* Main Content Grid - Matches HTML Layout Exactly */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT COLUMN: Status & Actions */}
          <div className="lg:col-span-7 space-y-6">
            {/* Main Status Card - Position Display */}
            <PositionDisplay
              entry={entry}
              previousPosition={previousPosition}
              onMilestone={handleMilestone}
            />

            {/* Action Area: Share & Refer (Combined into ShareCenter) */}
            <ShareCenter
              referralUrl={referralUrl}
              entryId={entry.id}
              currentPosition={entry.effective_position || 0}
              senderName={entry.full_name}
              referralCode={entry.referral_code}
              linkedInBoostClaimed={entry.linkedin_boost_claimed || false}
              twitterBoostClaimed={entry.twitter_boost_claimed || false}
              totalPoints={entry.total_points || 0}
              signupPosition={entry.signup_position || 0}
              onFirstShare={() => {
                setHasShared(true);
                handleMilestone('first_share');
              }}
              onBoostClaimed={(data) => {
                // Update the entry with new points and position from the boost
                updateEntry({
                  total_points: data.total_points,
                  effective_position: data.effective_position,
                  [`${data.platform}_boost_claimed`]: true
                });
                // Celebrate the boost!
                ConfettiService.milestone('first_share');
              }}
            />
          </div>

          {/* RIGHT COLUMN: Leaderboard & Achievements */}
          <div className="lg:col-span-5 space-y-6">
            {/* Leaderboard Card with Prizes */}
            <Leaderboard currentUserId={entry.id} />

            {/* Achievements Grid */}
            <div className="hidden lg:block">
              <AchievementUnlock
                referralCount={entry.referral_count}
                effectivePosition={entry.effective_position || 0}
                hasShared={hasShared}
                linkedInBoostClaimed={entry.linkedin_boost_claimed || false}
                twitterBoostClaimed={entry.twitter_boost_claimed || false}
                totalPoints={entry.total_points || 0}
              />
            </div>

            {/* Mobile Achievements (shows only on mobile) */}
            <MobileAchievements
              referralCount={entry.referral_count}
              effectivePosition={entry.effective_position || 0}
              hasShared={hasShared}
              linkedInBoostClaimed={entry.linkedin_boost_claimed || false}
              twitterBoostClaimed={entry.twitter_boost_claimed || false}
              totalPoints={entry.total_points || 0}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
