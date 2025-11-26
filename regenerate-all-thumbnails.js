#!/usr/bin/env node

/**
 * One-time script to regenerate thumbnails for all existing meetings
 * Uses the new V2 thumbnail generation function with your custom API
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   VITE_SUPABASE_URL');
  console.error('   VITE_SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function regenerateAllThumbnails() {
  console.log('🚀 Starting thumbnail regeneration for all meetings...\n');

  try {
    // Fetch all meetings with Fathom data
    console.log('📊 Fetching meetings from database...');
    const { data: meetings, error: fetchError } = await supabase
      .from('meetings')
      .select('id, title, share_url, fathom_recording_id, thumbnail_url')
      .or('share_url.not.is.null,fathom_recording_id.not.is.null')
      .order('created_at', { ascending: false });

    if (fetchError) {
      throw new Error(`Failed to fetch meetings: ${fetchError.message}`);
    }

    if (!meetings || meetings.length === 0) {
      console.log('ℹ️  No meetings found with Fathom data');
      return;
    }

    console.log(`✅ Found ${meetings.length} meetings\n`);
    console.log('═'.repeat(80));

    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;

    // Process each meeting
    for (let i = 0; i < meetings.length; i++) {
      const meeting = meetings[i];
      const progress = `[${i + 1}/${meetings.length}]`;

      console.log(`\n${progress} Processing: ${meeting.title || 'Untitled'}`);
      console.log(`   ID: ${meeting.id}`);
      console.log(`   Share URL: ${meeting.share_url || 'N/A'}`);
      console.log(`   Current thumbnail: ${meeting.thumbnail_url ? '✓ exists' : '✗ missing'}`);

      // Skip if no share URL
      if (!meeting.share_url) {
        console.log(`   ⏭️  Skipping - no share_url`);
        skippedCount++;
        continue;
      }

      // Build embed URL
      let embedUrl = null;
      if (meeting.share_url) {
        try {
          const url = new URL(meeting.share_url);
          const token = url.pathname.split('/').filter(Boolean).pop();
          if (token) {
            embedUrl = `https://fathom.video/embed/${token}`;
          }
        } catch (e) {
          console.log(`   ⚠️  Failed to parse share URL`);
        }
      }

      if (!embedUrl && meeting.fathom_recording_id) {
        embedUrl = `https://app.fathom.video/recording/${meeting.fathom_recording_id}`;
      }

      if (!embedUrl) {
        console.log(`   ⏭️  Skipping - cannot construct embed URL`);
        skippedCount++;
        continue;
      }

      // Call thumbnail generation function
      try {
        console.log(`   📸 Generating thumbnail...`);
        
        const { data, error } = await supabase.functions.invoke('generate-video-thumbnail-v2', {
          body: {
            recording_id: meeting.fathom_recording_id || meeting.id,
            share_url: meeting.share_url,
            fathom_embed_url: embedUrl,
            meeting_id: meeting.id,
            timestamp_seconds: 30
          }
        });

        if (error) {
          throw new Error(error.message);
        }

        if (data?.success && data?.thumbnail_url) {
          console.log(`   ✅ Success!`);
          console.log(`   📷 Thumbnail: ${data.thumbnail_url}`);
          console.log(`   🔧 Method: ${data.method_used}`);
          successCount++;
        } else {
          console.log(`   ❌ Failed - no thumbnail URL returned`);
          failCount++;
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        failCount++;
      }

      // Small delay to avoid overwhelming the API
      if (i < meetings.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Summary
    console.log('\n' + '═'.repeat(80));
    console.log('\n📊 Summary:');
    console.log(`   Total meetings: ${meetings.length}`);
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log(`   ⏭️  Skipped: ${skippedCount}`);
    console.log(`\n🎉 Thumbnail regeneration complete!\n`);

    // Show sample of updated thumbnails
    if (successCount > 0) {
      console.log('Verifying updated thumbnails in database...');
      const { data: updatedMeetings, error: verifyError } = await supabase
        .from('meetings')
        .select('id, title, thumbnail_url')
        .not('thumbnail_url', 'is', null)
        .like('thumbnail_url', '%fathom-thumbnail.s3%')
        .limit(5);

      if (!verifyError && updatedMeetings && updatedMeetings.length > 0) {
        console.log(`\n✅ Sample of ${updatedMeetings.length} updated thumbnails:`);
        updatedMeetings.forEach(m => {
          console.log(`   • ${m.title || 'Untitled'}`);
          console.log(`     ${m.thumbnail_url}`);
        });
      }
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run the script
console.log('═'.repeat(80));
console.log('   Thumbnail Regeneration Script');
console.log('   Using V2 function with custom API');
console.log('═'.repeat(80) + '\n');

regenerateAllThumbnails()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });


