import { useState, useCallback, useEffect } from 'react';
import { Link2, Copy, Check, Globe, Lock, Loader2, Eye } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { voiceRecordingService } from '@/lib/services/voiceRecordingService';
import { toast } from 'sonner';

interface VoiceShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordingId: string;
  recordingTitle: string;
}

/**
 * VoiceShareDialog - Modal for managing voice recording sharing
 * Allows enabling/disabling public sharing and copying share link
 */
export function VoiceShareDialog({
  open,
  onOpenChange,
  recordingId,
  recordingTitle,
}: VoiceShareDialogProps) {
  const [isPublic, setIsPublic] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareViews, setShareViews] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load sharing status when dialog opens
  useEffect(() => {
    if (open && recordingId) {
      loadSharingStatus();
    }
  }, [open, recordingId]);

  const loadSharingStatus = async () => {
    setIsLoading(true);
    const status = await voiceRecordingService.getSharingStatus(recordingId);
    if (status) {
      setIsPublic(status.isPublic);
      setShareViews(status.shareViews);
      if (status.isPublic && status.shareToken) {
        // Construct share URL using current origin
        const origin = window.location.origin;
        setShareUrl(`${origin}/share/voice/${status.shareToken}`);
      } else {
        setShareUrl(null);
      }
    }
    setIsLoading(false);
  };

  const handleToggleSharing = useCallback(async () => {
    setIsToggling(true);
    try {
      if (isPublic) {
        // Disable sharing
        const result = await voiceRecordingService.disableSharing(recordingId);
        if (result.success) {
          setIsPublic(false);
          setShareUrl(null);
          toast.success('Sharing disabled');
        } else {
          toast.error(result.error || 'Failed to disable sharing');
        }
      } else {
        // Enable sharing
        const result = await voiceRecordingService.enableSharing(recordingId);
        if (result.success && result.share_url) {
          setIsPublic(true);
          setShareUrl(result.share_url);
          toast.success('Sharing enabled');
        } else {
          toast.error(result.error || 'Failed to enable sharing');
        }
      }
    } catch {
      toast.error('Failed to update sharing settings');
    } finally {
      setIsToggling(false);
    }
  }, [isPublic, recordingId]);

  const handleCopyLink = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  }, [shareUrl]);

  const handleNativeShare = useCallback(async () => {
    if (!shareUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: recordingTitle,
          text: `Listen to this voice recording: ${recordingTitle}`,
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled or share failed
        if ((err as Error).name !== 'AbortError') {
          console.error('Share failed:', err);
        }
      }
    } else {
      handleCopyLink();
    }
  }, [shareUrl, recordingTitle, handleCopyLink]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-[#37bd7e]" />
            Share Recording
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Recording Title */}
            <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {recordingTitle}
              </p>
            </div>

            {/* Public Sharing Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isPublic ? (
                  <Globe className="w-5 h-5 text-[#37bd7e]" />
                ) : (
                  <Lock className="w-5 h-5 text-gray-400" />
                )}
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {isPublic ? 'Anyone with link' : 'Private'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {isPublic
                      ? 'Anyone with the link can view'
                      : 'Only you can access'}
                  </p>
                </div>
              </div>
              <Switch
                checked={isPublic}
                onCheckedChange={handleToggleSharing}
                disabled={isToggling}
              />
            </div>

            {/* Share Link */}
            {isPublic && shareUrl && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="flex-1 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyLink}
                    className="shrink-0"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-[#37bd7e]" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                    <Eye className="w-3.5 h-3.5" />
                    <span>{shareViews} view{shareViews !== 1 ? 's' : ''}</span>
                  </div>

                  {navigator.share && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNativeShare}
                      className="text-xs"
                    >
                      Share via...
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Done
              </Button>
              {isPublic && shareUrl && (
                <Button onClick={handleCopyLink} className="bg-[#37bd7e] hover:bg-[#2ea36d]">
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Link
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default VoiceShareDialog;
