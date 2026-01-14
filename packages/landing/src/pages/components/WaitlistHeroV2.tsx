import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Check, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase/clientV2';
import { DIALER_OPTIONS, MEETING_RECORDER_OPTIONS, CRM_OPTIONS, TASK_MANAGER_OPTIONS } from '@/lib/types/waitlist';
import type { WaitlistSignupData } from '@/lib/types/waitlist';
import * as waitlistService from '@/lib/services/waitlistService';
import { toast } from 'sonner';
import { LiveWaitlistCount } from './gamification/LiveWaitlistCount';

// Simple Thank You Screen Component
function SimpleThankYou({ email, fullName }: { email: string; fullName: string }) {
  const firstName = fullName.split(' ')[0];

  return (
    <section className="relative min-h-screen flex items-center justify-center bg-white dark:bg-gray-950">
      <div className="max-w-md mx-auto px-6 py-12 text-center">
        {/* Success Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
          className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mb-8 shadow-lg"
        >
          <Check className="w-10 h-10 text-white" strokeWidth={3} />
        </motion.div>

        {/* Thank You Message */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-3xl font-bold text-gray-900 dark:text-white mb-4"
        >
          Thank you, {firstName}!
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-lg text-gray-600 dark:text-gray-300 mb-8"
        >
          You've successfully joined the waitlist.
        </motion.p>

        {/* Email Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6 mb-8"
        >
          <Mail className="w-8 h-8 text-blue-500 mx-auto mb-3" />
          <p className="text-gray-700 dark:text-gray-300 mb-2">
            We'll send updates to:
          </p>
          <p className="font-semibold text-gray-900 dark:text-white">
            {email}
          </p>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-sm text-gray-500 dark:text-gray-400"
        >
          Check your inbox for a confirmation email with more information.
        </motion.p>
      </div>
    </section>
  );
}

export function WaitlistHeroV2() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<WaitlistSignupData>({
    email: '',
    full_name: '',
    company_name: '',
    meeting_recorder_tool: '',
    meeting_recorder_other: '',
    crm_tool: '',
    crm_other: '',
    task_manager_tool: '',
    task_manager_other: '',
    referred_by_code: ''
  });

  // Parse referral code and capture registration URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refCode = params.get('ref');
    
    // Capture the full registration URL (pathname + search params)
    const registrationUrl = window.location.pathname + window.location.search;
    
    setFormData(prev => ({
      ...prev,
      referred_by_code: refCode || prev.referred_by_code,
      registration_url: registrationUrl
    }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validation
      if (!formData.email || !formData.full_name || !formData.company_name) {
        throw new Error('Please fill in all required fields');
      }
      if (!formData.meeting_recorder_tool || !formData.crm_tool || !formData.task_manager_tool) {
        throw new Error('Please select all integration options');
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        throw new Error('Please enter a valid email address');
      }

      // Always capture registration URL at submit time to ensure it's current
      const registrationUrl = window.location.pathname + window.location.search;
      const finalFormData = {
        ...formData,
        registration_url: registrationUrl
      };

      // Save to database
      await waitlistService.signupForWaitlist(finalFormData);

      // Navigate to thank you page (using state to avoid URL exposure)
      const email = formData.email.trim().toLowerCase();
      const fullName = formData.full_name.trim();
      const companyName = formData.company_name.trim();
      navigate('/waitlist/thank-you', {
        state: { email, fullName, companyName }
      });

      toast.success('Successfully joined the waitlist!');
    } catch (err) {
      const error = err as Error;
      toast.error(error.message || 'Failed to join waitlist. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: keyof WaitlistSignupData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };


  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">

      {/* Animated Background - Light/Dark Mode Aware */}
      <div className="absolute inset-0 bg-white dark:bg-gray-950 transition-colors duration-300">
        {/* Grid Pattern - Light mode subtle gray, dark mode subtle white */}
        <div
          className="absolute inset-0 opacity-[0.4] dark:opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px'
          }}
        />
        <div
          className="absolute inset-0 opacity-0 dark:opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px'
          }}
        />

        {/* Animated Gradient Orbs - Adjusted for light/dark mode */}
        <motion.div
          className="absolute top-1/4 -left-32 w-[600px] h-[600px] rounded-full opacity-40 dark:opacity-100"
          style={{
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
          animate={{
            x: [0, 50, 0],
            y: [0, 30, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute bottom-1/4 -right-32 w-[500px] h-[500px] rounded-full opacity-40 dark:opacity-100"
          style={{
            background: 'radial-gradient(circle, rgba(168, 85, 247, 0.12) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
          animate={{
            x: [0, -40, 0],
            y: [0, -40, 0],
            scale: [1, 1.15, 1],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Column - Marketing Content */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="text-center lg:text-left"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 dark:border-emerald-500/20 mb-6"
            >
              <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Limited Early Access</span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight"
            >
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-emerald-600 dark:from-blue-400 dark:via-purple-400 dark:to-emerald-400 bg-clip-text text-transparent">
                Post Meeting Admin
              </span>
              <br />
              <span className="text-gray-900 dark:text-white">Handled For You</span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="text-lg sm:text-xl text-gray-700 dark:text-gray-300 mb-8 max-w-2xl leading-relaxed"
            >
              Stop spending 10+ hours per week on admin work. AI-powered meeting intelligence that updates your CRM, creates follow-up tasks, and guarantees no deal falls through the cracks.
            </motion.p>

            {/* Benefits */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="space-y-3 mb-8"
            >
              {[
                'Reclaim 10+ hours every week',
                '31% fewer deals lost to poor follow-up',
                'Find hidden revenue in past conversations',
                'Priority onboarding & 50% launch discount'
              ].map((benefit, i) => (
                <div key={i} className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                  <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <span>{benefit}</span>
                </div>
              ))}
            </motion.div>

            {/* Live Waitlist Count */}
            <LiveWaitlistCount />
          </motion.div>

          {/* Right Column - Signup Form */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="w-full"
          >
            <div className="relative">
              {/* Glassmorphism Card - Light/Dark Mode */}
              <div className="relative backdrop-blur-xl bg-white/95 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-6 sm:p-8 shadow-xl dark:shadow-2xl transition-colors duration-300">
                {/* Gradient Border Effect */}
                <div className="absolute -inset-px bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-emerald-500/20 rounded-2xl opacity-30 dark:opacity-50 blur-sm" />

                <div className="relative">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Get Early Access</h2>
                  <p className="text-gray-700 dark:text-white mb-6">Join the waitlist and start saving 10+ hours per week</p>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Name */}
                    <div>
                      <Input
                        type="text"
                        required
                        placeholder="Full Name *"
                        value={formData.full_name}
                        onChange={(e) => handleChange('full_name', e.target.value)}
                        className="bg-gray-50 dark:bg-white/5 border-gray-300 dark:border-white/10 text-gray-900 dark:text-white placeholder:text-gray-500 h-12"
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <Input
                        type="email"
                        required
                        placeholder="Work Email *"
                        value={formData.email}
                        onChange={(e) => handleChange('email', e.target.value)}
                        className="bg-gray-50 dark:bg-white/5 border-gray-300 dark:border-white/10 text-gray-900 dark:text-white placeholder:text-gray-500 h-12"
                      />
                    </div>

                    {/* Company */}
                    <div>
                      <Input
                        type="text"
                        required
                        placeholder="Company Name *"
                        value={formData.company_name}
                        onChange={(e) => handleChange('company_name', e.target.value)}
                        className="bg-gray-50 dark:bg-white/5 border-gray-300 dark:border-white/10 text-gray-900 dark:text-white placeholder:text-gray-500 h-12"
                      />
                    </div>

                    <div className="pt-2 pb-1">
                      <p className="text-xs text-gray-700 dark:text-white mb-3">What integrations are important to you?</p>
                    </div>

                    {/* Meeting Recorder */}
                    <div>
                      <Select value={formData.meeting_recorder_tool} onValueChange={(value) => handleChange('meeting_recorder_tool', value)} required>
                        <SelectTrigger className="bg-gray-50 dark:bg-white/5 border-gray-300 dark:border-white/10 text-gray-900 dark:text-white h-12">
                          <SelectValue placeholder="Which meeting recorder? *" />
                        </SelectTrigger>
                        <SelectContent>
                          {MEETING_RECORDER_OPTIONS.map(option => (
                            <SelectItem key={option} value={option}>{option}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <AnimatePresence>
                        {formData.meeting_recorder_tool === 'Other' && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden mt-2"
                          >
                            <Input
                              type="text"
                              placeholder="Which meeting recorder?"
                              value={formData.meeting_recorder_other}
                              onChange={(e) => handleChange('meeting_recorder_other', e.target.value)}
                              className="bg-gray-50 dark:bg-white/5 border-gray-300 dark:border-white/10 text-gray-900 dark:text-white placeholder:text-gray-500 h-12"
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* CRM */}
                    <div>
                      <Select value={formData.crm_tool} onValueChange={(value) => handleChange('crm_tool', value)} required>
                        <SelectTrigger className="bg-gray-50 dark:bg-white/5 border-gray-300 dark:border-white/10 text-gray-900 dark:text-white h-12">
                          <SelectValue placeholder="Which CRM? *" />
                        </SelectTrigger>
                        <SelectContent>
                          {CRM_OPTIONS.map(option => (
                            <SelectItem key={option} value={option}>{option}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <AnimatePresence>
                        {formData.crm_tool === 'Other' && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden mt-2"
                          >
                            <Input
                              type="text"
                              placeholder="Which CRM?"
                              value={formData.crm_other}
                              onChange={(e) => handleChange('crm_other', e.target.value)}
                              className="bg-gray-50 dark:bg-white/5 border-gray-300 dark:border-white/10 text-gray-900 dark:text-white placeholder:text-gray-500 h-12"
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Task Manager */}
                    <div>
                      <Select value={formData.task_manager_tool} onValueChange={(value) => {
                        handleChange('task_manager_tool', value);
                        if (value !== 'Other') {
                          handleChange('task_manager_other', '');
                        }
                      }} required>
                        <SelectTrigger className="bg-gray-50 dark:bg-white/5 border-gray-300 dark:border-white/10 text-gray-900 dark:text-white h-12">
                          <SelectValue placeholder="Which Task Manager? *" />
                        </SelectTrigger>
                        <SelectContent>
                          {TASK_MANAGER_OPTIONS.map(option => (
                            <SelectItem key={option} value={option}>{option}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <AnimatePresence>
                        {formData.task_manager_tool === 'Other' && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden mt-2"
                          >
                            <Input
                              type="text"
                              placeholder="Which task manager?"
                              value={formData.task_manager_other}
                              onChange={(e) => handleChange('task_manager_other', e.target.value)}
                              className="bg-gray-50 dark:bg-white/5 border-gray-300 dark:border-white/10 text-gray-900 dark:text-white placeholder:text-gray-500 h-12"
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Referral Code (if present) */}
                    {formData.referred_by_code && (
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm">
                          <Check className="w-4 h-4" />
                          <span>Referred by: <strong>{formData.referred_by_code}</strong></span>
                        </div>
                      </div>
                    )}

                    {/* Submit Button */}
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 font-semibold h-12 text-base"
                      style={{ color: 'white' }}
                    >
                      {isSubmitting ? 'Joining Waitlist...' : 'Get Early Access'}
                    </Button>

                    <p className="text-xs text-gray-500 dark:text-gray-500 text-center">
                      No credit card required
                    </p>
                  </form>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
