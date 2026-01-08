/**
 * Generate S3 Video Thumbnail Edge Function
 *
 * Generates thumbnails for video recordings stored in S3.
 * Uses AWS Lambda + ffmpeg to extract frames from videos.
 *
 * Pipeline:
 * 1. Receive recording/meeting ID
 * 2. Get S3 key from database
 * 3. Call Lambda function to generate thumbnail
 * 4. Update recording/meeting with thumbnail URL
 *
 * Endpoint: POST /functions/v1/generate-s3-video-thumbnail
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { S3Client, PutObjectCommand, GetObjectCommand } from 'npm:@aws-sdk/client-s3@3';
import { getSignedUrl } from 'npm:@aws-sdk/s3-request-presigner@3';
import { corsHeaders, handleCorsPreflightWithResponse } from '../_shared/corsHelper.ts';

// =============================================================================
// Types
// =============================================================================

interface GenerateThumbnailRequest {
  recording_id?: string;
  meeting_id?: string;
  bot_id?: string;
  // Optional timestamp in seconds for frame extraction (default: 30)
  timestamp?: number;
}

interface ThumbnailResult {
  success: boolean;
  thumbnail_url?: string;
  thumbnail_s3_key?: string;
  error?: string;
}

// =============================================================================
// Lambda Integration
// =============================================================================

/**
 * Call AWS Lambda function to generate thumbnail using ffmpeg
 * Lambda extracts a frame from the video and uploads to S3
 */
