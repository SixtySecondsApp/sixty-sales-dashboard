/**
 * MeetingBaaS Webhook Handler
 *
 * Processes webhook events from MeetingBaaS for white-labelled meeting recording.
 * Events include: bot lifecycle, recording ready, transcript ready
 *
 * Webhook URL format: /meetingbaas-webhook?token={org_webhook_token}
 */

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { legacyCorsHeaders as corsHeaders } from '../_shared/corsHelper.ts';
import { captureException, addBreadcrumb } from '../_shared/sentryEdge.ts';
import { hmacSha256Hex, timingSafeEqual } from '../_shared/use60Signing.ts';

// =============================================================================
// Types
// =============================================================================

type MeetingBaaSEventType =
  | 'bot.joining'
  | 'bot.in_meeting'
  | 'bot.left'
  | 'bot.failed'
  | 'recording.ready'
  | 'transcript.ready';

interface MeetingBaaSWebhookPayload {
  id?: string;
  type: MeetingBaaSEventType;
  bot_id: string;
  meeting_url?: string;
  timestamp?: string;
  // Error info
  error_code?: string;
  error_message?: string;
  // Recording info
  recording_url?: string;
  recording_expires_at?: string;
  // Transcript info
  transcript?: {
    text: string;
    utterances: Array<{
      speaker: number;
      start: number;
      end: number;
      text: string;
      confidence?: number;
    }>;
  };
  // Additional metadata
  [key: string]: unknown;
}

type BotDeploymentStatus =
  | 'scheduled'
  | 'joining'
  | 'in_meeting'
  | 'leaving'
  | 'completed'
  | 'failed'
  | 'cancelled';

type RecordingStatus =
  | 'pending'
  | 'bot_joining'
  | 'recording'
  | 'processing'
  | 'ready'
  | 'failed';

// =============================================================================
// Helpers
// =============================================================================

function mapEventToDeploymentStatus(eventType: MeetingBaaSEventType): BotDeploymentStatus | null {
  switch (eventType) {
    case 'bot.joining':
      return 'joining';
    case 'bot.in_meeting':
      return 'in_meeting';
    case 'bot.left':
      return 'completed';
    case 'bot.failed':
      return 'failed';
    default:
      return null;
  }
}

function mapEventToRecordingStatus(eventType: MeetingBaaSEventType): RecordingStatus | null {
  switch (eventType) {
    case 'bot.joining':
      return 'bot_joining';
    case 'bot.in_meeting':
      return 'recording';
    case 'bot.left':
      return 'processing';
    case 'bot.failed':
      return 'failed';
    case 'recording.ready':
    case 'transcript.ready':
      return null; // These don't change recording status directly
    default:
      return null;
  }
}

async function verifyMeetingBaaSSignature(
  secret: string,
  rawBody: string,
  signatureHeader: string | null,
  timestampHeader: string | null
): Promise<{ ok: boolean; reason?: string }> {
  if (!secret) {
    // If no secret configured, skip verification (development mode)
    return { ok: true };
  }

  if (!signatureHeader || !timestampHeader) {
    return { ok: false, reason: 'Missing signature or timestamp header' };
  }

  // Validate timestamp to prevent replay attacks (5 minute window)
  const timestamp = parseInt(timestampHeader, 10);
  if (isNaN(timestamp)) {
    return { ok: false, reason: 'Invalid timestamp format' };
  }

  const ageMs = Math.abs(Date.now() - timestamp * 1000);
  if (ageMs > 5 * 60 * 1000) {
    return { ok: false, reason: 'Stale webhook timestamp (possible replay)' };
  }

  // Compute expected signature: HMAC-SHA256(secret, timestamp:body)
  const payload = `${timestampHeader}:${rawBody}`;
  const expectedSignature = await hmacSha256Hex(secret, payload);

  // Parse signature header (format: v1=abc123)
  const signatureParts = signatureHeader.split('=');
  if (signatureParts.length !== 2 || signatureParts[0] !== 'v1') {
    return { ok: false, reason: 'Invalid signature format' };
  }

  const providedSignature = signatureParts[1];
  if (!timingSafeEqual(expectedSignature, providedSignature)) {
    return { ok: false, reason: 'Invalid signature' };
  }

  return { ok: true };
}

async function logWebhookEvent(
  supabase: SupabaseClient,
  source: string,
  eventType: string,
  payload: unknown,
  headers: Record<string, string>
): Promise<string> {
  const eventId = crypto.randomUUID();

  const { error } = await supabase.from('webhook_events').insert({
    id: eventId,
    source,
    event_type: eventType,
    event_id: (payload as MeetingBaaSWebhookPayload)?.id || null,
    payload,
    headers,
    status: 'received',
  });

  if (error) {
    console.error('[MeetingBaaS Webhook] Failed to log event:', error);
  }

  return eventId;
}

