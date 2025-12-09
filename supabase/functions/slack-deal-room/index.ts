// supabase/functions/slack-deal-room/index.ts
// Creates private Slack deal room channels when deals meet criteria

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import { buildDealRoomWelcomeMessage, type DealRoomData } from '../_shared/slackBlocks.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const appUrl = Deno.env.get('APP_URL') || Deno.env.get('SITE_URL') || 'https://use60.com';

interface DealData {
  id: string;
  title: string;
  stage: string;
  value: number;
  monthly_value?: number;
  win_probability?: number;
  user_id: string;
  org_id?: string;
  company_id?: string;
  company?: {
    id: string;
    name: string;
    industry?: string;
    size?: string;
  };
  contacts?: Array<{
    id: string;
    name: string;
    title?: string;
    is_decision_maker?: boolean;
  }>;
}

interface DealRoomSettings {
  enabled: boolean;
  valueThreshold: number;
  stageThreshold: string;
  stakeholderSlackIds: string[];
}

/**
 * Generate a Slack-safe channel name
 */
function generateChannelName(companyName: string, dealId: string): string {
  const slug = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);

  const shortId = dealId.substring(0, 4);
  return `deal-${slug}-${shortId}`;
}

/**
 * Get deal room settings for org
 */
async function getDealRoomSettings(
  supabase: ReturnType<typeof createClient>,
  orgId: string
): Promise<DealRoomSettings | null> {
  // Get org Slack connection
  const { data: orgSettings } = await supabase
    .from('slack_org_settings')
    .select('bot_access_token')
    .eq('org_id', orgId)
    .eq('is_connected', true)
    .single();

  if (!orgSettings?.bot_access_token) {
    return null;
  }

  // Get deal room feature settings
  const { data: featureSettings } = await supabase
    .from('slack_notification_settings')
    .select('*')
    .eq('org_id', orgId)
    .eq('feature', 'deal_rooms')
    .eq('is_enabled', true)
    .single();

  if (!featureSettings) {
    return null;
  }

  return {
    enabled: true,
    valueThreshold: featureSettings.deal_value_threshold || 25000,
    stageThreshold: featureSettings.deal_stage_threshold || 'opportunity',
    stakeholderSlackIds: featureSettings.stakeholder_slack_ids || [],
  };
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
 * Create a private Slack channel
 */
async function createSlackChannel(
  botToken: string,
  channelName: string
): Promise<{ ok: boolean; channel?: { id: string; name: string }; error?: string }> {
  const response = await fetch('https://slack.com/api/conversations.create', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: channelName,
      is_private: true,
    }),
  });

  return response.json();
}

/**
 * Invite users to a Slack channel
 */
async function inviteToChannel(
  botToken: string,
  channelId: string,
  userIds: string[]
): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch('https://slack.com/api/conversations.invite', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel: channelId,
      users: userIds.join(','),
    }),
  });

  return response.json();
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
 * Set channel topic
 */
