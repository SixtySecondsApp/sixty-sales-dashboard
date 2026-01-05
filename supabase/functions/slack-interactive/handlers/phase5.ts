// supabase/functions/slack-interactive/handlers/phase5.ts
// Phase 5: Team & Manager Operating Cadence interactive handlers

import { corsHeaders } from '../../_shared/cors.ts';
import type { SupabaseClient } from '@supabase/supabase-js';
import { handlePipeline } from '../../slack-slash-commands/handlers/pipeline.ts';
import { handleApprovals } from '../../slack-slash-commands/handlers/approvals.ts';
import { handleRisks } from '../../slack-slash-commands/handlers/risks.ts';

interface SlackAction {
  action_id: string;
  value: string;
  type: string;
  block_id?: string;
  selected_option?: { value: string };
}

interface InteractivePayload {
  user: { id: string };
  team?: { id: string };
  response_url?: string;
  trigger_id?: string;
}

/**
 * Get user context for Sixty operations
 */
async function getSixtyUserContext(
  supabase: SupabaseClient,
  slackUserId: string,
  teamId?: string
): Promise<{ userId: string; orgId: string } | null> {
  if (!teamId) return null;

  // Get org from team
  const { data: slackSettings } = await supabase
    .from('slack_org_settings')
    .select('org_id')
    .eq('slack_team_id', teamId)
    .eq('is_connected', true)
    .maybeSingle();

  if (!slackSettings?.org_id) return null;

  // Get user from Slack ID
  const { data: slackUser } = await supabase
    .from('slack_user_mappings')
    .select('user_id')
    .eq('slack_user_id', slackUserId)
    .eq('org_id', slackSettings.org_id)
    .maybeSingle();

  if (!slackUser?.user_id) return null;

  return {
    userId: slackUser.user_id,
    orgId: slackSettings.org_id,
  };
}

/**
 * Get bot token for response
 */
async function getBotToken(
  supabase: SupabaseClient,
  teamId?: string
): Promise<string | null> {
  if (!teamId) return null;

  const { data } = await supabase
    .from('slack_org_settings')
    .select('bot_access_token')
    .eq('slack_team_id', teamId)
    .eq('is_connected', true)
    .maybeSingle();

  return data?.bot_access_token || null;
}

/**
 * Send response to Slack via response_url
 */
async function sendSlackResponse(
  responseUrl: string,
  message: { blocks: unknown[]; text?: string; replace_original?: boolean }
): Promise<void> {
  await fetch(responseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...message,
      replace_original: message.replace_original ?? true,
    }),
  });
}

// ============================================================================
// Pipeline Handlers
// ============================================================================

/**
 * Handle pipeline filter button clicks
 */