async function updateWebhookEventStatus(
  supabase: SupabaseClient,
  eventId: string,
  status: 'processing' | 'processed' | 'failed' | 'ignored',
  errorMessage?: string
): Promise<void> {
  await supabase
    .from('webhook_events')
    .update({
      status,
      processed_at: status === 'processed' || status === 'failed' ? new Date().toISOString() : null,
      error_message: errorMessage || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId)
    .catch((err) => console.error('[MeetingBaaS Webhook] Failed to update event status:', err));
}

// =============================================================================
// Event Handlers
// =============================================================================

async function handleBotStatusEvent(
  supabase: SupabaseClient,
  payload: MeetingBaaSWebhookPayload,
  orgId: string
): Promise<{ success: boolean; error?: string }> {
  const { bot_id, type: eventType, error_code, error_message, timestamp } = payload;

  const deploymentStatus = mapEventToDeploymentStatus(eventType);
  const recordingStatus = mapEventToRecordingStatus(eventType);

  if (!deploymentStatus) {
    return { success: true }; // Event doesn't affect deployment status
  }

  addBreadcrumb(`Processing bot status: ${eventType} -> ${deploymentStatus}`, 'meetingbaas');

  // Update bot deployment
  const deploymentUpdate: Record<string, unknown> = {
    status: deploymentStatus,
    updated_at: new Date().toISOString(),
  };

  // Add status history entry
  const statusHistoryEntry = {
    status: deploymentStatus,
    timestamp: timestamp || new Date().toISOString(),
    details: error_message || null,
  };

  if (eventType === 'bot.in_meeting') {
    deploymentUpdate.actual_join_time = timestamp || new Date().toISOString();
  } else if (eventType === 'bot.left') {
    deploymentUpdate.leave_time = timestamp || new Date().toISOString();
  } else if (eventType === 'bot.failed') {
    deploymentUpdate.error_code = error_code || 'UNKNOWN';
    deploymentUpdate.error_message = error_message || 'Bot failed without error details';
  }

  // Fetch current deployment to append to status history
  const { data: deployment } = await supabase
    .from('bot_deployments')
    .select('id, recording_id, status_history')
    .eq('bot_id', bot_id)
    .eq('org_id', orgId)
    .maybeSingle();

  if (!deployment) {
    return { success: false, error: `Bot deployment not found for bot_id: ${bot_id}` };
  }

  // Append to status history
  const currentHistory = Array.isArray(deployment.status_history) ? deployment.status_history : [];
  deploymentUpdate.status_history = [...currentHistory, statusHistoryEntry];

  // Update deployment
  const { error: deploymentError } = await supabase
    .from('bot_deployments')
    .update(deploymentUpdate)
    .eq('id', deployment.id);

  if (deploymentError) {
    return { success: false, error: `Failed to update deployment: ${deploymentError.message}` };
  }

  // Update recording status if applicable
  if (recordingStatus && deployment.recording_id) {
    const recordingUpdate: Record<string, unknown> = {
      status: recordingStatus,
      updated_at: new Date().toISOString(),
    };

    if (eventType === 'bot.in_meeting') {
      recordingUpdate.meeting_start_time = timestamp || new Date().toISOString();
    } else if (eventType === 'bot.failed') {
      recordingUpdate.error_message = error_message || 'Recording failed';
    }

    await supabase
      .from('recordings')
      .update(recordingUpdate)
      .eq('id', deployment.recording_id)
      .catch((err) => console.error('[MeetingBaaS Webhook] Failed to update recording:', err));
  }

  // Send Slack notifications for key events
  if (deployment.recording_id && (eventType === 'bot.joining' || eventType === 'bot.failed')) {
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

      await fetch(`${supabaseUrl}/functions/v1/send-recording-notification`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recording_id: deployment.recording_id,
          notification_type: eventType === 'bot.joining' ? 'bot_joining' : 'bot_failed',
          error_message: eventType === 'bot.failed' ? (error_message || 'Bot failed to join the meeting') : undefined,
        }),
      });
    } catch (notifyError) {
      console.error('[MeetingBaaS Webhook] Failed to send notification:', notifyError);
      // Don't fail the webhook for notification errors
    }
  }

  return { success: true };
}

async function handleRecordingReady(
  supabase: SupabaseClient,
  payload: MeetingBaaSWebhookPayload,
  orgId: string
): Promise<{ success: boolean; error?: string }> {
  const { bot_id, recording_url, recording_expires_at } = payload;

  addBreadcrumb(`Processing recording.ready for bot: ${bot_id}`, 'meetingbaas');

  // Find the deployment and recording
  const { data: deployment } = await supabase
    .from('bot_deployments')
    .select('id, recording_id')
    .eq('bot_id', bot_id)
    .eq('org_id', orgId)
    .maybeSingle();

  if (!deployment?.recording_id) {
    return { success: false, error: `Recording not found for bot_id: ${bot_id}` };
  }

  // Store the MeetingBaaS recording URL temporarily
  // A background job will download and upload to our S3
  const { error: updateError } = await supabase
    .from('recordings')
    .update({
      meetingbaas_recording_id: bot_id,
      // Store URL in a metadata field for processing
      // The actual S3 upload happens in a background job
      updated_at: new Date().toISOString(),
    })
    .eq('id', deployment.recording_id);

  if (updateError) {
    return { success: false, error: `Failed to update recording: ${updateError.message}` };
  }

  // TODO: Trigger background job to:
  // 1. Download recording from MeetingBaaS
  // 2. Upload to our S3
  // 3. Update recording_s3_key and recording_s3_url
  // For now, we'll handle this in the transcript processing step

  return { success: true };
}

