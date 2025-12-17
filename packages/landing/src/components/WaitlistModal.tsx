import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Check, Copy, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWaitlistSignup } from '@/lib/hooks/useWaitlistSignup';
import { MEETING_RECORDER_OPTIONS, CRM_OPTIONS, TASK_MANAGER_OPTIONS } from '@/lib/types/waitlist';
import type { WaitlistSignupData } from '@/lib/types/waitlist';
import { toast } from 'sonner';

interface WaitlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEmail?: string;
  signupSource?: string;
}

export function WaitlistModal({ isOpen, onClose, initialEmail = '', signupSource = 'join-popup' }: WaitlistModalProps) {
  const { signup, isSubmitting, success, reset } = useWaitlistSignup();
  const [copied, setCopied] = useState(false);
  const [formData, setFormData] = useState<WaitlistSignupData>({
    email: initialEmail,
    full_name: '',
    company_name: '',
    meeting_recorder_tool: '',
    meeting_recorder_other: '',
    crm_tool: '',
    crm_other: '',
    task_manager_tool: '',
    task_manager_other: '',
    referred_by_code: '',
    signup_source: signupSource
  });

  // Update email when initialEmail changes
  useEffect(() => {
    if (initialEmail) {
      setFormData(prev => ({ ...prev, email: initialEmail }));
    }
  }, [initialEmail]);

  // Parse referral code from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refCode = params.get('ref');
    if (refCode) {
      setFormData(prev => ({ ...prev, referred_by_code: refCode }));
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await signup({ ...formData, signup_source: signupSource });
  };

  const handleChange = (field: keyof WaitlistSignupData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCopyReferralLink = () => {
    if (success) {
      const referralUrl = `${window.location.origin}/waitlist?ref=${success.referral_code}`;
      navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      toast.success('Referral link copied!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <AnimatePresence mode="wait">
          {success ? (
            // Success State
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="text-center py-4"
            >
              <div className="w-16 h-16 bg-gradient-to-br from-brand-teal to-brand-blue rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-white" />
              </div>

              <h2 className="font-heading text-2xl font-bold text-gray-900 dark:text-white mb-2">
                You're on the waitlist!
              </h2>

              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Welcome, {success.full_name.split(' ')[0]}! We'll notify you when it's your turn.
              </p>

              {/* Referral Code */}
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 mb-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Share your referral code with colleagues:
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white dark:bg-gray-900 px-3 py-2 rounded-lg text-sm font-mono text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700">
                    {success.referral_code}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyReferralLink}
                    className="shrink-0"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-brand-teal" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Position info */}
              {success.effective_position && (
                <p className="text-sm text-gray-500 dark:text-gray-500">
                  Your current position: <span className="font-semibold text-gray-900 dark:text-white">#{success.effective_position}</span>
                </p>
              )}

              <Button
                onClick={handleClose}
                className="w-full mt-4 bg-gradient-to-r from-brand-blue to-brand-violet hover:from-[#2351C4] hover:to-[#7024C0]"
              >
                Done
              </Button>
            </motion.div>
          ) : (
            // Form State
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <DialogHeader className="pb-4">
                <div className="flex items-center gap-2 text-brand-teal mb-2">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-sm font-medium">Limited Early Access</span>
                </div>
                <DialogTitle className="font-heading text-xl font-bold text-gray-900 dark:text-white">
                  Get Early Access
                </DialogTitle>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Join the waitlist and start saving 10+ hours per week
                </p>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name */}
                <Input
                  type="text"
                  required
                  placeholder="Full Name *"
                  value={formData.full_name}
                  onChange={(e) => handleChange('full_name', e.target.value)}
                  className="bg-gray-50 dark:bg-white/5 border-gray-300 dark:border-white/10 text-gray-900 dark:text-white placeholder:text-gray-500 h-11"
                />

                {/* Email */}
                <Input
                  type="email"
                  required
                  placeholder="Work Email *"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className="bg-gray-50 dark:bg-white/5 border-gray-300 dark:border-white/10 text-gray-900 dark:text-white placeholder:text-gray-500 h-11"
                />

                {/* Company */}
                <Input
                  type="text"
                  required
                  placeholder="Company Name *"
                  value={formData.company_name}
                  onChange={(e) => handleChange('company_name', e.target.value)}
                  className="bg-gray-50 dark:bg-white/5 border-gray-300 dark:border-white/10 text-gray-900 dark:text-white placeholder:text-gray-500 h-11"
                />

                <p className="text-xs text-gray-600 dark:text-gray-400 pt-1">
                  What integrations are important to you?
                </p>

                {/* Task Manager */}
                <Select value={formData.task_manager_tool} onValueChange={(value) => handleChange('task_manager_tool', value)} required>
                  <SelectTrigger className="bg-gray-50 dark:bg-white/5 border-gray-300 dark:border-white/10 text-gray-900 dark:text-white h-11">
                    <SelectValue placeholder="Which task manager? *" />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_MANAGER_OPTIONS.map(option => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.task_manager_tool === 'Other' && (
                  <Input
                    type="text"
                    placeholder="Which task manager?"
                    value={formData.task_manager_other}
                    onChange={(e) => handleChange('task_manager_other', e.target.value)}
                    className="bg-gray-50 dark:bg-white/5 border-gray-300 dark:border-white/10 text-gray-900 dark:text-white placeholder:text-gray-500 h-11"
                  />
                )}

                {/* Meeting Recorder */}
                <Select value={formData.meeting_recorder_tool} onValueChange={(value) => handleChange('meeting_recorder_tool', value)} required>
                  <SelectTrigger className="bg-gray-50 dark:bg-white/5 border-gray-300 dark:border-white/10 text-gray-900 dark:text-white h-11">
                    <SelectValue placeholder="Which meeting recorder? *" />
                  </SelectTrigger>
                  <SelectContent>
                    {MEETING_RECORDER_OPTIONS.map(option => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.meeting_recorder_tool === 'Other' && (
                  <Input
                    type="text"
                    placeholder="Which meeting recorder?"
                    value={formData.meeting_recorder_other}
                    onChange={(e) => handleChange('meeting_recorder_other', e.target.value)}
                    className="bg-gray-50 dark:bg-white/5 border-gray-300 dark:border-white/10 text-gray-900 dark:text-white placeholder:text-gray-500 h-11"
                  />
                )}

                {/* CRM */}
                <Select value={formData.crm_tool} onValueChange={(value) => handleChange('crm_tool', value)} required>
                  <SelectTrigger className="bg-gray-50 dark:bg-white/5 border-gray-300 dark:border-white/10 text-gray-900 dark:text-white h-11">
                    <SelectValue placeholder="Which CRM? *" />
                  </SelectTrigger>
                  <SelectContent>
                    {CRM_OPTIONS.map(option => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.crm_tool === 'Other' && (
                  <Input
                    type="text"
                    placeholder="Which CRM?"
                    value={formData.crm_other}
                    onChange={(e) => handleChange('crm_other', e.target.value)}
                    className="bg-gray-50 dark:bg-white/5 border-gray-300 dark:border-white/10 text-gray-900 dark:text-white placeholder:text-gray-500 h-11"
                  />
                )}

                {/* Referral Code (if present) */}
                {formData.referred_by_code && (
                  <div className="bg-brand-teal/10 border border-brand-teal/20 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-brand-teal text-sm">
                      <Check className="w-4 h-4" />
                      <span>Referred by: <strong>{formData.referred_by_code}</strong></span>
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-brand-blue to-brand-violet hover:from-[#2351C4] hover:to-[#7024C0] font-semibold h-11 text-base"
                  style={{ color: 'white' }}
                >
                  {isSubmitting ? 'Joining Waitlist...' : 'Get Early Access'}
                </Button>

                <p className="text-xs text-gray-500 text-center">
                  No credit card required • 50% launch discount
                </p>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

export default WaitlistModal;
