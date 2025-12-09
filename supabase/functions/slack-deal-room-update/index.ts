// supabase/functions/slack-deal-room-update/index.ts
// Posts updates to deal room channels for various deal events

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import {
  buildDealStageChangeMessage,
  buildDealActivityMessage,
  buildWinProbabilityChangeMessage,
  buildDealWonMessage,
  buildDealLostMessage,
  buildMeetingDebriefMessage,
  type DealStageChangeData,
  type DealActivityData,
  type WinProbabilityChangeData,
  type DealWonData,
  type DealLostData,
  type MeetingDebriefData,
} from '../_shared/slackBlocks.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const appUrl = Deno.env.get('APP_URL') || Deno.env.get('SITE_URL') || 'https://use60.com';

type UpdateType = 'stage_change' | 'activity' | 'win_probability' | 'deal_won' | 'deal_lost' | 'meeting_summary';

interface UpdateRequest {
  dealId: string;
  orgId?: string;
  updateType: UpdateType;
  data: Record<string, unknown>;
}

/**
 * Get deal room channel ID
 */
async function getDealRoomChannel(
  supabase: ReturnType<typeof createClient>,
  dealId: string
): Promise<{ channelId: string; orgId: string } | null> {
  const { data } = await supabase
    .from('slack_deal_rooms')
    .select('slack_channel_id, org_id')
    .eq('deal_id', dealId)
    .eq('is_archived', false)
    .single();

  if (!data) return null;

  return {
    channelId: data.slack_channel_id,
    orgId: data.org_id,
  };
}

/**
 * Get Slack bot token for org
 */
async function getSlackBotToken(
  supabase: ReturnType<typeof createClient>,
  orgId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('slack_org_settings')
    .select('bot_access_token')
    .eq('org_id', orgId)
    .eq('is_connected', true)
    .single();

  return data?.bot_access_token || null;
}

/**
 * Get Slack user ID for a Sixty user
 */
async function getSlackUserId(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  sixtyUserId: string
): Promise<string | undefined> {
  const { data } = await supabase
    .from('slack_user_mappings')
    .select('slack_user_id')
    .eq('org_id', orgId)
    .eq('sixty_user_id', sixtyUserId)
    .single();

  return data?.slack_user_id;
}

/**
 * Post message to Slack channel
 */
async function postToChannel(
  botToken: string,
  channelId: string,
  message: { blocks: unknown[]; text: string }
): Promise<{ ok: boolean; ts?: string; error?: string }> {
  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel: channelId,
      blocks: message.blocks,
      text: message.text,
    }),
  });

  return response.json();
}

/**
 * Archive a Slack channel
 */
async function archiveChannel(
  botToken: string,
  channelId: string
): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch('https://slack.com/api/conversations.archive', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel: channelId,
    }),
  });

  return response.json();
}

/**
 * Update channel topic
 */
async function updateChannelTopic(
  botToken: string,
  channelId: string,
  topic: string
): Promise<void> {
  await fetch('https://slack.com/api/conversations.setTopic', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel: channelId,
      topic,
    }),
  });
}

/**
 * Build message based on update type
 */
function buildUpdateMessage(
  updateType: UpdateType,
  data: Record<string, unknown>
): { blocks: unknown[]; text: string } {
  switch (updateType) {
    case 'stage_change':
      return buildDealStageChangeMessage(data as DealStageChangeData);
    case 'activity':
      return buildDealActivityMessage(data as DealActivityData);
    case 'win_probability':
      return buildWinProbabilityChangeMessage(data as WinProbabilityChangeData);
    case 'deal_won':
      return buildDealWonMessage(data as DealWonData);
    case 'deal_lost':
      return buildDealLostMessage(data as DealLostData);
    case 'meeting_summary':
      return buildMeetingDebriefMessage(data as MeetingDebriefData);
    default:
      return {
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `📢 *Deal Update*\n${JSON.stringify(data)}`,
            },
          },
        ],
        text: 'Deal Update',
      };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { dealId, orgId, updateType, data } = await req.json() as UpdateRequest;

    if (!dealId || !updateType) {
      return new Response(
        JSON.stringify({ error: 'dealId and updateType required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get deal room channel
    const dealRoom = await getDealRoomChannel(supabase, dealId);
    if (!dealRoom) {
      console.log('No deal room exists for deal:', dealId);
      return new Response(
        JSON.stringify({ success: false, message: 'No deal room for this deal' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get bot token
    const botToken = await getSlackBotToken(supabase, dealRoom.orgId);
    if (!botToken) {
      return new Response(
        JSON.stringify({ success: false, message: 'No Slack bot token' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Enrich data with common fields
    const enrichedData = {
      ...data,
      appUrl,
      dealId,
    };

    // If there's a user_id in data, try to get their Slack ID for @mention
    if (data.userId && typeof data.userId === 'string') {
      const slackUserId = await getSlackUserId(supabase, dealRoom.orgId, data.userId);
      if (slackUserId) {
        enrichedData.slackUserId = slackUserId;
      }
    }

    // Build the message
    const message = buildUpdateMessage(updateType, enrichedData);

    // Post to channel
    const postResult = await postToChannel(botToken, dealRoom.channelId, message);

    if (!postResult.ok) {
      console.error('Failed to post update:', postResult.error);
      return new Response(
        JSON.stringify({ success: false, error: postResult.error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle special cases for deal won/lost
    if (updateType === 'deal_won' || updateType === 'deal_lost') {
      // Update channel topic
      const statusEmoji = updateType === 'deal_won' ? '🏆 WON' : '❌ LOST';
      const topic = `${statusEmoji} - This channel will be archived soon`;
      await updateChannelTopic(botToken, dealRoom.channelId, topic);

      // Archive channel after a delay (or immediately)
      if (data.archiveImmediately) {
        const archiveResult = await archiveChannel(botToken, dealRoom.channelId);
        if (!archiveResult.ok) {
          console.warn('Failed to archive channel:', archiveResult.error);
        }

        // Update database
        await supabase
          .from('slack_deal_rooms')
          .update({
            is_archived: true,
            archived_at: new Date().toISOString(),
          })
          .eq('deal_id', dealId);
      }
    }

    // Update channel topic for stage changes
    if (updateType === 'stage_change') {
      const { dealName, dealValue, newStage } = data as { dealName?: string; dealValue?: number; newStage?: string };
      if (dealName && dealValue && newStage) {
        const topic = `💰 ${dealName} | $${dealValue.toLocaleString()} | Stage: ${newStage}`;
        await updateChannelTopic(botToken, dealRoom.channelId, topic);
      }
    }

    // Record notification
    await supabase.from('slack_notifications_sent').insert({
      org_id: dealRoom.orgId,
      feature: 'deal_rooms',
      entity_type: updateType,
      entity_id: dealId,
      recipient_type: 'channel',
      recipient_id: dealRoom.channelId,
      slack_ts: postResult.ts || '',
      slack_channel_id: dealRoom.channelId,
    });

    console.log(`Deal room update posted: ${updateType} for deal ${dealId}`);
    return new Response(
      JSON.stringify({
        success: true,
        slackTs: postResult.ts,
        channelId: dealRoom.channelId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error posting deal room update:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
