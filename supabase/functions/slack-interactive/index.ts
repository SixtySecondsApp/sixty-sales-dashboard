// supabase/functions/slack-interactive/index.ts
// Handles Slack Interactivity - button clicks, modal submissions, shortcuts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import {
  buildTaskAddedConfirmation,
  buildDealActivityMessage,
  type DealActivityData,
  buildHITLActionedConfirmation,
  type HITLActionedConfirmation,
  type HITLResourceType,
} from '../_shared/slackBlocks.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const slackSigningSecret = Deno.env.get('SLACK_SIGNING_SECRET');
const appUrl = Deno.env.get('APP_URL') || Deno.env.get('SITE_URL') || 'https://use60.com';

interface SlackUser {
  id: string;
  name?: string;
  username?: string;
}

interface SlackChannel {
  id: string;
  name?: string;
}

interface SlackMessage {
  ts: string;
  text?: string;
  blocks?: unknown[];
  user?: string;
  permalink?: string;
}

interface SlackAction {
  action_id: string;
  value: string;
  type: string;
  block_id?: string;
}

interface InteractivePayload {
  type: 'block_actions' | 'view_submission' | 'shortcut' | 'message_action';
  user: SlackUser;
  channel?: SlackChannel;
  message?: SlackMessage;
  response_url?: string;
  trigger_id?: string;
  callback_id?: string; // For shortcuts and message actions
  actions?: SlackAction[];
  view?: {
    id: string;
    callback_id: string;
    state?: {
      values: Record<string, Record<string, { value?: string; selected_option?: { value: string } }>>;
    };
    private_metadata?: string;
  };
  team?: {
    id: string;
    domain?: string;
  };
}

interface TaskData {
  title: string;
  dealId?: string;
  dueInDays?: number;
  meetingId?: string;
}

type SlackOrgConnection = { orgId: string; botToken: string };

// ============================================================================
// Activity Tracking for Smart Engagement Algorithm
// ============================================================================

/**
 * Log Slack interaction to user_activity_events for the Smart Engagement Algorithm.
 * This helps track user engagement with Slack notifications.
 */
