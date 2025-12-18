import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Check, ArrowRight, MailX, FileClock, CalendarClock, Inbox,
  X, Send, FileText, ClipboardList, Zap
} from 'lucide-react';
import { supabase } from '@/lib/supabase/clientV2';
import { usePublicBrandingSettings } from '@landing/lib/hooks/useBrandingSettings';
import { captureRegistrationUrl } from '@landing/lib/utils/registrationUrl';
import { useForceDarkMode } from '@landing/lib/hooks/useForceDarkMode';
import { WaitlistModal } from '@landing/components/WaitlistModal';

// Types
interface FormData {
  full_name: string;
  email: string;
  company_name: string;
  meeting_recorder_tool: string;
  crm_tool: string;
  task_manager_tool: string;
  task_manager_other: string;
}
const MEETING_RECORDER_OPTIONS = ['Fathom', 'Gong', 'Chorus', 'Fireflies', 'Otter.ai', 'None', 'Other'];
const CRM_OPTIONS = ['Salesforce', 'HubSpot', 'Pipedrive', 'Close', 'Zoho', 'None', 'Other'];
const TASK_MANAGER_OPTIONS = ['Monday', 'Jira', 'Coda', 'Asana', 'Teams', 'Trello'];

// Validation helpers
const isValidEmail = (email: string): boolean => {
  if (!email || !email.trim()) return false;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
};

