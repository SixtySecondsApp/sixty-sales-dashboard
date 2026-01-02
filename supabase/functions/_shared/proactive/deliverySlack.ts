/**
 * Slack Delivery for Proactive Notifications
 * 
 * Handles sending Slack DMs and channel messages with safe block rendering.
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { ProactiveNotificationPayload } from './types.ts';

interface SlackDeliveryOptions {
  botToken: string;
  slackUserId: string;
  blocks?: any[];
  text?: string;
}

/**
 * Send Slack DM to a user
 */
export async function sendSlackDM(
  options: SlackDeliveryOptions
): Promise<{ success: boolean; channelId?: string; ts?: string; error?: string }> {
  const { botToken, slackUserId, blocks, text } = options;

  try {
    // Open DM channel
    const openDmResponse = await fetch('https://slack.com/api/conversations.open', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        users: slackUserId,
      }),
    });

    const openDmData = await openDmResponse.json();
    
    if (!openDmData.ok || !openDmData.channel?.id) {
      return {
        success: false,
        error: `Failed to open DM: ${openDmData.error || 'Unknown error'}`,
      };
    }

    const channelId = openDmData.channel.id;

    // Send message
    const messagePayload: any = {
      channel: channelId,
      text: text || 'Notification from use60',
    };

    if (blocks && blocks.length > 0) {
      // Validate and truncate blocks if needed
      const safeBlocks = truncateBlocks(blocks);
      messagePayload.blocks = safeBlocks;
    }

    const postMessageResponse = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messagePayload),
    });

    const postMessageData = await postMessageResponse.json();

    if (!postMessageData.ok) {
      return {
        success: false,
        error: `Failed to send message: ${postMessageData.error || 'Unknown error'}`,
      };
    }

    return {
      success: true,
      channelId,
      ts: postMessageData.ts,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Truncate blocks to fit Slack limits
 */
function truncateBlocks(blocks: any[]): any[] {
  const MAX_BLOCKS = 50;
  const MAX_TEXT_LENGTH = 3000;

  let truncated = blocks.slice(0, MAX_BLOCKS);

  // Truncate text in sections
  truncated = truncated.map(block => {
    if (block.type === 'section' && block.text?.text) {
      if (block.text.text.length > MAX_TEXT_LENGTH) {
        block.text.text = block.text.text.substring(0, MAX_TEXT_LENGTH - 3) + '...';
      }
    }
    return block;
  });

  return truncated;
}

/**
 * Deliver notification to Slack
 */
export async function deliverToSlack(
  supabase: SupabaseClient,
  payload: ProactiveNotificationPayload,
  botToken: string
): Promise<{ sent: boolean; channelId?: string; ts?: string; error?: string }> {
  if (!payload.recipientSlackUserId) {
    return {
      sent: false,
      error: 'No Slack user ID provided',
    };
  }

  const result = await sendSlackDM({
    botToken,
    slackUserId: payload.recipientSlackUserId,
    blocks: payload.blocks,
    text: payload.message,
  });

  return {
    sent: result.success,
    channelId: result.channelId,
    ts: result.ts,
    error: result.error,
  };
}