async function logSlackInteraction(
  supabase: ReturnType<typeof createClient>,
  params: {
    userId: string | null;
    orgId: string | null;
    actionType: string;
    actionCategory?: string;
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  if (!params.userId || !params.orgId) {
    console.log('[Activity] Skipping log - missing userId or orgId');
    return;
  }

  try {
    const now = new Date();
    await supabase
      .from('user_activity_events')
      .insert({
        user_id: params.userId,
        org_id: params.orgId,
        event_type: 'slack_button_click',
        event_source: 'slack',
        event_category: params.actionCategory || 'notifications',
        entity_type: params.entityType || null,
        entity_id: params.entityId || null,
        action_detail: params.actionType,
        day_of_week: now.getDay(),
        hour_of_day: now.getHours(),
        metadata: params.metadata || {},
      });
    console.log('[Activity] Logged Slack interaction:', params.actionType);
  } catch (error) {
    // Non-blocking - don't fail the main request if logging fails
    console.error('[Activity] Failed to log Slack interaction:', error);
  }
}

/**
 * Verify Slack request signature
 */
async function verifySlackRequest(
  body: string,
  timestamp: string,
  signature: string
): Promise<boolean> {
  if (!slackSigningSecret) {
    // Allow opting into insecure mode for local development only.
    const allowInsecure = (Deno.env.get('ALLOW_INSECURE_SLACK_SIGNATURES') || '').toLowerCase() === 'true';
    if (allowInsecure) {
      console.warn('ALLOW_INSECURE_SLACK_SIGNATURES=true - skipping signature verification');
      return true;
    }
    console.error('SLACK_SIGNING_SECRET not set - refusing request');
    return false;
  }

  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - parseInt(timestamp)) > 300) {
    return false;
  }

  const sigBasestring = `v0:${timestamp}:${body}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(slackSigningSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(sigBasestring));
  const hashArray = Array.from(new Uint8Array(signatureBytes));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  const computedSignature = `v0=${hashHex}`;

  return computedSignature === signature;
}

async function getSlackOrgConnection(
  supabase: ReturnType<typeof createClient>,
  teamId?: string
): Promise<SlackOrgConnection | null> {
  if (!teamId) return null;

  const { data } = await supabase
    .from('slack_org_settings')
    .select('org_id, bot_access_token')
    .eq('slack_team_id', teamId)
    .eq('is_connected', true)
    .single();

  if (!data?.org_id || !data?.bot_access_token) return null;
  return { orgId: data.org_id as string, botToken: data.bot_access_token as string };
}

async function getUserDisplayName(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<string> {
  const { data } = await supabase
    .from('profiles')
    .select('full_name, first_name, last_name, email')
    .eq('id', userId)
    .single();

  const full = (data as any)?.full_name as string | null | undefined;
  if (full) return full;
  const first = (data as any)?.first_name as string | null | undefined;
  const last = (data as any)?.last_name as string | null | undefined;
  const combined = `${first || ''} ${last || ''}`.trim();
  if (combined) return combined;
  const email = (data as any)?.email as string | null | undefined;
  return email || 'Unknown';
}

async function postToChannel(
  botToken: string,
  channelId: string,
  message: { blocks: unknown[]; text: string }
): Promise<void> {
  await fetch('https://slack.com/api/chat.postMessage', {
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
}

/**
 * Get Sixty user ID from Slack user ID
 */
async function getSixtyUserContext(
  supabase: ReturnType<typeof createClient>,
  slackUserId: string,
  teamId?: string
): Promise<{ userId: string; orgId?: string } | null> {
  // First try to find by slack_user_id directly
  let query = supabase
    .from('slack_user_mappings')
    .select('sixty_user_id, org_id')
    .eq('slack_user_id', slackUserId);

  if (teamId) {
    // If we have team ID, find the org
    const { data: orgSettings } = await supabase
      .from('slack_org_settings')
      .select('org_id')
      .eq('slack_team_id', teamId)
      .single();

    if (orgSettings?.org_id) {
      query = query.eq('org_id', orgSettings.org_id);
    }
  }

  const { data, error } = await query.single();

  if (error || !data?.sixty_user_id) {
    console.warn('No Sixty user mapping found for Slack user:', slackUserId);
    return null;
  }

  return { userId: data.sixty_user_id as string, orgId: (data as any)?.org_id as string | undefined };
}

/**
 * Create a task in the database
 */
async function createTask(
  supabase: ReturnType<typeof createClient>,
  ctx: { userId: string; orgId?: string },
  taskData: TaskData
): Promise<{ success: boolean; taskId?: string; error?: string }> {
  // Calculate due date
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + (taskData.dueInDays || 3));

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      title: taskData.title,
      // Our tasks schema uses assigned_to/created_by (not user_id)
      assigned_to: ctx.userId,
      created_by: ctx.userId,
      // Multi-tenant: include org_id when available
      ...(ctx.orgId ? { org_id: ctx.orgId } : {}),
      deal_id: taskData.dealId || null,
      meeting_id: taskData.meetingId || null,
      due_date: dueDate.toISOString(),
      status: 'pending',
      source: 'slack_suggestion',
      metadata: taskData.meetingId ? { meeting_id: taskData.meetingId, source: 'slack_interactive' } : { source: 'slack_interactive' },
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating task:', error);
    return { success: false, error: error.message };
  }

  return { success: true, taskId: data.id };
}

/**
 * Send ephemeral message to user
 */
async function sendEphemeral(
  responseUrl: string,
  message: { blocks: unknown[]; text: string }
): Promise<void> {
  try {
    await fetch(responseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        response_type: 'ephemeral',
        replace_original: false,
        ...message,
      }),
    });
  } catch (error) {
    console.error('Error sending ephemeral message:', error);
  }
}

/**
 * Update the original message (e.g., to show task was added)
 */
async function updateMessage(
  responseUrl: string,
  blocks: unknown[]
): Promise<void> {
  try {
    await fetch(responseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        replace_original: true,
        blocks,
      }),
    });
  } catch (error) {
    console.error('Error updating message:', error);
  }
}

/**
 * Handle single task addition
 */
async function handleAddTask(
  supabase: ReturnType<typeof createClient>,
  payload: InteractivePayload,
  action: SlackAction
): Promise<Response> {
  const ctx = await getSixtyUserContext(supabase, payload.user.id, payload.team?.id);

  if (!ctx) {
    if (payload.response_url) {
      await sendEphemeral(payload.response_url, {
        blocks: [{ type: 'section', text: { type: 'mrkdwn', text: '❌ Your Slack account is not linked to Sixty. Please contact your admin to set up the mapping.' } }],
        text: 'Your Slack account is not linked to Sixty.',
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const taskData: TaskData = JSON.parse(action.value);
    const result = await createTask(supabase, ctx, taskData);

    // Log activity for Smart Engagement Algorithm
    await logSlackInteraction(supabase, {
      userId: ctx.userId,
      orgId: ctx.orgId || null,
      actionType: 'add_task',
      actionCategory: 'tasks',
      entityType: taskData.dealId ? 'deal' : taskData.meetingId ? 'meeting' : 'task',
      entityId: taskData.dealId || taskData.meetingId || result.taskId,
      metadata: { source: 'slack_button', task_title: taskData.title },
    });

    if (result.success && payload.response_url) {
      const confirmation = buildTaskAddedConfirmation(taskData.title);
      await sendEphemeral(payload.response_url, confirmation);

      // Optionally update the original message to show the task was added
      // by modifying the button to show a checkmark
      if (payload.message?.blocks) {
        const updatedBlocks = updateBlockWithCheckmark(
          payload.message.blocks as unknown[],
          action.action_id,
          taskData.title
        );
        if (updatedBlocks && payload.response_url) {
          await updateMessage(payload.response_url, updatedBlocks);
        }
      }
    } else if (payload.response_url) {
      await sendEphemeral(payload.response_url, {
        blocks: [{ type: 'section', text: { type: 'mrkdwn', text: `❌ Failed to create task: ${result.error}` } }],
        text: 'Failed to create task.',
      });
    }
  } catch (error) {
    console.error('Error parsing task data:', error);
    if (payload.response_url) {
      await sendEphemeral(payload.response_url, {
        blocks: [{ type: 'section', text: { type: 'mrkdwn', text: '❌ Error processing task. Please try again.' } }],
        text: 'Error processing task.',
      });
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Handle adding all tasks at once
 */
async function handleAddAllTasks(
  supabase: ReturnType<typeof createClient>,
  payload: InteractivePayload,
  action: SlackAction
): Promise<Response> {
  const ctx = await getSixtyUserContext(supabase, payload.user.id, payload.team?.id);

  if (!ctx) {
    if (payload.response_url) {
      await sendEphemeral(payload.response_url, {
        blocks: [{ type: 'section', text: { type: 'mrkdwn', text: '❌ Your Slack account is not linked to Sixty. Please contact your admin to set up the mapping.' } }],
        text: 'Your Slack account is not linked to Sixty.',
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { tasks } = JSON.parse(action.value) as { tasks: TaskData[] };
    let successCount = 0;
    const errors: string[] = [];

    for (const taskData of tasks) {
      const result = await createTask(supabase, ctx, taskData);
      if (result.success) {
        successCount++;
      } else {
        errors.push(result.error || 'Unknown error');
      }
    }

    // Log activity for Smart Engagement Algorithm
    if (successCount > 0) {
      await logSlackInteraction(supabase, {
        userId: ctx.userId,
        orgId: ctx.orgId || null,
        actionType: 'add_all_tasks',
        actionCategory: 'tasks',
        metadata: { source: 'slack_button', tasks_added: successCount, tasks_failed: errors.length },
      });
    }

    if (payload.response_url) {
      if (successCount > 0) {
        const confirmation = buildTaskAddedConfirmation('', successCount);
        await sendEphemeral(payload.response_url, confirmation);
      }

      if (errors.length > 0) {
        await sendEphemeral(payload.response_url, {
          blocks: [{ type: 'section', text: { type: 'mrkdwn', text: `⚠️ ${errors.length} task(s) failed to create.` } }],
          text: 'Some tasks failed to create.',
        });
      }
    }
  } catch (error) {
    console.error('Error parsing tasks data:', error);
    if (payload.response_url) {
      await sendEphemeral(payload.response_url, {
        blocks: [{ type: 'section', text: { type: 'mrkdwn', text: '❌ Error processing tasks. Please try again.' } }],
        text: 'Error processing tasks.',
      });
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Handle dismiss action
 */
async function handleDismiss(
  supabase: ReturnType<typeof createClient>,
  payload: InteractivePayload,
  _action: SlackAction
): Promise<Response> {
  // Get user context for activity logging
  const ctx = await getSixtyUserContext(supabase, payload.user.id, payload.team?.id);

  // Log activity for Smart Engagement Algorithm (even if user not mapped - we track dismissals)
  if (ctx) {
    await logSlackInteraction(supabase, {
      userId: ctx.userId,
      orgId: ctx.orgId || null,
      actionType: 'dismiss_tasks',
      actionCategory: 'notifications',
      metadata: { source: 'slack_button' },
    });
  }

  // Just acknowledge - optionally we could update the message
  if (payload.response_url) {
    await sendEphemeral(payload.response_url, {
      blocks: [{ type: 'section', text: { type: 'mrkdwn', text: '👍 Tasks dismissed.' } }],
      text: 'Tasks dismissed.',
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Handle task creation from alerts (e.g., win probability alert)
 */
async function handleCreateTaskFromAlert(
  supabase: ReturnType<typeof createClient>,
  payload: InteractivePayload,
  action: SlackAction
): Promise<Response> {
  const ctx = await getSixtyUserContext(supabase, payload.user.id, payload.team?.id);

  if (!ctx) {
    if (payload.response_url) {
      await sendEphemeral(payload.response_url, {
        blocks: [{ type: 'section', text: { type: 'mrkdwn', text: '❌ Your Slack account is not linked to Sixty.' } }],
        text: 'Your Slack account is not linked to Sixty.',
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { dealId, type } = JSON.parse(action.value) as { dealId?: string; type: string };

    // Generate task title based on alert type
    let taskTitle = 'Follow up on deal';
    if (type === 'win_probability') {
      taskTitle = 'Address win probability drop - review deal status';
    }

    const result = await createTask(supabase, ctx, {
      title: taskTitle,
      dealId,
      dueInDays: 1, // Urgent
    });
    // (note: ctx includes orgId when available)

    // Log activity for Smart Engagement Algorithm
    await logSlackInteraction(supabase, {
      userId: ctx.userId,
      orgId: ctx.orgId || null,
      actionType: 'create_task_from_alert',
      actionCategory: 'tasks',
      entityType: 'deal',
      entityId: dealId,
      metadata: { source: 'slack_button', alert_type: type, task_title: taskTitle },
    });

    if (result.success && payload.response_url) {
      const confirmation = buildTaskAddedConfirmation(taskTitle);
      await sendEphemeral(payload.response_url, confirmation);
    }
  } catch (error) {
    console.error('Error creating task from alert:', error);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Handle task creation from the Sales Assistant (and other proactive DMs)
 * Value is JSON and may include: title, dealId, contactId, dueInDays, source
 */
async function handleCreateTaskFromAssistant(
  supabase: ReturnType<typeof createClient>,
  payload: InteractivePayload,
  action: SlackAction
): Promise<Response> {
  const ctx = await getSixtyUserContext(supabase, payload.user.id, payload.team?.id);

  if (!ctx) {
    if (payload.response_url) {
      await sendEphemeral(payload.response_url, {
        blocks: [{ type: 'section', text: { type: 'mrkdwn', text: '❌ Your Slack account is not linked to Sixty.' } }],
        text: 'Your Slack account is not linked to Sixty.',
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const parsed = JSON.parse(action.value || '{}') as {
      title?: string;
      dealId?: string;
      contactId?: string;
      dueInDays?: number;
      source?: string;
    };

    const title = (parsed.title || '').trim() || 'Follow up';
    const dueInDays = typeof parsed.dueInDays === 'number' ? parsed.dueInDays : 1;

    const result = await createTask(supabase, ctx, {
      title,
      dealId: parsed.dealId,
      contactId: parsed.contactId,
      dueInDays,
    });

    // Log activity for Smart Engagement Algorithm
    await logSlackInteraction(supabase, {
      userId: ctx.userId,
      orgId: ctx.orgId || null,
      actionType: 'create_task_from_assistant',
      actionCategory: 'tasks',
      entityType: parsed.dealId ? 'deal' : parsed.contactId ? 'contact' : 'task',
      entityId: parsed.dealId || parsed.contactId || result.taskId,
      metadata: { source: parsed.source || 'slack_assistant', task_title: title },
    });

    if (payload.response_url) {
      if (result.success) {
        const confirmation = buildTaskAddedConfirmation(title);
        await sendEphemeral(payload.response_url, confirmation);
      } else {
        await sendEphemeral(payload.response_url, {
          blocks: [{ type: 'section', text: { type: 'mrkdwn', text: '❌ Failed to create task.' } }],
          text: 'Failed to create task.',
        });
      }
    }
  } catch (error) {
    console.error('Error creating task from assistant:', error);
    if (payload.response_url) {
      await sendEphemeral(payload.response_url, {
        blocks: [{ type: 'section', text: { type: 'mrkdwn', text: '❌ Failed to create task.' } }],
        text: 'Failed to create task.',
      });
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Update a block to show a checkmark after task was added
 */
function updateBlockWithCheckmark(
  blocks: unknown[],
  actionId: string,
  taskTitle: string
): unknown[] | null {
  try {
    return blocks.map((block: unknown) => {
      const b = block as { type?: string; accessory?: { action_id?: string }; text?: { type: string; text: string } };
      if (b.type === 'section' && b.accessory?.action_id === actionId) {
        // Replace the button with a checkmark
        return {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `✅ ~${taskTitle}~ _(added)_`,
          },
        };
      }
      return block;
    });
  } catch {
    return null;
  }
}

/**
 * Handle log activity button (from deal rooms)
 */
async function handleLogActivity(
  supabase: ReturnType<typeof createClient>,
  payload: InteractivePayload,
  action: SlackAction
): Promise<Response> {
  // Open a modal for logging an activity against a deal.
  const dealId = action.value;
  const channelId = payload.channel?.id;
  const triggerId = payload.trigger_id;

  if (!dealId || !triggerId) {
    // Acknowledge to Slack even if we cannot open modal
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const orgConnection = await getSlackOrgConnection(supabase, payload.team?.id);
  if (!orgConnection) {
    if (payload.response_url) {
      await sendEphemeral(payload.response_url, {
        blocks: [{ type: 'section', text: { type: 'mrkdwn', text: '❌ Slack is not connected for this workspace/org.' } }],
        text: 'Slack is not connected.',
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const privateMetadata = JSON.stringify({
    dealId,
    channelId: channelId || null,
    orgId: orgConnection.orgId,
  });

  // Minimal, high-signal modal (no schema guessing beyond type + notes)
  await fetch('https://slack.com/api/views.open', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${orgConnection.botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      trigger_id: triggerId,
      view: {
        type: 'modal',
        callback_id: 'log_activity_modal',
        private_metadata: privateMetadata,
        title: { type: 'plain_text', text: 'Log Activity' },
        submit: { type: 'plain_text', text: 'Log' },
        close: { type: 'plain_text', text: 'Cancel' },
        blocks: [
          {
            type: 'input',
            block_id: 'activity_type',
            label: { type: 'plain_text', text: 'Activity type' },
            element: {
              type: 'static_select',
              action_id: 'type_select',
              placeholder: { type: 'plain_text', text: 'Select a type' },
              options: [
                { text: { type: 'plain_text', text: '📧 Email' }, value: 'outbound_email' },
                { text: { type: 'plain_text', text: '📞 Call' }, value: 'outbound_call' },
                { text: { type: 'plain_text', text: '💬 LinkedIn' }, value: 'outbound_linkedin' },
                { text: { type: 'plain_text', text: '📅 Meeting' }, value: 'meeting' },
                { text: { type: 'plain_text', text: '📝 Proposal' }, value: 'proposal' },
                { text: { type: 'plain_text', text: '📌 Note' }, value: 'note' },
              ],
            },
          },
          {
            type: 'input',
            block_id: 'activity_details',
            optional: true,
            label: { type: 'plain_text', text: 'Details (optional)' },
            element: {
              type: 'plain_text_input',
              action_id: 'details_input',
              multiline: true,
              placeholder: { type: 'plain_text', text: 'What happened? Next step?' },
            },
          },
        ],
      },
    }),
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleLogActivitySubmission(
  supabase: ReturnType<typeof createClient>,
  payload: InteractivePayload
): Promise<Response> {
  const teamId = payload.team?.id;
  const orgConnection = await getSlackOrgConnection(supabase, teamId);

  const ctx = await getSixtyUserContext(supabase, payload.user.id, teamId);
  if (!ctx) {
    // Close modal; user isn't mapped
    return new Response('', { status: 200, headers: corsHeaders });
  }

  let meta: { dealId?: string; channelId?: string | null; orgId?: string } = {};
  try {
    meta = payload.view?.private_metadata ? JSON.parse(payload.view.private_metadata) : {};
  } catch {
    meta = {};
  }

  const dealId = meta.dealId;
  if (!dealId) {
    return new Response('', { status: 200, headers: corsHeaders });
  }

  const values = (payload.view?.state?.values || {}) as any;
  const typeValue =
    values['activity_type']?.['type_select']?.selected_option?.value ||
    values['activity_type']?.['type_select']?.value ||
    'note';
  const detailsValue = values['activity_details']?.['details_input']?.value || '';

  // Map modal type to activities schema
  let activityType = 'note';
  let outboundType: string | null = null;
  let activityLabel = 'Note';
  if (typeValue === 'outbound_email') {
    activityType = 'outbound';
    outboundType = 'email';
    activityLabel = 'Email';
  } else if (typeValue === 'outbound_call') {
    activityType = 'outbound';
    outboundType = 'call';
    activityLabel = 'Call';
  } else if (typeValue === 'outbound_linkedin') {
    activityType = 'outbound';
    outboundType = 'linkedin';
    activityLabel = 'LinkedIn';
  } else if (typeValue === 'meeting') {
    activityType = 'meeting';
    activityLabel = 'Meeting';
  } else if (typeValue === 'proposal') {
    activityType = 'proposal';
    activityLabel = 'Proposal';
  } else if (typeValue === 'note') {
    activityType = 'note';
    activityLabel = 'Note';
  }

  // Pull deal/company for required activity fields (best effort)
  const { data: deal } = await supabase
    .from('deals')
    .select('id, name, company, company_id, primary_contact_id, companies(name)')
    .eq('id', dealId)
    .single();

  const clientName =
    (deal as any)?.companies?.name ||
    (deal as any)?.company ||
    'Unknown';

  const salesRep = await getUserDisplayName(supabase, ctx.userId);

  // Insert activity
  const nowIso = new Date().toISOString();
  const { error: insertError } = await supabase
    .from('activities')
    .insert({
      user_id: ctx.userId,
      owner_id: ctx.userId,
      deal_id: dealId,
      company_id: (deal as any)?.company_id || null,
      contact_id: (deal as any)?.primary_contact_id || null,
      client_name: clientName,
      sales_rep: salesRep,
      type: activityType,
      outbound_type: outboundType,
      details: detailsValue || null,
      subject: detailsValue ? detailsValue.slice(0, 120) : `${activityLabel} logged via Slack`,
      date: nowIso,
      status: 'completed',
      priority: 'medium',
      quantity: 1,
      created_at: nowIso,
      updated_at: nowIso,
    });

  if (insertError) {
    console.error('Failed to insert activity from Slack modal:', insertError);
    // Keep the modal open and show an inline error.
    return new Response(
      JSON.stringify({
        response_action: 'errors',
        errors: {
          activity_details: 'Failed to save activity. Please try again.',
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!insertError && orgConnection?.botToken && meta.channelId) {
    const dealName = (deal as any)?.name || 'Deal';
    const message = buildDealActivityMessage({
      dealName,
      dealId,
      activityType: activityLabel,
      description: detailsValue || `${activityLabel} logged.`,
      createdBy: salesRep,
      slackUserId: payload.user.id,
      appUrl,
    } as DealActivityData);
    await postToChannel(orgConnection.botToken, meta.channelId, message);
  }

  // Close modal
  return new Response('', { status: 200, headers: corsHeaders });
}

// ============================================================================
// HITL (Human-in-the-Loop) Support
// ============================================================================

interface ParsedHITLAction {
  action: 'approve' | 'reject' | 'edit';
  resourceType: HITLResourceType;
  approvalId: string;
}

interface HITLApprovalRecord {
  id: string;
  org_id: string;
  user_id: string | null;
  created_by: string | null;
  resource_type: HITLResourceType;
  resource_id: string;
  resource_name: string | null;
  slack_team_id: string;
  slack_channel_id: string;
  slack_message_ts: string;
  slack_thread_ts: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'edited' | 'expired' | 'cancelled';
  original_content: Record<string, unknown>;
  edited_content: Record<string, unknown> | null;
  response: Record<string, unknown> | null;
  actioned_by: string | null;
  actioned_at: string | null;
  callback_type: 'edge_function' | 'webhook' | 'workflow' | null;
  callback_target: string | null;
  callback_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  expires_at: string;
  metadata: Record<string, unknown>;
}

/**
 * Parse HITL action ID
 * Format: {action}::{resource_type}::{approval_id}
 * Example: approve::email_draft::abc123
 */
function parseHITLActionId(actionId: string): ParsedHITLAction | null {
  const parts = actionId.split('::');
  if (parts.length !== 3) return null;

  const [action, resourceType, approvalId] = parts;

  if (!['approve', 'reject', 'edit'].includes(action)) return null;

  const validResourceTypes: HITLResourceType[] = [
    'email_draft', 'follow_up', 'task_list', 'summary',
    'meeting_notes', 'proposal_section', 'coaching_tip'
  ];
  if (!validResourceTypes.includes(resourceType as HITLResourceType)) return null;

  return {
    action: action as 'approve' | 'reject' | 'edit',
    resourceType: resourceType as HITLResourceType,
    approvalId,
  };
}

/**
 * Validate that a HITL approval exists and is pending
 */
async function validateHITLApproval(
  supabase: ReturnType<typeof createClient>,
  approvalId: string,
  _userId?: string
): Promise<{ valid: boolean; approval?: HITLApprovalRecord; error?: string }> {
  const { data, error } = await supabase
    .from('hitl_pending_approvals')
    .select('*')
    .eq('id', approvalId)
    .single();

  if (error || !data) {
    return { valid: false, error: 'Approval not found' };
  }

  const approval = data as HITLApprovalRecord;

  if (approval.status !== 'pending') {
    return { valid: false, error: `Approval already ${approval.status}`, approval };
  }

  if (new Date(approval.expires_at) < new Date()) {
    return { valid: false, error: 'Approval has expired', approval };
  }

  return { valid: true, approval };
}

/**
 * Get resource type label for display
 */
function getResourceTypeLabel(resourceType: HITLResourceType): string {
  const labels: Record<HITLResourceType, string> = {
    email_draft: 'Email Draft',
    follow_up: 'Follow-up',
    task_list: 'Task List',
    summary: 'Summary',
    meeting_notes: 'Meeting Notes',
    proposal_section: 'Proposal Section',
    coaching_tip: 'Coaching Tip',
  };
  return labels[resourceType] || resourceType;
}

/**
 * Trigger callback after HITL action
 */
async function triggerHITLCallback(
  approval: HITLApprovalRecord,
  action: 'approved' | 'rejected' | 'edited',
  content: Record<string, unknown>
): Promise<void> {
  if (!approval.callback_type || !approval.callback_target) {
    console.log('No callback configured for approval:', approval.id);
    return;
  }

  const callbackPayload = {
    approval_id: approval.id,
    resource_type: approval.resource_type,
    resource_id: approval.resource_id,
    resource_name: approval.resource_name,
    action,
    content,
    original_content: approval.original_content,
    callback_metadata: approval.callback_metadata,
    actioned_at: new Date().toISOString(),
  };

  try {
    switch (approval.callback_type) {
      case 'edge_function': {
        // Call another Supabase edge function
        const functionUrl = `${supabaseUrl}/functions/v1/${approval.callback_target}`;
        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify(callbackPayload),
        });
        if (!response.ok) {
          console.error('Callback edge function failed:', await response.text());
        }
        break;
      }

      case 'webhook': {
        // Call external webhook URL
        const response = await fetch(approval.callback_target, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(callbackPayload),
        });
        if (!response.ok) {
          console.error('Callback webhook failed:', await response.text());
        }
        break;
      }

      case 'workflow': {
        // Future: trigger internal workflow
        console.log('Workflow callback not yet implemented:', approval.callback_target);
        break;
      }
    }
  } catch (error) {
    console.error('Error triggering HITL callback:', error);
  }
}

/**
 * Log HITL action to integration_sync_logs
 */
async function logHITLAction(
  supabase: ReturnType<typeof createClient>,
  approval: HITLApprovalRecord,
  action: string,
  userId: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    await supabase
      .from('integration_sync_logs')
      .insert({
        org_id: approval.org_id,
        integration_type: 'slack_hitl',
        sync_type: 'hitl_action',
        status: 'success',
        records_synced: 1,
        message: `HITL ${action}: ${approval.resource_type} - ${approval.resource_name || approval.resource_id}`,
        metadata: {
          approval_id: approval.id,
          resource_type: approval.resource_type,
          resource_id: approval.resource_id,
          action,
          actioned_by: userId,
          ...details,
        },
      });
  } catch (error) {
    console.error('Error logging HITL action:', error);
  }
}

/**
 * Handle notification frequency feedback (Smart Engagement Algorithm)
 * Processes bi-weekly feedback buttons: "Want more" / "Just right" / "Too many"
 */
async function handleNotificationFeedback(
  supabase: ReturnType<typeof createClient>,
  payload: InteractivePayload,
  action: SlackAction
): Promise<Response> {
  const ctx = await getSixtyUserContext(supabase, payload.user.id, payload.team?.id);
  if (!ctx) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Parse feedback from action_id: notification_feedback_more, notification_feedback_right, notification_feedback_less
  const feedbackMap: Record<string, { value: string; frequency: string; emoji: string; message: string }> = {
    'notification_feedback_more': {
      value: 'more',
      frequency: 'high',
      emoji: '🚀',
      message: "Got it! I'll send you more updates to keep you in the loop.",
    },
    'notification_feedback_right': {
      value: 'just_right',
      frequency: 'moderate',
      emoji: '👍',
      message: "Perfect! I'll keep the current frequency.",
    },
    'notification_feedback_less': {
      value: 'less',
      frequency: 'low',
      emoji: '🔕',
      message: "Understood! I'll dial back the notifications and only share the essentials.",
    },
  };

  const feedback = feedbackMap[action.action_id];
  if (!feedback) {
    console.error('Unknown notification feedback action_id:', action.action_id);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // 1. Record the feedback
    await supabase.from('notification_feedback').insert({
      user_id: ctx.userId,
      org_id: ctx.orgId,
      feedback_type: 'frequency_preference',
      feedback_value: feedback.value,
      feedback_source: 'slack_button',
    });

    // 2. Update user's preferred notification frequency
    await supabase
      .from('user_engagement_metrics')
      .update({
        preferred_notification_frequency: feedback.frequency,
        last_feedback_requested_at: new Date().toISOString(),
        notifications_since_last_feedback: 0,
      })
      .eq('user_id', ctx.userId);

    // 3. Log activity for engagement tracking
    await logSlackInteraction(supabase, {
      userId: ctx.userId,
      orgId: ctx.orgId || null,
      actionType: `notification_feedback_${feedback.value}`,
      actionCategory: 'notifications',
      metadata: {
        feedback_value: feedback.value,
        new_frequency: feedback.frequency,
      },
    });

    // 4. Update the original message to show confirmation
    if (payload.response_url) {
      await fetch(payload.response_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          replace_original: true,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `${feedback.emoji} ${feedback.message}`,
              },
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: '_You can always change this in Settings → Notifications_',
                },
              ],
            },
          ],
        }),
      });
    }

    console.log(`[Engagement] User ${ctx.userId} set notification preference to: ${feedback.frequency}`);
  } catch (error) {
    console.error('Error handling notification feedback:', error);

    // Send error ephemeral
    if (payload.response_url) {
      await sendEphemeral(payload.response_url, {
        blocks: [{ type: 'section', text: { type: 'mrkdwn', text: '❌ Something went wrong saving your preference. Please try again.' } }],
        text: 'Error saving preference',
      });
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Handle HITL approve action
 */
async function handleHITLApprove(
  supabase: ReturnType<typeof createClient>,
  payload: InteractivePayload,
  action: SlackAction,
  hitlAction: ParsedHITLAction
): Promise<Response> {
  const ctx = await getSixtyUserContext(supabase, payload.user.id, payload.team?.id);

  // Validate the approval
  const validation = await validateHITLApproval(supabase, hitlAction.approvalId);
  if (!validation.valid || !validation.approval) {
    if (payload.response_url) {
      await sendEphemeral(payload.response_url, {
        blocks: [{ type: 'section', text: { type: 'mrkdwn', text: `❌ ${validation.error || 'Invalid approval'}` } }],
        text: validation.error || 'Invalid approval',
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const approval = validation.approval;

  // Process the approval action
  const { error: updateError } = await supabase.rpc('process_hitl_action', {
    p_approval_id: hitlAction.approvalId,
    p_action: 'approved',
    p_actioned_by: ctx?.userId || null,
    p_response: { slack_user_id: payload.user.id },
  });

  if (updateError) {
    console.error('Error processing HITL approve:', updateError);
    if (payload.response_url) {
      await sendEphemeral(payload.response_url, {
        blocks: [{ type: 'section', text: { type: 'mrkdwn', text: '❌ Failed to process approval. Please try again.' } }],
        text: 'Failed to process approval.',
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Update the original Slack message
  if (payload.response_url) {
    const confirmationData: HITLActionedConfirmation = {
      action: 'approved',
      resourceType: hitlAction.resourceType,
      resourceName: approval.resource_name || getResourceTypeLabel(hitlAction.resourceType),
      slackUserId: payload.user.id,
      timestamp: new Date().toISOString(),
    };
    const confirmationMessage = buildHITLActionedConfirmation(confirmationData);
    await updateMessage(payload.response_url, confirmationMessage.blocks);
  }

  // Log the action
  await logHITLAction(supabase, approval, 'approved', ctx?.userId || payload.user.id);

  // Trigger callback
  await triggerHITLCallback(approval, 'approved', approval.original_content);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Handle HITL reject action
 */
async function handleHITLReject(
  supabase: ReturnType<typeof createClient>,
  payload: InteractivePayload,
  action: SlackAction,
  hitlAction: ParsedHITLAction
): Promise<Response> {
  const ctx = await getSixtyUserContext(supabase, payload.user.id, payload.team?.id);

  // Validate the approval
  const validation = await validateHITLApproval(supabase, hitlAction.approvalId);
  if (!validation.valid || !validation.approval) {
    if (payload.response_url) {
      await sendEphemeral(payload.response_url, {
        blocks: [{ type: 'section', text: { type: 'mrkdwn', text: `❌ ${validation.error || 'Invalid approval'}` } }],
        text: validation.error || 'Invalid approval',
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const approval = validation.approval;

  // Process the rejection
  const { error: updateError } = await supabase.rpc('process_hitl_action', {
    p_approval_id: hitlAction.approvalId,
    p_action: 'rejected',
    p_actioned_by: ctx?.userId || null,
    p_response: { slack_user_id: payload.user.id },
  });

  if (updateError) {
    console.error('Error processing HITL reject:', updateError);
    if (payload.response_url) {
      await sendEphemeral(payload.response_url, {
        blocks: [{ type: 'section', text: { type: 'mrkdwn', text: '❌ Failed to process rejection. Please try again.' } }],
        text: 'Failed to process rejection.',
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Update the original Slack message
  if (payload.response_url) {
    const confirmationData: HITLActionedConfirmation = {
      action: 'rejected',
      resourceType: hitlAction.resourceType,
      resourceName: approval.resource_name || getResourceTypeLabel(hitlAction.resourceType),
      slackUserId: payload.user.id,
      timestamp: new Date().toISOString(),
    };
    const confirmationMessage = buildHITLActionedConfirmation(confirmationData);
    await updateMessage(payload.response_url, confirmationMessage.blocks);
  }

  // Log the action
  await logHITLAction(supabase, approval, 'rejected', ctx?.userId || payload.user.id);

  // Trigger callback (with original content since nothing was changed)
  await triggerHITLCallback(approval, 'rejected', approval.original_content);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Build edit modal blocks based on resource type
 */
function buildHITLEditModalBlocks(
  resourceType: HITLResourceType,
  originalContent: Record<string, unknown>
): unknown[] {
  const blocks: unknown[] = [];

  switch (resourceType) {
    case 'email_draft':
      blocks.push(
        {
          type: 'input',
          block_id: 'subject',
          label: { type: 'plain_text', text: 'Subject' },
          element: {
            type: 'plain_text_input',
            action_id: 'subject_input',
            initial_value: (originalContent.subject as string) || '',
            placeholder: { type: 'plain_text', text: 'Email subject' },
          },
        },
        {
          type: 'input',
          block_id: 'body',
          label: { type: 'plain_text', text: 'Message' },
          element: {
            type: 'plain_text_input',
            action_id: 'body_input',
            multiline: true,
            initial_value: (originalContent.body as string) || '',
            placeholder: { type: 'plain_text', text: 'Email body' },
          },
        }
      );
      if (originalContent.recipient) {
        blocks.unshift({
          type: 'context',
          elements: [{ type: 'mrkdwn', text: `*To:* ${originalContent.recipient}` }],
        });
      }
      break;

    case 'task_list':
      const tasks = Array.isArray(originalContent.tasks)
        ? (originalContent.tasks as string[]).join('\n')
        : (originalContent.body as string) || '';
      blocks.push({
        type: 'input',
        block_id: 'tasks',
        label: { type: 'plain_text', text: 'Tasks (one per line)' },
        element: {
          type: 'plain_text_input',
          action_id: 'tasks_input',
          multiline: true,
          initial_value: tasks,
          placeholder: { type: 'plain_text', text: 'Enter tasks, one per line' },
        },
      });
      break;

    case 'follow_up':
    case 'summary':
    case 'meeting_notes':
    case 'proposal_section':
    case 'coaching_tip':
    default:
      // Generic content editor
      blocks.push({
        type: 'input',
        block_id: 'content',
        label: { type: 'plain_text', text: 'Content' },
        element: {
          type: 'plain_text_input',
          action_id: 'content_input',
          multiline: true,
          initial_value: (originalContent.body as string) || (originalContent.content as string) || '',
          placeholder: { type: 'plain_text', text: 'Edit content...' },
        },
      });
      break;
  }

  // Add optional feedback field
  blocks.push({
    type: 'input',
    block_id: 'feedback',
    optional: true,
    label: { type: 'plain_text', text: 'Feedback (optional)' },
    element: {
      type: 'plain_text_input',
      action_id: 'feedback_input',
      multiline: true,
      placeholder: { type: 'plain_text', text: 'What should be improved in the future?' },
    },
  });

  return blocks;
}

/**
 * Handle HITL edit action - opens a modal for editing
 */
async function handleHITLEdit(
  supabase: ReturnType<typeof createClient>,
  payload: InteractivePayload,
  action: SlackAction,
  hitlAction: ParsedHITLAction
): Promise<Response> {
  const triggerId = payload.trigger_id;

  if (!triggerId) {
    if (payload.response_url) {
      await sendEphemeral(payload.response_url, {
        blocks: [{ type: 'section', text: { type: 'mrkdwn', text: '❌ Unable to open edit dialog.' } }],
        text: 'Unable to open edit dialog.',
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Validate the approval
  const validation = await validateHITLApproval(supabase, hitlAction.approvalId);
  if (!validation.valid || !validation.approval) {
    if (payload.response_url) {
      await sendEphemeral(payload.response_url, {
        blocks: [{ type: 'section', text: { type: 'mrkdwn', text: `❌ ${validation.error || 'Invalid approval'}` } }],
        text: validation.error || 'Invalid approval',
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const approval = validation.approval;

  // Get org connection for bot token
  const orgConnection = await getSlackOrgConnection(supabase, payload.team?.id);
  if (!orgConnection) {
    if (payload.response_url) {
      await sendEphemeral(payload.response_url, {
        blocks: [{ type: 'section', text: { type: 'mrkdwn', text: '❌ Slack is not connected for this workspace.' } }],
        text: 'Slack is not connected.',
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Build modal blocks based on resource type
  const editBlocks = buildHITLEditModalBlocks(
    hitlAction.resourceType,
    approval.original_content
  );

  const privateMetadata = JSON.stringify({
    approvalId: hitlAction.approvalId,
    resourceType: hitlAction.resourceType,
    channelId: payload.channel?.id,
    messageTs: payload.message?.ts,
    responseUrl: payload.response_url,
  });

  // Open the edit modal
  const modalResponse = await fetch('https://slack.com/api/views.open', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${orgConnection.botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      trigger_id: triggerId,
      view: {
        type: 'modal',
        callback_id: 'hitl_edit_modal',
        private_metadata: privateMetadata,
        title: { type: 'plain_text', text: `Edit ${getResourceTypeLabel(hitlAction.resourceType)}`, emoji: true },
        submit: { type: 'plain_text', text: '✅ Save & Approve', emoji: true },
        close: { type: 'plain_text', text: 'Cancel' },
        blocks: editBlocks,
      },
    }),
  });

  const modalResult = await modalResponse.json();
  if (!modalResult.ok) {
    console.error('Failed to open HITL edit modal:', modalResult);
    if (payload.response_url) {
      await sendEphemeral(payload.response_url, {
        blocks: [{ type: 'section', text: { type: 'mrkdwn', text: '❌ Failed to open edit dialog. Please try again.' } }],
        text: 'Failed to open edit dialog.',
      });
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Extract edited content from modal submission based on resource type
 */
function extractEditedContent(
  resourceType: HITLResourceType,
  values: Record<string, Record<string, { value?: string }>>
): Record<string, unknown> {
  const editedContent: Record<string, unknown> = {};

  switch (resourceType) {
    case 'email_draft':
      editedContent.subject = values['subject']?.['subject_input']?.value || '';
      editedContent.body = values['body']?.['body_input']?.value || '';
      break;

    case 'task_list':
      const tasksText = values['tasks']?.['tasks_input']?.value || '';
      editedContent.tasks = tasksText.split('\n').filter((t: string) => t.trim());
      editedContent.body = tasksText;
      break;

    default:
      editedContent.content = values['content']?.['content_input']?.value || '';
      editedContent.body = editedContent.content;
      break;
  }

  return editedContent;
}

/**
 * Handle HITL edit modal submission
 */
async function handleHITLEditSubmission(
  supabase: ReturnType<typeof createClient>,
  payload: InteractivePayload
): Promise<Response> {
  const ctx = await getSixtyUserContext(supabase, payload.user.id, payload.team?.id);

  let meta: {
    approvalId?: string;
    resourceType?: HITLResourceType;
    channelId?: string;
    messageTs?: string;
    responseUrl?: string;
  } = {};

  try {
    meta = payload.view?.private_metadata ? JSON.parse(payload.view.private_metadata) : {};
  } catch {
    console.error('Failed to parse HITL edit modal metadata');
    return new Response('', { status: 200, headers: corsHeaders });
  }

  if (!meta.approvalId || !meta.resourceType) {
    console.error('Missing approval ID or resource type in HITL edit modal');
    return new Response('', { status: 200, headers: corsHeaders });
  }

  // Validate the approval is still valid
  const validation = await validateHITLApproval(supabase, meta.approvalId);
  if (!validation.valid || !validation.approval) {
    return new Response(
      JSON.stringify({
        response_action: 'errors',
        errors: {
          content: validation.error || 'This approval is no longer valid.',
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const approval = validation.approval;
  const values = (payload.view?.state?.values || {}) as Record<string, Record<string, { value?: string }>>;

  // Extract edited content
  const editedContent = extractEditedContent(meta.resourceType, values);
  const feedback = values['feedback']?.['feedback_input']?.value || null;

  // Process the edit action
  const { error: updateError } = await supabase.rpc('process_hitl_action', {
    p_approval_id: meta.approvalId,
    p_action: 'edited',
    p_actioned_by: ctx?.userId || null,
    p_response: {
      slack_user_id: payload.user.id,
      feedback,
    },
    p_edited_content: editedContent,
  });

  if (updateError) {
    console.error('Error processing HITL edit submission:', updateError);
    return new Response(
      JSON.stringify({
        response_action: 'errors',
        errors: {
          content: 'Failed to save changes. Please try again.',
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Update the original message if we have the response URL
  if (meta.responseUrl) {
    const confirmationData: HITLActionedConfirmation = {
      action: 'edited',
      resourceType: meta.resourceType,
      resourceName: approval.resource_name || getResourceTypeLabel(meta.resourceType),
      slackUserId: payload.user.id,
      timestamp: new Date().toISOString(),
      editSummary: feedback || undefined,
    };
    const confirmationMessage = buildHITLActionedConfirmation(confirmationData);
    await updateMessage(meta.responseUrl, confirmationMessage.blocks);
  }

  // Log the action
  await logHITLAction(supabase, approval, 'edited', ctx?.userId || payload.user.id, { feedback });

  // Trigger callback with edited content
  await triggerHITLCallback(approval, 'edited', editedContent);

  // Close the modal
  return new Response('', { status: 200, headers: corsHeaders });
}

// ============================================================================
// Message Shortcut: Create Task from Message
// ============================================================================

/**
 * Handle "Create task from message" shortcut
 * Opens a modal pre-filled with the message text as task title
 */
async function handleCreateTaskFromMessage(
  supabase: ReturnType<typeof createClient>,
  payload: InteractivePayload
): Promise<Response> {
  const triggerId = payload.trigger_id;

  if (!triggerId) {
    console.error('No trigger_id for message shortcut');
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const ctx = await getSixtyUserContext(supabase, payload.user.id, payload.team?.id);
  if (!ctx) {
    // Open a simple modal explaining they need to link their account
    const orgConnection = await getSlackOrgConnection(supabase, payload.team?.id);
    if (orgConnection?.botToken) {
      await fetch('https://slack.com/api/views.open', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${orgConnection.botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          trigger_id: triggerId,
          view: {
            type: 'modal',
            title: { type: 'plain_text', text: 'Account Not Linked' },
            close: { type: 'plain_text', text: 'Close' },
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: '❌ Your Slack account is not linked to Sixty.\n\nPlease contact your admin to set up the mapping, or visit Sixty settings to connect your Slack account.',
                },
              },
            ],
          },
        }),
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const orgConnection = await getSlackOrgConnection(supabase, payload.team?.id);
  if (!orgConnection) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Extract message details
  const messageText = payload.message?.text || '';
  const messageTs = payload.message?.ts || '';
  const channelId = payload.channel?.id || '';

  // Build Slack permalink for backlink
  const teamDomain = payload.team?.domain || '';
  const slackPermalink = channelId && messageTs
    ? `https://${teamDomain}.slack.com/archives/${channelId}/p${messageTs.replace('.', '')}`
    : null;

  // Truncate message for title (max 100 chars)
  const suggestedTitle = messageText.length > 100
    ? messageText.substring(0, 97) + '...'
    : messageText;

  // Fetch user's deals for optional association
  const { data: deals } = await supabase
    .from('deals')
    .select('id, name')
    .eq('user_id', ctx.userId)
    .in('status', ['discovery', 'qualification', 'proposal', 'negotiation'])
    .order('updated_at', { ascending: false })
    .limit(20);

  const dealOptions = (deals || []).map((deal: { id: string; name: string }) => ({
    text: { type: 'plain_text', text: deal.name.substring(0, 75) },
    value: deal.id,
  }));

  const privateMetadata = JSON.stringify({
    channelId,
    messageTs,
    slackPermalink,
    orgId: orgConnection.orgId,
  });

  // Build modal blocks
  const modalBlocks: unknown[] = [
    {
      type: 'input',
      block_id: 'task_title',
      label: { type: 'plain_text', text: 'Task Title' },
      element: {
        type: 'plain_text_input',
        action_id: 'title_input',
        initial_value: suggestedTitle,
        placeholder: { type: 'plain_text', text: 'What needs to be done?' },
      },
    },
    {
      type: 'input',
      block_id: 'task_notes',
      optional: true,
      label: { type: 'plain_text', text: 'Notes' },
      element: {
        type: 'plain_text_input',
        action_id: 'notes_input',
        multiline: true,
        placeholder: { type: 'plain_text', text: 'Additional context...' },
      },
    },
    {
      type: 'input',
      block_id: 'due_date',
      label: { type: 'plain_text', text: 'Due' },
      element: {
        type: 'static_select',
        action_id: 'due_select',
        initial_option: { text: { type: 'plain_text', text: 'In 3 days' }, value: '3' },
        options: [
          { text: { type: 'plain_text', text: 'Today' }, value: '0' },
          { text: { type: 'plain_text', text: 'Tomorrow' }, value: '1' },
          { text: { type: 'plain_text', text: 'In 3 days' }, value: '3' },
          { text: { type: 'plain_text', text: 'In 1 week' }, value: '7' },
          { text: { type: 'plain_text', text: 'In 2 weeks' }, value: '14' },
        ],
      },
    },
  ];

  // Add deal selector if user has deals
  if (dealOptions.length > 0) {
    modalBlocks.push({
      type: 'input',
      block_id: 'deal_association',
      optional: true,
      label: { type: 'plain_text', text: 'Link to Deal (optional)' },
      element: {
        type: 'static_select',
        action_id: 'deal_select',
        placeholder: { type: 'plain_text', text: 'Select a deal...' },
        options: dealOptions,
      },
    });
  }

  // Add context about the source message
  if (slackPermalink) {
    modalBlocks.push({
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `📎 Task will include a link back to the <${slackPermalink}|original message>` },
      ],
    });
  }

  // Open the modal
  const modalResponse = await fetch('https://slack.com/api/views.open', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${orgConnection.botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      trigger_id: triggerId,
      view: {
        type: 'modal',
        callback_id: 'create_task_from_message_modal',
        private_metadata: privateMetadata,
        title: { type: 'plain_text', text: 'Create Task' },
        submit: { type: 'plain_text', text: 'Create Task' },
        close: { type: 'plain_text', text: 'Cancel' },
        blocks: modalBlocks,
      },
    }),
  });

  const modalResult = await modalResponse.json();
  if (!modalResult.ok) {
    console.error('Failed to open create task modal:', modalResult);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Handle submission of "Create task from message" modal
 */
async function handleCreateTaskFromMessageSubmission(
  supabase: ReturnType<typeof createClient>,
  payload: InteractivePayload
): Promise<Response> {
  const ctx = await getSixtyUserContext(supabase, payload.user.id, payload.team?.id);
  if (!ctx) {
    return new Response('', { status: 200, headers: corsHeaders });
  }

  let meta: {
    channelId?: string;
    messageTs?: string;
    slackPermalink?: string;
    orgId?: string;
  } = {};

  try {
    meta = payload.view?.private_metadata ? JSON.parse(payload.view.private_metadata) : {};
  } catch {
    console.error('Failed to parse create task modal metadata');
    return new Response('', { status: 200, headers: corsHeaders });
  }

  const values = (payload.view?.state?.values || {}) as Record<string, Record<string, { value?: string; selected_option?: { value: string } }>>;

  const title = values['task_title']?.['title_input']?.value || 'Task from Slack';
  const notes = values['task_notes']?.['notes_input']?.value || '';
  const dueInDays = parseInt(values['due_date']?.['due_select']?.selected_option?.value || '3', 10);
  const dealId = values['deal_association']?.['deal_select']?.selected_option?.value || null;

  // Calculate due date
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + dueInDays);

  // Build description with Slack backlink
  let description = notes;
  if (meta.slackPermalink) {
    description = notes
      ? `${notes}\n\n---\n📎 Created from Slack message: ${meta.slackPermalink}`
      : `📎 Created from Slack message: ${meta.slackPermalink}`;
  }

  // Create the task
  const { data: task, error: insertError } = await supabase
    .from('tasks')
    .insert({
      title,
      description: description || null,
      assigned_to: ctx.userId,
      created_by: ctx.userId,
      ...(ctx.orgId ? { org_id: ctx.orgId } : {}),
      deal_id: dealId,
      due_date: dueDate.toISOString(),
      status: 'pending',
      source: 'slack_message_shortcut',
      metadata: {
        source: 'slack_message_shortcut',
        slack_channel_id: meta.channelId,
        slack_message_ts: meta.messageTs,
        slack_permalink: meta.slackPermalink,
      },
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('Failed to create task from message shortcut:', insertError);
    return new Response(
      JSON.stringify({
        response_action: 'errors',
        errors: {
          task_title: 'Failed to create task. Please try again.',
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Log activity for Smart Engagement Algorithm
  await logSlackInteraction(supabase, {
    userId: ctx.userId,
    orgId: ctx.orgId || null,
    actionType: 'create_task_from_message',
    actionCategory: 'tasks',
    entityType: dealId ? 'deal' : 'task',
    entityId: dealId || task?.id,
    metadata: {
      source: 'slack_message_shortcut',
      task_title: title,
      has_deal: !!dealId,
    },
  });

  // Post ephemeral confirmation in the channel
  const orgConnection = await getSlackOrgConnection(supabase, payload.team?.id);
  if (orgConnection?.botToken && meta.channelId) {
    const taskUrl = `${appUrl}/tasks/${task?.id}`;
    await fetch('https://slack.com/api/chat.postEphemeral', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${orgConnection.botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: meta.channelId,
        user: payload.user.id,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `✅ Task created: *${title}*\n📅 Due ${dueDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`,
            },
            accessory: {
              type: 'button',
              text: { type: 'plain_text', text: 'View in Sixty', emoji: true },
              url: taskUrl,
              action_id: 'view_task_in_sixty',
            },
          },
        ],
        text: `Task created: ${title}`,
      }),
    });
  }

  // Close the modal
  return new Response('', { status: 200, headers: corsHeaders });
}

// ============================================================================
// PHASE 2: Contact & Deal Action Handlers
// ============================================================================

/**
 * Handle "Create Task" button from contact card
 */
async function handleCreateTaskForContact(
  supabase: ReturnType<typeof createClient>,
  payload: InteractivePayload,
  action: SlackAction
): Promise<Response> {
  const triggerId = payload.trigger_id;
  const teamId = payload.team?.id;
  const channelId = payload.channel?.id;

  if (!triggerId) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const orgConnection = await getSlackOrgConnection(supabase, teamId);
  if (!orgConnection?.botToken) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const ctx = await getSixtyUserContext(supabase, payload.user.id, teamId);
  if (!ctx) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let contactData: { contactId?: string; contactName?: string } = {};
  try {
    contactData = JSON.parse(action.value);
  } catch {
    contactData = {};
  }

  // Get contact's active deal for the deal selector
  let dealOptions: Array<{ text: { type: string; text: string }; value: string }> = [];
  if (contactData.contactId) {
    const { data: contactDeals } = await supabase
      .from('deal_contacts')
      .select('deal_id, deals!inner(id, name)')
      .eq('contact_id', contactData.contactId)
      .limit(5);

    if (contactDeals && contactDeals.length > 0) {
      dealOptions = contactDeals.map((dc: any) => ({
        text: { type: 'plain_text', text: truncateText(dc.deals.name, 50) },
        value: dc.deals.id,
      }));
    }
  }

  // Fallback: Get user's recent deals
  if (dealOptions.length === 0) {
    const { data: userDeals } = await supabase
      .from('deals')
      .select('id, name')
      .eq('user_id', ctx.userId)
      .not('status', 'eq', 'closed_won')
      .not('status', 'eq', 'closed_lost')
      .order('updated_at', { ascending: false })
      .limit(10);

    if (userDeals && userDeals.length > 0) {
      dealOptions = userDeals.map((d: any) => ({
        text: { type: 'plain_text', text: truncateText(d.name, 50) },
        value: d.id,
      }));
    }
  }

  const privateMetadata = JSON.stringify({
    contactId: contactData.contactId,
    contactName: contactData.contactName,
    channelId,
    orgId: ctx.orgId,
  });

  const blocks: unknown[] = [
    {
      type: 'input',
      block_id: 'task_title',
      label: { type: 'plain_text', text: 'Task' },
      element: {
        type: 'plain_text_input',
        action_id: 'title_input',
        placeholder: { type: 'plain_text', text: `Follow up with ${contactData.contactName || 'contact'}` },
      },
    },
    {
      type: 'input',
      block_id: 'task_notes',
      optional: true,
      label: { type: 'plain_text', text: 'Notes' },
      element: {
        type: 'plain_text_input',
        action_id: 'notes_input',
        multiline: true,
        placeholder: { type: 'plain_text', text: 'Additional context...' },
      },
    },
    {
      type: 'input',
      block_id: 'task_due',
      label: { type: 'plain_text', text: 'Due' },
      element: {
        type: 'static_select',
        action_id: 'due_select',
        initial_option: { text: { type: 'plain_text', text: 'Tomorrow' }, value: '1' },
        options: [
          { text: { type: 'plain_text', text: 'Today' }, value: '0' },
          { text: { type: 'plain_text', text: 'Tomorrow' }, value: '1' },
          { text: { type: 'plain_text', text: 'In 3 days' }, value: '3' },
          { text: { type: 'plain_text', text: 'In 1 week' }, value: '7' },
          { text: { type: 'plain_text', text: 'In 2 weeks' }, value: '14' },
        ],
      },
    },
  ];

  if (dealOptions.length > 0) {
    blocks.push({
      type: 'input',
      block_id: 'task_deal',
      optional: true,
      label: { type: 'plain_text', text: 'Link to Deal' },
      element: {
        type: 'static_select',
        action_id: 'deal_select',
        placeholder: { type: 'plain_text', text: 'Select a deal...' },
        options: dealOptions,
      },
    });
  }

  await fetch('https://slack.com/api/views.open', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${orgConnection.botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      trigger_id: triggerId,
      view: {
        type: 'modal',
        callback_id: 'create_task_for_contact_modal',
        private_metadata: privateMetadata,
        title: { type: 'plain_text', text: 'Create Task' },
        submit: { type: 'plain_text', text: 'Create' },
        close: { type: 'plain_text', text: 'Cancel' },
        blocks,
      },
    }),
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Handle "Create Task" button from deal card
 */
async function handleCreateTaskForDeal(
  supabase: ReturnType<typeof createClient>,
  payload: InteractivePayload,
  action: SlackAction
): Promise<Response> {
  const triggerId = payload.trigger_id;
  const teamId = payload.team?.id;
  const channelId = payload.channel?.id;

  if (!triggerId) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const orgConnection = await getSlackOrgConnection(supabase, teamId);
  if (!orgConnection?.botToken) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const ctx = await getSixtyUserContext(supabase, payload.user.id, teamId);
  if (!ctx) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let dealData: { dealId?: string; dealName?: string } = {};
  try {
    dealData = JSON.parse(action.value);
  } catch {
    dealData = {};
  }

  const privateMetadata = JSON.stringify({
    dealId: dealData.dealId,
    dealName: dealData.dealName,
    channelId,
    orgId: ctx.orgId,
  });

  await fetch('https://slack.com/api/views.open', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${orgConnection.botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      trigger_id: triggerId,
      view: {
        type: 'modal',
        callback_id: 'create_task_for_deal_modal',
        private_metadata: privateMetadata,
        title: { type: 'plain_text', text: 'Create Task' },
        submit: { type: 'plain_text', text: 'Create' },
        close: { type: 'plain_text', text: 'Cancel' },
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: `*Deal:* ${dealData.dealName || 'Unknown'}` },
          },
          {
            type: 'input',
            block_id: 'task_title',
            label: { type: 'plain_text', text: 'Task' },
            element: {
              type: 'plain_text_input',
              action_id: 'title_input',
              placeholder: { type: 'plain_text', text: 'What needs to be done?' },
            },
          },
          {
            type: 'input',
            block_id: 'task_notes',
            optional: true,
            label: { type: 'plain_text', text: 'Notes' },
            element: {
              type: 'plain_text_input',
              action_id: 'notes_input',
              multiline: true,
              placeholder: { type: 'plain_text', text: 'Additional context...' },
            },
          },
          {
            type: 'input',
            block_id: 'task_due',
            label: { type: 'plain_text', text: 'Due' },
            element: {
              type: 'static_select',
              action_id: 'due_select',
              initial_option: { text: { type: 'plain_text', text: 'Tomorrow' }, value: '1' },
              options: [
                { text: { type: 'plain_text', text: 'Today' }, value: '0' },
                { text: { type: 'plain_text', text: 'Tomorrow' }, value: '1' },
                { text: { type: 'plain_text', text: 'In 3 days' }, value: '3' },
                { text: { type: 'plain_text', text: 'In 1 week' }, value: '7' },
                { text: { type: 'plain_text', text: 'In 2 weeks' }, value: '14' },
              ],
            },
          },
        ],
      },
    }),
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Handle task creation modal submissions (for both contact and deal)
 */
