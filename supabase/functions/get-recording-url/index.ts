/**
 * Get Recording URL Edge Function
 *
 * Generates a fresh signed URL for a recording stored in AWS S3.
 * Handles expired URLs by creating new signed URLs on-demand.
 *
 * Endpoint: GET /functions/v1/get-recording-url?recording_id=<id>
 *
 * @see supabase/migrations/20260104100000_meetingbaas_core_tables.sql
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { S3Client, GetObjectCommand } from 'npm:@aws-sdk/client-s3@3';
import { getSignedUrl } from 'npm:@aws-sdk/s3-request-presigner@3';
import {
  handleCorsPreflightRequest,
  jsonResponse,
  errorResponse,
} from '../_shared/corsHelper.ts';

// =============================================================================
// Constants
// =============================================================================

// URL expiry time: 7 days in seconds
const URL_EXPIRY_SECONDS = 60 * 60 * 24 * 7;

// =============================================================================
// Types
// =============================================================================

interface GetRecordingUrlResponse {
  success: boolean;
  url?: string;
  expires_at?: string;
  error?: string;
}

// =============================================================================
// Main Handler
// =============================================================================

serve(async (req) => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) {
    return preflightResponse;
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return errorResponse('Method not allowed', req, 405);
  }

  try {
    // Get recording_id from query params
    const url = new URL(req.url);
    const recordingId = url.searchParams.get('recording_id');

    if (!recordingId) {
      return errorResponse('recording_id is required', req, 400);
    }

    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return errorResponse('Missing authorization header', req, 401);
    }

    // Create Supabase client with user's JWT for RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verify user is authenticated
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return errorResponse('Unauthorized', req, 401);
    }

    // Fetch the recording (RLS will enforce access)
    const { data: recording, error: recordingError } = await supabase
      .from('recordings')
      .select('id, org_id, recording_s3_key, status')
      .eq('id', recordingId)
      .maybeSingle();

    if (recordingError) {
      console.error('[GetRecordingUrl] Database error:', recordingError);
      return errorResponse('Failed to fetch recording', req, 500);
    }

    if (!recording) {
      return errorResponse('Recording not found', req, 404);
    }

    // Check if recording has an S3 key
    if (!recording.recording_s3_key) {
      // Recording hasn't been processed yet or has no video
      return jsonResponse(
        {
          success: false,
          error: 'Recording file not available yet',
        } as GetRecordingUrlResponse,
        req,
        200
      );
    }

    // Initialize S3 client
    const s3Client = new S3Client({
      region: Deno.env.get('AWS_REGION') || 'eu-west-2',
      credentials: {
        accessKeyId: Deno.env.get('AWS_ACCESS_KEY_ID')!,
        secretAccessKey: Deno.env.get('AWS_SECRET_ACCESS_KEY')!,
      },
    });

    const bucketName = Deno.env.get('AWS_S3_BUCKET') || 'use60-application';

    // Generate fresh signed URL for S3
    const getCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: recording.recording_s3_key,
    });

    try {
      const signedUrl = await getSignedUrl(s3Client, getCommand, {
        expiresIn: URL_EXPIRY_SECONDS,
      });

      // Calculate expiry timestamp
      const expiresAt = new Date(Date.now() + URL_EXPIRY_SECONDS * 1000).toISOString();

      console.log('[GetRecordingUrl] Generated S3 signed URL for recording:', recordingId);

      return jsonResponse(
        {
          success: true,
          url: signedUrl,
          expires_at: expiresAt,
        } as GetRecordingUrlResponse,
        req,
        200
      );
    } catch (s3Error) {
      console.error('[GetRecordingUrl] S3 signed URL error:', s3Error);
      return errorResponse('Failed to generate download URL', req, 500);
    }
  } catch (error) {
    console.error('[GetRecordingUrl] Error:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      req,
      500
    );
  }
});
