import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles, Check, ArrowRight, MailX, FileClock, CalendarClock, Inbox,
  X, Send, FileText, ClipboardList, Zap, User
} from 'lucide-react';
import { supabase } from '@/lib/supabase/clientV2';

// Types
interface FormData {
  full_name: string;
  email: string;
  company_name: string;
  dialer_tool: string;
  meeting_recorder_tool: string;
  crm_tool: string;
}

// Dialer options
const DIALER_OPTIONS = ['Aircall', 'Dialpad', 'RingCentral', 'Outreach', 'Salesloft', 'None', 'Other'];
const MEETING_RECORDER_OPTIONS = ['Fathom', 'Gong', 'Chorus', 'Fireflies', 'Otter.ai', 'None', 'Other'];
const CRM_OPTIONS = ['Salesforce', 'HubSpot', 'Pipedrive', 'Close', 'Zoho', 'None', 'Other'];

export default function EarlyAccessLanding() {
  const [waitlistCount, setWaitlistCount] = useState<number | null>(null);
  const [formData, setFormData] = useState<FormData>({
    full_name: '',
    email: '',
    company_name: '',
    dialer_tool: '',
    meeting_recorder_tool: '',
    crm_tool: ''
  });
  const [ctaEmail, setCtaEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCtaSubmitting, setIsCtaSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [ctaMessage, setCtaMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch waitlist count on mount
  useEffect(() => {
    fetchWaitlistCount();
  }, []);

  const fetchWaitlistCount = async () => {
    try {
      const { count, error } = await supabase
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsSubmitting(true);
    setMessage(null);

    // Preserve form data in case of error
    const currentFormData = { ...formData };

    try {
      const cleanData = {
        email: formData.email.trim().toLowerCase(),
        full_name: formData.full_name.trim() || null,
        company_name: formData.company_name.trim() || null,
        dialer_tool: formData.dialer_tool || null,
        meeting_recorder_tool: formData.meeting_recorder_tool || null,
        crm_tool: formData.crm_tool || null
      };

      const { error } = await supabase
        .from('meetings_waitlist')
        .insert([cleanData])
        .select()
        .single();

      if (error) {
        if (error.code === '23505' || error.message?.includes('duplicate')) {
          throw new Error('This email is already on the waitlist!');
        }
        throw error;
      }

      // Only clear form on successful submission
      setMessage({ type: 'success', text: "You're on the list! We'll be in touch soon with your early access." });
      setFormData({ full_name: '', email: '', company_name: '', dialer_tool: '', meeting_recorder_tool: '', crm_tool: '' });
      fetchWaitlistCount();
    } catch (err: any) {
      // Preserve form data on error - don't clear fields
      setFormData(currentFormData);
      setMessage({ type: 'error', text: err.message || 'Failed to join waitlist' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCtaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCtaSubmitting(true);
    setCtaMessage(null);

    try {
      const { error } = await supabase
        .from('meetings_waitlist')
        .insert([{ email: ctaEmail.trim().toLowerCase() }])
        .select()
        .single();

      if (error) {
        if (error.code === '23505' || error.message?.includes('duplicate')) {
          throw new Error('This email is already on the waitlist!');
        }
        throw error;
      }

      setCtaMessage({ type: 'success', text: "You're on the list! We'll be in touch soon with your early access." });
      setCtaEmail('');
      fetchWaitlistCount();
    } catch (err: any) {
      setCtaMessage({ type: 'error', text: err.message || 'Failed to join waitlist' });
    } finally {
      setIsCtaSubmitting(false);
    }
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const displayCount = waitlistCount !== null ? `${waitlistCount}+` : '...';

  return (
    <div className="min-h-screen bg-[#0a0d14] text-white font-sans antialiased overflow-x-hidden">
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
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[#0a0d14]/80 border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-3">
            <img src="https://www.sixtyseconds.ai/images/logo.png" alt="Sixty Seconds" className="h-10" />
          </button>
          <div className="hidden md:flex items-center gap-8">
            <button onClick={() => scrollToSection('problem')} className="text-sm font-medium text-gray-400 hover:text-white transition-colors">The Problem</button>
            <button onClick={() => scrollToSection('solution')} className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Solution</button>
            <button onClick={() => scrollToSection('features')} className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Features</button>
          </div>
          <button
            onClick={() => scrollToSection('waitlist')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/35 hover:-translate-y-0.5 transition-all"
          >
            Join Waitlist
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </nav>

      <main className="relative z-10">
        {/* Hero Section */}
        <section className="min-h-screen flex items-center pt-24 pb-16">
          <div className="max-w-7xl mx-auto px-6 w-full">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* Left Column */}
              <motion.div
                className="text-center lg:text-left"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 mb-6"
                >
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-medium text-emerald-400">Limited Early Access</span>
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.8 }}
                  className="text-4xl sm:text-5xl lg:text-6xl font-extrabold mb-6 leading-tight tracking-tight"
                >
                  Stop Doing Admin.<br />
                  <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                    Start Closing Deals.
                  </span>
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.8 }}
                  className="text-lg sm:text-xl text-gray-400 mb-8 max-w-xl leading-relaxed mx-auto lg:mx-0"
                >
                  AI-powered assistant that handles follow-ups, proposals, and meeting prep automatically—so you can focus on what you do best: selling.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.8 }}
                  className="space-y-3 mb-8"
                >
                  {['Reclaim 10+ hours every week', '31% fewer deals lost to poor follow-up', 'Priority onboarding & 50% launch discount'].map((benefit, i) => (
                    <div key={i} className="flex items-center gap-3 text-gray-300 justify-center lg:justify-start">
                      <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
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
                          className="w-9 h-9 rounded-full border-2 border-[#0a0d14] object-cover"
                        />
                      ))}
                      <div className="w-9 h-9 rounded-full border-2 border-[#0a0d14] bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-xs font-bold">
                        +{waitlistCount ? Math.max(0, waitlistCount - 5) : '...'}
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="text-lg font-bold">{displayCount}</div>
                      <div className="text-xs text-gray-500">On Waitlist</div>
                    </div>
                  </div>
                  <div className="hidden sm:block w-px h-10 bg-white/10" />
                  <div className="text-center lg:text-left">
                    <div className="text-2xl font-bold">47%</div>
                    <div className="text-xs text-gray-500">More Deals Closed</div>
                  </div>
                  <div className="text-center lg:text-left">
                    <div className="text-2xl font-bold">10hrs</div>
                    <div className="text-xs text-gray-500">Saved Weekly</div>
                  </div>
                </motion.div>
              </motion.div>

              {/* Right Column - Form */}
              <motion.div
                id="waitlist"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.8 }}
              >
                <div className="relative">
                  <div className="absolute -inset-px bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-emerald-500/20 rounded-2xl opacity-50 blur-sm" />
                  <div className="relative backdrop-blur-xl bg-white/[0.03] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl">
                    <h2 className="text-2xl font-bold mb-1">Get Early Access</h2>
                    <p className="text-gray-400 mb-6">Join the waitlist and save 10+ hours per week</p>

                    <form onSubmit={handleSubmit} className="space-y-4" onReset={(e) => e.preventDefault()} noValidate>
                      <input
                        key="full_name"
                        type="text"
                        required
                        placeholder="Full Name *"
                        value={formData.full_name}
                        onChange={(e) => setFormData((prev) => ({ ...prev, full_name: e.target.value }))}
                        disabled={isSubmitting}
                        className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all disabled:opacity-50"
                      />
                      <input
                        key="email"
                        type="email"
                        required
                        placeholder="Work Email *"
                        value={formData.email}
                        onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                        disabled={isSubmitting}
                        className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all disabled:opacity-50"
                      />
                      <input
                        key="company_name"
                        type="text"
                        required
                        placeholder="Company Name *"
                        value={formData.company_name}
                        onChange={(e) => setFormData((prev) => ({ ...prev, company_name: e.target.value }))}
                        disabled={isSubmitting}
                        className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all disabled:opacity-50"
                      />

                      <p className="text-xs text-gray-400 pt-2">What integrations are important to you?</p>

                      <select
                        key="dialer_tool"
                        required
                        value={formData.dialer_tool}
                        onChange={(e) => setFormData((prev) => ({ ...prev, dialer_tool: e.target.value }))}
                        disabled={isSubmitting}
                        className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all appearance-none cursor-pointer disabled:opacity-50"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '18px' }}
                      >
                        <option value="" disabled className="bg-[#0f1419]">Which dialer do you use? *</option>
                        {DIALER_OPTIONS.map(opt => <option key={opt} value={opt} className="bg-[#0f1419]">{opt}</option>)}
                      </select>

                      <select
                        key="meeting_recorder_tool"
                        required
                        value={formData.meeting_recorder_tool}
                        onChange={(e) => setFormData((prev) => ({ ...prev, meeting_recorder_tool: e.target.value }))}
                        disabled={isSubmitting}
                        className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all appearance-none cursor-pointer disabled:opacity-50"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '18px' }}
                      >
                        <option value="" disabled className="bg-[#0f1419]">Which meeting recorder? *</option>
                        {MEETING_RECORDER_OPTIONS.map(opt => <option key={opt} value={opt} className="bg-[#0f1419]">{opt}</option>)}
                      </select>

                      <select
                        key="crm_tool"
                        required
                        value={formData.crm_tool}
                        onChange={(e) => setFormData((prev) => ({ ...prev, crm_tool: e.target.value }))}
                        disabled={isSubmitting}
                        className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all appearance-none cursor-pointer disabled:opacity-50"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '18px' }}
                      >
                        <option value="" disabled className="bg-[#0f1419]">Which CRM? *</option>
                        {CRM_OPTIONS.map(opt => <option key={opt} value={opt} className="bg-[#0f1419]">{opt}</option>)}
                      </select>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-sm font-medium text-blue-400 mb-4">
                The Problem
              </span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 tracking-tight">
                You're Not Bad at Sales.<br />You're Drowning in Admin.
              </h2>
              <p className="text-lg text-gray-400">
                Every sales rep knows this cycle: Great meeting → Promise to follow up → Get distracted → Forget → Deal goes cold.
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
                  <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-5 bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 mt-12">
              {[
                { value: '70%', label: 'of work week on admin' },
                { value: '$595', label: 'lost per week, per rep' },
                { value: '1 in 3', label: 'reps meet quota' },
                { value: '6.4hrs', label: 'wasted on prep weekly' }
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <div className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
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
                  <div className="absolute bottom-4 left-4 right-4 bg-[#0a0d14]/90 backdrop-blur-md p-3 rounded-xl text-center">
                    <div className="font-semibold">Andrew</div>
                    <div className="text-xs text-gray-400">Founder & CEO</div>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-2xl lg:text-3xl font-bold mb-5">Why I Built This: A Founder's Confession</h3>
                <blockquote className="text-lg text-gray-400 pl-5 border-l-[3px] border-blue-500 mb-6 italic">
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
                      <div className="text-xl lg:text-2xl font-bold text-emerald-400">{metric.value}</div>
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
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-sm font-medium text-blue-400 mb-4">
                The Transformation
              </span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 tracking-tight">
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
                <h3 className="text-xl font-bold mb-5">Your Current Reality</h3>
                <ul className="space-y-3">
                  {['20+ hours/week on admin', 'Follow-ups delayed 24-48 hours', 'Proposals take 2-3 hours each', 'Enquiries sit until next day', '30 min prep per meeting', '18% close rate', 'Always behind, always stressed'].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm py-2 border-b border-white/[0.05] last:border-0">
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
                className="rounded-2xl p-8 bg-gradient-to-br from-emerald-500/[0.08] to-transparent border border-emerald-500/15"
              >
                <span className="inline-block px-3 py-1.5 rounded-md bg-emerald-500/15 text-emerald-400 text-[11px] font-semibold uppercase tracking-wide mb-4">With AI Assistant</span>
                <h3 className="text-xl font-bold mb-5">Your New Reality</h3>
                <ul className="space-y-3">
                  {['2 hours/week managing AI', 'Follow-ups sent in 5 minutes', 'Proposals in 60 seconds', 'Enquiries qualified instantly', '2 min prep (auto-generated)', '31% close rate', 'Feel more in control'].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm py-2 border-b border-white/[0.05] last:border-0">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
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
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-sm font-medium text-blue-400 mb-4">
                Features
              </span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 tracking-tight">
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
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold mb-2">{feature.title}</h4>
                    <p className="text-sm text-gray-400 mb-3 leading-relaxed">{feature.desc}</p>
                    <span className="inline-block px-2.5 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-semibold rounded-md">{feature.tag}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="py-24">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-sm font-medium text-blue-400 mb-4">
                Social Proof
              </span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
                Trusted by Sales Teams Who Were Tired of Admin
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-5">
              {[
                { text: "I thought I was decent at follow-ups. Then I saw the AI's speed and consistency. My prospects now get follow-ups within minutes. Close rate up 34%.", name: 'Sarah K.', role: 'Enterprise AE' },
                { text: "Our team went from 3 proposals per week to 3 per day. No drop in quality—just speed. We're closing deals that would have slipped through.", name: 'Marcus T.', role: 'SDR Manager' },
                { text: "I was drowning. Now I take twice as many calls with half the stress. Follow-ups happen automatically. I actually have evenings now.", name: 'David R.', role: 'Solo Consultant' }
              ].map((testimonial, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-7"
                >
                  <div className="text-yellow-400 text-base mb-4 tracking-widest">★★★★★</div>
                  <p className="text-sm text-gray-400 leading-relaxed mb-5">"{testimonial.text}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{testimonial.name}</div>
                      <div className="text-xs text-gray-500">{testimonial.role}</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24">
          <div className="max-w-7xl mx-auto px-6">
            <div className="bg-gradient-to-r from-blue-600 to-purple-500 rounded-3xl p-12 md:p-20 text-center relative overflow-hidden">
              <div
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.5'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
                }}
              />
              <div className="relative">
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">Stop Losing Deals to Admin</h2>
                <p className="text-lg opacity-90 max-w-lg mx-auto mb-8">
                  Join {displayCount} sales professionals already on the waitlist. Limited spots in our next cohort.
                </p>
                <form onSubmit={handleCtaSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto mb-5">
                  <input
                    type="email"
                    required
                    placeholder="Enter your work email"
                    value={ctaEmail}
                    onChange={(e) => setCtaEmail(e.target.value)}
                    className="flex-1 px-5 py-4 bg-white/15 border-2 border-white/20 rounded-xl text-white placeholder:text-white/60 focus:border-white/50 focus:bg-white/20 outline-none transition-all"
                  />
                  <button
                    type="submit"
                    disabled={isCtaSubmitting}
                    className="px-8 py-4 bg-white text-blue-600 font-semibold rounded-xl hover:-translate-y-0.5 hover:shadow-xl transition-all disabled:opacity-50 whitespace-nowrap"
                  >
                    {isCtaSubmitting ? 'Joining...' : 'Secure Your Spot'}
                  </button>
                </form>
                {ctaMessage && (
                  <p className={`text-sm ${ctaMessage.type === 'success' ? 'text-emerald-300' : 'text-red-300'}`}>
                    {ctaMessage.text}
                  </p>
                )}
                <p className="text-sm opacity-80">No credit card. No commitment. Just your email.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-12 border-t border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-white">Sixty</span>
            </div>
            <p className="text-sm text-gray-400 text-center md:text-left">
              Replace admin work with AI assistants. Get back to selling.
            </p>
            <p className="text-xs text-gray-500">
              © 2025 Sixty AI. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
