import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Users, TrendingUp, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWaitlistSignup } from '@/lib/hooks/useWaitlistSignup';
import { DIALER_OPTIONS, MEETING_RECORDER_OPTIONS, CRM_OPTIONS } from '@/lib/types/waitlist';
import type { WaitlistSignupData } from '@/lib/types/waitlist';
import { WaitlistSuccess } from './WaitlistSuccess';
import { captureRegistrationUrl } from '@/lib/utils/registrationUrl';

export function WaitlistHero() {
  const { signup, isSubmitting, success } = useWaitlistSignup();
  const [formData, setFormData] = useState<WaitlistSignupData>({
    email: '',
    full_name: '',
    company_name: '',
    dialer_tool: '',
    meeting_recorder_tool: '',
    crm_tool: '',
    referred_by_code: ''
  });

  // Parse referral code and capture registration URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refCode = params.get('ref');
    
    // Capture the full registration URL (pathname + search params) and normalize it
    const registrationUrl = captureRegistrationUrl();
    
    setFormData(prev => ({
      ...prev,
      referred_by_code: refCode || prev.referred_by_code,
      registration_url: registrationUrl
    }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Always capture registration URL at submit time to ensure it's current
    const registrationUrl = captureRegistrationUrl();
    const finalFormData = {
      ...formData,
      registration_url: registrationUrl
    };
    await signup(finalFormData);
  };

  const handleChange = (field: keyof WaitlistSignupData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Show success modal if signup was successful
  if (success) {
    return <WaitlistSuccess entry={success} />;
  }

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-[#0a0d14]">
        {/* Grid Pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px'
          }}
        />

        {/* Animated Gradient Orbs */}
        <motion.div
          className="absolute top-1/4 -left-32 w-[600px] h-[600px] rounded-full"
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
          className="absolute bottom-1/4 -right-32 w-[500px] h-[500px] rounded-full"
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
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 mb-6"
            >
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-blue-300">Coming Soon</span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6"
            >
              <span className="text-white">Join the</span>
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent">
                Meeting Intelligence
              </span>
              <br />
              <span className="text-white">Revolution</span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="text-lg sm:text-xl text-gray-300 mb-8 max-w-2xl"
            >
              Be among the first to experience AI-powered meeting insights that automatically update your CRM,
              create follow-up tasks, and reveal revenue opportunities.
            </motion.p>

            {/* Benefits */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="space-y-3 mb-8"
            >
              {[
                'Early access to exclusive features',
                'Influence our integration roadmap',
                'Special launch pricing (50% off)',
                'Priority onboarding support'
              ].map((benefit, i) => (
                <div key={i} className="flex items-center gap-3 text-gray-300">
                  <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <span>{benefit}</span>
                </div>
              ))}
            </motion.div>

            {/* Social Proof */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.8 }}
              className="flex items-center gap-4 text-gray-400"
            >
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 border-2 border-[#0a0d14]" />
                ))}
              </div>
              <div className="text-sm">
                <Users className="w-4 h-4 inline mr-1" />
                Join <span className="text-white font-semibold">200+</span> sales teams already on the list
              </div>
            </motion.div>
          </motion.div>

          {/* Right Column - Signup Form */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="w-full"
          >
            <div className="relative">
              {/* Glassmorphism Card */}
              <div className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 shadow-2xl">
                {/* Gradient Border Effect */}
                <div className="absolute -inset-px bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-emerald-500/20 rounded-2xl opacity-50 blur-sm" />

                <div className="relative">
                  <h2 className="text-2xl font-bold text-white mb-2">Get Early Access</h2>
                  <p className="text-gray-400 mb-6">Reserve your spot and move up the waitlist by referring friends</p>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Full Name *
                      </label>
                      <Input
                        type="text"
                        required
                        placeholder="John Smith"
                        value={formData.full_name}
                        onChange={(e) => handleChange('full_name', e.target.value)}
                        className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Work Email *
                      </label>
                      <Input
                        type="email"
                        required
                        placeholder="john@company.com"
                        value={formData.email}
                        onChange={(e) => handleChange('email', e.target.value)}
                        className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                      />
                    </div>

                    {/* Company */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Company Name *
                      </label>
                      <Input
                        type="text"
                        required
                        placeholder="Acme Inc"
                        value={formData.company_name}
                        onChange={(e) => handleChange('company_name', e.target.value)}
                        className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                      />
                    </div>

                    {/* Dialer */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Which dialer do you use?
                      </label>
                      <Select value={formData.dialer_tool} onValueChange={(value) => handleChange('dialer_tool', value)}>
                        <SelectTrigger className="bg-white/5 border-white/10 text-white">
                          <SelectValue placeholder="Select dialer" />
                        </SelectTrigger>
                        <SelectContent>
                          {DIALER_OPTIONS.map(option => (
                            <SelectItem key={option} value={option}>{option}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Meeting Recorder */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Which meeting recorder do you use?
                      </label>
                      <Select value={formData.meeting_recorder_tool} onValueChange={(value) => handleChange('meeting_recorder_tool', value)}>
                        <SelectTrigger className="bg-white/5 border-white/10 text-white">
                          <SelectValue placeholder="Select recorder" />
                        </SelectTrigger>
                        <SelectContent>
                          {MEETING_RECORDER_OPTIONS.map(option => (
                            <SelectItem key={option} value={option}>{option}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* CRM */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Which CRM do you use?
                      </label>
                      <Select value={formData.crm_tool} onValueChange={(value) => handleChange('crm_tool', value)}>
                        <SelectTrigger className="bg-white/5 border-white/10 text-white">
                          <SelectValue placeholder="Select CRM" />
                        </SelectTrigger>
                        <SelectContent>
                          {CRM_OPTIONS.map(option => (
                            <SelectItem key={option} value={option}>{option}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Referral Code (if present) */}
                    {formData.referred_by_code && (
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-emerald-400 text-sm">
                          <TrendingUp className="w-4 h-4" />
                          <span>Referred by: <strong>{formData.referred_by_code}</strong></span>
                        </div>
                      </div>
                    )}

                    {/* Submit Button */}
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold py-6 text-lg"
                    >
                      {isSubmitting ? 'Joining...' : 'Join the Waitlist'}
                    </Button>

                    <p className="text-xs text-gray-500 text-center">
                      No credit card required • Get 5 spots ahead for each referral
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
