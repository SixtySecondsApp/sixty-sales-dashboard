import React, { useState, useCallback, useEffect, memo } from 'react';
import { Link2, Copy, Check, Eye, Globe, Lock, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { voiceRecordingService } from '@/lib/services/voiceRecordingService';

interface ShareRecordingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordingId: string;
  recordingTitle: string;
}

/**
 * ShareRecordingDialog - Dialog to manage public sharing of voice recordings
 * - Toggle sharing on/off
 * - Copy share link
 * - Display view count
 */
export const ShareRecordingDialog = memo(function ShareRecordingDialog({
  open,
  onOpenChange,
  recordingId,
  recordingTitle,
}: ShareRecordingDialogProps) {
  const [isPublic, setIsPublic] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareViews, setShareViews] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch current sharing status
  useEffect(() => {
    if (!open || !recordingId) return;

    const fetchSharingStatus = async () => {
      setIsLoading(true);
      setError(null);

      const status = await voiceRecordingService.getSharingStatus(recordingId);
      if (status) {
        setIsPublic(status.is_public);
        setShareViews(status.share_views);
        if (status.is_public && status.share_token) {
          // Construct share URL
          const appUrl = window.location.origin;
          setShareUrl(`${appUrl}/share/voice/${status.share_token}`);
        } else {
          setShareUrl(null);
        }
      } else {
        setError('Failed to load sharing status');
      }
      setIsLoading(false);
    };

    fetchSharingStatus();
  }, [open, recordingId]);

  // Toggle sharing on/off
  const handleToggleSharing = useCallback(async () => {
    setIsToggling(true);
    setError(null);

    try {
      if (isPublic) {
        // Disable sharing
        const success = await voiceRecordingService.disableSharing(recordingId);
        if (success) {
          setIsPublic(false);
          setShareUrl(null);
        } else {
          setError('Failed to disable sharing');
        }
      } else {
        // Enable sharing
        const result = await voiceRecordingService.enableSharing(recordingId);
        if (result) {
          setIsPublic(true);
          setShareUrl(result.share_url);
        } else {
          setError('Failed to enable sharing');
        }
      }
    } catch (err) {
      setError('An error occurred while updating sharing');
      console.error('Sharing toggle error:', err);
    } finally {
      setIsToggling(false);
    }
  }, [isPublic, recordingId]);

  // Copy link to clipboard
  const handleCopyLink = useCallback(async () => {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [shareUrl]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <Link2 className="w-5 h-5" />
            Share Recording
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Recording info */}
          <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
            {recordingTitle}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              {/* Sharing toggle */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700/50">
                <div className="flex items-center gap-3">
                  {isPublic ? (
                    <Globe className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <Lock className="w-5 h-5 text-gray-400" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-200">
                      {isPublic ? 'Public link enabled' : 'Private'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {isPublic
                        ? 'Anyone with the link can view'
                        : 'Only you can access this recording'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleToggleSharing}
                  disabled={isToggling}
                  className={cn(
                    'relative w-12 h-6 rounded-full transition-colors',
                    isPublic
                      ? 'bg-emerald-500'
                      : 'bg-gray-300 dark:bg-gray-600',
                    isToggling && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all',
                      isPublic ? 'left-6' : 'left-0.5'
                    )}
                  />
                </button>
              </div>

              {/* Share link (when public) */}
              {isPublic && shareUrl && (
                <div className="space-y-3">
                  {/* Copy link input */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-300 truncate">
                      {shareUrl}
                    </div>
                    <button
                      onClick={handleCopyLink}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all',
                        copied
                          ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                          : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100'
                      )}
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>

                  {/* View count */}
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <Eye className="w-4 h-4" />
                    <span>
                      {shareViews} {shareViews === 1 ? 'view' : 'views'}
                    </span>
                  </div>
                </div>
              )}

              {/* Error message */}
              {error && (
                <div className="text-sm text-red-500 dark:text-red-400 text-center">
                  {error}
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
});

export default ShareRecordingDialog;
