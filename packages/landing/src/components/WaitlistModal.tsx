import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Check, Copy, X, PartyPopper, Mail } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWaitlistSignup } from '../lib/hooks/useWaitlistSignup';
import { savePartialSignup } from '../lib/services/waitlistService';
import { captureRegistrationUrl } from '../lib/utils/registrationUrl';
import { MEETING_RECORDER_OPTIONS, CRM_OPTIONS, TASK_MANAGER_OPTIONS } from '../lib/types/waitlist';
import type { WaitlistSignupData } from '../lib/types/waitlist';
import { toast } from 'sonner';

interface WaitlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEmail?: string;
  signupSource?: string;
}

export function WaitlistModal({ isOpen, onClose, initialEmail = '', signupSource = 'join-popup' }: WaitlistModalProps) {
  const navigate = useNavigate();
  const { signup, isSubmitting, success, simpleSuccess, reset } = useWaitlistSignup();

  // Check for either success state (gamification enabled or disabled)
  const isSuccess = success || simpleSuccess;

  // Navigate to thank-you page when signup is successful
  useEffect(() => {
    if (simpleSuccess) {
      const email = simpleSuccess.email.trim().toLowerCase();
      const fullName = simpleSuccess.full_name.trim();
      navigate('/waitlist/thank-you', {
        state: { email, fullName }
      });
      // Close the modal after navigation
      onClose();
    }
  }, [simpleSuccess, navigate, onClose]);
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

    // Client-side validation for Select components (they don't support HTML required)
    if (!formData.task_manager_tool) {
      toast.error('Please select a task manager');
      return;
    }
    if (!formData.meeting_recorder_tool) {
      toast.error('Please select a meeting recorder');
      return;
    }
    if (!formData.crm_tool) {
      toast.error('Please select a CRM');
      return;
    }

    // Capture the full registration URL (pathname + search params) at submit time
    const registrationUrl = captureRegistrationUrl();

    await signup({ 
      ...formData, 
      signup_source: signupSource,
      registration_url: registrationUrl
    });
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

  const handleClose = async () => {
    // If the form wasn't successfully submitted but user entered an email, save partial signup
    if (!isSuccess && formData.email && formData.email.includes('@')) {
      await savePartialSignup(formData.email, signupSource);
    }
    reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <AnimatePresence mode="wait">
          {isSuccess ? (
            // Success State - Celebratory Design
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", duration: 0.6 }}
              className="text-center py-6 relative overflow-hidden"
            >
              {/* Animated celebration particles */}
              <div className="absolute inset-0 pointer-events-none">
                {[...Array(12)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{
                      opacity: 0,
                      scale: 0,
                      x: '50%',
                      y: '30%'
                    }}
                    animate={{
                      opacity: [0, 1, 0],
                      scale: [0, 1, 0.5],
                      x: `${20 + Math.random() * 60}%`,
                      y: `${Math.random() * 100}%`,
                    }}
                    transition={{
                      duration: 1.5,
                      delay: i * 0.08,
                      ease: "easeOut"
                    }}
                    className="absolute w-2 h-2 rounded-full"
                    style={{
                      background: ['#00D4AA', '#2563EB', '#8B5CF6', '#F59E0B', '#EC4899'][i % 5],
                    }}
                  />
                ))}
              </div>

              {/* Glowing success icon */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", delay: 0.2, duration: 0.8 }}
                className="relative mx-auto mb-6"
              >
                <div className="absolute inset-0 w-20 h-20 mx-auto bg-gradient-to-br from-brand-teal to-brand-blue rounded-full blur-xl opacity-50" />
                <div className="relative w-20 h-20 mx-auto bg-gradient-to-br from-brand-teal via-brand-blue to-brand-violet rounded-full flex items-center justify-center shadow-lg shadow-brand-teal/30">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.5, type: "spring" }}
                  >
                    <Check className="w-10 h-10 text-white" strokeWidth={3} />
                  </motion.div>
                </div>
              </motion.div>

              {/* Celebratory header */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <div className="flex items-center justify-center gap-2 mb-3">
                  <PartyPopper className="w-5 h-5 text-amber-400" />
                  <span className="text-sm font-semibold text-brand-teal uppercase tracking-wider">
                    You're in!
                  </span>
                  <PartyPopper className="w-5 h-5 text-amber-400 scale-x-[-1]" />
                </div>

                <h2 className="font-heading text-2xl sm:text-3xl font-bold text-white mb-3">
                  Welcome to the waitlist,{' '}
                  <span className="bg-gradient-to-r from-brand-teal to-brand-blue bg-clip-text text-transparent">
                    {isSuccess.full_name.split(' ')[0]}!
                  </span>
                </h2>
              </motion.div>

              {/* Info card */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6 backdrop-blur-sm"
              >
                <div className="flex items-center gap-3 text-left">
                  <div className="w-10 h-10 rounded-full bg-brand-blue/20 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-5 h-5 text-brand-blue" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-300">
                      We'll email you at <span className="font-medium text-white">{isSuccess.email}</span> when it's your turn.
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* What's next section */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-left mb-6"
              >
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">What happens next</p>
                <div className="space-y-2">
                  {[
                    'Early access with 50% lifetime discount',
                    'Priority onboarding when we launch',
                    'Exclusive product updates'
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-gray-300">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-teal" />
                      {item}
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Referral Code - only show if gamification is enabled */}
              {success?.referral_code && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="bg-gradient-to-r from-brand-teal/10 to-brand-blue/10 border border-brand-teal/20 rounded-xl p-4 mb-4"
                >
                  <p className="text-sm text-gray-300 mb-2">
                    <Sparkles className="w-4 h-4 inline mr-1 text-amber-400" />
                    Share & move up the waitlist:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-black/30 px-3 py-2 rounded-lg text-sm font-mono text-white border border-white/10">
                      {success.referral_code}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyReferralLink}
                      className="shrink-0 border-brand-teal/30 hover:bg-brand-teal/20"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-brand-teal" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Position info - only show if gamification is enabled */}
              {success?.effective_position && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  className="text-sm text-gray-400 mb-4"
                >
                  Your current position: <span className="font-bold text-white">#{success.effective_position}</span>
                </motion.p>
              )}

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <Button
                  onClick={handleClose}
                  className="w-full bg-gradient-to-r from-brand-blue to-brand-violet hover:from-[#2351C4] hover:to-[#7024C0] text-white font-semibold h-12 text-base shadow-lg shadow-brand-violet/25"
                >
                  Got it, thanks!
                </Button>
              </motion.div>
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
