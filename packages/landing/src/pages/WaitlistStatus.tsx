import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase/clientV2';
import { WaitlistSuccess } from './components/WaitlistSuccess';
import type { WaitlistEntry } from '@/lib/types/waitlist';
import { usePublicBrandingSettings } from '@/lib/hooks/useBrandingSettings';
import { ThemeToggle } from '@/components/ThemeToggle';
import { setWaitlistSession } from '../lib/utils/waitlistSession';

export default function WaitlistStatus() {
  const { id } = useParams<{ id: string }>();
  
  // Debug: Log component mount and params immediately
  console.log('[WaitlistStatus] Component rendering');
  console.log('[WaitlistStatus] URL params id:', id);
  
  // Safely get branding settings with error handling
  let logoDark = 'https://user-upload.s3.eu-west-2.amazonaws.com/erg%20logos/lightLogo/lightLogo-global-1764287988029.png';
  try {
    const branding = usePublicBrandingSettings();
    logoDark = branding.logoDark || logoDark;
  } catch (err) {
    console.error('[WaitlistStatus] Error loading branding settings:', err);
  }
  
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

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entry, setEntry] = useState<WaitlistEntry | null>(null);

  useEffect(() => {
    const fetchEntry = async () => {
      console.log('[WaitlistStatus] Starting fetch for id:', id);

      if (!id) {
        console.log('[WaitlistStatus] No ID provided');
        setError('No ID provided');
        setIsLoading(false);
        return;
      }

      try {
        console.log('[WaitlistStatus] Querying supabase...');
        const { data, error: queryError } = await supabase
          .from('meetings_waitlist')
          .select('*')
          .eq('id', id)
          .single();

        console.log('[WaitlistStatus] Query result:', { data, error: queryError });

        if (queryError) {
          console.error('[WaitlistStatus] Query error:', queryError);
          if (queryError.code === 'PGRST116') {
            setError('Waitlist entry not found. The link may be invalid or expired.');
          } else {
            throw queryError;
          }
          setIsLoading(false);
          return;
        }

        console.log('[WaitlistStatus] Setting entry:', data);
        setEntry(data as WaitlistEntry);
        
        // Store entry ID in session so user can access leaderboard without re-entering email
        if (data?.id) {
          setWaitlistSession(data.id);
          console.log('[WaitlistStatus] Session stored - user can now access leaderboard');
        }
        
        setIsLoading(false);
      } catch (err: any) {
        console.error('[WaitlistStatus] Catch error:', err);
        setError(err.message || 'Failed to load your waitlist position');
        setIsLoading(false);
      }
    };

    fetchEntry();
  }, [id]);

  console.log('[WaitlistStatus] Render state:', { isLoading, error, hasEntry: !!entry, id });

  // Safety check: If component rendered but nothing shows, render a fallback
  if (!isLoading && !error && !entry && id) {
    console.warn('[WaitlistStatus] Unexpected state: not loading, no error, no entry, but has id');
  }

  // Loading state - check first
  if (isLoading) {
    console.log('[WaitlistStatus] Rendering loading state');
    return (
      <div className="min-h-screen bg-white dark:bg-[#0a0d14] flex items-center justify-center transition-colors duration-300">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading your waitlist position...</p>
        </motion.div>
      </div>
    );
  }

  // Success state - show the full WaitlistSuccess component
  if (entry) {
    console.log('[WaitlistStatus] Rendering success state with entry');
    return <WaitlistSuccess entry={entry} />;
  }

  // Error state (fallback)
  console.log('[WaitlistStatus] Rendering error state');
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
            <div className="absolute -inset-px bg-gradient-to-r from-red-500/20 via-orange-500/20 to-red-500/20 rounded-2xl opacity-50 blur-sm" />
            <div className="relative backdrop-blur-xl bg-white/80 dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-2xl p-8 shadow-2xl">
              {/* Header */}
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-red-400 to-orange-500 flex items-center justify-center shadow-lg shadow-red-500/25">
                  <AlertCircle className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Link Not Found
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  {error || 'We could not find your waitlist entry.'}
                </p>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <a
                  href="/waitlist/leaderboard"
                  className="block w-full py-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all text-center"
                >
                  Look Up by Email
                </a>
                <a
                  href="/waitlist"
                  className="block w-full py-4 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-900 dark:text-white font-semibold rounded-xl border border-gray-200 dark:border-white/10 transition-all text-center"
                >
                  Join Waitlist
                </a>
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
