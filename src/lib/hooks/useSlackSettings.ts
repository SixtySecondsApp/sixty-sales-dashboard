/**
 * useSlackSettings Hook
 *
 * Manages Slack integration settings for organizations.
 * Handles CRUD operations for notification settings, channel selection, and user mappings.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/clientV2';
import { useOrg } from '@/lib/contexts/OrgContext';

// Types
export interface SlackOrgSettings {
  id: string;
  org_id: string;
  slack_team_id: string | null;
  slack_team_name: string | null;
  is_connected: boolean;
  connected_at: string | null;
  connected_by: string | null;
}

export interface SlackNotificationSettings {
  id: string;
  org_id: string;
  feature: SlackFeature;
  is_enabled: boolean;
  delivery_method: 'channel' | 'dm';
  channel_id: string | null;
  channel_name: string | null;
  schedule_time: string | null;
  schedule_timezone: string | null;
  deal_value_threshold: number | null;
  deal_stage_threshold: string | null;
  stakeholder_slack_ids: string[] | null;
}

export interface SlackUserMapping {
  id: string;
  org_id: string;
  slack_user_id: string;
  slack_username: string | null;
  slack_email: string | null;
  sixty_user_id: string | null;
}

export interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  num_members: number;
  is_member: boolean;
}

export type SlackFeature = 'meeting_debrief' | 'daily_digest' | 'meeting_prep' | 'deal_rooms';

// Query keys
const QUERY_KEYS = {
  orgSettings: (orgId: string) => ['slack', 'org-settings', orgId],
  notificationSettings: (orgId: string) => ['slack', 'notification-settings', orgId],
  userMappings: (orgId: string) => ['slack', 'user-mappings', orgId],
  channels: (orgId: string) => ['slack', 'channels', orgId],
};

/**
 * Hook to get Slack org connection status
 */
export function useSlackOrgSettings() {
  const { activeOrgId } = useOrg();
  const orgId = activeOrgId;

  return useQuery({
    queryKey: QUERY_KEYS.orgSettings(orgId || ''),
    queryFn: async () => {
      if (!orgId) return null;

      // Using type assertion since slack tables aren't in generated types yet
      const { data, error } = await (supabase
        .from('slack_org_settings') as any)
        .select('*')
        .eq('org_id', orgId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data as SlackOrgSettings | null;
    },
    enabled: !!orgId,
  });
}

/**
 * Hook to get all notification settings for the org
 */
export function useSlackNotificationSettings() {
  const { activeOrgId } = useOrg();
  const orgId = activeOrgId;

  return useQuery({
    queryKey: QUERY_KEYS.notificationSettings(orgId || ''),
    queryFn: async () => {
      if (!orgId) return [];

      // Using type assertion since slack tables aren't in generated types yet
      const { data, error } = await (supabase
        .from('slack_notification_settings') as any)
        .select('*')
        .eq('org_id', orgId);

      if (error) throw error;

      return (data || []) as SlackNotificationSettings[];
    },
    enabled: !!orgId,
  });
}

/**
 * Hook to update notification settings for a feature
 */
export function useUpdateNotificationSettings() {
  const { activeOrgId } = useOrg();
  const orgId = activeOrgId;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      feature,
      settings,
    }: {
      feature: SlackFeature;
      settings: Partial<Omit<SlackNotificationSettings, 'id' | 'org_id' | 'feature'>>;
    }) => {
      if (!orgId) throw new Error('No org selected');

      // Check if settings exist
      // Using type assertion since slack tables aren't in generated types yet
      const { data: existing } = await (supabase
        .from('slack_notification_settings') as any)
        .select('id')
        .eq('org_id', orgId)
        .eq('feature', feature)
        .single();

      if (existing) {
        // Update existing
        const { error } = await (supabase
          .from('slack_notification_settings') as any)
          .update({
            ...settings,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await (supabase
          .from('slack_notification_settings') as any)
          .insert({
            org_id: orgId,
            feature,
            ...settings,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notificationSettings(orgId || '') });
    },
  });
}

/**
 * Hook to get Slack channels
 */
export function useSlackChannels() {
  const { activeOrgId } = useOrg();
  const orgId = activeOrgId;

  return useQuery({
    queryKey: QUERY_KEYS.channels(orgId || ''),
    queryFn: async () => {
      if (!orgId) return [];

      const { data, error } = await supabase.functions.invoke('slack-list-channels', {
        body: { orgId },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      return (data.channels || []) as SlackChannel[];
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

/**
 * Hook to get user mappings
 */
export function useSlackUserMappings() {
  const { activeOrgId } = useOrg();
  const orgId = activeOrgId;

  return useQuery({
    queryKey: QUERY_KEYS.userMappings(orgId || ''),
    queryFn: async () => {
      if (!orgId) return [];

      // Using type assertion since slack tables aren't in generated types yet
      const { data, error } = await (supabase
        .from('slack_user_mappings') as any)
        .select('*')
        .eq('org_id', orgId);

      if (error) throw error;

      return (data || []) as SlackUserMapping[];
    },
    enabled: !!orgId,
  });
}

/**
 * Hook to update user mapping
 */
export function useUpdateUserMapping() {
  const { activeOrgId } = useOrg();
  const orgId = activeOrgId;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      slackUserId,
      sixtyUserId,
    }: {
      slackUserId: string;
      sixtyUserId: string | null;
    }) => {
      if (!orgId) throw new Error('No org selected');

      // Using type assertion since slack tables aren't in generated types yet
      const { error } = await (supabase
        .from('slack_user_mappings') as any)
        .update({
          sixty_user_id: sixtyUserId,
        })
        .eq('org_id', orgId)
        .eq('slack_user_id', slackUserId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.userMappings(orgId || '') });
    },
  });
}

/**
 * Hook to send a test notification
 */
export function useSendTestNotification() {
  return useMutation({
    mutationFn: async ({
      feature,
      orgId,
    }: {
      feature: SlackFeature;
      orgId: string;
    }) => {
      const functionMap: Record<SlackFeature, string> = {
        meeting_debrief: 'slack-post-meeting',
        daily_digest: 'slack-daily-digest',
        meeting_prep: 'slack-meeting-prep',
        deal_rooms: 'slack-deal-room',
      };

      const { data, error } = await supabase.functions.invoke(functionMap[feature], {
        body: {
          orgId,
          isTest: true,
        },
      });

      if (error) throw error;
      return data;
    },
  });
}

/**
 * Hook to disconnect Slack
 */
export function useDisconnectSlack() {
  const { activeOrgId } = useOrg();
  const orgId = activeOrgId;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error('No org selected');

      // Using type assertion since slack tables aren't in generated types yet
      const { error } = await (supabase
        .from('slack_org_settings') as any)
        .update({
          is_connected: false,
          bot_access_token: null,
        })
        .eq('org_id', orgId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.orgSettings(orgId || '') });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notificationSettings(orgId || '') });
    },
  });
}
