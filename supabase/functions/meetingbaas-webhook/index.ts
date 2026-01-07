/**
 * MeetingBaaS Webhook Handler
 *
 * Processes webhook events from MeetingBaaS for white-labelled meeting recording.
 * Events include: bot lifecycle, recording ready, transcript ready
 *
 * Organization identification (in priority order):
 * 1. URL token: /meetingbaas-webhook?token={org_webhook_token} (legacy)
 * 2. Bot ID lookup: Find org from bot_deployments table using payload.bot_id
 *
 * Since MeetingBaaS webhooks are account-level (not per-org), we primarily
 * use bot_id lookup to identify the organization. Token-based lookup is
 * kept for backward compatibility.
 */

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { S3Client, PutObjectCommand, HeadObjectCommand } from 'npm:@aws-sdk/client-s3@3';
import { getSignedUrl } from 'npm:@aws-sdk/s3-request-presigner@3';
import { handleCorsPreflightRequest, getCorsHeaders, jsonResponse, errorResponse } from '../_shared/corsHelper.ts';
import { captureException, addBreadcrumb } from '../_shared/sentryEdge.ts';
import { hmacSha256Hex, timingSafeEqual } from '../_shared/use60Signing.ts';

// =============================================================================
// Types
// =============================================================================

type MeetingBaaSEventType =
  // Bot lifecycle events
  | 'bot.joining'
  | 'bot.in_meeting'
  | 'bot.left'
  | 'bot.failed'
  | 'bot.status_change'
  | 'bot.completed'
  // Recording/transcript events
  | 'recording.ready'
  | 'transcript.ready'
  // Calendar events (from MeetingBaaS calendar sync)
  | 'calendar.created'
  | 'calendar.updated'
  | 'calendar.deleted'
  | 'calendar.error'
  | 'calendar.sync_complete'
  | 'calendar_event.created'
  | 'calendar_event.updated'
  | 'calendar_event.deleted';

type MeetingBaaSStatusCode =
  | 'joining_call'
  | 'in_waiting_room'
  | 'in_call_not_recording'
  | 'in_call_recording'
  | 'call_ended'
  | 'recording_done'
  | 'error';

// Raw webhook payload from MeetingBaaS (actual format)
interface MeetingBaaSRawWebhookPayload {
  event: MeetingBaaSEventType;
  data: {
    bot_id: string;
    // For bot.status_change
    status?: {
      code: MeetingBaaSStatusCode;
    };
    // For bot.completed
    audio?: string;
    video?: string;
    duration_seconds?: number;
    joined_at?: string;
    exited_at?: string;
    // For recording/transcript
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
    recording_url?: string;
    // Calendar events
    calendar_id?: string;
    // Error info
    error_code?: string;
    error_message?: string;
    // Additional metadata
    [key: string]: unknown;
  };
}

// Legacy flat payload format (for backward compatibility)
interface MeetingBaaSWebhookPayload {
  id?: string;
  type: MeetingBaaSEventType;
  bot_id: string;
  calendar_id?: string; // For calendar-related events
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

function mapStatusCodeToDeploymentStatus(statusCode: string): BotDeploymentStatus | null {
  switch (statusCode) {
    case 'joining_call':
    case 'in_waiting_room':
      return 'joining';
    case 'in_call_not_recording':
    case 'in_call_recording':
      return 'in_meeting';
    case 'call_ended':
      return 'leaving';
    case 'recording_done':
      return 'completed';
    case 'error':
      return 'failed';
    default:
      return null;
  }
}

function mapStatusCodeToRecordingStatus(statusCode: string): RecordingStatus | null {
  switch (statusCode) {
    case 'joining_call':
    case 'in_waiting_room':
      return 'bot_joining';
    case 'in_call_not_recording':
      return 'bot_joining';
    case 'in_call_recording':
      return 'recording';
    case 'call_ended':
    case 'recording_done':
      return 'processing';
    case 'error':
      return 'failed';
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
// S3 Upload Helper
// =============================================================================

import { S3Client, PutObjectCommand, HeadObjectCommand } from 'npm:@aws-sdk/client-s3@3';
import { getSignedUrl } from 'npm:@aws-sdk/s3-request-presigner@3';

interface UploadRecordingResult {
  success: boolean;
  storageUrl?: string;
  storagePath?: string;
  error?: string;
}

/**
 * Download recording from MeetingBaaS and upload to AWS S3
 * Bucket: use60-application (eu-west-2)
 * Folder structure: /meeting-recordings/{org_id}/{user_id}/{recording_id}/recording.mp4
 */
async function uploadRecordingToS3(
  recordingUrl: string,
  orgId: string,
  userId: string,
  recordingId: string
): Promise<UploadRecordingResult> {
  console.log('[MeetingBaaS Webhook] Downloading recording from MeetingBaaS...');

  try {
    // Initialize S3 client
    const s3Client = new S3Client({
      region: Deno.env.get('AWS_REGION') || 'eu-west-2',
      credentials: {
        accessKeyId: Deno.env.get('AWS_ACCESS_KEY_ID')!,
        secretAccessKey: Deno.env.get('AWS_SECRET_ACCESS_KEY')!,
      },
    });

    const bucketName = Deno.env.get('AWS_S3_BUCKET') || 'use60-application';

    // Download the recording
    const response = await fetch(recordingUrl);
    if (!response.ok) {
      throw new Error(`Failed to download recording: ${response.status}`);
    }

    // Get content type and determine file extension
    const contentType = response.headers.get('content-type') || 'video/mp4';
    let fileExtension = 'mp4';
    if (contentType.includes('webm')) {
      fileExtension = 'webm';
    } else if (contentType.includes('audio')) {
      fileExtension = contentType.includes('wav') ? 'wav' : 'mp3';
    }

    // Create S3 key: meeting-recordings/{org_id}/{user_id}/{recording_id}/recording.{ext}
    const s3Key = `meeting-recordings/${orgId}/${userId}/${recordingId}/recording.${fileExtension}`;

    console.log(`[MeetingBaaS Webhook] Uploading to S3: s3://${bucketName}/${s3Key}`);

    // Get the recording data as array buffer
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Upload to S3
    const putCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: uint8Array,
      ContentType: contentType,
      Metadata: {
        'org-id': orgId,
        'user-id': userId,
        'recording-id': recordingId,
      },
    });

    await s3Client.send(putCommand);

    // Generate a signed URL (7 days expiry)
    const getCommand = new HeadObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
    });

