// supabase/functions/slack-interactive/index.ts
// Handles Slack Interactivity - button clicks, modal submissions, shortcuts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import { buildTaskAddedConfirmation, buildDealActivityMessage, type DealActivityData } from '../_shared/slackBlocks.ts';

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
  blocks?: unknown[];
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
  payload: InteractivePayload,
  _action: SlackAction
): Promise<Response> {
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

        // Route to appropriate handler based on action_id
        if (action.action_id.startsWith('add_task_')) {
          return handleAddTask(supabase, payload, action);
        } else if (action.action_id === 'add_all_tasks') {
          return handleAddAllTasks(supabase, payload, action);
        } else if (action.action_id === 'dismiss_tasks') {
          return handleDismiss(payload, action);
        } else if (action.action_id === 'create_task_from_alert') {
          return handleCreateTaskFromAlert(supabase, payload, action);
        } else if (action.action_id === 'log_activity') {
          return handleLogActivity(supabase, payload, action);
        } else if (action.action_id.startsWith('view_')) {
          // View actions are typically handled by the URL in the button
          // Just acknowledge
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Unknown action - just acknowledge
        console.log('Unknown action_id:', action.action_id);
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'view_submission': {
        // Handle modal submissions (future feature)
        console.log('View submission:', payload.view?.callback_id);
        if (payload.view?.callback_id === 'log_activity_modal') {
          return handleLogActivitySubmission(supabase, payload);
        }
        return new Response('', { status: 200, headers: corsHeaders });
      }

      case 'shortcut':
      case 'message_action': {
        // Handle shortcuts and message actions (future feature)
        console.log('Shortcut/message action received');
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
