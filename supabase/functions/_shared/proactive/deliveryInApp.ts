/**
 * In-App Notification Delivery
 * 
 * Creates mirrored in-app notifications for proactive Slack notifications.
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { ProactiveNotificationPayload } from './types.ts';

/**
 * Create in-app notification mirroring Slack notification
 */
export async function deliverToInApp(
  supabase: SupabaseClient,
  payload: ProactiveNotificationPayload
): Promise<{ created: boolean; notificationId?: string; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: payload.recipientUserId,
        title: payload.title,
        message: payload.message,
        type: payload.inAppType || 'info',
        category: payload.inAppCategory || 'team',
        entity_type: payload.entityType,
        entity_id: payload.entityId,
        action_url: payload.actionUrl,
        metadata: {
          ...payload.metadata,
          proactive_type: payload.type,
          priority: payload.priority,
          slack_sent: true,
        },
      })
      .select('id')
      .single();

    if (error) {
      console.error('[proactive/deliveryInApp] Error creating notification:', error);
      return {
        created: false,
        error: error.message,
      };
    }

    return {
      created: true,
      notificationId: data.id,
    };
  } catch (error) {
    return {
      created: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
