/**
 * Slack Copilot Actions Edge Function
 * 
 * PROACTIVE-005: Handle Slack button clicks and replies for proactive messages.
 * 
 * Handles:
 * - Button clicks (Draft Email, View Brief, More Info)
 * - Threaded replies as copilot prompts
 * - Execute sequences based on Slack actions
 * - Send responses back to Slack thread
 * - Support HITL confirmation flow in Slack
 * 
 * @see docs/PRD_PROACTIVE_AI_TEAMMATE.md
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// ============================================================================
// Types
// ============================================================================

interface SlackInteraction {
  type: 'block_actions' | 'message_action' | 'view_submission';
  user: { id: string; username: string; name: string };
  team: { id: string };
  channel: { id: string };
  message?: { ts: string; thread_ts?: string };
  actions?: Array<{
    action_id: string;
    block_id?: string;
    value?: string;
    type: string;
  }>;
  trigger_id?: string;
  response_url?: string;
}

interface SlackEvent {
  type: string;
  user: string;
  channel: string;
  text: string;
  ts: string;
  thread_ts?: string;
  event_ts: string;
}

// ============================================================================
// Main Handler
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const contentType = req.headers.get('content-type') || '';
    
    // Handle Slack URL verification
    if (contentType.includes('application/json')) {
      const body = await req.json();
      
      // URL verification challenge
      if (body.type === 'url_verification') {
        return new Response(body.challenge, {
          headers: { 'Content-Type': 'text/plain' },
        });
      }
      
      // Event callback (threaded replies)
      if (body.type === 'event_callback') {
        await handleSlackEvent(supabase, body.event);
        return new Response('ok', { headers: corsHeaders });
      }
    }
    
    // Handle form-encoded payload (button clicks)
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      const payload = formData.get('payload');
      
      if (payload) {
        const interaction = JSON.parse(payload as string) as SlackInteraction;
        await handleSlackInteraction(supabase, interaction);
        return new Response('', { status: 200 });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[slack-copilot-actions] Error:', error);
    return new Response('ok', { status: 200 }); // Always return 200 to Slack
  }
});

// ============================================================================
// Handle Slack Interaction (Button Clicks)
// ============================================================================

async function handleSlackInteraction(
  supabase: any,
  interaction: SlackInteraction
): Promise<void> {
  console.log('[SlackActions] Handling interaction:', {
    type: interaction.type,
    user: interaction.user.id,
    actions: interaction.actions?.map(a => a.action_id),
  });

  // Get user from Slack ID
  const { data: slackAuth } = await supabase
    .from('slack_auth')
    .select('user_id, access_token, organization_id')
    .eq('slack_user_id', interaction.user.id)
    .maybeSingle();

  if (!slackAuth) {
    console.log('[SlackActions] No user found for Slack ID:', interaction.user.id);
    await sendSlackEphemeral(
      interaction.response_url!,
      'Please connect your Slack account in 60 Settings first.'
    );
    return;
  }

  for (const action of interaction.actions || []) {
    await processAction(supabase, slackAuth, interaction, action);
  }
}

async function processAction(
  supabase: any,
  slackAuth: any,
  interaction: SlackInteraction,
  action: { action_id: string; value?: string }
): Promise<void> {
  const actionId = action.action_id;
  const value = action.value ? JSON.parse(action.value) : {};

  console.log('[SlackActions] Processing action:', actionId, value);

  // Pipeline action buttons
  if (actionId.startsWith('pipeline_action_')) {
    await handlePipelineAction(supabase, slackAuth, interaction, value);
    return;
  }

  // Task action buttons
  if (actionId.startsWith('task_action_')) {
    await handleTaskAction(supabase, slackAuth, interaction, actionId, value);
    return;
  }

  // HITL confirmation buttons
  if (actionId === 'confirm_action') {
    await handleHitlConfirm(supabase, slackAuth, interaction, value);
    return;
  }

  if (actionId === 'cancel_action') {
    await handleHitlCancel(supabase, slackAuth, interaction, value);
    return;
  }

  // Open dashboard/copilot buttons
  if (actionId === 'open_dashboard' || actionId === 'open_copilot') {
    // These are URL buttons, no handler needed
    return;
  }

  // View brief button
  if (actionId === 'view_brief') {
    // URL button, no handler needed
    return;
  }

  console.log('[SlackActions] Unknown action:', actionId);
}

// ============================================================================
// Handle Pipeline Actions
// ============================================================================

async function handlePipelineAction(
  supabase: any,
  slackAuth: any,
  interaction: SlackInteraction,
  value: { type?: string; dealId?: string; contactId?: string; sequenceKey?: string }
): Promise<void> {
  const { dealId, contactId, sequenceKey } = value;

  // Acknowledge the action
  await sendSlackMessage(
    slackAuth.access_token,
    interaction.channel.id,
    '🔄 Working on it...',
    interaction.message?.ts
  );

  try {
    // Call copilot to run the sequence
    const prompt = sequenceKey === 'seq-deal-rescue-pack'
      ? `Run deal rescue analysis for deal ${dealId}`
      : sequenceKey === 'seq-post-meeting-followup-pack'
      ? `Draft a follow-up email for contact ${contactId}`
      : sequenceKey === 'seq-next-meeting-command-center'
      ? `Prep me for the next meeting with ${contactId}`
      : 'Help me with this deal';

    const { data, error } = await supabase.functions.invoke('api-copilot/chat', {
      body: {
        message: prompt,
        context: {
          userId: slackAuth.user_id,
          orgId: slackAuth.organization_id,
          dealId,
          contactId,
          source: 'slack',
        },
      },
    });

    if (error) throw error;

    // Send the result back to Slack
    const response = data?.response?.content || data?.summary || 'Done! Check the app for details.';
    
    await sendSlackMessage(
      slackAuth.access_token,
      interaction.channel.id,
      response.substring(0, 3000), // Slack message limit
      interaction.message?.ts
    );

    // Log engagement
    await supabase.rpc('log_copilot_engagement', {
      p_org_id: slackAuth.organization_id,
      p_user_id: slackAuth.user_id,
      p_event_type: 'action_taken',
      p_trigger_type: 'proactive',
      p_channel: 'slack',
      p_sequence_key: sequenceKey,
      p_metadata: { dealId, contactId },
    });

  } catch (err) {
    console.error('[SlackActions] Pipeline action failed:', err);
    await sendSlackMessage(
      slackAuth.access_token,
      interaction.channel.id,
      `❌ Sorry, something went wrong. Please try again in the app.`,
      interaction.message?.ts
    );
  }
}

// ============================================================================
// Handle Task Actions
// ============================================================================

async function handleTaskAction(
  supabase: any,
  slackAuth: any,
  interaction: SlackInteraction,
  actionId: string,
  value: any
): Promise<void> {
  // Parse action ID: task_action_{taskId}_{actionType}
  const parts = actionId.split('_');
  const taskId = parts[2];
  const actionType = parts[3];

  await sendSlackMessage(
    slackAuth.access_token,
    interaction.channel.id,
    '🔄 On it...',
    interaction.message?.ts
  );

  try {
    const { data, error } = await supabase.functions.invoke('proactive-task-analysis', {
      body: {
        action: 'execute_action',
        userId: slackAuth.user_id,
        taskId,
        actionType,
        sequenceKey: value?.sequenceKey,
      },
    });

    if (error) throw error;

    let message = '✅ Done!';
    if (actionType === 'reschedule') {
      message = `✅ Task rescheduled to tomorrow`;
    } else if (actionType === 'complete') {
      message = `✅ Task marked as complete`;
    } else if (data?.result?.response?.content) {
      message = data.result.response.content.substring(0, 3000);
    }

    await sendSlackMessage(
      slackAuth.access_token,
      interaction.channel.id,
      message,
      interaction.message?.ts
    );

  } catch (err) {
    console.error('[SlackActions] Task action failed:', err);
    await sendSlackMessage(
      slackAuth.access_token,
      interaction.channel.id,
      `❌ Sorry, couldn't complete that action. Try again in the app.`,
      interaction.message?.ts
    );
  }
}

// ============================================================================
// Handle HITL Confirmation
// ============================================================================

async function handleHitlConfirm(
  supabase: any,
  slackAuth: any,
  interaction: SlackInteraction,
  value: { pendingActionId?: string; sequenceKey?: string }
): Promise<void> {
  await sendSlackMessage(
    slackAuth.access_token,
    interaction.channel.id,
    '✅ Confirmed! Executing...',
    interaction.message?.ts
  );

  try {
    // Call copilot with confirmation
    const { data, error } = await supabase.functions.invoke('api-copilot/chat', {
      body: {
        message: 'Confirm',
        context: {
          userId: slackAuth.user_id,
          orgId: slackAuth.organization_id,
          pendingActionId: value.pendingActionId,
          isConfirmation: true,
        },
      },
    });

    if (error) throw error;

    const response = data?.response?.content || '✅ Action completed!';
    await sendSlackMessage(
      slackAuth.access_token,
      interaction.channel.id,
      response.substring(0, 3000),
      interaction.message?.ts
    );

    // Log engagement
    await supabase.rpc('log_copilot_engagement', {
      p_org_id: slackAuth.organization_id,
      p_user_id: slackAuth.user_id,
      p_event_type: 'confirmation_given',
      p_trigger_type: 'proactive',
      p_channel: 'slack',
      p_sequence_key: value.sequenceKey,
    });

  } catch (err) {
    console.error('[SlackActions] HITL confirm failed:', err);
  }
}

async function handleHitlCancel(
  supabase: any,
  slackAuth: any,
  interaction: SlackInteraction,
  value: any
): Promise<void> {
  await sendSlackMessage(
    slackAuth.access_token,
    interaction.channel.id,
    '❌ Action cancelled.',
    interaction.message?.ts
  );

  // Log engagement
  await supabase.rpc('log_copilot_engagement', {
    p_org_id: slackAuth.organization_id,
    p_user_id: slackAuth.user_id,
    p_event_type: 'confirmation_denied',
    p_trigger_type: 'proactive',
    p_channel: 'slack',
    p_sequence_key: value?.sequenceKey,
  });
}

// ============================================================================
// Handle Slack Events (Threaded Replies)
// ============================================================================

async function handleSlackEvent(
  supabase: any,
  event: SlackEvent
): Promise<void> {
  // Only handle message replies in threads
  if (event.type !== 'message' || !event.thread_ts) {
    return;
  }

  // Ignore bot messages
  if (event.text?.includes('Bot') || !event.user) {
    return;
  }

  console.log('[SlackActions] Handling threaded reply:', {
    user: event.user,
    text: event.text?.substring(0, 100),
  });

  // Get user from Slack ID
  const { data: slackAuth } = await supabase
    .from('slack_auth')
    .select('user_id, access_token, organization_id')
    .eq('slack_user_id', event.user)
    .maybeSingle();

  if (!slackAuth) {
    return;
  }

  try {
    // Treat the reply as a copilot prompt
    const { data, error } = await supabase.functions.invoke('api-copilot/chat', {
      body: {
        message: event.text,
        context: {
          userId: slackAuth.user_id,
          orgId: slackAuth.organization_id,
          source: 'slack_thread',
        },
      },
    });

    if (error) throw error;

    // Send response back to the thread
    const response = data?.response?.content || data?.summary || '';
    if (response) {
      await sendSlackMessage(
        slackAuth.access_token,
        event.channel,
        response.substring(0, 3000),
        event.thread_ts
      );
    }

  } catch (err) {
    console.error('[SlackActions] Thread reply failed:', err);
  }
}

// ============================================================================
// Slack API Helpers
// ============================================================================

async function sendSlackMessage(
  accessToken: string,
  channel: string,
  text: string,
  threadTs?: string
): Promise<boolean> {
  try {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel,
        text,
        thread_ts: threadTs,
      }),
    });

    const result = await response.json();
    return result.ok === true;
  } catch (err) {
    console.error('[SlackActions] Failed to send message:', err);
    return false;
  }
}

async function sendSlackEphemeral(
  responseUrl: string,
  text: string
): Promise<void> {
  try {
    await fetch(responseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        response_type: 'ephemeral',
        text,
      }),
    });
  } catch (err) {
    console.error('[SlackActions] Failed to send ephemeral:', err);
  }
}
