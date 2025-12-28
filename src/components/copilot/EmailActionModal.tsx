/**
 * Email Action Modal Component
 * Provides proper UI for email reply and forward actions (replaces browser prompt())
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Mail, Reply, Forward, Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type EmailActionType = 'reply' | 'forward';

interface EmailActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: EmailActionData) => Promise<void>;
  actionType: EmailActionType;
  emailDetails?: {
    replyTo?: string;
    subject?: string;
    originalSnippet?: string;
  };
}

export interface EmailActionData {
  body: string;
  recipients?: string[]; // For forward only
  subject?: string;
}

export const EmailActionModal: React.FC<EmailActionModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  actionType,
  emailDetails
}) => {
  const [body, setBody] = useState('');
  const [recipients, setRecipients] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setBody('');
      setRecipients('');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!body.trim()) return;
    if (actionType === 'forward' && !recipients.trim()) return;

    setIsSubmitting(true);
    try {
      const data: EmailActionData = {
        body: body.trim(),
        subject: emailDetails?.subject
      };

      if (actionType === 'forward') {
        data.recipients = recipients
          .split(',')
          .map(e => e.trim())
          .filter(e => e);
      }

      await onSubmit(data);
      onClose();
    } catch (error) {
      // Error handling is done in parent component
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isReply = actionType === 'reply';
  const Icon = isReply ? Reply : Forward;
  const title = isReply ? 'Reply to Email' : 'Forward Email';
  const buttonText = isReply ? 'Send Reply' : 'Forward';

  const isValid = body.trim() && (isReply || recipients.trim());

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <Icon className="w-5 h-5 text-blue-500" />
            {title}
          </DialogTitle>
          {emailDetails?.replyTo && isReply && (
            <DialogDescription className="text-sm text-gray-500 dark:text-gray-400">
              To: {emailDetails.replyTo}
            </DialogDescription>
          )}
          {emailDetails?.subject && (
            <DialogDescription className="text-sm text-gray-500 dark:text-gray-400">
              Subject: {emailDetails.subject}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Forward recipients input */}
          {actionType === 'forward' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Forward to
              </label>
              <Input
                placeholder="Enter email addresses (comma-separated)"
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
                className="w-full"
                autoFocus
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Separate multiple recipients with commas
              </p>
            </div>
          )}

          {/* Original email snippet (collapsed) */}
          {emailDetails?.originalSnippet && (
            <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700/50">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Original message:
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">
                {emailDetails.originalSnippet}
              </p>
            </div>
          )}

          {/* Message body */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {isReply ? 'Your reply' : 'Add a message (optional)'}
            </label>
            <Textarea
              placeholder={isReply ? 'Type your reply...' : 'Add a message before forwarding...'}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-[150px] resize-none"
              autoFocus={isReply}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Press {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Enter to send
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
            className={cn(
              'bg-blue-600 hover:bg-blue-700 text-white',
              isSubmitting && 'opacity-70'
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                {buttonText}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EmailActionModal;
