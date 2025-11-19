#!/usr/bin/env tsx
/**
 * Test script to debug transcript fetching for a specific meeting
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

async function testTranscriptFetch(meetingId: string) {
  console.log(`\n🔍 Testing transcript fetch for meeting: ${meetingId}\n`);

  // Get meeting details
  const { data: meeting, error: meetingError } = await supabase
    .from('meetings')
    .select('id, title, fathom_recording_id, owner_user_id, transcript_text, transcript_fetch_attempts, last_transcript_fetch_at')
    .eq('id', meetingId)
    .single();

  if (meetingError || !meeting) {
    console.error('❌ Meeting not found:', meetingError?.message);
    return;
  }

  console.log('📋 Meeting Details:');
  console.log(`   Title: ${meeting.title}`);
  console.log(`   Recording ID: ${meeting.fathom_recording_id}`);
  console.log(`   Recording ID type: ${typeof meeting.fathom_recording_id}`);
  console.log(`   Has transcript: ${!!meeting.transcript_text}`);
  console.log(`   Fetch attempts: ${meeting.transcript_fetch_attempts || 0}`);
  console.log(`   Last fetch: ${meeting.last_transcript_fetch_at || 'Never'}`);

  if (!meeting.fathom_recording_id) {
    console.error('❌ No fathom_recording_id found');
    return;
  }

  // Get Fathom integration
  const { data: integration, error: integrationError } = await supabase
    .from('fathom_integrations')
    .select('id, access_token, refresh_token, token_expires_at, fathom_user_id')
    .eq('user_id', meeting.owner_user_id)
    .eq('is_active', true)
    .single();

  if (integrationError || !integration) {
    console.error('❌ Fathom integration not found:', integrationError?.message);
    return;
  }

  console.log('\n🔑 Integration Details:');
  console.log(`   Integration ID: ${integration.id}`);
  console.log(`   Fathom User ID: ${integration.fathom_user_id}`);
  console.log(`   Token expires at: ${integration.token_expires_at}`);

  // Refresh token if needed
  const now = new Date();
  const expiresAt = new Date(integration.token_expires_at);
  const bufferMs = 5 * 60 * 1000; // 5 minutes buffer

  let accessToken = integration.access_token;
  if (expiresAt.getTime() - now.getTime() <= bufferMs) {
    console.log('\n🔄 Token expired or expiring soon, refreshing...');
    
    const clientId = process.env.VITE_FATHOM_CLIENT_ID;
    const clientSecret = process.env.VITE_FATHOM_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('❌ Missing Fathom OAuth credentials');
      return;
    }

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
      console.error('❌ Token refresh failed:', errorText);
      return;
    }

    const tokenData = await tokenResponse.json();
    accessToken = tokenData.access_token;
    console.log('✅ Token refreshed');
  } else {
    console.log('✅ Token is still valid');
  }

  // Test API call
  const recordingId = String(meeting.fathom_recording_id);
  const url = `https://api.fathom.ai/external/v1/recordings/${recordingId}/transcript`;
  
  console.log(`\n🌐 Testing API call:`);
  console.log(`   URL: ${url}`);
  console.log(`   Recording ID: ${recordingId}`);

  // Try X-Api-Key first
  console.log('\n📡 Attempting with X-Api-Key header...');
  let response = await fetch(url, {
    headers: {
      'X-Api-Key': accessToken,
      'Content-Type': 'application/json',
    },
  });

  console.log(`   Status: ${response.status} ${response.statusText}`);

  if (response.status === 401) {
    console.log('\n📡 Attempting with Bearer token...');
    response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    console.log(`   Status: ${response.status} ${response.statusText}`);
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`\n❌ API Error:`);
    console.error(`   Status: ${response.status}`);
    console.error(`   Response: ${errorText.substring(0, 500)}`);
    
    // Try to get recording details to verify it exists
    console.log('\n🔍 Verifying recording exists...');
    const recordingUrl = `https://api.fathom.ai/external/v1/recordings/${recordingId}`;
    const recordingResponse = await fetch(recordingUrl, {
      headers: {
        'X-Api-Key': accessToken,
        'Content-Type': 'application/json',
      },
    });
    
    if (recordingResponse.status === 401) {
      const recordingResponse2 = await fetch(recordingUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      console.log(`   Recording details status: ${recordingResponse2.status}`);
      if (recordingResponse2.ok) {
        const recordingData = await recordingResponse2.json();
        console.log(`   Recording title: ${recordingData.title || 'N/A'}`);
        console.log(`   Recording exists: ✅`);
      }
    } else if (recordingResponse.ok) {
      const recordingData = await recordingResponse.json();
      console.log(`   Recording title: ${recordingData.title || 'N/A'}`);
      console.log(`   Recording exists: ✅`);
    } else {
      console.log(`   Recording details status: ${recordingResponse.status}`);
    }
    
    return;
  }

  const data = await response.json();
  console.log('\n✅ Success! Transcript data received:');
  console.log(`   Data type: ${typeof data}`);
  console.log(`   Has transcript property: ${!!data.transcript}`);
  
  if (Array.isArray(data.transcript)) {
    console.log(`   Transcript format: Array with ${data.transcript.length} segments`);
    const sample = data.transcript.slice(0, 2);
    console.log(`   Sample segments:`, JSON.stringify(sample, null, 2));
  } else if (typeof data.transcript === 'string') {
    console.log(`   Transcript format: String (${data.transcript.length} characters)`);
    console.log(`   Preview: ${data.transcript.substring(0, 200)}...`);
  } else {
    console.log(`   Unexpected format:`, JSON.stringify(data, null, 2).substring(0, 500));
  }
}

// Get meeting ID from command line or use the one from the error
const meetingId = process.argv[2] || '05891abb-319f-4117-bdca-d26f7db8a35c';

testTranscriptFetch(meetingId).catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});


