import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Clock,
  Settings,
  Play,
  Pause,
  Loader2,
  Mail,
  Calendar,
  Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
// TODO: googleEmailService not implemented yet
// import { googleEmailService } from '@/lib/services/googleEmailService';

// Stub service until googleEmailService is implemented
const googleEmailService = {
  getSyncStatus: async (): Promise<{
    syncEnabled: boolean;
    lastSync: string | null;
    nextSync: string | null;
    totalSynced: number;
  }> => {
    console.warn('googleEmailService.getSyncStatus is not implemented');
    return { syncEnabled: false, lastSync: null, nextSync: null, totalSynced: 0 };
  },
  syncEmailsToContacts: async (): Promise<{ success: boolean; syncedCount: number; error?: string }> => {
    console.warn('googleEmailService.syncEmailsToContacts is not implemented');
    return { success: false, syncedCount: 0, error: 'Email sync service not yet implemented' };
  },
  toggleEmailSync: async (_enabled: boolean): Promise<{ success: boolean; error?: string }> => {
    console.warn('googleEmailService.toggleEmailSync is not implemented');
    return { success: false, error: 'Email sync service not yet implemented' };
  }
};
import { formatDistanceToNow, format } from 'date-fns';

interface EmailSyncStatusProps {
  className?: string;
  onSyncComplete?: (syncedCount: number) => void;
}

interface SyncStatus {
  lastSync: string | null;
  totalSynced: number;
  syncEnabled: boolean;
  nextSync?: string;
}