async function handleTranscriptReady(
  supabase: SupabaseClient,
  payload: MeetingBaaSWebhookPayload,
  orgId: string
): Promise<{ success: boolean; error?: string }> {
  const { bot_id, transcript, timestamp } = payload;

  addBreadcrumb(`Processing transcript.ready for bot: ${bot_id}`, 'meetingbaas');

  // Find the deployment and recording
  const { data: deployment } = await supabase
    .from('bot_deployments')
    .select('id, recording_id')
    .eq('bot_id', bot_id)
    .eq('org_id', orgId)
    .maybeSingle();

  if (!deployment?.recording_id) {
    return { success: false, error: `Recording not found for bot_id: ${bot_id}` };
  }

  // Update recording end time
  await supabase
    .from('recordings')
    .update({
      meeting_end_time: timestamp || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', deployment.recording_id);

  // Trigger the process-recording function for full analysis
  // This handles transcription, speaker identification, AI summary, etc.
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const processResponse = await fetch(`${supabaseUrl}/functions/v1/process-recording`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recording_id: deployment.recording_id,
        bot_id: bot_id,
      }),
    });

    if (!processResponse.ok) {
      const error = await processResponse.text();
      console.error('[MeetingBaaS Webhook] Process recording failed:', error);
      // Don't fail the webhook - processing can be retried
    } else {
      console.log('[MeetingBaaS Webhook] Process recording triggered for:', deployment.recording_id);
    }
  } catch (error) {
    console.error('[MeetingBaaS Webhook] Failed to trigger process-recording:', error);
    // Don't fail the webhook - the recording data is saved and can be processed later
  }

  return { success: true };
}

// =============================================================================
// Main Handler
// =============================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const webhookEventId = crypto.randomUUID();
  let supabase: SupabaseClient | null = null;

  try {
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const meetingbaasWebhookSecret = Deno.env.get('MEETINGBAAS_WEBHOOK_SECRET') ?? '';

    supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Get raw body for signature verification
    const rawBody = await req.text();

    // Extract webhook token from URL
    const url = new URL(req.url);
    const webhookToken = url.searchParams.get('token');

    if (!webhookToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing webhook token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find organization by webhook token
    // We store the webhook token in organization settings
    const { data: org } = await supabase
      .from('organizations')
      .select('id, recording_settings')
      .eq('recording_settings->>webhook_token', webhookToken)
      .maybeSingle();

    if (!org) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid webhook token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const orgId = org.id;

    // Verify signature (if secret configured)
    const signatureHeader = req.headers.get('x-meetingbaas-signature');
    const timestampHeader = req.headers.get('x-meetingbaas-timestamp');

    const verification = await verifyMeetingBaaSSignature(
      meetingbaasWebhookSecret,
      rawBody,
      signatureHeader,
      timestampHeader
    );

    if (!verification.ok) {
      return new Response(
        JSON.stringify({ success: false, error: verification.reason }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse payload
    let payload: MeetingBaaSWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!payload.type || !payload.bot_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: type, bot_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log webhook event
    const eventId = await logWebhookEvent(
      supabase,
      'meetingbaas',
      payload.type,
      payload,
      {
        'x-meetingbaas-signature': signatureHeader || '',
        'x-meetingbaas-timestamp': timestampHeader || '',
      }
    );

    await updateWebhookEventStatus(supabase, eventId, 'processing');

    addBreadcrumb(`Processing MeetingBaaS event: ${payload.type}`, 'meetingbaas', 'info', {
      bot_id: payload.bot_id,
      org_id: orgId,
    });

    // Route to appropriate handler
    let result: { success: boolean; error?: string };

    switch (payload.type) {
      case 'bot.joining':
      case 'bot.in_meeting':
      case 'bot.left':
      case 'bot.failed':
        result = await handleBotStatusEvent(supabase, payload, orgId);
        break;

      case 'recording.ready':
        result = await handleRecordingReady(supabase, payload, orgId);
        break;

      case 'transcript.ready':
        result = await handleTranscriptReady(supabase, payload, orgId);
        break;

      default:
        // Unknown event type - log but don't fail
        console.warn(`[MeetingBaaS Webhook] Unknown event type: ${payload.type}`);
        result = { success: true };
    }

    // Update webhook event status
    if (result.success) {
      await updateWebhookEventStatus(supabase, eventId, 'processed');
    } else {
      await updateWebhookEventStatus(supabase, eventId, 'failed', result.error);
    }

    return new Response(
      JSON.stringify({
        success: result.success,
        event_id: eventId,
        event_type: payload.type,
        error: result.error,
      }),
      {
        status: result.success ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[MeetingBaaS Webhook] Error:', error);

    await captureException(error, {
      tags: {
        function: 'meetingbaas-webhook',
        integration: 'meetingbaas',
      },
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Webhook processing failed',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