async function setChannelTopic(
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
 * Check if deal should trigger room creation
 */
function shouldCreateRoom(
  deal: DealData,
  settings: DealRoomSettings,
  previousStage?: string,
  previousValue?: number
): boolean {
  const stageOrder = ['sql', 'opportunity', 'verbal', 'signed'];
  const stageIndex = stageOrder.indexOf(deal.stage.toLowerCase());
  const thresholdIndex = stageOrder.indexOf(settings.stageThreshold.toLowerCase());

  const meetsStageThreshold = stageIndex >= thresholdIndex && thresholdIndex >= 0;
  const meetsValueThreshold = deal.value >= settings.valueThreshold;

  // Check if this is a new trigger (stage or value just crossed threshold)
  if (previousStage !== undefined) {
    const previousStageIndex = stageOrder.indexOf(previousStage.toLowerCase());
    const wasUnderStageThreshold = previousStageIndex < thresholdIndex;
    const stageJustCrossed = wasUnderStageThreshold && meetsStageThreshold;

    if (stageJustCrossed && meetsValueThreshold) {
      return true;
    }
  }

  if (previousValue !== undefined) {
    const wasUnderValueThreshold = previousValue < settings.valueThreshold;
    const valueJustCrossed = wasUnderValueThreshold && meetsValueThreshold;

    if (valueJustCrossed && meetsStageThreshold) {
      return true;
    }
  }

  // If no previous values, check if both thresholds are met
  if (previousStage === undefined && previousValue === undefined) {
    return meetsStageThreshold && meetsValueThreshold;
  }

  return false;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { dealId, orgId, previousStage, previousValue } = await req.json();

    if (!dealId) {
      return new Response(
        JSON.stringify({ error: 'dealId required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch deal data with company and contacts
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select(`
        id,
        title,
        stage,
        value,
        monthly_value,
        win_probability,
        user_id,
        org_id,
        company_id,
        companies:company_id (
          id,
          name,
          industry,
          size
        ),
        deal_contacts (
          contacts (
            id,
            name,
            title,
            is_decision_maker
          )
        )
      `)
      .eq('id', dealId)
      .single();

    if (dealError || !deal) {
      console.error('Deal not found:', dealError);
      return new Response(
        JSON.stringify({ error: 'Deal not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const effectiveOrgId = orgId || deal.org_id;
    if (!effectiveOrgId) {
      return new Response(
        JSON.stringify({ error: 'Org ID required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if deal room already exists
    const { data: existingRoom } = await supabase
      .from('slack_deal_rooms')
      .select('id, slack_channel_id, slack_channel_name')
      .eq('deal_id', dealId)
      .eq('is_archived', false)
      .single();

    if (existingRoom) {
      console.log('Deal room already exists:', existingRoom.slack_channel_name);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Deal room already exists',
          channelId: existingRoom.slack_channel_id,
          channelName: existingRoom.slack_channel_name,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get deal room settings
    const settings = await getDealRoomSettings(supabase, effectiveOrgId);
    if (!settings) {
      return new Response(
        JSON.stringify({ success: false, message: 'Deal rooms not enabled for org' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if deal meets criteria
    if (!shouldCreateRoom(deal, settings, previousStage, previousValue)) {
      console.log('Deal does not meet room creation criteria');
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Deal does not meet room creation criteria',
          criteria: {
            valueThreshold: settings.valueThreshold,
            stageThreshold: settings.stageThreshold,
            currentValue: deal.value,
            currentStage: deal.stage,
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Slack bot token
    const botToken = await getSlackBotToken(supabase, effectiveOrgId);
    if (!botToken) {
      return new Response(
        JSON.stringify({ success: false, message: 'No Slack bot token' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate channel name
    const companyName = (deal.companies as { name?: string })?.name || deal.title || 'unknown';
    const channelName = generateChannelName(companyName, deal.id);

    // Create the channel
    console.log('Creating Slack channel:', channelName);
    const createResult = await createSlackChannel(botToken, channelName);

    if (!createResult.ok) {
      // Handle name_taken error by appending timestamp
      if (createResult.error === 'name_taken') {
        const timestamp = Date.now().toString().slice(-4);
        const retryName = `${channelName}-${timestamp}`;
        const retryResult = await createSlackChannel(botToken, retryName);

        if (!retryResult.ok) {
          console.error('Failed to create channel (retry):', retryResult.error);
          return new Response(
            JSON.stringify({ success: false, error: retryResult.error }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        createResult.channel = retryResult.channel;
      } else {
        console.error('Failed to create channel:', createResult.error);
        return new Response(
          JSON.stringify({ success: false, error: createResult.error }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const channelId = createResult.channel!.id;
    const actualChannelName = createResult.channel!.name;

    // Collect users to invite
    const usersToInvite: string[] = [];

    // 1. Deal owner (required)
    const ownerSlackId = await getSlackUserId(supabase, effectiveOrgId, deal.user_id);
    if (ownerSlackId) {
      usersToInvite.push(ownerSlackId);
    }

    // 2. Stakeholders from settings
    if (settings.stakeholderSlackIds.length > 0) {
      usersToInvite.push(...settings.stakeholderSlackIds);
    }

    // Deduplicate
    const uniqueUsers = [...new Set(usersToInvite)];

    // Invite users to channel
    if (uniqueUsers.length > 0) {
      const inviteResult = await inviteToChannel(botToken, channelId, uniqueUsers);
      if (!inviteResult.ok && inviteResult.error !== 'already_in_channel') {
        console.warn('Some users could not be invited:', inviteResult.error);
      }
    }

    // Set channel topic
    const topic = `💰 ${deal.title} | $${deal.value.toLocaleString()} | Stage: ${deal.stage}`;
    await setChannelTopic(botToken, channelId, topic);

    // Store deal room in database
    const { error: insertError } = await supabase
      .from('slack_deal_rooms')
      .insert({
        org_id: effectiveOrgId,
        deal_id: deal.id,
        slack_channel_id: channelId,
        slack_channel_name: actualChannelName,
      });

    if (insertError) {
      console.error('Failed to store deal room:', insertError);
    }

    // Build and post welcome message
    const contacts = (deal.deal_contacts as Array<{ contacts: { id: string; name: string; title?: string; is_decision_maker?: boolean } }>)
      ?.map(dc => dc.contacts)
      .filter(Boolean) || [];

    const dealRoomData: DealRoomData = {
      dealName: deal.title,
      dealId: deal.id,
      dealValue: deal.value,
      dealStage: deal.stage,
      winProbability: deal.win_probability,
      companyName: (deal.companies as { name?: string })?.name,
      companyIndustry: (deal.companies as { industry?: string })?.industry,
      companySize: (deal.companies as { size?: string })?.size,
      keyContacts: contacts.map(c => ({
        name: c.name,
        title: c.title,
        isDecisionMaker: c.is_decision_maker,
      })),
      appUrl,
    };

    const welcomeMessage = buildDealRoomWelcomeMessage(dealRoomData);
    const postResult = await postToChannel(botToken, channelId, welcomeMessage);

    if (!postResult.ok) {
      console.error('Failed to post welcome message:', postResult.error);
    }

    // Record notification
    await supabase.from('slack_notifications_sent').insert({
      org_id: effectiveOrgId,
      feature: 'deal_rooms',
      entity_type: 'deal',
      entity_id: deal.id,
      recipient_type: 'channel',
      recipient_id: channelId,
      slack_ts: postResult.ts || '',
      slack_channel_id: channelId,
    });

    console.log('Deal room created successfully:', actualChannelName);
    return new Response(
      JSON.stringify({
        success: true,
        channelId,
        channelName: actualChannelName,
        invitedUsers: uniqueUsers.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error creating deal room:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