async function handleCreateTaskModalSubmission(
  supabase: ReturnType<typeof createClient>,
  payload: InteractivePayload
): Promise<Response> {
  const ctx = await getSixtyUserContext(supabase, payload.user.id, payload.team?.id);
  if (!ctx) {
    return new Response('', { status: 200, headers: corsHeaders });
  }

  let meta: { contactId?: string; contactName?: string; dealId?: string; dealName?: string; channelId?: string; orgId?: string } = {};
  try {
    meta = payload.view?.private_metadata ? JSON.parse(payload.view.private_metadata) : {};
  } catch {
    meta = {};
  }

  const values = (payload.view?.state?.values || {}) as any;
  const title = values['task_title']?.['title_input']?.value || 'Follow up';
  const notes = values['task_notes']?.['notes_input']?.value || '';
  const dueDays = parseInt(values['task_due']?.['due_select']?.selected_option?.value || '1', 10);
  const selectedDealId = values['task_deal']?.['deal_select']?.selected_option?.value;

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + dueDays);

  const dealId = meta.dealId || selectedDealId || null;

  // Create the task
  const { data: task } = await supabase
    .from('tasks')
    .insert({
      user_id: ctx.userId,
      title,
      notes,
      due_date: dueDate.toISOString(),
      status: 'pending',
      contact_id: meta.contactId || null,
      deal_id: dealId,
      source: 'slack',
      metadata: {
        created_via: 'slack_action',
        contact_name: meta.contactName || null,
        deal_name: meta.dealName || null,
      },
    })
    .select('id')
    .single();

  // Log activity for Smart Engagement Algorithm
  await logSlackInteraction(supabase, {
    userId: ctx.userId,
    orgId: ctx.orgId || null,
    actionType: meta.contactId ? 'create_task_for_contact' : 'create_task_for_deal',
    actionCategory: 'tasks',
    entityType: dealId ? 'deal' : 'contact',
    entityId: dealId || meta.contactId,
    metadata: {
      source: 'slack_card_action',
      task_title: title,
    },
  });

  // Post ephemeral confirmation
  const orgConnection = await getSlackOrgConnection(supabase, payload.team?.id);
  const appUrl = Deno.env.get('PUBLIC_APP_URL') || 'https://app.use60.com';

  if (orgConnection?.botToken && meta.channelId) {
    const taskUrl = `${appUrl}/tasks/${task?.id}`;
    await fetch('https://slack.com/api/chat.postEphemeral', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${orgConnection.botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: meta.channelId,
        user: payload.user.id,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `✅ Task created: *${title}*\n📅 Due ${dueDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`,
            },
            accessory: {
              type: 'button',
              text: { type: 'plain_text', text: 'View in Sixty', emoji: true },
              url: taskUrl,
              action_id: 'view_task_in_sixty',
            },
          },
        ],
        text: `Task created: ${title}`,
      }),
    });
  }

  return new Response('', { status: 200, headers: corsHeaders });
}