const sanitizeName = (name: string): string => {
  return name.replace(/[^a-zA-Z\s'-]/g, '');
};

export default function EarlyAccessLanding() {
  const navigate = useNavigate();

  // Force dark mode for landing pages
  useForceDarkMode();

  // Branding settings for logos
  const { logoDark } = usePublicBrandingSettings();

  const [waitlistCount, setWaitlistCount] = useState<number | null>(null);
  const [formData, setFormData] = useState<FormData>({
    full_name: '',
    email: '',
    company_name: '',
    meeting_recorder_tool: '',
    crm_tool: '',
    task_manager_tool: '',
    task_manager_other: ''
  });
  const [ctaEmail, setCtaEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [shouldGlow, setShouldGlow] = useState(false);

  // WaitlistModal State (for CTA section)
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);

  // Fetch waitlist count on mount
  useEffect(() => {
    fetchWaitlistCount();
  }, []);

  const fetchWaitlistCount = async () => {
    try {
      const { count, error } = await (supabase as any)
        .from('meetings_waitlist')
        .select('*', { count: 'exact', head: true });

      if (!error && count !== null) {
        setWaitlistCount(count);
      } else {
        // Fallback if RLS prevents public access
        setWaitlistCount(127);
      }
    } catch (err) {
      console.error('Error fetching waitlist count:', err);
      // Fallback on error
      setWaitlistCount(127);
    }
  };

  // Prevent special characters from being typed in name/company fields
  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key.length === 1) {
      const allowedPattern = /^[a-zA-Z\s'-]$/;
      if (!allowedPattern.test(e.key)) {
        e.preventDefault();
      }
    }
  };

  // Sanitize pasted text in name/company fields
  const handleNamePaste = (e: React.ClipboardEvent<HTMLInputElement>, field: 'full_name' | 'company_name') => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const sanitized = sanitizeName(pastedText);
    if (field === 'full_name') {
      setFormData(prev => ({ ...prev, full_name: sanitized }));
    } else {
      setFormData(prev => ({ ...prev, company_name: sanitized }));
    }
  };

  // Handle name/company change with sanitization
  const handleNameChange = (field: 'full_name' | 'company_name', value: string) => {
    const sanitized = sanitizeName(value);
    setFormData(prev => ({ ...prev, [field]: sanitized }));
  };

  // Validate email on blur
  const handleEmailBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.target.value && !isValidEmail(e.target.value)) {
      e.target.setCustomValidity('Please enter a valid email address');
    } else {
      e.target.setCustomValidity('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsSubmitting(true);
    setMessage(null);

    // Validate email before submission
    if (!isValidEmail(formData.email)) {
      setMessage({ type: 'error', text: 'Please enter a valid email address' });
      setIsSubmitting(false);
      return;
    }

    // Validate all three dropdowns are selected
    if (!formData.meeting_recorder_tool || !formData.crm_tool || !formData.task_manager_tool) {
      setMessage({ type: 'error', text: 'Please select an option for Meeting Recorder, CRM, and Task Manager' });
      setIsSubmitting(false);
      return;
    }

    // Validate "Other" option has a value
    if (formData.task_manager_tool === 'Other' && !formData.task_manager_other?.trim()) {
      setMessage({ type: 'error', text: 'Please specify which task manager you use' });
      setIsSubmitting(false);
      return;
    }

    // Preserve form data in case of error
    const currentFormData = { ...formData };

    try {
      // Capture the full registration URL (pathname + search params)
      // Always capture at submit time to ensure we have the current URL
      // Normalize to remove trailing slashes (e.g., "/waitlist/" -> "/waitlist")
      const registrationUrl = typeof window !== 'undefined' 
        ? captureRegistrationUrl() 
        : '/waitlist';
      
      console.log('[Waitlist] Capturing registration URL:', {
        registrationUrl,
        windowLocation: typeof window !== 'undefined' ? window.location.href : 'N/A'
      }); // Debug log
      
      const cleanData = {
        email: formData.email.trim().toLowerCase(),
        full_name: sanitizeName(formData.full_name.trim()) || null,
        company_name: sanitizeName(formData.company_name.trim()) || null,
        dialer_tool: null,
        meeting_recorder_tool: formData.meeting_recorder_tool || null,
        crm_tool: formData.crm_tool || null,
        task_manager_tool: formData.task_manager_tool || null,
        task_manager_other: formData.task_manager_other?.trim() || null,
        registration_url: registrationUrl || '/waitlist' // Fallback to /waitlist if somehow empty
      };
      
      console.log('[Waitlist] Submitting with registration_url:', cleanData.registration_url); // Debug log
      console.log('[Waitlist] Full cleanData object:', cleanData); // Debug log
      console.log('[Waitlist] registration_url in cleanData:', cleanData.registration_url); // Debug log

      const { data: entry, error } = await (supabase as any)
        .from('meetings_waitlist')
        .insert([cleanData])
        .select()
        .single();

      if (error) {
        console.error('[Waitlist] Insert error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        if (error.code === '23505' || error.message?.includes('duplicate')) {
          throw new Error('This email is already on the waitlist!');
        }
        throw error;
      }
      
      console.log('[Waitlist] Insert result:', { 
        entry, 
        error,
        entryRegistrationUrl: entry?.registration_url,
        cleanDataRegistrationUrl: cleanData.registration_url,
        allEntryFields: entry ? Object.keys(entry) : []
      }); // Debug log
      
      // Verify the registration_url was saved
      if (entry) {
        if (entry.registration_url !== cleanData.registration_url) {
          console.warn('[Waitlist] WARNING: registration_url mismatch!', {
            sent: cleanData.registration_url,
            received: entry.registration_url,
            entryHasField: 'registration_url' in entry
          });
          
          // If registration_url wasn't saved, try to update it directly
          if (!entry.registration_url && cleanData.registration_url) {
            console.log('[Waitlist] Attempting to update registration_url after insert...');
            const { error: updateError } = await (supabase as any)
              .from('meetings_waitlist')
              .update({ registration_url: cleanData.registration_url })
              .eq('id', entry.id);
            
            if (updateError) {
              console.error('[Waitlist] Failed to update registration_url:', updateError);
            } else {
              console.log('[Waitlist] Successfully updated registration_url after insert');
            }
          }
        } else {
          console.log('[Waitlist] ✓ registration_url saved correctly:', entry.registration_url);
        }
      }

      // Send welcome email using the same method as onboarding simulator
      try {
        const firstName = sanitizeName(formData.full_name.trim()).split(' ')[0];
        const { data: emailData, error: emailError } = await supabase.functions.invoke('encharge-send-email', {
          body: {
            template_type: 'waitlist_welcome',
            to_email: formData.email.trim().toLowerCase(),
            to_name: firstName,
            variables: {
              user_name: firstName,
              full_name: sanitizeName(formData.full_name.trim()),
              company_name: sanitizeName(formData.company_name.trim()) || '',
              first_name: firstName,
              email: formData.email.trim().toLowerCase(),
            },
          },
        });

        if (emailError) {
          console.error('[Waitlist] Welcome email failed:', emailError);
        } else {
          console.log('[Waitlist] Welcome email sent successfully:', emailData);
        }
      } catch (err) {
        console.error('[Waitlist] Welcome email exception:', err);
      }

      // Navigate to thank you page with user data (using state to avoid URL exposure)
      const email = formData.email.trim().toLowerCase();
      const fullName = sanitizeName(formData.full_name.trim());
      navigate('/waitlist/thank-you', {
        state: { email, fullName }
      });
    } catch (err: any) {
      // Preserve form data on error - don't clear fields
      setFormData(currentFormData);
      setMessage({ type: 'error', text: err.message || 'Failed to join waitlist' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle initial CTA email submission - opens WaitlistModal
  const handleCtaEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ctaEmail.trim()) return;

    // Validate email before opening modal
    if (!isValidEmail(ctaEmail)) {
      return; // Browser will show validation error
    }

    // Open WaitlistModal with pre-filled email
    setShowWaitlistModal(true);
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const displayCount = waitlistCount !== null ? `${waitlistCount}+` : '...';

  return (
    <div className="min-h-screen bg-gray-950 text-white font-body antialiased overflow-x-hidden transition-colors duration-300">
      {/* Background */}
      <div className="fixed inset-0 z-0">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />
        <motion.div
          className="absolute top-[15%] -left-[10%] w-[600px] h-[600px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
          animate={{ x: [0, 30, 0], y: [0, -20, 0], scale: [1, 1.05, 1] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-[20%] -right-[10%] w-[500px] h-[500px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(168, 85, 247, 0.12) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
          animate={{ x: [0, -40, 0], y: [0, -40, 0], scale: [1, 1.15, 1] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, transparent 60%)',
            filter: 'blur(80px)',
          }}
          animate={{ opacity: [0.5, 0.8, 0.5], scale: [1, 1.2, 1] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-gray-950/90 border-b border-gray-800 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-3">
            <img src={logoDark} alt="Sixty Seconds" className="h-10 transition-all duration-300" />
          </button>
          <div className="hidden md:flex items-center gap-8">
            <button onClick={() => scrollToSection('problem')} className="text-sm font-medium text-gray-400 hover:text-white transition-colors">The Problem</button>
            <button onClick={() => scrollToSection('solution')} className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Solution</button>
            <button onClick={() => scrollToSection('features')} className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Features</button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                // Trigger glow animation after scroll completes
                setTimeout(() => {
                  setShouldGlow(true);
                  // Reset after animation completes (2 glows, ~2 seconds total)
                  setTimeout(() => {
                    setShouldGlow(false);
                  }, 2000);
                }, 500); // Wait for scroll to start
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-brand-blue to-brand-violet text-white text-sm font-semibold rounded-xl shadow-lg shadow-brand-violet/25 hover:opacity-90 hover:-translate-y-0.5 transition-all"
            >
              Join Waitlist
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      <main className="relative z-10">
        {/* Hero Section */}
        <section className="min-h-screen flex items-center pt-24 pb-16">
          <div className="max-w-7xl mx-auto px-6 w-full">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* Left Column - Hero Text (shows second on mobile) */}
              <motion.div
                className="text-center lg:text-left order-2 lg:order-1"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-teal/10 border border-brand-teal/20 mb-6"
                >
                  <Sparkles className="w-4 h-4 text-brand-teal" />
                  <span className="text-sm font-medium text-brand-teal">Limited Early Access</span>
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.8 }}
                  className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight tracking-tight text-white"
                >
                  Stop Doing Admin.<br />
                  <span className="bg-gradient-to-r from-brand-blue to-brand-violet bg-clip-text text-transparent">
                    Start Closing Deals.
                  </span>
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.8 }}
                  className="text-lg sm:text-xl text-gray-400 mb-8 max-w-xl leading-relaxed mx-auto lg:mx-0"
                >
                  You know that sinking feeling when you remember a follow-up you forgot to send? We built an AI assistant that makes sure that feeling becomes a thing of the past.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.8 }}
                  className="space-y-3 mb-8"
                >
                  {['Reclaim 10+ hours every week', '31% fewer deals lost to poor follow-up', 'Priority onboarding & 50% launch discount'].map((benefit, i) => (
                    <div key={i} className="flex items-center gap-3 text-gray-300 justify-center lg:justify-start">
                      <Check className="w-5 h-5 text-brand-teal flex-shrink-0" />
                      <span>{benefit}</span>
                    </div>
                  ))}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.8 }}
                  className="flex flex-wrap items-center gap-6 justify-center lg:justify-start"
                >
                  {/* Avatar Stack with Count */}
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-3">
                      {[
                        'https://randomuser.me/api/portraits/men/32.jpg',
                        'https://randomuser.me/api/portraits/women/44.jpg',
                        'https://randomuser.me/api/portraits/men/67.jpg',
                        'https://randomuser.me/api/portraits/women/28.jpg',
                        'https://randomuser.me/api/portraits/men/52.jpg',
                      ].map((src, i) => (
                        <img
                          key={i}
                          src={src}
                          alt={`Waitlist member ${i + 1}`}
                          className="w-9 h-9 rounded-full border-2 border-gray-950 object-cover"
                        />
                      ))}
                      <div className="w-9 h-9 rounded-full border-2 border-gray-950 bg-gradient-to-br from-brand-blue to-brand-violet flex items-center justify-center text-xs font-bold text-white">
                        +{waitlistCount ? Math.max(0, waitlistCount - 5) : '...'}
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="text-lg font-bold text-white">{displayCount}</div>
                      <div className="text-xs text-gray-500">On Waitlist</div>
                    </div>
                  </div>
                  <div className="hidden sm:block w-px h-10 bg-white/10" />
                  <div className="text-center lg:text-left">
                    <div className="text-2xl font-bold text-white">47%</div>
                    <div className="text-xs text-gray-500">More Deals Closed</div>
                  </div>
                  <div className="text-center lg:text-left">
                    <div className="text-2xl font-bold text-white">10hrs</div>
                    <div className="text-xs text-gray-500">Saved Weekly</div>
                  </div>
                </motion.div>
              </motion.div>

              {/* Right Column - Form (shows first on mobile) */}
              <motion.div
                id="waitlist"
                className="order-1 lg:order-2"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.8 }}
              >
                <div className="relative">
                  <div className="absolute -inset-px bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-emerald-500/20 rounded-2xl opacity-50 blur-sm" />
                  <motion.div
                    className="absolute inset-0 rounded-2xl pointer-events-none"
                    animate={{
                      boxShadow: shouldGlow 
                        ? [
                            '0 0 0px rgba(59, 130, 246, 0), 0 0 0px rgba(168, 85, 247, 0)',
                            '0 0 30px rgba(59, 130, 246, 0.6), 0 0 50px rgba(168, 85, 247, 0.4)',
                            '0 0 0px rgba(59, 130, 246, 0), 0 0 0px rgba(168, 85, 247, 0)',
                            '0 0 30px rgba(59, 130, 246, 0.6), 0 0 50px rgba(168, 85, 247, 0.4)',
                            '0 0 0px rgba(59, 130, 246, 0), 0 0 0px rgba(168, 85, 247, 0)'
                          ]
                        : '0 0 0px rgba(59, 130, 246, 0), 0 0 0px rgba(168, 85, 247, 0)',
                    }}
                    transition={{
                      duration: 2,
                      times: [0, 0.25, 0.5, 0.75, 1],
                      ease: "easeInOut",
                    }}
                  />
                  <div className="relative backdrop-blur-xl bg-white/[0.03] border border-gray-700/50 rounded-2xl p-6 sm:p-8 shadow-2xl transition-colors duration-300">
                    <h2 className="font-heading text-2xl font-bold mb-1 text-white">Get Early Access</h2>
                    <p className="text-gray-400 mb-6">Join the waitlist and save 10+ hours per week</p>

                    <form onSubmit={handleSubmit} className="space-y-4" onReset={(e) => e.preventDefault()} noValidate>
                      <input
                        key="full_name"
                        type="text"
                        required
                        placeholder="Full Name *"
                        value={formData.full_name}
                        onChange={(e) => handleNameChange('full_name', e.target.value)}
                        onKeyDown={handleNameKeyDown}
                        onPaste={(e) => handleNamePaste(e, 'full_name')}
                        onInput={(e) => {
                          const target = e.target as HTMLInputElement;
                          const sanitized = sanitizeName(target.value);
                          if (target.value !== sanitized) {
                            target.value = sanitized;
                            setFormData(prev => ({ ...prev, full_name: sanitized }));
                          }
                        }}
                        disabled={isSubmitting}
                        className="w-full px-4 py-3.5 bg-white/5 border border-gray-700 rounded-xl text-white placeholder:text-gray-500 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all disabled:opacity-50"
                      />
                      <input
                        key="email"
                        type="email"
                        required
                        placeholder="Work Email *"
                        value={formData.email}
                        onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                        onBlur={handleEmailBlur}
                        disabled={isSubmitting}
                        className="w-full px-4 py-3.5 bg-white/5 border border-gray-700 rounded-xl text-white placeholder:text-gray-500 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all disabled:opacity-50"
                      />
                      <input
                        key="company_name"
                        type="text"
                        required
                        placeholder="Company Name *"
                        value={formData.company_name}
                        onChange={(e) => handleNameChange('company_name', e.target.value)}
                        onKeyDown={handleNameKeyDown}
                        onPaste={(e) => handleNamePaste(e, 'company_name')}
                        onInput={(e) => {
                          const target = e.target as HTMLInputElement;
                          const sanitized = sanitizeName(target.value);
                          if (target.value !== sanitized) {
                            target.value = sanitized;
                            setFormData(prev => ({ ...prev, company_name: sanitized }));
                          }
                        }}
                        disabled={isSubmitting}
                        className="w-full px-4 py-3.5 bg-white/5 border border-gray-700 rounded-xl text-white placeholder:text-gray-500 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all disabled:opacity-50"
                      />

                      <p className="text-xs text-gray-400 pt-2">What integrations are important to you?</p>

                      <select
                        key="meeting_recorder_tool"
                        required
                        value={formData.meeting_recorder_tool}
                        onChange={(e) => setFormData((prev) => ({ ...prev, meeting_recorder_tool: e.target.value }))}
                        disabled={isSubmitting}
                        className="w-full px-4 py-3.5 bg-white/5 border border-gray-700 rounded-xl text-white focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all appearance-none cursor-pointer disabled:opacity-50"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '18px' }}
                      >
                        <option value="" disabled className="bg-gray-900">Which meeting recorder? *</option>
                        {MEETING_RECORDER_OPTIONS.map(opt => <option key={opt} value={opt} className="bg-gray-900">{opt}</option>)}
                      </select>

                      <select
                        key="crm_tool"
                        required
                        value={formData.crm_tool}
                        onChange={(e) => setFormData((prev) => ({ ...prev, crm_tool: e.target.value }))}
                        disabled={isSubmitting}
                        className="w-full px-4 py-3.5 bg-white/5 border border-gray-700 rounded-xl text-white focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all appearance-none cursor-pointer disabled:opacity-50"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '18px' }}
                      >
                        <option value="" disabled className="bg-gray-900">Which CRM? *</option>
                        {CRM_OPTIONS.map(opt => <option key={opt} value={opt} className="bg-gray-900">{opt}</option>)}
                      </select>

                      <select
                        key="task_manager_tool"
                        required
                        value={formData.task_manager_tool}
                        onChange={(e) => setFormData((prev) => ({ ...prev, task_manager_tool: e.target.value, task_manager_other: e.target.value === 'Other' ? prev.task_manager_other : '' }))}
                        disabled={isSubmitting}
                        className="w-full px-4 py-3.5 bg-white/5 border border-gray-700 rounded-xl text-white focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all appearance-none cursor-pointer disabled:opacity-50"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '18px' }}
                      >
                        <option value="" disabled className="bg-gray-900">Which Task Manager? *</option>
                        {TASK_MANAGER_OPTIONS.map(opt => <option key={opt} value={opt} className="bg-gray-900">{opt}</option>)}
                      </select>

                      {formData.task_manager_tool === 'Other' && (
                        <input
                          type="text"
                          required
                          placeholder="Which task manager?"
                          value={formData.task_manager_other}
                          onChange={(e) => setFormData((prev) => ({ ...prev, task_manager_other: e.target.value }))}
                          disabled={isSubmitting}
                          className="w-full px-4 py-3.5 bg-white/5 border border-gray-700 rounded-xl text-white placeholder:text-gray-500 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all disabled:opacity-50"
                        />
                      )}

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-4 bg-gradient-to-r from-brand-blue to-brand-violet hover:opacity-90 text-white font-semibold rounded-xl shadow-lg shadow-brand-violet/25 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? 'Joining...' : 'Get Early Access'}
                      </button>

                      <p className="text-center text-xs text-gray-500">No credit card required • 5 spots ahead per referral</p>

                      {message && (
                        <p className={`text-center text-sm ${message.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {message.text}
                        </p>
                      )}
                    </form>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Problem Section */}
        <section id="problem" className="py-24">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-sm font-medium text-brand-blue mb-4">
                The Problem
              </span>
              <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 tracking-tight text-white">
                You're Not Bad at Sales.<br />You're Just Drowning in Admin.
              </h2>
              <p className="text-lg text-gray-400">
                Every sales rep knows this cycle:
                Great meeting → Promise to follow up → Get distracted → Forget → Deal goes cold.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              {[
                { icon: MailX, title: 'Follow-up Failures', desc: "You promise to follow up, then life happens. By the time you remember, the prospect has gone cold or signed with a competitor." },
                { icon: FileClock, title: 'Proposal Bottleneck', desc: "Proposals take 2-3 hours each. By the time you finish, the prospect's excitement has faded. Momentum lost." },
                { icon: CalendarClock, title: 'Meeting Prep Time Sink', desc: "30 minutes of prep for a 30-minute call. You're spending more time researching than actually selling." },
                { icon: Inbox, title: 'Inbox Avalanche', desc: "New enquiries come in while you're on calls. By the time you respond, they've moved on to whoever answered first." }
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-7 hover:border-white/15 hover:-translate-y-1 transition-all"
                >
                  <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center mb-4">
                    <item.icon className="w-6 h-6 text-red-400" />
                  </div>
                  <h3 className="font-heading text-lg font-semibold mb-2 text-white">{item.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-5 bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 mt-12">
              {[
                { value: '70%', label: 'of work week on admin' },
                { value: '£470', label: 'lost per week, per rep' },
                { value: '1 in 4', label: 'reps meet quota' },
                { value: '3hrs', label: 'wasted on prep weekly' }
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <div className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-brand-blue to-brand-violet bg-clip-text text-transparent">
                    {stat.value}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Founder Story Section */}
        <section className="py-24">
          <div className="max-w-7xl mx-auto px-6">
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-3xl p-8 lg:p-16 grid lg:grid-cols-[280px_1fr] gap-12 items-center">
              <div className="flex justify-center">
                <div className="w-64 h-64 lg:w-72 lg:h-72 rounded-2xl relative overflow-hidden">
                  <img
                    src="https://res.cloudinary.com/sixty-seconds/image/upload/v1755179902/andrew_bryce_446433654b.jpg"
                    alt="Andrew Bryce - Founder & CEO"
                    className="w-full h-full object-cover object-center"
                  />
                  <div className="absolute bottom-4 left-4 right-4 bg-gray-950/90 backdrop-blur-md p-3 rounded-xl text-center">
                    <div className="font-semibold text-white">Andrew</div>
                    <div className="text-xs text-gray-400">Founder & CEO</div>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="font-heading text-2xl lg:text-3xl font-bold mb-5 text-white">Why I Built This: A Founder's Confession</h3>
                <blockquote className="text-lg text-gray-400 pl-5 border-l-[3px] border-brand-blue mb-6 italic">
                  "I was a terrible sales rep. Not at selling—I was great on calls. But everything after? Disaster."
                </blockquote>
                <div className="text-gray-400 space-y-4 mb-6">
                  <p>Monday morning: 3 new enquiries from the weekend. I'd respond Tuesday afternoon. Two had already booked with competitors.</p>
                  <p>Wednesday: Promised a proposal "by end of day." Finished it Friday at 11 PM.</p>
                  <p><strong className="text-white">The breaking point?</strong> A £60k deal I lost because I forgot to send a follow-up email. Perfect prospect. Great fit. They literally asked for a proposal. I forgot.</p>
                  <p>That's when I realised: I don't need to get better at admin. <strong className="text-white">I need to eliminate admin entirely.</strong></p>
                </div>
                <div className="grid grid-cols-3 gap-4 bg-white/[0.03] rounded-xl p-5">
                  {[
                    { value: '35hrs', label: 'Now selling, not 15' },
                    { value: '18% → 31%', label: 'Close rate' },
                    { value: '2x', label: 'More deals closed' }
                  ].map((metric, i) => (
                    <div key={i} className="text-center">
                      <div className="text-xl lg:text-2xl font-bold text-brand-teal">{metric.value}</div>
                      <div className="text-[10px] text-gray-500 mt-1">{metric.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Comparison Section */}
        <section id="solution" className="py-24">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-sm font-medium text-brand-blue mb-4">
                The Transformation
              </span>
              <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 tracking-tight text-white">
                The Shift That Changes Everything
              </h2>
              <p className="text-lg text-gray-400">See what changes when AI handles your admin work.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="rounded-2xl p-8 bg-gradient-to-br from-red-500/[0.08] to-transparent border border-red-500/15"
              >
                <span className="inline-block px-3 py-1.5 rounded-md bg-red-500/15 text-red-400 text-[11px] font-semibold uppercase tracking-wide mb-4">Without AI</span>
                <h3 className="font-heading text-xl font-bold mb-5 text-white">Your Current Reality</h3>
                <ul className="space-y-3">
                  {['20+ hours/week on admin', 'Follow-ups delayed 24-48 hours', 'Proposals take 2-3 hours each', 'Enquiries sit until next day', '30 min prep per meeting', '18% close rate', 'Always behind, always stressed'].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm py-2 border-b border-white/[0.05] last:border-0 text-gray-300">
                      <X className="w-4 h-4 text-red-400 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="rounded-2xl p-8 bg-gradient-to-br from-brand-teal/[0.08] to-transparent border border-brand-teal/15"
              >
                <span className="inline-block px-3 py-1.5 rounded-md bg-brand-teal/15 text-brand-teal text-[11px] font-semibold uppercase tracking-wide mb-4">With AI Assistant</span>
                <h3 className="font-heading text-xl font-bold mb-5 text-white">Your New Reality</h3>
                <ul className="space-y-3">
                  {['2 hours/week managing AI', 'Follow-ups sent in 5 minutes', 'Proposals in 60 seconds', 'Enquiries qualified instantly', '2 min prep (auto-generated)', '31% close rate', 'Feel more in control'].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm py-2 border-b border-white/[0.05] last:border-0 text-gray-300">
                      <Check className="w-4 h-4 text-brand-teal flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-sm font-medium text-brand-blue mb-4">
                Features
              </span>
              <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 tracking-tight text-white">
                AI-Powered Features That Replace Your Admin
              </h2>
              <p className="text-lg text-gray-400">Every feature designed to get you back to selling.</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              {[
                { icon: Send, title: 'Intelligent Follow-ups', desc: 'AI drafts personalised emails based on meeting context, your communication style, and optimal timing.', tag: 'Sent within 5 minutes' },
                { icon: FileText, title: '60-Second Proposals', desc: 'Turn meeting notes into detailed, professional proposals automatically. Customised, branded, ready to send.', tag: '3 hours → 60 seconds' },
                { icon: ClipboardList, title: 'Automated Meeting Prep', desc: 'AI creates briefing docs with prospect research, conversation history, and recommended talking points.', tag: 'Ready in 2 minutes' },
                { icon: Zap, title: 'Instant Enquiry Response', desc: 'Respond to leads 24/7. AI qualifies, answers questions, and books meetings while you sleep.', tag: 'Never miss a lead' }
              ].map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex gap-5 bg-white/[0.03] border border-white/[0.08] rounded-2xl p-7 hover:border-white/15 hover:-translate-y-1 transition-all"
                >
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-brand-blue to-brand-violet flex items-center justify-center flex-shrink-0">
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="font-heading text-lg font-semibold mb-2 text-white">{feature.title}</h4>
                    <p className="text-sm text-gray-400 mb-3 leading-relaxed">{feature.desc}</p>
                    <span className="inline-block px-2.5 py-1 bg-brand-teal/10 text-brand-teal text-xs font-semibold rounded-md">{feature.tag}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24">
          <div className="max-w-7xl mx-auto px-6">
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-7 text-center relative overflow-hidden">
              <div className="relative">
                <h2 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-white">Stop Losing Deals to Admin</h2>
                <p className="text-lg text-gray-400 max-w-lg mx-auto mb-8">
                  Join {displayCount} sales professionals already on the waitlist. Limited spots in our next cohort.
                </p>
                <form onSubmit={handleCtaEmailSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto mb-5">
                  <input
                    type="email"
                    required
                    placeholder="Enter your work email"
                    value={ctaEmail}
                    onChange={(e) => setCtaEmail(e.target.value)}
                    onBlur={handleEmailBlur}
                    className="flex-1 px-5 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-400 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all"
                  />
                  <button
                    type="submit"
                    className="px-8 py-4 bg-gradient-to-r from-brand-blue to-brand-violet hover:opacity-90 text-white font-semibold rounded-xl shadow-lg shadow-brand-violet/25 hover:-translate-y-0.5 hover:shadow-xl transition-all whitespace-nowrap"
                  >
                    Secure Your Spot
                  </button>
                </form>
                <p className="text-sm text-gray-400">No credit card. No commitment. Just your email.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-12 border-t border-white/[0.08] transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <img
                src={logoDark}
                alt="60"
                className="h-10 w-auto transition-all duration-300"
              />
            </div>
            <p className="text-sm text-gray-400 text-center md:text-left">
              Replace admin work with AI assistants. Get back to selling.
            </p>
            <p className="text-xs text-gray-500">
              © 2025 Sixty Seconds Ltd. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* Waitlist Modal */}
      <WaitlistModal
        isOpen={showWaitlistModal}
        onClose={() => setShowWaitlistModal(false)}
        initialEmail={ctaEmail}
        signupSource="waitlist-cta"
      />
    </div>
  );
}
