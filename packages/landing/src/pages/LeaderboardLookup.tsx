import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, ArrowRight, Trophy, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/clientV2';
import { WaitlistSuccess } from './components/WaitlistSuccess';
import type { WaitlistEntry } from '@/lib/types/waitlist';
import { usePublicBrandingSettings } from '@/lib/hooks/useBrandingSettings';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function LeaderboardLookup() {
  const { logoDark } = usePublicBrandingSettings();
  const LIGHT_MODE_LOGO = 'https://user-upload.s3.eu-west-2.amazonaws.com/erg%20logos/lightLogo/lightLogo-global-1764287988029.png';

  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const html = document.documentElement;
      return html.classList.contains('dark') || html.getAttribute('data-theme') === 'dark';
    }
    return true;
  });

  useEffect(() => {
    const checkTheme = () => {
      const html = document.documentElement;
      const hasDarkClass = html.classList.contains('dark');
      const dataTheme = html.getAttribute('data-theme');
      setIsDark(hasDarkClass || dataTheme === 'dark');
    };

    checkTheme();

    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme']
    });

    return () => observer.disconnect();
  }, []);

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entry, setEntry] = useState<WaitlistEntry | null>(null);

  // Check URL for email parameter on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get('email');
    if (emailParam) {
      setEmail(emailParam);
      handleLookup(emailParam);
    }
  }, []);

  const handleLookup = async (lookupEmail?: string) => {
    const emailToLookup = lookupEmail || email;
    if (!emailToLookup.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from('meetings_waitlist')
        .select('*')
        .eq('email', emailToLookup.trim().toLowerCase())
        .single();

      if (queryError) {
        if (queryError.code === 'PGRST116') {
          setError('No waitlist entry found for this email. Have you signed up yet?');
        } else {
          throw queryError;
        }
        return;
      }

      setEntry(data as WaitlistEntry);
    } catch (err: any) {
      setError(err.message || 'Failed to look up your position');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleLookup();
  };

  // If we found an entry, show the full WaitlistSuccess component
  if (entry) {
    return <WaitlistSuccess entry={entry} />;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0d14] text-gray-900 dark:text-white font-sans antialiased overflow-x-hidden transition-colors duration-300">
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
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-[#0a0d14]/80 border-b border-gray-200 dark:border-white/[0.08] transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/waitlist" className="flex items-center gap-3">
            <img src={isDark ? logoDark : LIGHT_MODE_LOGO} alt="Sixty Seconds" className="h-10" />
          </a>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <a
              href="/waitlist"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/35 hover:-translate-y-0.5 transition-all"
            >
              Join Waitlist
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 min-h-screen flex items-center justify-center pt-16 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          <div className="relative">
            <div className="absolute -inset-px bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-emerald-500/20 rounded-2xl opacity-50 blur-sm" />
            <div className="relative backdrop-blur-xl bg-white/80 dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-2xl p-8 shadow-2xl">
              {/* Header */}
              <div className="text-center mb-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg shadow-yellow-500/25">
                  <Trophy className="w-8 h-8 text-white" />
                </div>
                <h1 className="font-heading text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Check Your Position
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Enter your email to see your waitlist position and referral stats
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    required
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all disabled:opacity-50"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !email.trim()}
                  className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Looking up...
                    </>
                  ) : (
                    <>
                      <Trophy className="w-5 h-5" />
                      View My Position
                    </>
                  )}
                </button>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-xl bg-red-500/10 border border-red-500/20"
                  >
                    <p className="text-sm text-red-500 dark:text-red-400 text-center">{error}</p>
                    <a
                      href="/waitlist"
                      className="block mt-2 text-center text-sm text-blue-500 hover:text-blue-400 underline"
                    >
                      Sign up for the waitlist →
                    </a>
                  </motion.div>
                )}
              </form>

              {/* Footer */}
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-white/10 text-center">
                <p className="text-sm text-gray-500">
                  Not on the waitlist yet?{' '}
                  <a href="/waitlist" className="text-blue-500 hover:text-blue-400 font-medium">
                    Join now
                  </a>
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="absolute bottom-0 left-0 right-0 py-6 text-center">
        <p className="text-xs text-gray-500">
          © 2025 Sixty Seconds Ltd. All rights reserved.
        </p>
      </footer>
    </div>
  );
}