export async function handlePipelineFilter(
  supabase: SupabaseClient,
  payload: InteractivePayload,
  action: SlackAction
): Promise<Response> {
  const filterMap: Record<string, string> = {
    'pipeline_filter_all': '',
    'pipeline_filter_risk': 'at-risk',
    'pipeline_filter_closing': 'closing',
    'pipeline_filter_stale': 'stale',
  };

  const filter = filterMap[action.action_id] || '';
  const ctx = await getSixtyUserContext(supabase, payload.user.id, payload.team?.id);

  if (!ctx || !payload.response_url) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Build command context
  const commandCtx = {
    supabase,
    userContext: {
      userId: ctx.userId,
      orgId: ctx.orgId,
      slackUserId: payload.user.id,
    },
    appUrl: Deno.env.get('APP_URL') || 'https://use60.com',
  };

  try {
    const result = await handlePipeline(commandCtx as any, filter);
    await sendSlackResponse(payload.response_url, {
      blocks: result.blocks as unknown[],
      text: result.text,
      replace_original: true,
    });
  } catch (error) {
    console.error('Error handling pipeline filter:', error);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Handle pipeline view stage button
 */
export async function handlePipelineViewStage(
  supabase: SupabaseClient,
  payload: InteractivePayload,
  action: SlackAction
): Promise<Response> {
  const stageId = action.value;
  // For now, just filter by stage - could show detailed stage view later
  // This triggers a filter that would need stage-specific logic

  console.log('View stage:', stageId);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Handle pipeline deal overflow menu actions
 */
export async function handlePipelineDealOverflow(
  supabase: SupabaseClient,
  payload: InteractivePayload,
  action: SlackAction
): Promise<Response> {
  const selectedOption = action.selected_option?.value;
  if (!selectedOption) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const [actionType, dealId, dealName] = selectedOption.split(':');

  console.log('Pipeline deal action:', actionType, dealId, dealName);

  // Route to appropriate handler based on action type
  switch (actionType) {
    case 'view':
      // Just acknowledge - user will navigate to deal
      break;
    case 'draft_checkin':
      // Could trigger follow-up flow
      break;
    case 'update_stage':
      // Could open stage update modal
      break;
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ============================================================================
// Standup Handlers
// ============================================================================

/**
 * Handle standup view pipeline button
 */
export async function handleStandupViewPipeline(
  supabase: SupabaseClient,
  payload: InteractivePayload
): Promise<Response> {
  const ctx = await getSixtyUserContext(supabase, payload.user.id, payload.team?.id);

  if (!ctx || !payload.response_url) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Build command context
  const commandCtx = {
    supabase,
    userContext: {
      userId: ctx.userId,
      orgId: ctx.orgId,
      slackUserId: payload.user.id,
    },
    appUrl: Deno.env.get('APP_URL') || 'https://use60.com',
  };

  try {
    const result = await handlePipeline(commandCtx as any, '');
    await sendSlackResponse(payload.response_url, {
      blocks: result.blocks as unknown[],
      text: result.text,
      replace_original: false, // Don't replace standup message
    });
  } catch (error) {
    console.error('Error handling standup view pipeline:', error);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Handle standup view risks button
 */
export async function handleStandupViewRisks(
  supabase: SupabaseClient,
  payload: InteractivePayload
): Promise<Response> {
  const ctx = await getSixtyUserContext(supabase, payload.user.id, payload.team?.id);

  if (!ctx || !payload.response_url) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Build command context
  const commandCtx = {
    supabase,
    userContext: {
      userId: ctx.userId,
      orgId: ctx.orgId,
      slackUserId: payload.user.id,
    },
    appUrl: Deno.env.get('APP_URL') || 'https://use60.com',
  };

  try {
    const result = await handleRisks(commandCtx as any, 'at-risk');
    await sendSlackResponse(payload.response_url, {
      blocks: result.blocks as unknown[],
      text: result.text,
      replace_original: false, // Don't replace standup message
    });
  } catch (error) {
    console.error('Error handling standup view risks:', error);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ============================================================================
// Approvals Handlers
// ============================================================================

/**
 * Handle approval overflow menu actions
 */
export async function handleApprovalOverflow(
  supabase: SupabaseClient,
  payload: InteractivePayload,
  action: SlackAction
): Promise<Response> {
  const selectedOption = action.selected_option?.value;
  if (!selectedOption) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const [actionType, approvalType, approvalId] = selectedOption.split(':');
  const ctx = await getSixtyUserContext(supabase, payload.user.id, payload.team?.id);

  if (!ctx) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  console.log('Approval action:', actionType, approvalType, approvalId);

  try {
    switch (actionType) {
      case 'approve':
        await handleApproveAction(supabase, approvalType, approvalId, ctx.userId);
        break;
      case 'edit':
        // Could open edit modal
        break;
      case 'reject':
        await handleRejectAction(supabase, approvalType, approvalId, ctx.userId);
        break;
      case 'view':
        // Just acknowledge - user navigates via URL
        break;
    }

    // Refresh the approvals view
    if (payload.response_url) {
      const commandCtx = {
        supabase,
        userContext: {
          userId: ctx.userId,
          orgId: ctx.orgId,
          slackUserId: payload.user.id,
        },
        appUrl: Deno.env.get('APP_URL') || 'https://use60.com',
      };

      const result = await handleApprovals(commandCtx as any);
      await sendSlackResponse(payload.response_url, {
        blocks: result.blocks as unknown[],
        text: result.text,
        replace_original: true,
      });
    }
  } catch (error) {
    console.error('Error handling approval action:', error);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Handle approve all button
 */
export async function handleApprovalsApproveAll(
  supabase: SupabaseClient,
  payload: InteractivePayload
): Promise<Response> {
  const ctx = await getSixtyUserContext(supabase, payload.user.id, payload.team?.id);

  if (!ctx) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Approve all pending ai_suggestions
    await supabase
      .from('ai_suggestions')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('user_id', ctx.userId)
      .eq('status', 'pending');

    // Approve all pending draft_messages
    await supabase
      .from('draft_messages')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('user_id', ctx.userId)
      .eq('status', 'pending_approval');

    // Approve all pending next_action_suggestions
    await supabase
      .from('next_action_suggestions')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('user_id', ctx.userId)
      .eq('status', 'pending');

    // Refresh approvals view (should now be empty)
    if (payload.response_url) {
      const commandCtx = {
        supabase,
        userContext: {
          userId: ctx.userId,
          orgId: ctx.orgId,
          slackUserId: payload.user.id,
        },
        appUrl: Deno.env.get('APP_URL') || 'https://use60.com',
      };

      const result = await handleApprovals(commandCtx as any);
      await sendSlackResponse(payload.response_url, {
        blocks: result.blocks as unknown[],
        text: result.text,
        replace_original: true,
      });
    }
  } catch (error) {
    console.error('Error handling approve all:', error);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Handle approvals refresh button
 */
export async function handleApprovalsRefresh(
  supabase: SupabaseClient,
  payload: InteractivePayload
): Promise<Response> {
  const ctx = await getSixtyUserContext(supabase, payload.user.id, payload.team?.id);

  if (!ctx || !payload.response_url) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const commandCtx = {
      supabase,
      userContext: {
        userId: ctx.userId,
        orgId: ctx.orgId,
        slackUserId: payload.user.id,
      },
      appUrl: Deno.env.get('APP_URL') || 'https://use60.com',
    };

    const result = await handleApprovals(commandCtx as any);
    await sendSlackResponse(payload.response_url, {
      blocks: result.blocks as unknown[],
      text: result.text,
      replace_original: true,
    });
  } catch (error) {
    console.error('Error handling approvals refresh:', error);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Handle approving a single suggestion
 */
async function handleApproveAction(
  supabase: SupabaseClient,
  approvalType: string,
  approvalId: string,
  userId: string
): Promise<void> {
  const tableMap: Record<string, string> = {
    'follow_up': 'ai_suggestions',
    'task': 'next_action_suggestions',
    'activity': 'ai_suggestions',
    'email': 'draft_messages',
  };

  const table = tableMap[approvalType];
  if (!table) return;

  const statusField = table === 'draft_messages' ? 'status' : 'status';
  const approvedValue = table === 'draft_messages' ? 'approved' : 'approved';

  await supabase
    .from(table)
    .update({
      status: approvedValue,
      approved_at: new Date().toISOString(),
    })
    .eq('id', approvalId)
    .eq('user_id', userId);
}

/**
 * Handle rejecting a single suggestion
 */
async function handleRejectAction(
  supabase: SupabaseClient,
  approvalType: string,
  approvalId: string,
  userId: string
): Promise<void> {
  const tableMap: Record<string, string> = {
    'follow_up': 'ai_suggestions',
    'task': 'next_action_suggestions',
    'activity': 'ai_suggestions',
    'email': 'draft_messages',
  };

  const table = tableMap[approvalType];
  if (!table) return;

  await supabase
    .from(table)
    .update({
      status: 'rejected',
      rejected_at: new Date().toISOString(),
    })
    .eq('id', approvalId)
    .eq('user_id', userId);
}
