import React, { useState, useCallback, useEffect, memo } from 'react';
import {
  Link2,
  Copy,
  Check,
  Eye,
  Globe,
  Lock,
  Loader2,
  FileText,
  ListChecks,
  ScrollText,
  Video,
  ExternalLink
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase/clientV2';
import { toast } from 'sonner';

interface ShareOptions {
  include_summary: boolean;
  include_action_items: boolean;
  include_transcript: boolean;
  include_recording: boolean;
}

interface ShareMeetingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingId: string;
  meetingTitle: string;
  sourceType: 'fathom' | 'voice' | null;
  fathomShareUrl?: string | null;
  voiceRecordingId?: string | null;
  hasSummary?: boolean;
  hasActionItems?: boolean;
  hasTranscript?: boolean;
}

/**
 * ShareMeetingModal - Dialog to manage public sharing of meetings
 * Supports both Fathom and voice meetings with analysis content options
 */
export const ShareMeetingModal = memo(function ShareMeetingModal({
  open,
  onOpenChange,
  meetingId,
  meetingTitle,
  sourceType,
  fathomShareUrl,
  voiceRecordingId,
  hasSummary = false,
  hasActionItems = false,
  hasTranscript = false,
}: ShareMeetingModalProps) {
  const [isPublic, setIsPublic] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareViews, setShareViews] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [isSavingOptions, setIsSavingOptions] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [shareOptions, setShareOptions] = useState<ShareOptions>({
    include_summary: true,
    include_action_items: true,
    include_transcript: false,
    include_recording: true,
  });

  // Fetch current sharing status
  useEffect(() => {
    if (!open || !meetingId) return;

    const fetchSharingStatus = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from('meetings')
          .select('is_public, share_token, share_views, share_options')
          .eq('id', meetingId)
          .maybeSingle();

        if (fetchError) {
          setError('Failed to load sharing status');
          console.error('Error fetching sharing status:', fetchError);
        } else if (data) {
          setIsPublic(data.is_public || false);
          setShareViews(data.share_views || 0);

          if (data.share_options) {
            setShareOptions(data.share_options as ShareOptions);
          }

          if (data.is_public && data.share_token) {
            const appUrl = window.location.origin;
            setShareUrl(`${appUrl}/share/meeting/${data.share_token}`);
          } else {
            setShareUrl(null);
          }
        }
      } catch (err) {
        setError('Failed to load sharing status');
        console.error('Error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSharingStatus();
  }, [open, meetingId]);

  // Toggle sharing on/off
  const handleToggleSharing = useCallback(async () => {
    setIsToggling(true);
    setError(null);

    try {
      const newIsPublic = !isPublic;

      const { data, error: updateError } = await supabase
        .from('meetings')
        .update({
          is_public: newIsPublic,
          share_options: shareOptions
        })
        .eq('id', meetingId)
        .select('share_token')
        .single();

      if (updateError) {
        throw updateError;
      }

      setIsPublic(newIsPublic);

      if (newIsPublic && data?.share_token) {
        const appUrl = window.location.origin;
        const newShareUrl = `${appUrl}/share/meeting/${data.share_token}`;
        setShareUrl(newShareUrl);
        toast.success('Sharing enabled');
      } else {
        setShareUrl(null);
        toast.success('Sharing disabled');
      }
    } catch (err) {
      setError('Failed to update sharing');
      console.error('Sharing toggle error:', err);
      toast.error('Failed to update sharing');
    } finally {
      setIsToggling(false);
    }
  }, [isPublic, meetingId, shareOptions]);

  // Update share options
  const handleOptionChange = useCallback(async (key: keyof ShareOptions, value: boolean) => {
    const newOptions = { ...shareOptions, [key]: value };
    setShareOptions(newOptions);

    // If sharing is already enabled, save the options
    if (isPublic) {
      setIsSavingOptions(true);
      try {
        await supabase
          .from('meetings')
          .update({ share_options: newOptions })
          .eq('id', meetingId);
      } catch (err) {
        console.error('Error saving options:', err);
      } finally {
        setIsSavingOptions(false);
      }
    }
  }, [shareOptions, isPublic, meetingId]);

  // Copy link to clipboard
  const handleCopyLink = useCallback(async () => {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      toast.error('Failed to copy link');
    }
  }, [shareUrl]);

  // Check if meeting has recording capability
  const hasRecording = sourceType === 'voice' && voiceRecordingId;
  const hasFathomVideo = sourceType === 'fathom' && fathomShareUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <Link2 className="w-5 h-5" />
            Share Meeting
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Meeting info */}
          <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
            {meetingTitle}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              {/* Share Content Options */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-200">
                  Include in share
                </p>
                <div className="space-y-2">
                  <div className={cn(
                    "flex items-center justify-between p-3 rounded-lg border",
                    "bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700/50",
                    !hasSummary && "opacity-50"
                  )}>
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-emerald-500" />
                      <Label htmlFor="include-summary" className="text-sm cursor-pointer">
                        AI Summary
                      </Label>
                    </div>
                    <Switch
                      id="include-summary"
                      checked={shareOptions.include_summary}
                      onCheckedChange={(v) => handleOptionChange('include_summary', v)}
                      disabled={!hasSummary || isSavingOptions}
                    />
                  </div>

                  <div className={cn(
                    "flex items-center justify-between p-3 rounded-lg border",
                    "bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700/50",
                    !hasActionItems && "opacity-50"
                  )}>
                    <div className="flex items-center gap-3">
                      <ListChecks className="w-4 h-4 text-blue-500" />
                      <Label htmlFor="include-actions" className="text-sm cursor-pointer">
                        Action Items
                      </Label>
                    </div>
                    <Switch
                      id="include-actions"
                      checked={shareOptions.include_action_items}
                      onCheckedChange={(v) => handleOptionChange('include_action_items', v)}
                      disabled={!hasActionItems || isSavingOptions}
                    />
                  </div>

                  <div className={cn(
                    "flex items-center justify-between p-3 rounded-lg border",
                    "bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700/50",
                    !hasTranscript && "opacity-50"
                  )}>
                    <div className="flex items-center gap-3">
                      <ScrollText className="w-4 h-4 text-violet-500" />
                      <Label htmlFor="include-transcript" className="text-sm cursor-pointer">
                        Transcript
                      </Label>
                    </div>
                    <Switch
                      id="include-transcript"
                      checked={shareOptions.include_transcript}
                      onCheckedChange={(v) => handleOptionChange('include_transcript', v)}
                      disabled={!hasTranscript || isSavingOptions}
                    />
                  </div>

                  {(hasRecording || hasFathomVideo) && (
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700/50">
                      <div className="flex items-center gap-3">
                        <Video className="w-4 h-4 text-orange-500" />
                        <Label htmlFor="include-recording" className="text-sm cursor-pointer">
                          Recording {sourceType === 'fathom' && '(Fathom link)'}
                        </Label>
                      </div>
                      <Switch
                        id="include-recording"
                        checked={shareOptions.include_recording}
                        onCheckedChange={(v) => handleOptionChange('include_recording', v)}
                        disabled={isSavingOptions}
                      />
                    </div>
                  )}
                </div>
              </div>

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
                        : 'Only you can access this meeting'}
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
                    <input
                      type="text"
                      readOnly
                      value={shareUrl}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                    <button
                      onClick={handleCopyLink}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all flex-shrink-0',
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

              {/* Fathom external link (always available if exists) */}
              {hasFathomVideo && fathomShareUrl && (
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700/50">
                  <a
                    href={fathomShareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open in Fathom
                  </a>
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

export default ShareMeetingModal;