const EmailSyncStatus: React.FC<EmailSyncStatusProps> = ({
  className = "",
  onSyncComplete
}) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    lastSync: null,
    totalSynced: 0,
    syncEnabled: false,
    nextSync: undefined
  });
  
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<{
    success: boolean;
    count: number;
    timestamp: string;
  } | null>(null);

  const loadSyncStatus = async () => {
    try {
      setError(null);
      const status = await googleEmailService.getSyncStatus();
      setSyncStatus(status);
    } catch (error) {
      setError('Failed to load sync status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSyncStatus();
    
    // Poll for status updates every 30 seconds when sync is enabled
    const interval = setInterval(() => {
      if (syncStatus.syncEnabled && !syncing) {
        loadSyncStatus();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [syncStatus.syncEnabled, syncing]);

  const handleManualSync = async () => {
    setSyncing(true);
    setError(null);

    try {
      const result = await googleEmailService.syncEmailsToContacts();
      
      if (result.success) {
        setLastSyncResult({
          success: true,
          count: result.syncedCount,
          timestamp: new Date().toISOString()
        });
        
        toast.success(`Successfully synced ${result.syncedCount} emails`);
        
        if (onSyncComplete) {
          onSyncComplete(result.syncedCount);
        }
        
        // Refresh status after sync
        await loadSyncStatus();
      } else {
        setLastSyncResult({
          success: false,
          count: 0,
          timestamp: new Date().toISOString()
        });
        
        setError(result.error || 'Sync failed');
        toast.error(result.error || 'Failed to sync emails');
      }
    } catch (error) {
      setError('Sync failed unexpectedly');
      toast.error('Failed to sync emails');
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleSync = async (enabled: boolean) => {
    setToggling(true);
    setError(null);

    try {
      const result = await googleEmailService.toggleEmailSync(enabled);
      
      if (result.success) {
        setSyncStatus(prev => ({ ...prev, syncEnabled: enabled }));
        toast.success(enabled ? 'Email sync enabled' : 'Email sync disabled');
        
        // Refresh status to get updated nextSync time
        if (enabled) {
          await loadSyncStatus();
        }
      } else {
        setError(result.error || 'Failed to toggle sync');
        toast.error(result.error || 'Failed to toggle sync');
      }
    } catch (error) {
      setError('Failed to toggle sync');
      toast.error('Failed to toggle sync');
    } finally {
      setToggling(false);
    }
  };

  const getSyncStatusIcon = () => {
    if (syncing) {
      return <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />;
    }
    
    if (error) {
      return <XCircle className="h-5 w-5 text-red-400" />;
    }
    
    if (!syncStatus.syncEnabled) {
      return <Pause className="h-5 w-5 text-slate-400" />;
    }
    
    if (syncStatus.lastSync) {
      return <CheckCircle className="h-5 w-5 text-green-400" />;
    }
    
    return <Clock className="h-5 w-5 text-yellow-400" />;
  };

  const getSyncStatusText = () => {
    if (syncing) return 'Syncing...';
    if (error) return 'Sync Error';
    if (!syncStatus.syncEnabled) return 'Sync Disabled';
    if (!syncStatus.lastSync) return 'Not Synced';
    return 'Synced';
  };

  const getSyncStatusColor = () => {
    if (syncing) return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    if (error) return 'bg-red-500/10 text-red-400 border-red-500/20';
    if (!syncStatus.syncEnabled) return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    if (!syncStatus.lastSync) return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    return 'bg-green-500/10 text-green-400 border-green-500/20';
  };

  const formatLastSync = (lastSync: string | null) => {
    if (!lastSync) return 'Never';
    
    try {
      const date = new Date(lastSync);
      const now = new Date();
      const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
      
      if (diffInHours < 1) {
        return formatDistanceToNow(date, { addSuffix: true });
      } else if (diffInHours < 24) {
        return format(date, 'h:mm a');
      } else {
        return format(date, 'MMM d, h:mm a');
      }
    } catch (error) {
      return 'Invalid date';
    }
  };

  const formatNextSync = (nextSync: string | undefined) => {
    if (!nextSync || !syncStatus.syncEnabled) return null;
    
    try {
      const date = new Date(nextSync);
      const now = new Date();
      
      if (date < now) {
        return 'Soon';
      }
      
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
      return null;
    }
  };

  if (loading) {
    return (
      <Card className={`bg-slate-900/50 backdrop-blur-sm border-slate-700/50 ${className}`}>
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
            <span className="text-sm text-slate-400">Loading sync status...</span>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card className={`bg-slate-900/50 backdrop-blur-sm border-slate-700/50 ${className}`}>
        <div className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-500/20 rounded-lg">
                <Activity className="h-4 w-4 text-blue-400" />
              </div>
              <h4 className="font-medium text-white">Email Sync</h4>
            </div>
            
            <Badge variant="outline" className={getSyncStatusColor()}>
              <div className="flex items-center gap-1">
                {getSyncStatusIcon()}
                {getSyncStatusText()}
              </div>
            </Badge>
          </div>

          {/* Error Display */}
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-400" />
                <span className="text-sm text-red-400">{error}</span>
              </div>
            </motion.div>
          )}

          {/* Sync Statistics */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">
                {syncStatus.totalSynced.toLocaleString()}
              </div>
              <div className="text-xs text-slate-400">Total Synced</div>
            </div>
            
            <div className="text-center">
              <div className="text-lg font-semibold text-slate-300">
                {formatLastSync(syncStatus.lastSync)}
              </div>
              <div className="text-xs text-slate-400">Last Sync</div>
            </div>
          </div>

          {/* Next Sync Info */}
          {syncStatus.syncEnabled && syncStatus.nextSync && (
            <div className="flex items-center gap-2 mb-4 p-2 bg-slate-800/30 rounded-lg">
              <Calendar className="h-4 w-4 text-blue-400" />
              <span className="text-sm text-slate-300">
                Next sync {formatNextSync(syncStatus.nextSync)}
              </span>
            </div>
          )}

          {/* Last Sync Result */}
          {lastSyncResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex items-center gap-2 mb-4 p-2 rounded-lg ${
                lastSyncResult.success 
                  ? 'bg-green-500/10 border border-green-500/20' 
                  : 'bg-red-500/10 border border-red-500/20'
              }`}
            >
              {lastSyncResult.success ? (
                <CheckCircle className="h-4 w-4 text-green-400" />
              ) : (
                <XCircle className="h-4 w-4 text-red-400" />
              )}
              <span className={`text-sm ${lastSyncResult.success ? 'text-green-400' : 'text-red-400'}`}>
                {lastSyncResult.success 
                  ? `Synced ${lastSyncResult.count} emails`
                  : 'Sync failed'
                } • {formatDistanceToNow(new Date(lastSyncResult.timestamp), { addSuffix: true })}
              </span>
            </motion.div>
          )}

          {/* Controls */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Switch
                checked={syncStatus.syncEnabled}
                onCheckedChange={handleToggleSync}
                disabled={toggling}
                className="data-[state=checked]:bg-blue-600"
              />
              <span className="text-sm text-slate-300">
                Auto Sync
              </span>
              {toggling && (
                <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
              )}
            </div>

            <div className="flex gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadSyncStatus}
                    disabled={loading || syncing}
                    className="text-slate-400 hover:text-white"
                  >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Refresh status</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleManualSync}
                    disabled={syncing || toggling}
                    className="text-slate-400 hover:text-white"
                  >
                    {syncing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Manual sync</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Sync Info */}
          <div className="mt-4 pt-3 border-t border-slate-700/50 text-xs text-slate-500">
            {syncStatus.syncEnabled ? (
              <div className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                Automatic sync every 15 minutes
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <Settings className="h-3 w-3" />
                Enable sync to automatically fetch new emails
              </div>
            )}
          </div>
        </div>
      </Card>
    </TooltipProvider>
  );
};

export default EmailSyncStatus;