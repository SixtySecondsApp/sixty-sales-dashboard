import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import { supabase } from '@/lib/supabase/clientV2';

export function LiveWaitlistCount() {
  const [count, setCount] = useState<number>(0);
  const [recentProfiles, setRecentProfiles] = useState<string[]>([]);

  useEffect(() => {
    loadCount();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('waitlist-count')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meetings_waitlist'
        },
        () => {
          loadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadCount = async () => {
    try {
      // Get total count
      const { count: totalCount, error: countError } = await (supabase as any)
        .from('meetings_waitlist')
        .select('*', { count: 'exact', head: true });

      if (countError) throw countError;

      setCount(totalCount || 0);

      // Get unique profile images for the overlapping avatars
      const { data: profiles, error: profileError } = await (supabase as any)
        .from('meetings_waitlist')
        .select('profile_image_url')
        .not('profile_image_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(20); // Get more to ensure we have 4 unique

      if (profileError) throw profileError;

      // Get 4 unique profile images
      const uniqueProfiles: string[] = [
        ...new Set<string>(
          ((profiles as any[]) || [])
            .map((p: any) => String(p.profile_image_url || '').trim())
            .filter(Boolean)
        ),
      ];
      setRecentProfiles(uniqueProfiles.slice(0, 4));
    } catch (err) {
      console.error('Failed to load waitlist count:', err);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.6, duration: 0.8 }}
      className="flex items-center gap-4"
    >
      {/* Overlapping Profile Avatars */}
      <div className="flex -space-x-2">
        {recentProfiles.slice(0, 4).map((profileUrl, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 + (index * 0.1), duration: 0.3 }}
          >
            <img
              src={profileUrl}
              alt="Profile"
              className="w-10 h-10 rounded-full object-cover border-2 border-white dark:border-gray-950"
            />
          </motion.div>
        ))}
      </div>

      {/* Count Display */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        <Users className="w-4 h-4 inline mr-1" />
        <motion.span
          key={count}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="text-gray-900 dark:text-white font-semibold"
        >
          {count.toLocaleString()}+
        </motion.span>{' '}
        revenue teams in queue
      </div>
    </motion.div>
  );
}