/**
 * Handle "Update Stage" button from deal card
 */
async function handleUpdateDealStage(
  supabase: ReturnType<typeof createClient>,
  payload: InteractivePayload,
  action: SlackAction
): Promise<Response> {
  const triggerId = payload.trigger_id;
  const teamId = payload.team?.id;
  const channelId = payload.channel?.id;

  if (!triggerId) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const orgConnection = await getSlackOrgConnection(supabase, teamId);
  if (!orgConnection?.botToken) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const ctx = await getSixtyUserContext(supabase, payload.user.id, teamId);
  if (!ctx) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let dealData: { dealId?: string; dealName?: string } = {};
  try {
    dealData = JSON.parse(action.value);
  } catch {
    dealData = {};
  }

  // Get current deal and available stages
  const { data: deal } = await supabase
    .from('deals')
    .select('id, name, stage_id, pipeline_id')
    .eq('id', dealData.dealId)
    .maybeSingle();

  if (!deal) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Get stages for this pipeline
  const { data: stages } = await supabase
    .from('deal_stages')
    .select('id, name, order_index')
    .eq('pipeline_id', deal.pipeline_id)
    .order('order_index', { ascending: true });

  if (!stages || stages.length === 0) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const stageOptions = stages.map((s: any) => ({
    text: { type: 'plain_text', text: s.name },
    value: s.id,
  }));

  const currentStageOption = stageOptions.find((s: any) => s.value === deal.stage_id);

  const privateMetadata = JSON.stringify({
    dealId: deal.id,
    dealName: deal.name,
    channelId,
    orgId: ctx.orgId,
    currentStageId: deal.stage_id,
  });

  await fetch('https://slack.com/api/views.open', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${orgConnection.botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      trigger_id: triggerId,
      view: {
        type: 'modal',
        callback_id: 'update_deal_stage_modal',
        private_metadata: privateMetadata,
        title: { type: 'plain_text', text: 'Update Stage' },
        submit: { type: 'plain_text', text: 'Update' },
        close: { type: 'plain_text', text: 'Cancel' },
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: `*Deal:* ${deal.name}` },
          },
          {
            type: 'input',
            block_id: 'stage_select',
            label: { type: 'plain_text', text: 'New Stage' },
            element: {
              type: 'static_select',
              action_id: 'stage_input',
              initial_option: currentStageOption,
              options: stageOptions,
            },
          },
          {
            type: 'input',
            block_id: 'stage_notes',
            optional: true,
            label: { type: 'plain_text', text: 'Notes' },
            element: {
              type: 'plain_text_input',
              action_id: 'notes_input',
              multiline: true,
              placeholder: { type: 'plain_text', text: 'Why is the stage changing?' },
            },
          },
        ],
      },
    }),
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Handle stage update modal submission
 */
