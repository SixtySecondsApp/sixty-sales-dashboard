/**
 * EnableAutoRecordingPrompt Component
 *
 * Modal prompt that appears after Google Calendar connection,
 * asking if the user wants to enable automatic meeting recording.
 *
 * This is a key part of the onboarding flow that guides users
 * to complete the MeetingBaaS calendar connection.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Bot, Calendar, CheckCircle2, Sparkles, Loader2 } from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

interface EnableAutoRecordingPromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEnableAutoRecording: () => Promise<void>;
  onSkip?: () => void;
  selectedCalendarName?: string;
}

// =============================================================================
// Component
// =============================================================================

export const EnableAutoRecordingPrompt: React.FC<EnableAutoRecordingPromptProps> = ({
  open,
  onOpenChange,
  onEnableAutoRecording,
  onSkip,
  selectedCalendarName = 'Primary Calendar',
}) => {
  const [isEnabling, setIsEnabling] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleEnable = async () => {
    setIsEnabling(true);
    try {
      await onEnableAutoRecording();
      setShowSuccess(true);

      // Auto-close after showing success
      setTimeout(() => {
        onOpenChange(false);
        setShowSuccess(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to enable auto-recording:', error);
      setIsEnabling(false);
    }
  };

  const handleSkip = () => {
    onSkip?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <AnimatePresence mode="wait">
          {!showSuccess ? (
            <motion.div
              key="prompt"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <DialogHeader>
                <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                  <Calendar className="h-8 w-8 text-emerald-600" />
                </div>
                <DialogTitle className="text-center text-xl">
                  Great! Your Google Calendar is Connected
                </DialogTitle>
                <DialogDescription className="text-center">
                  Would you like to enable automatic meeting recording?
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-6">
                {/* Benefits List */}
                <div className="space-y-3">
                  <BenefitItem
                    icon={Bot}
                    title="Automatic Bot Deployment"
                    description="The 60 Notetaker bot will automatically join your scheduled meetings"
                  />
                  <BenefitItem
                    icon={Sparkles}
                    title="AI-Powered Insights"
                    description="Get transcripts, summaries, and action items after each meeting"
                  />
                  <BenefitItem
                    icon={Calendar}
                    title={`Monitoring ${selectedCalendarName}`}
                    description="The bot will watch your calendar for new meetings with video links"
                  />
                </div>

                {/* Info Note */}
                <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50/50 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-700/30">
                  <Sparkles className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                  <div className="text-sm text-blue-700 dark:text-blue-300">
                    <p className="font-medium mb-1">You can customize recording rules later</p>
                    <p className="text-blue-600/80 dark:text-blue-400/80">
                      Control which meetings are recorded based on participants, keywords, and more.
                    </p>
                  </div>
                </div>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={handleSkip}
                  disabled={isEnabling}
                  className="w-full sm:w-auto"
                >
                  I'll do it manually
                </Button>
                <Button
                  onClick={handleEnable}
                  disabled={isEnabling}
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700"
                >
                  {isEnabling ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enabling...
                    </>
                  ) : (
                    <>
                      <Bot className="mr-2 h-4 w-4" />
                      Yes, Enable Auto-Recording
                    </>
                  )}
                </Button>
              </DialogFooter>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-12 text-center"
            >
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Auto-Recording Enabled!
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Your 60 Notetaker bot is now ready to join your meetings
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};

// =============================================================================
// BenefitItem Component
// =============================================================================

interface BenefitItemProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

const BenefitItem: React.FC<BenefitItemProps> = ({ icon: Icon, title, description }) => (
  <div className="flex items-start gap-3">
    <div className="h-10 w-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0">
      <Icon className="h-5 w-5 text-emerald-600" />
    </div>
    <div>
      <p className="font-medium text-gray-900 dark:text-gray-100">{title}</p>
      <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
    </div>
  </div>
);

export default EnableAutoRecordingPrompt;
