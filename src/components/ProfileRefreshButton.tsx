import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { toast } from 'sonner';
import logger from '@/lib/utils/logger';

export function ProfileRefreshButton() {
  const { refreshProfile, user, userProfile } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Log current profile state
  useEffect(() => {
    logger.log('🔍 Current profile state:', {
      user: user?.email,
      userId: user?.id,
      profile: userProfile,
      hasProfile: !!userProfile
    });
  }, [user, userProfile]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    logger.log('🔄 Manual profile refresh triggered');
    logger.log('Current user:', user);
    
    try {
      await refreshProfile();
      toast.success('Profile refreshed successfully!');
      
      // Also try to reload the page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      logger.error('Failed to refresh profile:', error);
      toast.error('Failed to refresh profile');
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!user) return null;

  return (
    <button
      onClick={handleRefresh}
      disabled={isRefreshing}
      className="fixed bottom-20 right-6 p-3 rounded-full bg-gray-800 hover:bg-gray-700 transition-colors shadow-lg z-50 group"
      title="Refresh Profile"
    >
      <RefreshCw 
        className={`w-5 h-5 text-white ${isRefreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`}
      />
    </button>
  );
}