async function callLambdaThumbnailGenerator(
  s3Key: string,
  timestampSeconds: number = 30
): Promise<ThumbnailResult> {
  const lambdaUrl = Deno.env.get('AWS_LAMBDA_THUMBNAIL_URL');
  const lambdaApiKey = Deno.env.get('AWS_LAMBDA_API_KEY');

  if (!lambdaUrl) {
    console.warn('[Thumbnail] Lambda URL not configured, using fallback');
    return { success: false, error: 'Lambda not configured' };
  }

  try {
    console.log(`[Thumbnail] Calling Lambda for ${s3Key} at ${timestampSeconds}s`);

    const response = await fetch(lambdaUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(lambdaApiKey && { 'x-api-key': lambdaApiKey }),
      },
      body: JSON.stringify({
        s3_key: s3Key,
        timestamp_seconds: timestampSeconds,
        output_format: 'jpg',
        width: 480,
        height: 270,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Lambda error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    if (result.thumbnail_s3_key) {
      console.log(`[Thumbnail] Lambda success: ${result.thumbnail_s3_key}`);
      return {
        success: true,
        thumbnail_s3_key: result.thumbnail_s3_key,
        thumbnail_url: result.thumbnail_url,
      };
    }

    return { success: false, error: result.error || 'Unknown Lambda error' };
  } catch (error) {
    console.error('[Thumbnail] Lambda call failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Lambda call failed',
    };
  }
}

/**
 * Generate a placeholder thumbnail when video extraction fails
 * Creates a simple image with the meeting title initial
 */
async function generatePlaceholderThumbnail(
  meetingTitle: string,
  orgId: string,
  recordingId: string
): Promise<ThumbnailResult> {
  const s3Client = new S3Client({
    region: Deno.env.get('AWS_REGION') || 'eu-west-2',
    credentials: {
      accessKeyId: Deno.env.get('AWS_ACCESS_KEY_ID')!,
      secretAccessKey: Deno.env.get('AWS_SECRET_ACCESS_KEY')!,
    },
  });

  const bucketName = Deno.env.get('AWS_S3_BUCKET') || 'use60-application';

  // Create a simple SVG placeholder with meeting initial
  const initial = (meetingTitle || 'M')[0].toUpperCase();
  const colors = ['#4F46E5', '#7C3AED', '#2563EB', '#0891B2', '#059669'];
  const color = colors[initial.charCodeAt(0) % colors.length];

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="480" height="270" viewBox="0 0 480 270">
      <rect width="480" height="270" fill="${color}"/>
      <text x="240" y="150" font-family="Arial, sans-serif" font-size="100" fill="white" text-anchor="middle" dominant-baseline="middle">${initial}</text>
      <text x="240" y="220" font-family="Arial, sans-serif" font-size="16" fill="rgba(255,255,255,0.7)" text-anchor="middle">60 Notetaker Recording</text>
    </svg>
  `;

  try {
    const s3Key = `meeting-thumbnails/${orgId}/${recordingId}/placeholder.svg`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
        Body: new TextEncoder().encode(svg),
        ContentType: 'image/svg+xml',
        Metadata: {
          'is-placeholder': 'true',
          'meeting-title': meetingTitle.substring(0, 100),
        },
      })
    );

    // Generate signed URL
    const signedUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
      }),
      { expiresIn: 60 * 60 * 24 * 7 } // 7 days
    );

    console.log(`[Thumbnail] Created placeholder: ${s3Key}`);

    return {
      success: true,
      thumbnail_s3_key: s3Key,
      thumbnail_url: signedUrl,
    };
  } catch (error) {
    console.error('[Thumbnail] Placeholder generation failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Placeholder generation failed',
    };
  }
}

// =============================================================================
// Main Handler
// =============================================================================

async function generateThumbnail(
  supabase: SupabaseClient,
  request: GenerateThumbnailRequest
): Promise<ThumbnailResult> {
  const { recording_id, meeting_id, bot_id, timestamp = 30 } = request;

  console.log('[Thumbnail] Starting generation:', { recording_id, meeting_id, bot_id, timestamp });

  // Get recording details
  let recording: Record<string, unknown> | null = null;
  let targetTable: 'recordings' | 'meetings' = 'recordings';
  let targetId: string | null = null;

  if (recording_id) {
    const { data, error } = await supabase
      .from('recordings')
      .select('id, org_id, user_id, recording_s3_key, meeting_title')
      .eq('id', recording_id)
      .single();

    if (error || !data) {
      return { success: false, error: 'Recording not found' };
    }

    recording = data;
    targetTable = 'recordings';
    targetId = recording_id;
  } else if (meeting_id || bot_id) {
    let query = supabase
      .from('meetings')
      .select('id, org_id, owner_user_id, recording_s3_key, title');

    if (meeting_id) {
      query = query.eq('id', meeting_id);
    } else if (bot_id) {
      query = query.eq('bot_id', bot_id);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      return { success: false, error: 'Meeting not found' };
    }

    recording = data;
    targetTable = 'meetings';
    targetId = data.id as string;
  } else {
    return { success: false, error: 'recording_id, meeting_id, or bot_id required' };
  }

  const s3Key = recording.recording_s3_key as string;
  const orgId = (recording.org_id || recording.owner_user_id) as string;
  const title = (recording.meeting_title || recording.title || 'Meeting') as string;

  if (!s3Key) {
    console.warn('[Thumbnail] No S3 key found, generating placeholder');
    return await generatePlaceholderThumbnail(title, orgId, targetId);
  }

  // Try Lambda thumbnail generation at different timestamps
  const timestamps = [timestamp, Math.max(timestamp - 20, 0), 0];

  for (const ts of timestamps) {
    const result = await callLambdaThumbnailGenerator(s3Key, ts);
    if (result.success) {
      // Update database with thumbnail
      const updateFields = {
        thumbnail_s3_key: result.thumbnail_s3_key,
        thumbnail_url: result.thumbnail_url,
        updated_at: new Date().toISOString(),
      };

      if (targetTable === 'recordings') {
        await supabase.from('recordings').update(updateFields).eq('id', targetId);
      } else {
        await supabase.from('meetings').update(updateFields).eq('id', targetId);
      }

      // Also update the linked meeting/recording if applicable
      if (targetTable === 'recordings' && bot_id) {
        await supabase
          .from('meetings')
          .update(updateFields)
          .eq('bot_id', bot_id)
          .eq('source_type', '60_notetaker');
      }

      console.log(`[Thumbnail] Successfully generated at ${ts}s`);
      return result;
    }

    console.warn(`[Thumbnail] Lambda failed at ${ts}s, trying next timestamp`);
  }

  // Fallback to placeholder
  console.warn('[Thumbnail] All Lambda attempts failed, using placeholder');
  const placeholderResult = await generatePlaceholderThumbnail(title, orgId, targetId);

  if (placeholderResult.success) {
    // Update database with placeholder
    const updateFields = {
      thumbnail_s3_key: placeholderResult.thumbnail_s3_key,
      thumbnail_url: placeholderResult.thumbnail_url,
      updated_at: new Date().toISOString(),
    };

    if (targetTable === 'recordings') {
      await supabase.from('recordings').update(updateFields).eq('id', targetId);
    } else {
      await supabase.from('meetings').update(updateFields).eq('id', targetId);
    }
  }

  return placeholderResult;
}

// =============================================================================
// Server
// =============================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightWithResponse();
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')!,
      authHeader
        ? {
            global: {
              headers: { Authorization: authHeader },
            },
          }
        : undefined
    );

    const body: GenerateThumbnailRequest = await req.json();

    const result = await generateThumbnail(supabase, body);

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Thumbnail] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
