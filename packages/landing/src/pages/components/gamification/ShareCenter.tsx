import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, Share2, Mail, Sparkles, Zap, AlertCircle, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useShareTracking } from '@/lib/hooks/useShareTracking';
import { ConfettiService } from '@/lib/services/confettiService';
import { hasClaimedLinkedInBoost, trackLinkedInFirstShare, hasClaimedTwitterBoost, trackTwitterFirstShare } from '@/lib/services/shareTrackingService';
import { sendBulkInvites } from '@/lib/services/emailInviteService';
import { RecentLinkedInShares } from './RecentLinkedInShares';
import { ShareConfirmationModal } from './ShareConfirmationModal';
import { BoostSuccessToast } from './BoostSuccessToast';

interface ShareCenterProps {
  referralUrl: string;
  entryId: string;
  currentPosition: number;
  onFirstShare?: () => void;
  onBoostClaimed?: (data: { total_points: number; effective_position: number; platform: 'linkedin' | 'twitter' }) => void;
  onEntryUpdate?: () => void; // Callback to refetch entry after updates
  senderName?: string;
  referralCode?: string;
  linkedInBoostClaimed?: boolean;
  twitterBoostClaimed?: boolean;
  totalPoints?: number;
  signupPosition?: number;
}

export function ShareCenter({
  referralUrl,
  entryId,
  currentPosition,
  onFirstShare,
  onBoostClaimed,
  onEntryUpdate,
  senderName,
  referralCode,
  linkedInBoostClaimed: propLinkedInBoostClaimed = false,
  twitterBoostClaimed: propTwitterBoostClaimed = false,
  totalPoints = 0,
  signupPosition = 0
}: ShareCenterProps) {
  const [copied, setCopied] = useState(false);
  const [messageCopied, setMessageCopied] = useState(false);
  const { trackShare } = useShareTracking(entryId);
  const [hasShared, setHasShared] = useState(false);
  const [linkedInBoostClaimed, setLinkedInBoostClaimed] = useState(false);
  const [twitterBoostClaimed, setTwitterBoostClaimed] = useState(false);
  const [showLinkedInBoostToast, setShowLinkedInBoostToast] = useState(false);
  const [showTwitterBoostToast, setShowTwitterBoostToast] = useState(false);
  const [showLinkedInCopyNotice, setShowLinkedInCopyNotice] = useState(false);

  // Confirmation modal state
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    platform: 'linkedin' | 'twitter';
    onConfirm: () => void;
  }>({
    isOpen: false,
    platform: 'linkedin',
    onConfirm: () => {}
  });

  // Email invite state
  const [emails, setEmails] = useState(['', '']);
  const [sending, setSending] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Check boost status on mount
  useEffect(() => {
    const checkBoosts = async () => {
      const [linkedInClaimed, twitterClaimed] = await Promise.all([
        hasClaimedLinkedInBoost(entryId),
        hasClaimedTwitterBoost(entryId)
      ]);
      setLinkedInBoostClaimed(linkedInClaimed);
      setTwitterBoostClaimed(twitterClaimed);
    };
    checkBoosts();
  }, [entryId]);

  // Calculate future position after share boost
  const calculateFuturePosition = (platform: 'linkedin' | 'twitter') => {
    // If boost already claimed, no change
    if (platform === 'linkedin' && linkedInBoostClaimed) return currentPosition;
    if (platform === 'twitter' && twitterBoostClaimed) return currentPosition;

    // Calculate new total points with the +50 boost
    const newTotalPoints = totalPoints + 50;

    // Calculate new position: MAX(1, signup_position - new_total_points)
    const newPosition = Math.max(1, signupPosition - newTotalPoints);

    return newPosition;
  };

  // Share message template - use current position (user will choose which platform)
  // When they actually share, the position will be calculated based on the platform
  const shareMessage = `I just secured early access to Meeting Intelligence—the tool that reclaims 10+ hours per week.

I'm #${currentPosition} in line and moving fast! Join me and lock in 50% off for life 🚀

${referralUrl}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);

      // Track the copy
      await trackShare('copy');

      // Wait for database to process
      await new Promise(resolve => setTimeout(resolve, 500));

      // Trigger entry refetch to get updated share counts
      if (onEntryUpdate) {
        await onEntryUpdate();
      }

      // Trigger first share celebration
      if (!hasShared) {
        setHasShared(true);
        ConfettiService.subtle();
        onFirstShare?.();
      }
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(shareMessage);
      setMessageCopied(true);
      setTimeout(() => setMessageCopied(false), 2000);

      // Track the copy
      await trackShare('copy');

      // Wait for database to process
      await new Promise(resolve => setTimeout(resolve, 500));

      // Trigger entry refetch to get updated share counts
      if (onEntryUpdate) {
        await onEntryUpdate();
      }

      // Trigger first share celebration
      if (!hasShared) {
        setHasShared(true);
        ConfettiService.subtle();
        onFirstShare?.();
      }
    } catch (err) {
      console.error('Failed to copy message:', err);
    }
  };

  const handleShare = async (platform: 'twitter' | 'linkedin' | 'email') => {
    // Calculate position for the share message
    let sharePosition = currentPosition;
    if (platform === 'linkedin' || platform === 'twitter') {
      sharePosition = calculateFuturePosition(platform);
    }

    const text = `I just secured early access to Meeting Intelligence—the tool that reclaims 10+ hours per week.