async function handleUpdateDealStageSubmission(
  supabase: ReturnType<typeof createClient>,
  payload: InteractivePayload
): Promise<Response> {
  const ctx = await getSixtyUserContext(supabase, payload.user.id, payload.team?.id);
  if (!ctx) {
    return new Response('', { status: 200, headers: corsHeaders });
  }

  let meta: { dealId?: string; dealName?: string; channelId?: string; orgId?: string; currentStageId?: string } = {};
  try {
    meta = payload.view?.private_metadata ? JSON.parse(payload.view.private_metadata) : {};
  } catch {
    meta = {};
  }

  if (!meta.dealId) {
    return new Response('', { status: 200, headers: corsHeaders });
  }

  const values = (payload.view?.state?.values || {}) as any;
  const newStageId = values['stage_select']?.['stage_input']?.selected_option?.value;
  const notes = values['stage_notes']?.['notes_input']?.value || '';

  if (!newStageId || newStageId === meta.currentStageId) {
    return new Response('', { status: 200, headers: corsHeaders });
  }

  // Get stage name for the activity log
  const { data: stage } = await supabase
    .from('deal_stages')
    .select('name')
    .eq('id', newStageId)
    .maybeSingle();

  // Update the deal
  await supabase
    .from('deals')
    .update({
      stage_id: newStageId,
      stage_changed_at: new Date().toISOString(),
    })
    .eq('id', meta.dealId);

  // Log the activity
  await supabase
    .from('activities')
    .insert({
      user_id: ctx.userId,
      deal_id: meta.dealId,
      activity_type: 'stage_change',
      activity_date: new Date().toISOString(),
      notes: notes || `Stage changed to ${stage?.name || 'Unknown'}`,
      metadata: {
        source: 'slack',
        old_stage_id: meta.currentStageId,
        new_stage_id: newStageId,
        new_stage_name: stage?.name,
      },
    });

  // Log for Smart Engagement
  await logSlackInteraction(supabase, {
    userId: ctx.userId,
    orgId: ctx.orgId || null,
    actionType: 'update_deal_stage',
    actionCategory: 'deals',
    entityType: 'deal',
    entityId: meta.dealId,
    metadata: {
      source: 'slack_card_action',
      new_stage: stage?.name,
    },
  });

  // Post ephemeral confirmation
  const orgConnection = await getSlackOrgConnection(supabase, payload.team?.id);
  if (orgConnection?.botToken && meta.channelId) {
    await fetch('https://slack.com/api/chat.postEphemeral', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${orgConnection.botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: meta.channelId,
        user: payload.user.id,
        text: `✅ ${meta.dealName} moved to *${stage?.name}*`,
      }),
    });
  }

  return new Response('', { status: 200, headers: corsHeaders });
}

