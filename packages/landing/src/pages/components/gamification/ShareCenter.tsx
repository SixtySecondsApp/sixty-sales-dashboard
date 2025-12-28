import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, Share2, Mail, Sparkles, Zap, AlertCircle, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useShareTracking } from '@/lib/hooks/useShareTracking';
import { ConfettiService } from '@/lib/services/confettiService';
import { hasClaimedLinkedInBoost, trackLinkedInFirstShare, hasClaimedTwitterBoost, trackTwitterFirstShare, hasClaimedEmailBoost, trackEmailFirstShare } from '@/lib/services/shareTrackingService';
import { sendBulkInvites } from '@/lib/services/emailInviteService';
import { RecentLinkedInShares } from './RecentLinkedInShares';
import { ShareConfirmationModal } from './ShareConfirmationModal';
import { BoostSuccessToast } from './BoostSuccessToast';
import { formatRank } from '../../../lib/utils/utils';

interface ShareCenterProps {
  referralUrl: string;
  entryId: string;
  currentPosition: number;
  onFirstShare?: () => void;
  senderName?: string;
  referralCode?: string;
  linkedInBoostClaimed?: boolean;
  twitterBoostClaimed?: boolean;
  emailBoostClaimed?: boolean;
  totalPoints?: number;
  signupPosition?: number;
  onBoostClaimed?: (data: { total_points: number; effective_position: number }) => void;
  onEntryUpdate?: () => Promise<void>;
}

export function ShareCenter({
  referralUrl,
  entryId,
  currentPosition,
  onFirstShare,
  senderName,
  referralCode,
  linkedInBoostClaimed: propLinkedInBoostClaimed = false,
  twitterBoostClaimed: propTwitterBoostClaimed = false,
  emailBoostClaimed: propEmailBoostClaimed = false,
  totalPoints = 0,
  signupPosition = 0,
  onBoostClaimed,
  onEntryUpdate
}: ShareCenterProps) {
  const [copied, setCopied] = useState(false);
  const [messageCopied, setMessageCopied] = useState(false);
  const { trackShare } = useShareTracking(entryId);
  const [hasShared, setHasShared] = useState(false);
  const [linkedInBoostClaimed, setLinkedInBoostClaimed] = useState(false);
  const [twitterBoostClaimed, setTwitterBoostClaimed] = useState(false);
  const [emailBoostClaimed, setEmailBoostClaimed] = useState(false);
  const [showLinkedInBoostToast, setShowLinkedInBoostToast] = useState(false);
  const [showTwitterBoostToast, setShowTwitterBoostToast] = useState(false);
  const [showEmailBoostToast, setShowEmailBoostToast] = useState(false);
  const [showLinkedInCopyNotice, setShowLinkedInCopyNotice] = useState(false);

  // Confirmation modal state
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    platform: 'linkedin' | 'twitter' | 'email';
    onConfirm: () => void;
  }>({
    isOpen: false,
    platform: 'linkedin',
    onConfirm: () => {}
  });

  // Email invite state
  const [emails, setEmails] = useState(['']);
  const [sending, setSending] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Check boost status on mount
  useEffect(() => {
    const checkBoosts = async () => {
      const [linkedInClaimed, twitterClaimed, emailClaimed] = await Promise.all([
        hasClaimedLinkedInBoost(entryId),
        hasClaimedTwitterBoost(entryId),
        hasClaimedEmailBoost(entryId)
      ]);
      setLinkedInBoostClaimed(linkedInClaimed);
      setTwitterBoostClaimed(twitterClaimed);
      setEmailBoostClaimed(emailClaimed);
    };
    checkBoosts();
  }, [entryId]);

  // Calculate future position after share boost
  const calculateFuturePosition = (platform: 'linkedin' | 'twitter' | 'email') => {
    // If boost already claimed, no change
    if (platform === 'linkedin' && linkedInBoostClaimed) return currentPosition;
    if (platform === 'twitter' && twitterBoostClaimed) return currentPosition;
    if (platform === 'email' && emailBoostClaimed) return currentPosition;

    // Calculate new total points with the +50 boost
    const newTotalPoints = totalPoints + 50;

    // Calculate new position: MAX(1, signup_position - new_total_points)
    const newPosition = Math.max(1, signupPosition - newTotalPoints);

    return newPosition;
  };

  // Share message template - use current position (user will choose which platform)
  // When they actually share, the position will be calculated based on the platform
  const shareMessage = `I just secured early access to Meeting Intelligence—the tool that reclaims 10+ hours per week.

I'm #${formatRank(currentPosition)} in line and moving fast! Join me and lock in 50% off for life 🚀

${referralUrl}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);

      // Track the copy
      await trackShare('copy');

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
    if (platform === 'linkedin' || platform === 'twitter' || platform === 'email') {
      sharePosition = calculateFuturePosition(platform);
    }

    const text = `I just secured early access to Meeting Intelligence—the tool that reclaims 10+ hours per week.