I'm #${sharePosition} in line and moving fast! Join me and lock in 50% off for life 🚀

${referralUrl}`;

    const url = referralUrl;
    const title = 'Join the Meeting Intelligence Waitlist';

    // For LinkedIn, copy message to clipboard first (LinkedIn doesn't support pre-filled text)
    if (platform === 'linkedin') {
      try {
        await navigator.clipboard.writeText(text);
        // Show toast notification
        setShowLinkedInCopyNotice(true);
        setTimeout(() => setShowLinkedInCopyNotice(false), 8000);
      } catch (err) {
        console.error('Failed to copy message:', err);
        // Show error in the existing copy notice banner instead of ugly alert
        setShowLinkedInCopyNotice(true);
        setTimeout(() => setShowLinkedInCopyNotice(false), 8000);
      }
    }

    const shareUrls = {
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
      // LinkedIn feed share - simpler URL that works with their current system
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      email: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text)}`
    };

    // Open share window
    const shareWindow = window.open(shareUrls[platform], '_blank', 'width=600,height=400');

    // Handle social media first share boosts - track window close
    if ((platform === 'linkedin' && !linkedInBoostClaimed) || (platform === 'twitter' && !twitterBoostClaimed)) {
      if (shareWindow) {
        // Poll to detect when window closes
        const checkWindowClosed = setInterval(() => {
          if (shareWindow.closed) {
            clearInterval(checkWindowClosed);

            // Show custom confirmation modal instead of ugly system dialog
            setConfirmationModal({
              isOpen: true,
              platform: platform,
              onConfirm: async () => {
                // Grant the boost
                console.log('[ShareCenter] onConfirm called for platform:', platform);
                console.log('[ShareCenter] Entry ID:', entryId);
                console.log('[ShareCenter] Current boost states:', {
                  linkedInBoostClaimed,
                  twitterBoostClaimed
                });

                const result = platform === 'linkedin'
                  ? await trackLinkedInFirstShare(entryId)
                  : await trackTwitterFirstShare(entryId);

                console.log('[ShareCenter] Track result:', {
                  success: result.success,
                  boosted: result.boosted,
                  updatedEntry: result.updatedEntry
                });
                if (result.updatedEntry) {
                  console.log('[ShareCenter] Updated entry details:', {
                    total_points: result.updatedEntry.total_points,
                    effective_position: result.updatedEntry.effective_position,
                    linkedin_boost_claimed: result.updatedEntry.linkedin_boost_claimed,
                    twitter_boost_claimed: result.updatedEntry.twitter_boost_claimed,
                    referral_count: result.updatedEntry.referral_count
                  });
                }

                if (result.boosted) {
                  if (platform === 'linkedin') {
                    setLinkedInBoostClaimed(true);
                    setShowLinkedInBoostToast(true);
                    setTimeout(() => setShowLinkedInBoostToast(false), 5000);
                  } else {
                    setTwitterBoostClaimed(true);
                    setShowTwitterBoostToast(true);
                    setTimeout(() => setShowTwitterBoostToast(false), 5000);
                  }
                  ConfettiService.milestone('first_share');

                  // Immediately update UI with the data we got back from the database update
                  // The database trigger has already calculated the new points/position
                  if (result.updatedEntry && onBoostClaimed) {
                    console.log('[ShareCenter] Calling onBoostClaimed with:', {
                      total_points: result.updatedEntry.total_points,
                      effective_position: result.updatedEntry.effective_position,
                      platform
                    });
                    onBoostClaimed({
                      total_points: result.updatedEntry.total_points,
                      effective_position: result.updatedEntry.effective_position,
                      platform
                    });
                  } else {
                    console.warn('[ShareCenter] No updatedEntry in result or onBoostClaimed not provided!', {
                      hasUpdatedEntry: !!result.updatedEntry,
                      hasOnBoostClaimed: !!onBoostClaimed
                    });
                  }
                  
                  // Wait a moment for database transaction to fully commit
                  console.log('[ShareCenter] Waiting 500ms for database transaction to commit...');
                  await new Promise(resolve => setTimeout(resolve, 500));
                  
                  // Then refetch to get ALL fields (referral_count, etc.) and ensure everything is in sync
                  if (onEntryUpdate) {
                    console.log('[ShareCenter] Calling onEntryUpdate to refetch...');
                    await onEntryUpdate();
                  } else {
                    console.warn('[ShareCenter] onEntryUpdate not provided!');
                  }
                } else if (result.success) {
                  // Even if boost wasn't granted (already claimed), still refetch to get latest data
                  console.log('[ShareCenter] Boost not granted but success=true, refetching...');
                  await new Promise(resolve => setTimeout(resolve, 300));
                  if (onEntryUpdate) {
                    await onEntryUpdate();
                  }
                } else {
                  // Update failed
                  console.error('[ShareCenter] Boost update failed!', result);
                  alert('Failed to apply boost. Please try again or contact support.');
                }

                // Close modal
                setConfirmationModal({ isOpen: false, platform: 'linkedin', onConfirm: () => {} });
              }
            });
          }
        }, 500);

        // Clear interval after 5 minutes to prevent memory leak
        setTimeout(() => clearInterval(checkWindowClosed), 300000);
      }
    } else {
      // Track regular share (already claimed boost)
      await trackShare(platform);
      
      // Wait for database to process the share tracking
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Trigger entry refetch to get updated share counts
      if (onEntryUpdate) {
        await onEntryUpdate();
      }
    }

    // Trigger first share celebration
    if (!hasShared) {
      setHasShared(true);
      ConfettiService.subtle();
      onFirstShare?.();
    }
  };

  const handleSendInvites = async () => {
    if (!senderName || !referralCode) {
      setInviteError('Missing sender information');
      return;
    }

    // Filter out empty emails
    const validEmails = emails.filter(e => e.trim());

    if (validEmails.length === 0) {
      setInviteError('Please enter at least one email address');
      return;
    }

    setSending(true);
    setInviteError(null);
    setInviteSuccess(false);

    try {
      const result = await sendBulkInvites({
        waitlist_entry_id: entryId,
        emails: validEmails,
        referral_code: referralCode,
        sender_name: senderName
      });

      if (result.success && result.sent > 0) {
        // Success! Show celebration
        setInviteSuccess(true);
        ConfettiService.subtle();

        // Calculate points awarded (5 per invite)
        const pointsAwarded = result.sent * 5;

        // Clear email fields
        setEmails(['', '']);

        // Wait for database triggers to process invites and calculate points
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Trigger entry refetch to get updated referral count and points
        if (onEntryUpdate) {
          await onEntryUpdate();
        }

        // Hide success message after 5 seconds
        setTimeout(() => {
          setInviteSuccess(false);
        }, 5000);

        // Optional: Track analytics
        if (typeof window !== 'undefined' && (window as any).analytics) {
          (window as any).analytics.track('Email Invites Sent', {
            count: result.sent,
            points_awarded: pointsAwarded
          });
        }
      } else {
        setInviteError(result.errors.join('. ') || 'Failed to send invites');
      }
    } catch (err) {
      console.error('Send invites error:', err);
      setInviteError(err instanceof Error ? err.message : 'Failed to send invites');
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.8, duration: 0.8 }}
      className="rounded-xl p-6 space-y-6 bg-white dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 shadow-sm dark:shadow-none transition-colors duration-300"
    >
      {/* Header */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Zap className="w-5 h-5 text-blue-500 dark:text-blue-400" />
          Skip the Line Faster
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">Jump <span className="text-gray-900 dark:text-gray-200 font-semibold">5 points ahead</span> for every revenue leader you refer.</p>
      </div>

      {/* Copy Link Input */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Input
            readOnly
            value={referralUrl}
            className="w-full rounded-lg py-2.5 pl-4 pr-4 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-mono truncate"
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
        </div>
        <Button
          onClick={handleCopy}
          className="px-4 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors flex items-center justify-center gap-2 flex-shrink-0"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              Copy
            </>
          )}
        </Button>
      </div>

      {/* Copy Share Message Button */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Share Message</label>
        <Button
          onClick={handleCopyMessage}
          className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2"
        >
          {messageCopied ? (
            <>
              <Check className="w-4 h-4" />
              Message Copied!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              Copy Share Message
            </>
          )}
        </Button>
        <p className="text-xs text-gray-500 dark:text-gray-500 text-center mt-2">
          Copy this message, then paste it when sharing on LinkedIn or Twitter
        </p>
      </div>

      {/* Share Buttons */}
      <div className="grid grid-cols-3 gap-2">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.7 }}
          className="relative"
        >
          <Button
            onClick={() => handleShare('twitter')}
            variant="outline"
            disabled={twitterBoostClaimed}
            className={`w-full border-white/10 h-10 sm:h-10 flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 ${
              twitterBoostClaimed
                ? 'bg-emerald-500/10 border-emerald-500/30 cursor-not-allowed opacity-75'
                : 'bg-gradient-to-r from-blue-500/10 to-sky-500/10 border-blue-500/30 hover:from-blue-500/20 hover:to-sky-500/20 hover:border-blue-500/50'
            }`}
          >
            {twitterBoostClaimed ? (
              <>
                <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span className="text-xs sm:text-sm text-emerald-400 truncate">Claimed</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <span className="text-xs sm:text-sm font-semibold truncate">X/Twitter</span>
              </>
            )}
          </Button>
          {!twitterBoostClaimed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute -top-2 -right-2 bg-blue-500 text-white text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded-full"
            >
              +50
            </motion.div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.75 }}
          className="relative"
        >
          <Button
            onClick={() => handleShare('linkedin')}
            variant="outline"
            disabled={linkedInBoostClaimed}
            className={`w-full border-white/10 h-10 sm:h-10 flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 ${
              linkedInBoostClaimed
                ? 'bg-emerald-500/10 border-emerald-500/30 cursor-not-allowed opacity-75'
                : 'bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-yellow-500/30 hover:from-yellow-500/20 hover:to-orange-500/20 hover:border-yellow-500/50'
            }`}
          >
            {linkedInBoostClaimed ? (
              <>
                <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span className="text-xs sm:text-sm text-emerald-400 truncate">Claimed</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                <span className="text-xs sm:text-sm font-semibold truncate">LinkedIn</span>
              </>
            )}
          </Button>
          {!linkedInBoostClaimed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute -top-2 -right-2 bg-yellow-500 text-yellow-900 text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded-full"
            >
              +50
            </motion.div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.8 }}
        >
          <Button
            onClick={() => handleShare('email')}
            variant="outline"
            className="w-full border-white/10 hover:bg-purple-500/20 hover:border-purple-500/50 flex items-center justify-center gap-1 sm:gap-2 h-10 px-2 sm:px-4"
          >
            <Mail className="w-4 h-4 flex-shrink-0" />
            <span className="text-xs sm:text-sm">Email</span>
          </Button>
        </motion.div>
      </div>

      {/* LinkedIn Copy Notice */}
      {showLinkedInCopyNotice && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="bg-gradient-to-r from-blue-500/20 to-indigo-500/20 border border-blue-500/40 rounded-lg p-4 flex items-start gap-3"
        >
          <div className="flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Copy className="w-5 h-5 text-blue-400" />
            </div>
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-blue-300 mb-1">
              📋 Message Copied!
            </h4>
            <p className="text-xs text-gray-300">
              Paste it into LinkedIn after the window opens. Close the LinkedIn window when done to get your 50-point boost!
            </p>
          </div>
        </motion.div>
      )}

      {/* Honor System Notice for Social Shares */}
      {(!linkedInBoostClaimed || !twitterBoostClaimed) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.85 }}
          className="bg-blue-50 dark:bg-blue-500/5 border border-blue-200 dark:border-blue-500/20 rounded-lg p-3 flex items-start gap-2"
        >
          <AlertCircle className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-300 mb-2">
              How to get your 50-point boost:
            </p>
            <ol className="text-xs text-gray-700 dark:text-gray-300 space-y-1.5 list-decimal list-inside">
              <li>Click "Copy Share Message" above</li>
              <li>Click "Share on LinkedIn" or "Share on X/Twitter"</li>
              <li>Paste the message and post</li>
              <li>Close the window to get your 50-point boost! 💙</li>
            </ol>
          </div>
        </motion.div>
      )}

      {/* Email Invite Section - Matches HTML */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Invite via Email</label>

        {/* Success Message */}
        <AnimatePresence>
          {inviteSuccess && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2"
            >
              <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-emerald-300 font-medium">Invites sent successfully!</p>
                <p className="text-xs text-emerald-400/70 mt-1">
                  You've earned 5 points per invite. Check your updated position above!
                </p>
              </div>
              <button
                onClick={() => setInviteSuccess(false)}
                className="text-emerald-400/50 hover:text-emerald-400"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Message */}
        <AnimatePresence>
          {inviteError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-300">{inviteError}</p>
              </div>
              <button
                onClick={() => setInviteError(null)}
                className="text-red-400/50 hover:text-red-400"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-3">
          {emails.map((email, index) => (
            <div key={index} className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                type="email"
                placeholder={index === 0 ? "colleague@company.com" : "manager@company.com"}
                value={email}
                onChange={(e) => {
                  const newEmails = [...emails];
                  newEmails[index] = e.target.value;
                  setEmails(newEmails);
                  // Clear error when user starts typing
                  if (inviteError) setInviteError(null);
                }}
                disabled={sending}
                className="w-full rounded-lg py-2.5 pl-10 pr-4 text-sm text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700/50 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          ))}
          <Button
            onClick={handleSendInvites}
            disabled={sending || !emails.some(e => e.trim())}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            {sending ? 'Sending...' : 'Send Invites'}
          </Button>
          <p className="text-xs text-gray-500 dark:text-gray-500 text-center">
            💡 Earn <strong className="text-gray-700 dark:text-gray-300">5 points</strong> for each email invite sent
          </p>
        </div>
      </div>

      {/* Custom Confirmation Modal - replaces ugly system alert */}
      <ShareConfirmationModal
        isOpen={confirmationModal.isOpen}
        onClose={() => setConfirmationModal({ isOpen: false, platform: 'linkedin', onConfirm: () => {} })}
        onConfirm={confirmationModal.onConfirm}
        platform={confirmationModal.platform}
        pointsBoost={50}
      />

      {/* Centered Boost Success Toasts */}
      <BoostSuccessToast
        isOpen={showLinkedInBoostToast}
        platform="linkedin"
        onClose={() => setShowLinkedInBoostToast(false)}
      />
      <BoostSuccessToast
        isOpen={showTwitterBoostToast}
        platform="twitter"
        onClose={() => setShowTwitterBoostToast(false)}
      />
    </motion.div>
  );
}
