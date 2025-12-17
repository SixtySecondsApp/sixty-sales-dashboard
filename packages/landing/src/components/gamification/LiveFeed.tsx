import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, UserPlus, TrendingUp, Crown } from 'lucide-react';
import { supabase } from '@/lib/supabase/clientV3-optimized';
import { getTierForPosition } from '@/lib/types/waitlist';

interface FeedItem {
  id: string;
  type: 'signup' | 'referral' | 'tier_upgrade' | 'position_jump';
  name: string;
  timestamp: string;
  details?: string;
}

export function LiveFeed() {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Load initial feed
    loadRecentActivity();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('waitlist_activity')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'meetings_waitlist'
        },
        (payload) => {
          handleNewSignup(payload.new);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'meetings_waitlist'
        },
        (payload) => {
          handleUpdate(payload.new, payload.old);
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadRecentActivity = async () => {
    try {
      const { data, error } = await supabase
        .from('meetings_waitlist')
        .select('id, full_name, referral_count, effective_position, created_at')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      // Convert to feed items
      const items: FeedItem[] = (data || []).map(entry => ({
        id: entry.id,
        type: 'signup',
        name: anonymizeName(entry.full_name),
        timestamp: entry.created_at,
        details: undefined
      }));

      setFeed(items.slice(0, 5));
    } catch (err) {
      console.error('Failed to load activity:', err);
    }
  };

  const handleNewSignup = (entry: any) => {
    const newItem: FeedItem = {
      id: entry.id,
      type: 'signup',
      name: anonymizeName(entry.full_name),
      timestamp: new Date().toISOString(),
      details: undefined
    };

    setFeed(prev => [newItem, ...prev].slice(0, 5));
  };

  const handleUpdate = (newEntry: any, oldEntry: any) => {
    // Check for referral
    if (newEntry.referral_count > oldEntry.referral_count) {
      const newItem: FeedItem = {
        id: `${newEntry.id}-referral-${Date.now()}`,
        type: 'referral',
        name: anonymizeName(newEntry.full_name),
        timestamp: new Date().toISOString(),
        details: `${newEntry.referral_count} referral${newEntry.referral_count > 1 ? 's' : ''}`
      };

      setFeed(prev => [newItem, ...prev].slice(0, 5));
    }

    // Check for tier upgrade
    const oldTier = getTierForPosition(oldEntry.effective_position);
    const newTier = getTierForPosition(newEntry.effective_position);

    if (newTier.name !== oldTier.name && newTier.threshold < oldTier.threshold) {
      const newItem: FeedItem = {
        id: `${newEntry.id}-tier-${Date.now()}`,
        type: 'tier_upgrade',
        name: anonymizeName(newEntry.full_name),
        timestamp: new Date().toISOString(),
        details: `${newTier.badge} ${newTier.name}`
      };

      setFeed(prev => [newItem, ...prev].slice(0, 5));
    }

    // Check for significant position jump
    const positionChange = oldEntry.effective_position - newEntry.effective_position;
    if (positionChange >= 25) {
      const newItem: FeedItem = {
        id: `${newEntry.id}-jump-${Date.now()}`,
        type: 'position_jump',
        name: anonymizeName(newEntry.full_name),
        timestamp: new Date().toISOString(),
        details: `+${positionChange} spots`
      };

      setFeed(prev => [newItem, ...prev].slice(0, 5));
    }
  };

  const anonymizeName = (fullName: string) => {
    const parts = fullName.trim().split(' ');
    if (parts.length === 0) return 'Someone';
    const firstName = parts[0];
    const lastInitial = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return `${firstName} ${lastInitial}.`;
  };

  const getTimeAgo = (timestamp: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(timestamp).getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const getIcon = (type: FeedItem['type']) => {
    switch (type) {
      case 'signup':
        return <UserPlus className="w-4 h-4 text-blue-400" />;
      case 'referral':
        return <Activity className="w-4 h-4 text-emerald-400" />;
      case 'tier_upgrade':
        return <Crown className="w-4 h-4 text-yellow-400" />;
      case 'position_jump':
        return <TrendingUp className="w-4 h-4 text-purple-400" />;
    }
  };

  const getMessage = (item: FeedItem) => {
    switch (item.type) {
      case 'signup':
        return 'just joined the waitlist';
      case 'referral':
        return `referred their first person`;
      case 'tier_upgrade':
        return `reached ${item.details}`;
      case 'position_jump':
        return `jumped ${item.details}!`;
    }
  };

  if (feed.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 2.5, duration: 0.8 }}
      className="bg-white/5 border border-white/10 rounded-xl p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-heading text-base font-bold text-white flex items-center gap-2">
          <Activity className="w-4 h-4 text-green-400" />
          Live Activity
        </h3>
        {isConnected && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-gray-400">Live</span>
          </div>
        )}
      </div>

      {/* Feed List */}
      <div className="space-y-2 max-h-[160px] overflow-hidden">
        <AnimatePresence mode="popLayout">
          {feed.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, height: 0, y: -10 }}
              animate={{
                opacity: 1 - (index * 0.15),
                height: 'auto',
                y: 0
              }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              {/* Icon */}
              <div className="flex-shrink-0">
                {getIcon(item.type)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-300 truncate">
                  <span className="font-semibold text-white">{item.name}</span>
                  {' '}
                  {getMessage(item)}
                </p>
              </div>

              {/* Timestamp */}
              <div className="flex-shrink-0 text-xs text-gray-500">
                {getTimeAgo(item.timestamp)}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