I'm #${formatRank(sharePosition)} in line and moving fast! Join me and lock in 50% off for life 🚀

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
    if ((platform === 'linkedin' && !linkedInBoostClaimed) || (platform === 'twitter' && !twitterBoostClaimed) || (platform === 'email' && !emailBoostClaimed)) {
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
                let result;
                if (platform === 'linkedin') {
                  result = await trackLinkedInFirstShare(entryId);
                } else if (platform === 'twitter') {
                  result = await trackTwitterFirstShare(entryId);
                } else {
                  result = await trackEmailFirstShare(entryId);
                }

                if (result.boosted) {
                  if (platform === 'linkedin') {
                    setLinkedInBoostClaimed(true);
                    setShowLinkedInBoostToast(true);
                    setTimeout(() => setShowLinkedInBoostToast(false), 5000);
                  } else if (platform === 'twitter') {
                    setTwitterBoostClaimed(true);
                    setShowTwitterBoostToast(true);
                    setTimeout(() => setShowTwitterBoostToast(false), 5000);
                  } else {
                    setEmailBoostClaimed(true);
                    setShowEmailBoostToast(true);
                    setTimeout(() => setShowEmailBoostToast(false), 5000);
                  }
                  ConfettiService.milestone('first_share');
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

        // Clear email field
        setEmails(['']);

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
      className="rounded-xl p-6 space-y-6"
      style={{
        background: 'rgba(17, 24, 39, 0.8)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(55, 65, 81, 0.5)'
      }}
    >
      {/* Header */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
          <Zap className="w-5 h-5 text-blue-400" />
          Skip the Line Faster
        </h3>
        <p className="text-sm text-gray-400">Jump <span className="text-gray-200 font-semibold">5 spots ahead</span> for every revenue leader you refer.</p>
      </div>

      {/* Copy Link Input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            readOnly
            value={referralUrl}
            className="w-full rounded-lg py-2.5 pl-4 pr-10 text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-mono"
            style={{
              background: 'rgba(31, 41, 55, 0.5)',
              border: '1px solid rgba(55, 65, 81, 0.5)'
            }}
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
        </div>
        <Button
          onClick={handleCopy}
          className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm font-medium text-gray-200 transition-colors flex items-center gap-2"
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
        <label className="block text-sm font-medium text-gray-300 mb-2">Share Message</label>
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
        <p className="text-xs text-gray-500 text-center mt-2">
          Copy this message, then paste it when sharing on LinkedIn or Twitter
        </p>
      </div>

      {/* Share Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
            className={`w-full border-white/10 h-10 flex items-center justify-center gap-2 ${
              twitterBoostClaimed
                ? 'bg-emerald-500/10 border-emerald-500/30 cursor-not-allowed opacity-75'
                : 'bg-gradient-to-r from-blue-500/10 to-sky-500/10 border-blue-500/30 hover:from-blue-500/20 hover:to-sky-500/20 hover:border-blue-500/50'
            }`}
          >
            {twitterBoostClaimed ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-emerald-400">Boost Claimed ✓</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-semibold">Share on X/Twitter</span>
              </>
            )}
          </Button>
          {!twitterBoostClaimed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-full"
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
            className={`w-full border-white/10 h-10 flex items-center justify-center gap-2 ${
              linkedInBoostClaimed
                ? 'bg-emerald-500/10 border-emerald-500/30 cursor-not-allowed opacity-75'
                : 'bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-yellow-500/30 hover:from-yellow-500/20 hover:to-orange-500/20 hover:border-yellow-500/50'
            }`}
          >
            {linkedInBoostClaimed ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-emerald-400">Boost Claimed ✓</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-yellow-400" />
                <span className="text-sm font-semibold">Share on LinkedIn</span>
              </>
            )}
          </Button>
          {!linkedInBoostClaimed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute -top-2 -right-2 bg-yellow-500 text-yellow-900 text-xs font-bold px-2 py-0.5 rounded-full"
            >
              +50
            </motion.div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.8 }}
          className="relative"
        >
          <Button
            onClick={() => handleShare('email')}
            variant="outline"
            disabled={emailBoostClaimed}
            className={`w-full border-white/10 h-10 flex items-center justify-center gap-2 ${
              emailBoostClaimed
                ? 'bg-emerald-500/10 border-emerald-500/30 cursor-not-allowed opacity-75'
                : 'bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/30 hover:from-purple-500/20 hover:to-pink-500/20 hover:border-purple-500/50'
            }`}
          >
            {emailBoostClaimed ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-emerald-400">Boost Claimed ✓</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-semibold">Share via Email</span>
              </>
            )}
          </Button>
          {!emailBoostClaimed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute -top-2 -right-2 bg-purple-500 text-white text-xs font-bold px-2 py-0.5 rounded-full"
            >
              +50
            </motion.div>
          )}
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
      {(!linkedInBoostClaimed || !twitterBoostClaimed || !emailBoostClaimed) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.85 }}
          className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 flex items-start gap-2"
        >
          <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs font-semibold text-blue-300 mb-2">
              How to get your 50-spot boost:
            </p>
            <ol className="text-xs text-gray-300 space-y-1.5 list-decimal list-inside">
              <li>Click "Copy Share Message" above</li>
              <li>Click "Share on LinkedIn" or "Share on X/Twitter"</li>
              <li>Paste the message and post</li>
              <li>Close the window to get your 50-spot boost! 💙</li>
            </ol>
          </div>
        </motion.div>
      )}

      {/* Email Invite Section - Matches HTML */}
      <div className="pt-4 border-t border-gray-800">
        <label className="block text-sm font-medium text-gray-300 mb-3">Invite via Email</label>

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
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              type="email"
              placeholder="colleague@company.com"
              value={emails[0]}
              onChange={(e) => {
                setEmails([e.target.value]);
                // Clear error when user starts typing
                if (inviteError) setInviteError(null);
              }}
              disabled={sending}
              className="w-full rounded-lg py-2.5 pl-10 pr-4 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'rgba(31, 41, 55, 0.5)',
                border: '1px solid rgba(55, 65, 81, 0.5)'
              }}
            />
          </div>
          <Button
            onClick={handleSendInvites}
            disabled={sending || !emails.some(e => e.trim())}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            {sending ? 'Sending...' : 'Send Invite'}
          </Button>
          <p className="text-xs text-gray-500 text-center">
            💡 Earn <strong className="text-gray-300">5 spots</strong> for each email invite sent
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
      <BoostSuccessToast
        isOpen={showEmailBoostToast}
        platform="email"
        onClose={() => setShowEmailBoostToast(false)}
      />
    </motion.div>
  );
}
