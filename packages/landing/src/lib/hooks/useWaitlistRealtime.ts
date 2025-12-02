import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/clientV2';
import type { WaitlistEntry } from '@/lib/types/waitlist';
import { getTierForPosition } from '@/lib/types/waitlist';

interface RealtimeUpdate {
  position: number;
  referral_count: number;
  effective_position: number;
  previousPosition?: number;
  tierChange?: boolean;
}

export function useWaitlistRealtime(entryId: string, initialEntry: WaitlistEntry) {
  const [entry, setEntry] = useState<WaitlistEntry>(initialEntry);
  const [previousPosition, setPreviousPosition] = useState<number | undefined>();
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<RealtimeUpdate | null>(null);

  // Debounced update handler to prevent excessive re-renders
  const handleUpdate = useCallback((payload: any) => {
    const newEntry = payload.new as WaitlistEntry;

    setEntry((prev) => {
      // Check for tier changes
      const oldTier = getTierForPosition(prev.effective_position || 0);
      const newTier = getTierForPosition(newEntry.effective_position || 0);
      const tierChanged = oldTier.name !== newTier.name;

      // Store previous position for animations
      setPreviousPosition(prev.effective_position);

      // Create update object for milestone tracking
      const update: RealtimeUpdate = {
        position: newEntry.effective_position || 0,
        referral_count: newEntry.referral_count,
        effective_position: newEntry.effective_position || 0,
        previousPosition: prev.effective_position,
        tierChange: tierChanged
      };

      setLastUpdate(update);

      return newEntry;
    });
  }, []);

  useEffect(() => {
    // Subscribe to changes for this specific waitlist entry
    const channel = supabase
      .channel(`waitlist:${entryId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'meetings_waitlist',
          filter: `id=eq.${entryId}`
        },
        handleUpdate
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [entryId, handleUpdate]);

  return {
    entry,
    previousPosition,
    isConnected,
    lastUpdate
  };
}
