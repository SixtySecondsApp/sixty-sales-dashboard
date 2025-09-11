import { useState, useEffect } from 'react';
import { googleAuthService } from '@/lib/services/googleAuthService';
import { gmailService } from '@/lib/services/gmailService';
import { googleCalendarService } from '@/lib/services/googleCalendarService';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { 
  Mail, 
  Calendar, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  RefreshCw,
  LogOut,
  Link2,
  Shield
} from 'lucide-react';
import logger from '@/lib/utils/logger';

interface GoogleConnectProps {
  returnTo?: string;
  onConnected?: () => void;
}

export function GoogleConnect({ returnTo = '/email', onConnected }: GoogleConnectProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncStats, setSyncStats] = useState({ emails: 0, events: 0 });

  useEffect(() => {
    checkConnectionStatus();
  }, []);

  const checkConnectionStatus = () => {
    const connected = googleAuthService.isAuthenticated();
    setIsConnected(connected);
    
    // Get last sync time from localStorage
    const lastSyncTime = localStorage.getItem('google_last_sync');
    if (lastSyncTime) {
      setLastSync(new Date(lastSyncTime));
    }
  };

  const handleConnect = () => {
    // Store return URL for after OAuth
    localStorage.setItem('google_oauth_return', returnTo);
    
    // Get OAuth URL and redirect
    const authUrl = googleAuthService.getAuthUrl();
    window.location.href = authUrl;
  };

  const handleDisconnect = async () => {
    try {
      const success = await googleAuthService.revokeAccess();
      if (success) {
        setIsConnected(false);
        setLastSync(null);
        toast.success('Google account disconnected');
      } else {
        toast.error('Failed to disconnect Google account');
      }
    } catch (error) {
      logger.error('Disconnect error:', error);
      toast.error('An error occurred while disconnecting');
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      // Sync Gmail
      const emailCount = await gmailService.syncEmails();
      
      // Sync Calendar
      const eventCount = await googleCalendarService.syncCalendar();
      
      setSyncStats({ emails: emailCount, events: eventCount });
      setLastSync(new Date());
      localStorage.setItem('google_last_sync', new Date().toISOString());
      
      toast.success(`Synced ${emailCount} emails and ${eventCount} calendar events`);
      
      if (onConnected) {
        onConnected();
      }
    } catch (error) {
      logger.error('Sync error:', error);
      toast.error('Failed to sync with Google. Please reconnect.');
    } finally {
      setIsSyncing(false);
    }
  };

  const formatLastSync = () => {
    if (!lastSync) return 'Never';
    
    const now = new Date();
    const diff = now.getTime() - lastSync.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  if (isConnected) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-900/50 backdrop-blur-md rounded-xl border border-gray-800 p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="h-10 w-10 bg-green-500/20 rounded-full flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Google Connected</h3>
              <p className="text-sm text-gray-400">Last synced: {formatLastSync()}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center space-x-2 transition-colors disabled:opacity-50"
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span>Sync Now</span>
            </button>
            
            <button
              onClick={handleDisconnect}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg flex items-center space-x-2 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Disconnect</span>
            </button>
          </div>
        </div>

        {/* Sync Stats */}
        {syncStats.emails > 0 || syncStats.events > 0 ? (
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <Mail className="h-4 w-4 text-blue-400" />
                <span className="text-sm text-gray-400">Emails</span>
              </div>
              <p className="text-2xl font-semibold text-white mt-1">{syncStats.emails}</p>
            </div>
            
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-green-400" />
                <span className="text-sm text-gray-400">Events</span>
              </div>
              <p className="text-2xl font-semibold text-white mt-1">{syncStats.events}</p>
            </div>
          </div>
        ) : null}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-900/50 backdrop-blur-md rounded-xl border border-gray-800 p-6"
    >
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="h-16 w-16 bg-blue-500/20 rounded-full flex items-center justify-center">
            <Link2 className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        
        <div>
          <h3 className="text-xl font-semibold text-white mb-2">Connect Google Account</h3>
          <p className="text-gray-400">
            Connect your Google account to sync Gmail and Calendar
          </p>
        </div>

        {/* Permissions */}
        <div className="bg-gray-800/50 rounded-lg p-4 text-left">
          <div className="flex items-center space-x-2 mb-3">
            <Shield className="h-4 w-4 text-yellow-500" />
            <span className="text-sm font-medium text-white">Permissions Required:</span>
          </div>
          <ul className="space-y-2 text-sm text-gray-400">
            <li className="flex items-center space-x-2">
              <Mail className="h-3 w-3" />
              <span>Read and manage your Gmail</span>
            </li>
            <li className="flex items-center space-x-2">
              <Calendar className="h-3 w-3" />
              <span>Access and manage your Google Calendar</span>
            </li>
          </ul>
        </div>

        <button
          onClick={handleConnect}
          className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center space-x-2 transition-colors"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          <span>Connect with Google</span>
        </button>
      </div>
    </motion.div>
  );
}