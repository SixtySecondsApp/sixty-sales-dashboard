import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LinkedinIcon, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase/clientV2';

interface RecentShare {
  full_name: string;
  shared_at: string;
  company_name?: string;
}

export function RecentLinkedInShares() {
  const [recentShares, setRecentShares] = useState<RecentShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [useRealtime, setUseRealtime] = useState(true);
  const mountTimeRef = useRef(Date.now());
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchRecentShares = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('waitlist_shares')
        .select(`
          shared_at,
          waitlist_entry_id,
          meetings_waitlist!inner(
            full_name,
            company_name
          )
        `)
        .eq('platform', 'linkedin')
        .order('shared_at', { ascending: false })
        .limit(5);

      if (error) {
        console.error('Failed to fetch recent shares:', error);
        return;
      }

      const shares = data?.map(share => ({
        full_name: (share as any).meetings_waitlist.full_name,
        company_name: (share as any).meetings_waitlist.company_name,
        shared_at: share.shared_at
      })) || [];

      setRecentShares(shares);
    } catch (err) {
      console.error('Error fetching shares:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchRecentShares();

    // Use realtime for first 2 minutes to catch user's share action
    // Then switch to polling every 30s to reduce database load
    const REALTIME_WINDOW = 2 * 60 * 1000; // 2 minutes

    let channel: ReturnType<typeof supabase.channel> | null = null;

    if (useRealtime) {
      // Subscribe to real-time updates with filter
      channel = supabase
        .channel('linkedin-shares-realtime')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'waitlist_shares',
            filter: 'platform=eq.linkedin'
          },
          () => {
            fetchRecentShares();
          }
        )
        .subscribe();

      // After 2 minutes, switch to polling
      const timeoutId = setTimeout(() => {
        setUseRealtime(false);
        if (channel) {
          supabase.removeChannel(channel);
        }
      }, REALTIME_WINDOW);

      return () => {
        clearTimeout(timeoutId);
        if (channel) {
          supabase.removeChannel(channel);
        }
      };
    } else {
      // Polling mode - every 30 seconds
      pollingIntervalRef.current = setInterval(fetchRecentShares, 30000);

      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
        }
      };
    }
  }, [fetchRecentShares, useRealtime]);

  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (loading || recentShares.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4 space-y-3"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-blue-400" />
        <h4 className="text-sm font-medium text-blue-300">
          Recent LinkedIn Shares
        </h4>
      </div>

      {/* Recent shares list */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {recentShares.map((share, index) => (
            <motion.div
              key={`${share.full_name}-${share.shared_at}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center gap-3 bg-white/5 rounded px-3 py-2"
            >
              <div className="flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <LinkedinIcon className="w-4 h-4 text-blue-400" />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {share.full_name}
                </p>
                {share.company_name && (
                  <p className="text-xs text-gray-400 truncate">
                    {share.company_name}
                  </p>
                )}
              </div>

              <div className="flex-shrink-0">
                <span className="text-xs text-gray-500">
                  {getTimeAgo(share.shared_at)}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Footer message */}
      <p className="text-xs text-gray-400 text-center pt-2 border-t border-white/5">
        💙 Join {recentShares.length}+ others who shared on LinkedIn
      </p>
    </motion.div>
  );
}