/**
 * Handle "Log Activity" button from deal card
 */
async function handleLogDealActivity(
  supabase: ReturnType<typeof createClient>,
  payload: InteractivePayload,
  action: SlackAction
): Promise<Response> {
  // This reuses the existing handleLogActivity but parses deal info from the action value
  let dealData: { dealId?: string; dealName?: string } = {};
  try {
    dealData = JSON.parse(action.value);
  } catch {
    dealData = {};
  }

  // Create a modified action with just the dealId
  const modifiedAction: SlackAction = {
    ...action,
    value: dealData.dealId || '',
  };

  return handleLogActivity(supabase, payload, modifiedAction);
}

/**
 * Handle "Draft Follow-up" button from contact card (HITL flow)
 */
async function handleDraftFollowupContact(
  supabase: ReturnType<typeof createClient>,
  payload: InteractivePayload,
  action: SlackAction
): Promise<Response> {
  const teamId = payload.team?.id;
  const channelId = payload.channel?.id;

  const orgConnection = await getSlackOrgConnection(supabase, teamId);
  if (!orgConnection?.botToken) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const ctx = await getSixtyUserContext(supabase, payload.user.id, teamId);
  if (!ctx) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let contactData: { contactId?: string; contactName?: string; email?: string } = {};
  try {
    contactData = JSON.parse(action.value);
  } catch {
    contactData = {};
  }

  // Post an ephemeral "generating" message
  if (channelId) {
    await fetch('https://slack.com/api/chat.postEphemeral', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${orgConnection.botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: channelId,
        user: payload.user.id,
        text: `✨ Drafting follow-up for ${contactData.contactName || 'contact'}...`,
      }),
    });
  }

  // Call the follow-up generation edge function
  const appUrl = Deno.env.get('PUBLIC_APP_URL') || 'https://app.use60.com';
  const supabaseUrl = Deno.env.get('SUPABASE_URL');

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/slack-slash-commands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'x-slack-request-timestamp': Math.floor(Date.now() / 1000).toString(),
      },
      body: new URLSearchParams({
        command: '/sixty',
        text: `follow-up ${contactData.contactName || contactData.email || ''}`,
        user_id: payload.user.id,
        team_id: teamId || '',
        channel_id: channelId || '',
        trigger_id: payload.trigger_id || '',
        response_url: payload.response_url || '',
      }).toString(),
    });

    // The follow-up command will post its own HITL message
  } catch (error) {
    console.error('Error calling follow-up command:', error);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Handle "Draft Check-in" button from deal card (HITL flow)
 */
async function handleDraftCheckinDeal(
  supabase: ReturnType<typeof createClient>,
  payload: InteractivePayload,
  action: SlackAction
): Promise<Response> {
  const teamId = payload.team?.id;
  const channelId = payload.channel?.id;

  const orgConnection = await getSlackOrgConnection(supabase, teamId);
  if (!orgConnection?.botToken) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const ctx = await getSixtyUserContext(supabase, payload.user.id, teamId);
  if (!ctx) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let dealData: { dealId?: string; dealName?: string; contactEmail?: string } = {};
  try {
    dealData = JSON.parse(action.value);
  } catch {
    dealData = {};
  }

  // Post an ephemeral "generating" message
  if (channelId) {
    await fetch('https://slack.com/api/chat.postEphemeral', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${orgConnection.botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: channelId,
        user: payload.user.id,
        text: `✨ Drafting check-in for ${dealData.dealName || 'deal'}...`,
      }),
    });
  }

  // Call the follow-up generation edge function with deal context
  const supabaseUrl = Deno.env.get('SUPABASE_URL');

  try {
    await fetch(`${supabaseUrl}/functions/v1/slack-slash-commands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'x-slack-request-timestamp': Math.floor(Date.now() / 1000).toString(),
      },
      body: new URLSearchParams({
        command: '/sixty',
        text: `follow-up ${dealData.dealName || ''}`,
        user_id: payload.user.id,
        team_id: teamId || '',
        channel_id: channelId || '',
        trigger_id: payload.trigger_id || '',
        response_url: payload.response_url || '',
      }).toString(),
    });
  } catch (error) {
    console.error('Error calling follow-up command:', error);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Helper to truncate text
 */
function truncateText(text: string, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Slack signs the *raw* request body. Do not use req.formData() here because it
    // normalizes/decodes the body and breaks signature verification.
    const rawBody = await req.text();
    const contentType = (req.headers.get('content-type') || '').toLowerCase();

    let payloadStr: string | null = null;
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const params = new URLSearchParams(rawBody);
      payloadStr = params.get('payload');
    } else if (contentType.includes('application/json')) {
      // Defensive: some proxies may forward JSON. Slack normally sends urlencoded.
      const parsed = JSON.parse(rawBody);
      payloadStr = typeof parsed?.payload === 'string' ? parsed.payload : rawBody;
    } else {
      // Best effort: attempt urlencoded parse
      const params = new URLSearchParams(rawBody);
      payloadStr = params.get('payload');
    }

    if (!payloadStr) {
      return new Response(
        JSON.stringify({ error: 'No payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify Slack signature
    const timestamp = req.headers.get('x-slack-request-timestamp') || '';
    const signature = req.headers.get('x-slack-signature') || '';

    if (!await verifySlackRequest(rawBody, timestamp, signature)) {
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload: InteractivePayload = JSON.parse(payloadStr);
    console.log('Received interactive payload:', { type: payload.type, user: payload.user?.id });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle different interaction types
    switch (payload.type) {
      case 'block_actions': {
        const action = payload.actions?.[0];
        if (!action) {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log('Processing action:', action.action_id);

        // Check if this is a HITL action first
        const hitlAction = parseHITLActionId(action.action_id);
        if (hitlAction) {
          console.log('Processing HITL action:', hitlAction);
          switch (hitlAction.action) {
            case 'approve':
              return handleHITLApprove(supabase, payload, action, hitlAction);
            case 'reject':
              return handleHITLReject(supabase, payload, action, hitlAction);
            case 'edit':
              return handleHITLEdit(supabase, payload, action, hitlAction);
          }
        }

        // Route to appropriate handler based on action_id
        if (action.action_id.startsWith('add_task_')) {
          return handleAddTask(supabase, payload, action);
        } else if (action.action_id === 'add_all_tasks') {
          return handleAddAllTasks(supabase, payload, action);
        } else if (action.action_id === 'dismiss_tasks') {
          return handleDismiss(supabase, payload, action);
        } else if (action.action_id === 'create_task_from_assistant') {
          return handleCreateTaskFromAssistant(supabase, payload, action);
        } else if (action.action_id === 'create_task_from_alert') {
          return handleCreateTaskFromAlert(supabase, payload, action);
        } else if (action.action_id === 'log_activity') {
          return handleLogActivity(supabase, payload, action);
        } else if (action.action_id.startsWith('notification_feedback_')) {
          // Smart Engagement Algorithm: Handle feedback buttons
          return handleNotificationFeedback(supabase, payload, action);
        } else if (action.action_id.startsWith('view_')) {
          // View actions are typically handled by the URL in the button
          // Just acknowledge
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        // Phase 2: Contact & Deal action handlers
        else if (action.action_id === 'create_task_for_contact') {
          return handleCreateTaskForContact(supabase, payload, action);
        } else if (action.action_id === 'create_task_for_deal') {
          return handleCreateTaskForDeal(supabase, payload, action);
        } else if (action.action_id === 'update_deal_stage') {
          return handleUpdateDealStage(supabase, payload, action);
        } else if (action.action_id === 'log_deal_activity') {
          return handleLogDealActivity(supabase, payload, action);
        } else if (action.action_id === 'draft_followup_contact') {
          return handleDraftFollowupContact(supabase, payload, action);
        } else if (action.action_id === 'draft_checkin_deal') {
          return handleDraftCheckinDeal(supabase, payload, action);
        }

        // Unknown action - just acknowledge
        console.log('Unknown action_id:', action.action_id);
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'view_submission': {
        // Handle modal submissions
        console.log('View submission:', payload.view?.callback_id);
        if (payload.view?.callback_id === 'log_activity_modal') {
          return handleLogActivitySubmission(supabase, payload);
        }
        if (payload.view?.callback_id === 'hitl_edit_modal') {
          return handleHITLEditSubmission(supabase, payload);
        }
        if (payload.view?.callback_id === 'create_task_from_message_modal') {
          return handleCreateTaskFromMessageSubmission(supabase, payload);
        }
        // Phase 2: Contact & Deal modal submissions
        if (payload.view?.callback_id === 'create_task_for_contact_modal' ||
            payload.view?.callback_id === 'create_task_for_deal_modal') {
          return handleCreateTaskModalSubmission(supabase, payload);
        }
        if (payload.view?.callback_id === 'update_deal_stage_modal') {
          return handleUpdateDealStageSubmission(supabase, payload);
        }
        return new Response('', { status: 200, headers: corsHeaders });
      }

      case 'message_action': {
        // Handle message shortcuts (right-click on message → "Create task")
        console.log('Message action received:', payload.callback_id);
        if (payload.callback_id === 'create_task_from_message') {
          return handleCreateTaskFromMessage(supabase, payload);
        }
        // Unknown message action - acknowledge
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'shortcut': {
        // Handle global shortcuts (future feature)
        console.log('Global shortcut received:', payload.callback_id);
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        console.warn('Unknown interaction type:', payload.type);
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    console.error('Error processing interactive payload:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
