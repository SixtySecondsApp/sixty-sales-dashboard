#!/usr/bin/env tsx
/**
 * Backfill script to fetch missing transcripts for Fathom meetings
 * 
 * Usage:
 *   tsx scripts/backfill-fathom-transcripts.ts [--limit N] [--days N] [--dry-run]
 * 
 * Options:
 *   --limit N      Process only N meetings (default: all)
 *   --days N       Only process meetings from last N days (default: all)
 *   --dry-run      Show what would be processed without making changes
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials');
  console.error('   Required: VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

interface CliOptions {
  limit?: number;
  days?: number;
  dryRun?: boolean;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--limit':
      case '-l': {
        const value = args[i + 1];
        if (!value) throw new Error(`Missing value for ${arg}`);
        options.limit = parseInt(value, 10);
        if (isNaN(options.limit)) throw new Error(`Invalid number: ${value}`);
        i++;
        break;
      }
      case '--days':
      case '-d': {
        const value = args[i + 1];
        if (!value) throw new Error(`Missing value for ${arg}`);
        options.days = parseInt(value, 10);
        if (isNaN(options.days)) throw new Error(`Invalid number: ${value}`);
        i++;
        break;
      }
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
      case '-h':
        console.log(`
Usage: tsx scripts/backfill-fathom-transcripts.ts [options]

Options:
  --limit, -l N      Process only N meetings (default: all)
  --days, -d N       Only process meetings from last N days (default: all)
  --dry-run          Show what would be processed without making changes
  --help, -h         Show this help message
        `);
        process.exit(0);
        break;
      default:
        console.warn(`⚠️  Ignoring unknown option: "${arg}"`);
        break;
    }
  }

  return options;
}

/**
 * Fetch transcript from Fathom API using dual authentication
 */
async function fetchTranscriptFromFathom(
  accessToken: string,
  recordingId: string
): Promise<string | null> {
  try {
    const url = `https://api.fathom.ai/external/v1/recordings/${recordingId}/transcript`;
    
    // Try X-Api-Key first (preferred for Fathom API)
    let response = await fetch(url, {
      headers: {
        'X-Api-Key': accessToken,
        'Content-Type': 'application/json',
      },
    });

    // If X-Api-Key fails with 401, try Bearer (for OAuth tokens)
    if (response.status === 401) {
      response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
    }

    if (response.status === 404) {
      // Transcript not yet available - Fathom still processing
      return null;
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 200)}`);
    }

    const data = await response.json();

    // Handle array format (most common)
    if (Array.isArray(data.transcript)) {
      const lines = data.transcript.map((segment: any) => {
        const speaker = segment?.speaker?.display_name ? `${segment.speaker.display_name}: ` : '';
        const text = segment?.text || '';
        return `${speaker}${text}`.trim();
      });
      return lines.join('\n');
    }

    // Handle string format (fallback)
    if (typeof data.transcript === 'string') {
      return data.transcript;
    }

    // If data itself is a string
    if (typeof data === 'string') {
      return data;
    }

    console.error(`❌ Unexpected transcript format for recording ${recordingId}`);
    return null;
  } catch (error) {
    console.error(`❌ Error fetching transcript for ${recordingId}:`, error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * Refresh OAuth access token if expired
 */
async function refreshAccessToken(integration: any): Promise<string> {
  const now = new Date();
  const expiresAt = new Date(integration.token_expires_at);

  // Check if token is expired or will expire within 5 minutes
  const bufferMs = 5 * 60 * 1000; // 5 minutes buffer
  if (expiresAt.getTime() - now.getTime() > bufferMs) {
    // Token is still valid
    return integration.access_token;
  }

  console.log(`🔄 Access token expired or expiring soon, refreshing...`);

  const clientId = process.env.VITE_FATHOM_CLIENT_ID;
  const clientSecret = process.env.VITE_FATHOM_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing Fathom OAuth configuration for token refresh');
  }

  // Exchange refresh token for new access token
  const tokenParams = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: integration.refresh_token,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const tokenResponse = await fetch('https://fathom.video/external/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: tokenParams.toString(),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Token refresh failed: ${errorText}`);
  }

  const tokenData = await tokenResponse.json();

  // Calculate new token expiry
  const expiresIn = tokenData.expires_in || 3600; // Default 1 hour
  const newTokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  // Update tokens in database
  const { error: updateError } = await supabase
    .from('fathom_integrations')
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || integration.refresh_token,
      token_expires_at: newTokenExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', integration.id);

  if (updateError) {
    throw new Error(`Failed to update refreshed tokens: ${updateError.message}`);
  }

  return tokenData.access_token;
}

