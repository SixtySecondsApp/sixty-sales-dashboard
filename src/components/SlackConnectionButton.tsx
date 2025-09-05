import React, { useState, useEffect } from 'react';
import { slackOAuthService } from '@/lib/services/slackOAuthService';
import { supabase } from '@/lib/supabase/clientV2';
import { FaSlack } from 'react-icons/fa';
import { HiCheck, HiX } from 'react-icons/hi';
import logger from '@/lib/utils/logger';

interface SlackConnectionButtonProps {
  onConnectionChange?: (connected: boolean) => void;
  className?: string;
}

export function SlackConnectionButton({ 
  onConnectionChange,
  className = ''
}: SlackConnectionButtonProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  
  // Get current user on mount
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        checkConnection(user.id);
      } else {
        setIsLoading(false);
      }
    };
    getUser();
  }, []);
  
  // Check for OAuth callback params in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slackConnected = params.get('slack_connected');
    const slackError = params.get('slack_error');
    
    if (slackConnected === 'true') {
      if (userId) {
        checkConnection(userId);
      }
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
      // Show success message
      alert('✅ Successfully connected to Slack!');
    } else if (slackError) {
      alert(`❌ Failed to connect to Slack: ${slackError}`);
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [userId]);
  
  const checkConnection = async (uid?: string) => {
    const userIdToUse = uid || userId;
    if (!userIdToUse) {
      setIsLoading(false);
      return;
    }
    
    try {
      const connected = await slackOAuthService.hasActiveIntegration(userIdToUse);
      setIsConnected(connected);
      
      if (connected) {
        const ints = await slackOAuthService.getIntegrations(userIdToUse);
        setIntegrations(ints);
      }
      
      onConnectionChange?.(connected);
    } catch (error) {
      logger.error('Failed to check Slack connection:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleConnect = () => {
    if (!userId) {
      alert('Please sign in to connect Slack');
      return;
    }
    
    // Open OAuth URL in a popup window
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
        // Check connection status after popup closes
        setTimeout(() => checkConnection(), 1000);
      }
    }, 1000);
  };
  
  const handleDisconnect = async (teamId: string) => {
    if (!userId) return;
    
    if (confirm('Are you sure you want to disconnect from this Slack workspace?')) {
      try {
        await slackOAuthService.disconnect(userId, teamId);
        await checkConnection();
        alert('✅ Disconnected from Slack');
      } catch (error) {
        alert('❌ Failed to disconnect from Slack');
        logger.error('Failed to disconnect:', error);
      }
    }
  };
  
  const handleTest = async (teamId: string) => {
    if (!userId) return;
    
    try {
      const success = await slackOAuthService.testConnection(userId, teamId);
      if (success) {
        alert('✅ Test message sent! Check your #general channel.');
      } else {
        alert('❌ Failed to send test message');
      }
    } catch (error) {
      alert('❌ Test failed: ' + error.message);
    }
  };
  
  if (isLoading) {
    return (
      <div className={`animate-pulse bg-gray-800/50 rounded-lg p-4 ${className}`}>
        <div className="h-10 bg-gray-700/50 rounded"></div>
      </div>
    );
  }
  
  return (
    <div className={`bg-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-800 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <FaSlack className="text-2xl text-[#4A154B]" />
          <div>
            <h3 className="text-lg font-semibold text-white">Slack Integration</h3>
            <p className="text-sm text-gray-400">
              {isConnected 
                ? 'Connected to Slack workspace' 
                : 'Connect to send workflow notifications to Slack'}
            </p>
          </div>
        </div>
        
        {!isConnected && (
          <button
            onClick={handleConnect}
            className="px-4 py-2 bg-[#4A154B] text-white rounded-lg hover:bg-[#611f69] transition-colors flex items-center gap-2"
          >
            <FaSlack className="text-lg" />
            Connect to Slack
          </button>
        )}
      </div>
      
      {isConnected && integrations.length > 0 && (
        <div className="space-y-3">
          {integrations.map((integration) => (
            <div 
              key={integration.id}
              className="bg-gray-800/50 rounded-lg p-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <div>
                  <p className="text-sm font-medium text-white">
                    {integration.team_name}
                  </p>
                  <p className="text-xs text-gray-400">
                    Team ID: {integration.team_id}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleTest(integration.team_id)}
                  className="px-3 py-1 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
                >
                  Test
                </button>
                <button
                  onClick={() => handleDisconnect(integration.team_id)}
                  className="px-3 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div className="mt-4 p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
        <h4 className="text-xs font-medium text-blue-400 mb-1">
          {isConnected ? '✓ Ready to use' : 'How it works'}
        </h4>
        <p className="text-xs text-gray-400">
          {isConnected 
            ? 'You can now select Slack channels dynamically in your workflows. The bot can post to any public channel or channels it\'s invited to.'
            : 'OAuth integration allows dynamic channel selection and doesn\'t require managing webhook URLs. Connect once and post to any channel.'}
        </p>
      </div>
    </div>
  );
}