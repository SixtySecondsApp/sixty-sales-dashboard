/**
 * SlackNotificationSettings - Admin component for configuring waitlist Slack notifications
 * Uses OAuth flow for workspace connection and lists available channels
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/clientV2';
import { slackOAuthService } from '@/lib/services/slackOAuthService';
import { toast } from 'sonner';
import { FaSlack } from 'react-icons/fa';
import {
  Check,
  Loader2,
  Bell,
  Hash,
  Send,
  RefreshCw,
  Link as LinkIcon,
  AlertCircle,
  Search,
  Lock,
  ChevronDown,
  Users,
  Trophy,
  Star,
  Calendar,
  Play,
} from 'lucide-react';

interface SlackChannel {
  id: string;
  name: string;
  is_private?: boolean;
  num_members?: number;
}

interface SlackOrg {
  org_id: string;
  team_id: string;
  team_name: string;
  is_connected: boolean;
}

interface SlackNotificationSettingsProps {
  className?: string;
}

const CONFIG_KEYS = {
  ORG_ID: 'waitlist_slack_org_id',
  CHANNEL_ID: 'waitlist_slack_channel_id',
};

export function SlackNotificationSettings({ className = '' }: SlackNotificationSettingsProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isLoadingChannels, setIsLoadingChannels] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Test notification states
  const [testingType, setTestingType] = useState<string | null>(null);
  const [sampleEntry, setSampleEntry] = useState<any>(null);

  // Connected workspace
  const [connectedOrg, setConnectedOrg] = useState<SlackOrg | null>(null);
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  // Current settings
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [originalChannelId, setOriginalChannelId] = useState<string>('');
  const [channelSearch, setChannelSearch] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Track if settings have changed
  const hasChanges = selectedChannelId !== originalChannelId;

  // Filter channels based on search
  const filteredChannels = channels.filter(channel =>
    channel.name.toLowerCase().includes(channelSearch.toLowerCase())
  );

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    getUser();
  }, []);

  // Load current settings and connected workspace
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Load current settings from system_config
      const { data: configs } = await supabase
        .from('system_config')
        .select('key, value')
        .in('key', [CONFIG_KEYS.ORG_ID, CONFIG_KEYS.CHANNEL_ID]);

      const configMap = new Map(configs?.map(c => [c.key, c.value]) || []);
      const savedOrgId = configMap.get(CONFIG_KEYS.ORG_ID) || '';
      const savedChannelId = configMap.get(CONFIG_KEYS.CHANNEL_ID) || '';

      setSelectedChannelId(savedChannelId);
      setOriginalChannelId(savedChannelId);

      // Load connected Slack workspaces (via user's integrations)
      if (userId) {
        const integrations = await slackOAuthService.getIntegrations(userId);
        if (integrations && integrations.length > 0) {
          // Use the first connected workspace (or the saved one if it matches)
          const matchingOrg = savedOrgId
            ? integrations.find((i: any) => i.team_id === savedOrgId)
            : integrations[0];

          if (matchingOrg) {
            setConnectedOrg({
              org_id: matchingOrg.team_id,
              team_id: matchingOrg.team_id,
              team_name: matchingOrg.team_name,
              is_connected: true,
            });
            // Load channels for this workspace
            await loadChannels(matchingOrg.team_id);
          }
        }
      }
    } catch (err) {
      console.error('Error loading Slack settings:', err);
      toast.error('Failed to load Slack settings');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Load channels for a workspace (uses cache first)
  const loadChannels = async (teamId: string) => {
    if (!teamId || !userId) {
      setChannels([]);
      return;
    }

    setIsLoadingChannels(true);
    try {
      // First try to get cached channels
      let channelList = await slackOAuthService.getChannels(userId, teamId);

      // If no cached channels, refresh from Slack API via edge function
      if (channelList.length === 0) {
        try {
          // refreshChannels now returns channels directly from the edge function
          channelList = await slackOAuthService.refreshChannels(userId, teamId);
        } catch (refreshErr) {
          console.error('Error refreshing channels:', refreshErr);
          // Try to get cached channels again in case some were loaded
          channelList = await slackOAuthService.getChannels(userId, teamId);
        }
      }

      setChannels(channelList);
    } catch (err) {
      console.error('Error loading Slack channels:', err);
      toast.error('Failed to load channels. The bot may need to be invited to channels first.');
      setChannels([]);
    } finally {
      setIsLoadingChannels(false);
    }
  };

  // Force refresh channels from Slack API
  const forceRefreshChannels = async (teamId: string) => {
    if (!teamId || !userId) {
      return;
    }

    setIsLoadingChannels(true);
    try {
      // Always refresh from Slack API
      const channelList = await slackOAuthService.refreshChannels(userId, teamId);
      setChannels(channelList);
      toast.success(`Found ${channelList.length} channels`);
    } catch (err) {
      console.error('Error refreshing Slack channels:', err);
      toast.error('Failed to refresh channels. The bot may need to be invited to channels first.');
    } finally {
      setIsLoadingChannels(false);
    }
  };

  useEffect(() => {
    if (userId) {
      loadData();
    }
  }, [userId, loadData]);

  // Load a sample waitlist entry for testing
  useEffect(() => {
    const loadSampleEntry = async () => {
      try {
        const { data, error } = await supabase
          .from('meetings_waitlist')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (!error && data) {
          setSampleEntry(data);
        }
      } catch (err) {
        console.error('Error loading sample entry:', err);
      }
    };

    loadSampleEntry();
  }, []);

  // Check for OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slackConnected = params.get('slack_connected');
    const slackError = params.get('slack_error');

    if (slackConnected === 'true') {
      toast.success('Successfully connected to Slack!');
      window.history.replaceState({}, '', window.location.pathname);
      if (userId) {
        loadData();
      }
    } else if (slackError) {
      toast.error(`Failed to connect to Slack: ${slackError}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [userId, loadData]);

  // Handle OAuth connect
  const handleConnect = () => {
    if (!userId) {
      toast.error('Please sign in first');
      return;
    }

    setIsConnecting(true);

    // Open OAuth URL in a popup
    const oauthUrl = slackOAuthService.initiateOAuth(userId);
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      oauthUrl,
      'slack-oauth',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
    );

    // Check if popup was closed
    const checkInterval = setInterval(() => {
      if (popup?.closed) {
        clearInterval(checkInterval);
        setIsConnecting(false);
        // Refresh data after popup closes
        setTimeout(() => loadData(), 1000);
      }
    }, 1000);
  };

  // Save settings
  const handleSave = async () => {
    if (!connectedOrg) {
      toast.error('Please connect a Slack workspace first');
      return;
    }

    if (!selectedChannelId) {
      toast.error('Please select a channel');
      return;
    }

    setIsSaving(true);
    try {
      // Save org ID
      const { error: orgError } = await supabase.rpc('set_system_config', {
        p_key: CONFIG_KEYS.ORG_ID,
        p_value: connectedOrg.team_id,
        p_description: 'Slack workspace ID for waitlist notifications',
      });

      if (orgError) throw orgError;

      // Save channel ID
      const { error: channelError } = await supabase.rpc('set_system_config', {
        p_key: CONFIG_KEYS.CHANNEL_ID,
        p_value: selectedChannelId,
        p_description: 'Slack channel ID for waitlist notifications',
      });

      if (channelError) throw channelError;

      setOriginalChannelId(selectedChannelId);
      toast.success('Slack notification settings saved');
    } catch (err) {
      console.error('Error saving Slack settings:', err);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  // Test notification handlers
  const testNotification = async (
    type: string,
    params: Record<string, any> = {},
    successMessage: string
  ) => {
    setTestingType(type);
    try {
      const { data, error } = await supabase.functions.invoke('slack-waitlist-notification', {
        body: { type, ...params },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(successMessage);
      } else {
        toast.error(data?.error || 'Failed to send test notification');
      }
    } catch (err: any) {
      console.error('Error sending test notification:', err);
      toast.error(err.message || 'Failed to send test notification');
    } finally {
      setTestingType(null);
    }
  };

  const handleTestNewSignup = () => {
    if (!sampleEntry) {
      toast.error('No sample waitlist entry found');
      return;
    }
    testNotification(
      'new_signup',
      { entry_id: sampleEntry.id },
      `✅ New signup notification sent for ${sampleEntry.full_name || sampleEntry.email}`
    );
  };

  const handleTestDailyDigest = () => {
    testNotification(
      'daily_digest',
      {},
      '✅ Daily digest notification sent!'
    );
  };

  const handleTestReferralMilestone = (milestone: number) => {
    if (!sampleEntry) {
      toast.error('No sample waitlist entry found');
      return;
    }
    testNotification(
      'referral_milestone',
      { entry_id: sampleEntry.id, milestone },
      `✅ Referral milestone (${milestone}) notification sent!`
    );
  };

  const handleTestTierUpgrade = (tier: string) => {
    if (!sampleEntry) {
      toast.error('No sample waitlist entry found');
      return;
    }
    testNotification(
      'tier_upgrade',
      { entry_id: sampleEntry.id, new_tier: tier },
      `✅ ${tier} tier upgrade notification sent!`
    );
  };

  // Legacy test handler (keeping for backward compatibility)
  const handleTest = () => handleTestDailyDigest();

  if (isLoading) {
    return (
      <div className={`bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Loading Slack settings...</span>
        </div>
      </div>
    );
  }

  const selectedChannel = channels.find(c => c.id === selectedChannelId);

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
            <Bell className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Slack Notifications
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Configure where waitlist notifications are sent
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Workspace Connection */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <FaSlack className="h-4 w-4 text-[#4A154B]" />
            Slack Workspace
          </label>

          {connectedOrg ? (
            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {connectedOrg.team_name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Connected
                  </p>
                </div>
              </div>
              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="text-xs text-purple-600 dark:text-purple-400 hover:underline"
              >
                Switch workspace
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      No Slack workspace connected
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      Connect your Slack workspace to enable waitlist notifications
                    </p>
                  </div>
                </div>
              </div>
              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="flex items-center gap-2 px-4 py-2 bg-[#4A154B] hover:bg-[#611f69] text-white rounded-lg transition-colors"
              >
                {isConnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FaSlack className="h-4 w-4" />
                )}
                Connect to Slack
              </button>
            </div>
          )}
        </div>

        {/* Channel Selection */}
        {connectedOrg && (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <Hash className="h-4 w-4" />
              Notification Channel
            </label>

            {isLoadingChannels ? (
              <div className="flex items-center gap-2 py-2 text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading channels...
              </div>
            ) : channels.length > 0 ? (
              <div className="relative">
                {/* Selected channel display / dropdown trigger */}
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <span className="flex items-center gap-2">
                    {selectedChannelId ? (
                      <>
                        {channels.find(c => c.id === selectedChannelId)?.is_private ? (
                          <Lock className="h-3.5 w-3.5 text-gray-400" />
                        ) : (
                          <Hash className="h-3.5 w-3.5 text-gray-400" />
                        )}
                        {channels.find(c => c.id === selectedChannelId)?.name}
                      </>
                    ) : (
                      <span className="text-gray-400">Select a channel...</span>
                    )}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown */}
                {isDropdownOpen && (
                  <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg max-h-80 overflow-hidden">
                    {/* Search input */}
                    <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search channels..."
                          value={channelSearch}
                          onChange={(e) => setChannelSearch(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-md text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          autoFocus
                        />
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-500">
                          {filteredChannels.length} of {channels.length} channels
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            forceRefreshChannels(connectedOrg.team_id);
                          }}
                          disabled={isLoadingChannels}
                          className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 disabled:opacity-50"
                        >
                          <RefreshCw className={`h-3 w-3 ${isLoadingChannels ? 'animate-spin' : ''}`} />
                          Refresh
                        </button>
                      </div>
                    </div>

                    {/* Channel list */}
                    <div className="max-h-56 overflow-y-auto">
                      {filteredChannels.length > 0 ? (
                        filteredChannels.map((channel) => (
                          <button
                            key={channel.id}
                            type="button"
                            onClick={() => {
                              setSelectedChannelId(channel.id);
                              setIsDropdownOpen(false);
                              setChannelSearch('');
                            }}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                              selectedChannelId === channel.id
                                ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                                : 'text-gray-900 dark:text-gray-100'
                            }`}
                          >
                            {channel.is_private ? (
                              <Lock className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                            ) : (
                              <Hash className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                            )}
                            <span className="truncate">{channel.name}</span>
                            {selectedChannelId === channel.id && (
                              <Check className="h-4 w-4 text-purple-600 ml-auto flex-shrink-0" />
                            )}
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-4 text-center text-sm text-gray-500">
                          No channels match "{channelSearch}"
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Click outside to close */}
                {isDropdownOpen && (
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      setChannelSearch('');
                    }}
                  />
                )}
              </div>
            ) : (
              <div className="p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  No channels found. Click refresh to load all available channels.
                </p>
                <button
                  onClick={() => forceRefreshChannels(connectedOrg.team_id)}
                  disabled={isLoadingChannels}
                  className="mt-2 text-sm text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3 w-3 ${isLoadingChannels ? 'animate-spin' : ''}`} />
                  {isLoadingChannels ? 'Refreshing...' : 'Refresh channels'}
                </button>
              </div>
            )}

            <p className="text-xs text-gray-500 dark:text-gray-400">
              The bot will post waitlist notifications to this channel
            </p>
          </div>
        )}

        {/* Current Configuration Display */}
        {originalChannelId && (
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg space-y-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Current Configuration
            </p>
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              {connectedOrg && (
                <p>
                  <span className="text-gray-500">Workspace:</span>{' '}
                  {connectedOrg.team_name}
                </p>
              )}
              <p>
                <span className="text-gray-500">Channel:</span>{' '}
                {selectedChannel ? `#${selectedChannel.name}` : originalChannelId}
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        {connectedOrg && (
          <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleSave}
              disabled={!hasChanges || isSaving || !selectedChannelId}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Save Settings
            </button>

            <button
              onClick={handleTest}
              disabled={!originalChannelId || isTesting}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
            >
              {isTesting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send Test
            </button>

            <button
              onClick={loadData}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        )}

        {/* Test Notifications Section */}
        {connectedOrg && originalChannelId && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <Play className="h-4 w-4" />
              Test Notifications
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Test each notification type using sample data. Messages will be sent to the configured channel.
            </p>

            {/* Sample entry info */}
            {sampleEntry && (
              <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-xs text-gray-500 dark:text-gray-400">
                <span className="font-medium">Sample user for tests:</span>{' '}
                {sampleEntry.full_name || 'Unknown'} ({sampleEntry.email})
                {sampleEntry.referral_count > 0 && (
                  <span className="ml-2">• {sampleEntry.referral_count} referrals</span>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* New Signup Test */}
              <button
                onClick={handleTestNewSignup}
                disabled={testingType !== null || !sampleEntry}
                className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="p-2 bg-blue-100 dark:bg-blue-800/50 rounded-lg">
                  {testingType === 'new_signup' ? (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                  ) : (
                    <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    New Signup
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    🎉 Real-time notification
                  </p>
                </div>
              </button>

              {/* Daily Digest Test */}
              <button
                onClick={handleTestDailyDigest}
                disabled={testingType !== null}
                className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="p-2 bg-amber-100 dark:bg-amber-800/50 rounded-lg">
                  {testingType === 'daily_digest' ? (
                    <Loader2 className="h-4 w-4 animate-spin text-amber-600 dark:text-amber-400" />
                  ) : (
                    <Calendar className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Daily Digest
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    ☀️ Stats & tool leaderboard
                  </p>
                </div>
              </button>

              {/* Referral Milestone Test */}
              <button
                onClick={() => handleTestReferralMilestone(5)}
                disabled={testingType !== null || !sampleEntry}
                className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="p-2 bg-green-100 dark:bg-green-800/50 rounded-lg">
                  {testingType === 'referral_milestone' ? (
                    <Loader2 className="h-4 w-4 animate-spin text-green-600 dark:text-green-400" />
                  ) : (
                    <Trophy className="h-4 w-4 text-green-600 dark:text-green-400" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Referral Milestone
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    🏆 5 referrals reached
                  </p>
                </div>
              </button>

              {/* Tier Upgrade Test */}
              <button
                onClick={() => handleTestTierUpgrade('VIP')}
                disabled={testingType !== null || !sampleEntry}
                className="flex items-center gap-2 p-3 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-lg text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="p-2 bg-purple-100 dark:bg-purple-800/50 rounded-lg">
                  {testingType === 'tier_upgrade' ? (
                    <Loader2 className="h-4 w-4 animate-spin text-purple-600 dark:text-purple-400" />
                  ) : (
                    <Star className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    VIP Tier Upgrade
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    👑 Top 50 achieved
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Info */}
        <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
          <p><strong>Notifications sent:</strong></p>
          <ul className="list-disc list-inside ml-2 space-y-1">
            <li>New signups (real-time)</li>
            <li>Daily digest at 9 AM UK time</li>
            <li>Referral milestones (3, 5, 10 referrals)</li>
            <li>Tier upgrades (VIP, Priority)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
