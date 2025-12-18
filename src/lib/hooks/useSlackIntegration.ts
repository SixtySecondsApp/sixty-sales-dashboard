/**
 * useSlackIntegration Hook
 *
 * Hook for the Integrations page to check Slack connection status at the org level.
 * Uses the org-level Slack settings rather than user-level.
 */

import { useSlackOrgSettings, useDisconnectSlack } from '@/lib/hooks/useSlackSettings';
import { slackOAuthService } from '@/lib/services/slackOAuthService';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useOrg } from '@/lib/contexts/OrgContext';
import { useCallback } from 'react';

export function useSlackIntegration() {
  const { user } = useAuth();
  const { activeOrgId } = useOrg();
  const { data: orgSettings, isLoading, refetch } = useSlackOrgSettings();
  const disconnectMutation = useDisconnectSlack();

  const isConnected = orgSettings?.is_connected ?? false;

  /**
   * Initiate Slack OAuth flow
   */
  const connectSlack = useCallback(() => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    const authUrl = slackOAuthService.initiateOAuth(user.id, activeOrgId || undefined);
    
    // Open OAuth in same window (redirect flow)
    window.location.href = authUrl;
  }, [user?.id, activeOrgId]);

  /**
   * Disconnect Slack integration
   */
  const disconnectSlack = useCallback(async () => {
    await disconnectMutation.mutateAsync();
    await refetch();
  }, [disconnectMutation, refetch]);

  return {
    isConnected,
    loading: isLoading,
    orgSettings,
    teamName: orgSettings?.slack_team_name || null,
    connectedAt: orgSettings?.connected_at || null,
    connectSlack,
    disconnectSlack,
    isDisconnecting: disconnectMutation.isPending,
    refetch,
  };
}