async function main() {
  const options = parseArgs();

  console.log(`
╔════════════════════════════════════════════════════════════════
║ 📄 Fathom Transcript Backfill Script
╚════════════════════════════════════════════════════════════════
  `);

  if (options.dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  // Build query for meetings without transcripts
  let query = supabase
    .from('meetings')
    .select('id, title, fathom_recording_id, owner_user_id, meeting_start, transcript_text')
    .is('transcript_text', null)
    .not('fathom_recording_id', 'is', null)
    .order('meeting_start', { ascending: false });

  // Add date filter if specified
  if (options.days) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - options.days);
    query = query.gte('meeting_start', cutoffDate.toISOString());
    console.log(`📅 Filtering meetings from last ${options.days} days`);
  }

  // Add limit if specified
  if (options.limit) {
    query = query.limit(options.limit);
    console.log(`🔢 Limiting to ${options.limit} meetings\n`);
  }

  const { data: meetings, error: meetingsError } = await query;

  if (meetingsError) {
    console.error('❌ Error fetching meetings:', meetingsError.message);
    process.exit(1);
  }

  if (!meetings || meetings.length === 0) {
    console.log('✅ No meetings found without transcripts');
    process.exit(0);
  }

  console.log(`📋 Found ${meetings.length} meeting(s) without transcripts\n`);

  // Group meetings by owner to batch integration lookups
  const meetingsByOwner = new Map<string, typeof meetings>();
  for (const meeting of meetings) {
    if (!meeting.owner_user_id) continue;
    const ownerId = meeting.owner_user_id;
    if (!meetingsByOwner.has(ownerId)) {
      meetingsByOwner.set(ownerId, []);
    }
    meetingsByOwner.get(ownerId)!.push(meeting);
  }

  console.log(`👥 Processing meetings for ${meetingsByOwner.size} user(s)\n`);

  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  // Process each owner's meetings
  for (const [ownerId, ownerMeetings] of meetingsByOwner) {
    console.log(`\n👤 Processing ${ownerMeetings.length} meeting(s) for user ${ownerId}...`);

    // Get Fathom integration for this owner
    const { data: integration, error: integrationError } = await supabase
      .from('fathom_integrations')
      .select('id, access_token, refresh_token, token_expires_at')
      .eq('user_id', ownerId)
      .eq('is_active', true)
      .single();

    if (integrationError || !integration) {
      console.error(`   ❌ No active Fathom integration found for user ${ownerId}`);
      skippedCount += ownerMeetings.length;
      continue;
    }

    // Refresh token if needed
    let accessToken = integration.access_token;
    try {
      accessToken = await refreshAccessToken(integration);
    } catch (error) {
      console.error(`   ⚠️  Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error(`   ⚠️  Continuing with existing token...`);
    }

    // Process each meeting
    for (const meeting of ownerMeetings) {
      if (!meeting.fathom_recording_id) {
        console.log(`   ⏭️  Skipping ${meeting.title || meeting.id} - no recording ID`);
        skippedCount++;
        continue;
      }

      console.log(`   📄 Fetching transcript for: ${meeting.title || meeting.id} (${meeting.fathom_recording_id})`);

      if (options.dryRun) {
        console.log(`      [DRY RUN] Would fetch and update transcript`);
        continue;
      }

      // Fetch transcript
      const transcript = await fetchTranscriptFromFathom(accessToken, meeting.fathom_recording_id);

      if (!transcript) {
        console.log(`      ⏭️  Transcript not yet available (404 or still processing)`);
        skippedCount++;
        continue;
      }

      // Update meeting with transcript
      const { error: updateError } = await supabase
        .from('meetings')
        .update({
          transcript_text: transcript,
          updated_at: new Date().toISOString(),
        })
        .eq('id', meeting.id);

      if (updateError) {
        console.error(`      ❌ Failed to update meeting: ${updateError.message}`);
        errorCount++;
      } else {
        console.log(`      ✅ Transcript saved (${transcript.length} characters)`);
        successCount++;
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(`
╔════════════════════════════════════════════════════════════════
║ 📊 Backfill Summary
╚════════════════════════════════════════════════════════════════
║ ✅ Successfully processed: ${successCount}
║ ⏭️  Skipped (not available): ${skippedCount}
║ ❌ Errors: ${errorCount}
║ 📋 Total meetings checked: ${meetings.length}
╚════════════════════════════════════════════════════════════════
  `);
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});






