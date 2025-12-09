// supabase/functions/slack-interactive/index.ts
// Handles Slack Interactivity - button clicks, modal submissions, shortcuts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import { buildTaskAddedConfirmation } from '../_shared/slackBlocks.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const slackSigningSecret = Deno.env.get('SLACK_SIGNING_SECRET');

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

/**
 * Verify Slack request signature
 */
async function verifySlackRequest(
  body: string,
  timestamp: string,
  signature: string
): Promise<boolean> {
  if (!slackSigningSecret) {
    console.warn('SLACK_SIGNING_SECRET not set - skipping signature verification');
    return true;
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

/**
 * Get Sixty user ID from Slack user ID
 */
async function getSixtyUserId(
  supabase: ReturnType<typeof createClient>,
  slackUserId: string,
  teamId?: string
): Promise<string | null> {
  // First try to find by slack_user_id directly
  let query = supabase
    .from('slack_user_mappings')
    .select('sixty_user_id')
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

  return data.sixty_user_id;
}

/**
 * Create a task in the database
 */
async function createTask(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  taskData: TaskData
): Promise<{ success: boolean; taskId?: string; error?: string }> {
  // Calculate due date
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + (taskData.dueInDays || 3));

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      title: taskData.title,
      user_id: userId,
      deal_id: taskData.dealId || null,
      due_date: dueDate.toISOString(),
      status: 'proposed',
      source: 'slack_suggestion',
      metadata: taskData.meetingId ? { meeting_id: taskData.meetingId } : null,
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
  const sixtyUserId = await getSixtyUserId(supabase, payload.user.id, payload.team?.id);

  if (!sixtyUserId) {
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
    const result = await createTask(supabase, sixtyUserId, taskData);

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
  const sixtyUserId = await getSixtyUserId(supabase, payload.user.id, payload.team?.id);

  if (!sixtyUserId) {
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
      const result = await createTask(supabase, sixtyUserId, taskData);
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
  const sixtyUserId = await getSixtyUserId(supabase, payload.user.id, payload.team?.id);

  if (!sixtyUserId) {
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

    const result = await createTask(supabase, sixtyUserId, {
      title: taskTitle,
      dealId,
      dueInDays: 1, // Urgent
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
  _supabase: ReturnType<typeof createClient>,
  payload: InteractivePayload,
  _action: SlackAction
): Promise<Response> {
  // For now, just acknowledge - in the future, we could open a modal
  if (payload.response_url) {
    await sendEphemeral(payload.response_url, {
      blocks: [{
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '📝 Activity logging via Slack coming soon! For now, please log activities in the Sixty app.',
        },
      }],
      text: 'Activity logging coming soon.',
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const payloadStr = formData.get('payload') as string;

    if (!payloadStr) {
      return new Response(
        JSON.stringify({ error: 'No payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify Slack signature
    const timestamp = req.headers.get('x-slack-request-timestamp') || '';
    const signature = req.headers.get('x-slack-signature') || '';
    const bodyStr = `payload=${encodeURIComponent(payloadStr)}`;

    if (!await verifySlackRequest(bodyStr, timestamp, signature)) {
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
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
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
