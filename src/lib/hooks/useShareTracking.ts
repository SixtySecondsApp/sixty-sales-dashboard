import { useCallback, useState } from 'react';
import { trackShare } from '@/lib/services/shareTrackingService';
import type { SharePlatform } from '@/lib/types/waitlist';
import { toast } from 'sonner';

export function useShareTracking(entryId: string) {
  const [isTracking, setIsTracking] = useState(false);

  const track = useCallback(async (platform: SharePlatform) => {
    setIsTracking(true);

    try {
      await trackShare({
        waitlist_entry_id: entryId,
        platform
      });

      // Success feedback
      toast.success('Share tracked! This helps your referral count.');
    } catch (error) {
      // Silent fail - don't interrupt user experience
      console.error('Share tracking failed:', error);
    } finally {
      setIsTracking(false);
    }
  }, [entryId]);

  return {
    trackShare: track,
    isTracking
  };
}