    const signedUrl = await getSignedUrl(s3Client, getCommand, {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
    });

    console.log(`[MeetingBaaS Webhook] S3 upload successful: ${s3Key}`);

    return {
      success: true,
      storageUrl: signedUrl,
      storagePath: s3Key,
    };
  } catch (error) {
    console.error('[MeetingBaaS Webhook] S3 upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
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
  // Handle CORS preflight first (before any async operations)
  if (req.method === 'OPTIONS') {
    try {
      const preflightResponse = handleCorsPreflightRequest(req);
      if (preflightResponse) {
        return preflightResponse;
      }
      // Fallback
      return new Response('ok', {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'authorization, content-type',
        },
      });
    } catch (error) {
      console.error('[meetingbaas-webhook] OPTIONS handler error:', error);
      return new Response('ok', {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'authorization, content-type',
        },
      });
    }
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

    // Verify signature first (if secret configured) - MeetingBaaS uses SVIX
    const signatureHeader = req.headers.get('svix-signature') || req.headers.get('x-meetingbaas-signature');
    const timestampHeader = req.headers.get('svix-timestamp') || req.headers.get('x-meetingbaas-timestamp');
    const svixId = req.headers.get('svix-id');

    const verification = await verifyMeetingBaaSSignature(
      meetingbaasWebhookSecret,
      rawBody,
      signatureHeader,
      timestampHeader
    );

    if (!verification.ok) {
      console.warn('[MeetingBaaS Webhook] Signature verification failed:', verification.reason);
      // Only fail if we have a secret configured - otherwise allow for development
      if (meetingbaasWebhookSecret) {
        return errorResponse(verification.reason || 'Invalid signature', req, 401);
      }
    }

    // Parse payload early to get bot_id for org lookup
    let payload: MeetingBaaSWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return errorResponse('Invalid JSON payload', req, 400);
    }

    if (!payload.type || !payload.bot_id) {
      return errorResponse('Missing required fields: type, bot_id', req, 400);
    }

    // Find organization - try multiple methods
    let orgId: string | null = null;

    // Method 1: URL token (legacy, for backward compatibility)
    const url = new URL(req.url);
    const webhookToken = url.searchParams.get('token');

    if (webhookToken && webhookToken !== '{ORG_TOKEN}') {
      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('recording_settings->>webhook_token', webhookToken)
        .maybeSingle();

      if (org) {
        orgId = org.id;
        console.log(`[MeetingBaaS Webhook] Org identified via token: ${orgId}`);
      }
    }

    // Method 2: Look up org from bot_id via bot_deployments
    if (!orgId) {
      const { data: deployment } = await supabase
        .from('bot_deployments')
        .select('org_id')
        .eq('bot_id', payload.bot_id)
        .maybeSingle();

      if (deployment?.org_id) {
        orgId = deployment.org_id;
        console.log(`[MeetingBaaS Webhook] Org identified via bot_id: ${orgId}`);
      }
    }

    // Method 3: Look up org from calendar_id if present in payload
    if (!orgId && payload.calendar_id) {
      const { data: calendar } = await supabase
        .from('meetingbaas_calendars')
        .select('org_id')
        .eq('meetingbaas_calendar_id', payload.calendar_id)
        .maybeSingle();

      if (calendar?.org_id) {
        orgId = calendar.org_id;
        console.log(`[MeetingBaaS Webhook] Org identified via calendar_id: ${orgId}`);
      }
    }

    if (!orgId) {
      console.error('[MeetingBaaS Webhook] Could not identify organization', {
        bot_id: payload.bot_id,
        calendar_id: payload.calendar_id,
        token_provided: !!webhookToken,
        token_value: webhookToken === '{ORG_TOKEN}' ? 'PLACEHOLDER_NOT_REPLACED' : webhookToken?.substring(0, 10) + '...',
      });
      return jsonResponse({
        success: false,
        error: 'Could not identify organization for this webhook',
        hint: 'Ensure bot_deployments or meetingbaas_calendars has the org_id set. If token is {ORG_TOKEN}, it was not replaced with actual token.',
        bot_id: payload.bot_id,
        calendar_id: payload.calendar_id,
      }, req, 401);
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

    return jsonResponse({
      success: result.success,
      event_id: eventId,
      event_type: payload.type,
      error: result.error,
    }, req, result.success ? 200 : 500);
  } catch (error) {
    console.error('[MeetingBaaS Webhook] Error:', error);

    await captureException(error, {
      tags: {
        function: 'meetingbaas-webhook',
        integration: 'meetingbaas',
      },
    });

    return errorResponse(
      error instanceof Error ? error.message : 'Webhook processing failed',
      req,
      500
    );
  }
});
