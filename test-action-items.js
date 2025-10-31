// Test script to check action items in Fathom API response
// Run with: node test-action-items.js

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

async function testActionItems() {
  console.log('🔍 Checking Fathom integration and action items...\n');

  // Get integration
  const integrationRes = await fetch(`${SUPABASE_URL}/rest/v1/fathom_integrations?select=*&limit=1`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    }
  });

  const integrations = await integrationRes.json();

  if (!integrations || integrations.length === 0) {
    console.log('❌ No Fathom integration found');
    return;
  }

  const integration = integrations[0];
  console.log(`✅ Found integration for user: ${integration.user_id}`);
  const tokenPreview = integration.access_token ? integration.access_token.substring(0, 20) : 'none';
  console.log(`   Access token: ${tokenPreview}...`);

  // Fetch meetings from Fathom API
  console.log('\n📡 Fetching meetings from Fathom API...');
  const fathomRes = await fetch('https://api.fathom.ai/external/v1/meetings?limit=3', {
    headers: {
      'Authorization': `Bearer ${integration.access_token}`,
      'Content-Type': 'application/json',
    }
  });

  if (!fathomRes.ok) {
    console.log(`❌ Fathom API error: ${fathomRes.status}`);
    const errorText = await fathomRes.text();
    console.log(`   Error: ${errorText}`);
    return;
  }

  const fathomData = await fathomRes.json();
  console.log(`✅ Got response from Fathom`);

  // Check structure
  const meetings = fathomData.items || fathomData.meetings || fathomData;
  console.log(`   Found ${meetings.length} meetings`);

  // Check each meeting for action_items
  meetings.forEach((meeting, idx) => {
    console.log(`\n📅 Meeting ${idx + 1}: ${meeting.title || meeting.meeting_title}`);
    console.log(`   Recording ID: ${meeting.recording_id}`);
    console.log(`   Action Items Field: ${typeof meeting.action_items}`);

    if (meeting.action_items === null) {
      console.log(`   ⚠️  Action items: null (not yet processed by Fathom)`);
    } else if (Array.isArray(meeting.action_items)) {
      console.log(`   ✅ Action items: array with ${meeting.action_items.length} items`);

      if (meeting.action_items.length > 0) {
        console.log(`   📋 Sample action item:`);
        console.log(`      ${JSON.stringify(meeting.action_items[0], null, 6)}`);
      }
    } else {
      console.log(`   ❓ Unexpected format: ${JSON.stringify(meeting.action_items)}`);
    }
  });

  // Check database for action items
  console.log('\n\n💾 Checking database for action items...');
  const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/meeting_action_items?select=*&limit=10&order=created_at.desc`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    }
  });

  const dbActionItems = await dbRes.json();
  console.log(`   Found ${dbActionItems.length} action items in database`);

  if (dbActionItems.length > 0) {
    console.log(`   Latest action item: ${dbActionItems[0].title}`);
  }
}

testActionItems().catch(err => {
  console.error('❌ Error:', err);
});
