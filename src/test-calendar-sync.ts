import { supabase } from '@/lib/supabase/clientV2';
import { calendarService } from '@/lib/services/calendarService';

async function testCalendarSync() {
  console.log('🔍 Starting Calendar Sync Test...\n');
  
  try {
    // Step 1: Check authentication
    console.log('1️⃣ Checking authentication...');
    const { data: userData, error: authError } = await supabase.auth.getUser();
    
    if (authError || !userData?.user) {
      console.error('❌ Authentication failed:', authError);
      return;
    }
    
    console.log('✅ Authenticated as:', userData.user.email);
    console.log('   User ID:', userData.user.id);
    
    // Step 2: Check Google integration
    console.log('\n2️⃣ Checking Google integration...');
    const { data: integration, error: integrationError } = await supabase
      .from('google_integrations')
      .select('*')
      .eq('user_id', userData.user.id)
      .eq('is_active', true)
      .single();
    
    if (integrationError || !integration) {
      console.error('❌ No active Google integration found');
      console.log('   Please connect your Google account first');
      return;
    }
    
    console.log('✅ Google account connected:', integration.email);
    console.log('   Token expires at:', new Date(integration.expires_at).toLocaleString());
    
    // Step 3: Test calendar sync
    console.log('\n3️⃣ Syncing calendar events...');
    const syncResult = await calendarService.syncCalendarEvents(
      'sync-incremental',
      'primary'
    );
    
    if (syncResult.error) {
      console.error('❌ Sync failed:', syncResult.error);
      return;
    }
    
    console.log('✅ Calendar sync completed!');
    console.log('   Events created:', syncResult.eventsCreated);
    console.log('   Events updated:', syncResult.eventsUpdated);
    console.log('   Last synced at:', syncResult.lastSyncedAt?.toLocaleString());
    
    // Step 4: Fetch events from database
    console.log('\n4️⃣ Fetching events from database...');
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    
    const events = await calendarService.getEventsFromDB(startDate, endDate);
    
    console.log('✅ Found', events.length, 'events in database');
    
    if (events.length > 0) {
      console.log('\n📅 Sample events:');
      events.slice(0, 3).forEach((event, index) => {
        console.log(`   ${index + 1}. ${event.title}`);
        console.log(`      Start: ${event.start.toLocaleString()}`);
        console.log(`      End: ${event.end?.toLocaleString()}`);
        if (event.location) console.log(`      Location: ${event.location}`);
        if (event.attendees?.length) console.log(`      Attendees: ${event.attendees.length}`);
      });
    }
    
    // Step 5: Test database function directly
    console.log('\n5️⃣ Testing database function directly...');
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_calendar_events_in_range', {
      p_user_id: userData.user.id,
      p_start_date: startDate.toISOString(),
      p_end_date: endDate.toISOString(),
      p_calendar_ids: null,
    });
    
    if (rpcError) {
      console.error('❌ Database function error:', rpcError);
    } else {
      console.log('✅ Database function working!');
      console.log('   Returned', rpcData?.length || 0, 'events');
    }
    
    // Step 6: Check calendar record
    console.log('\n6️⃣ Checking calendar record...');
    const { data: calendar, error: calendarError } = await supabase
      .from('calendar_calendars')
      .select('*')
      .eq('user_id', userData.user.id)
      .single();
    
    if (calendarError || !calendar) {
      console.error('❌ No calendar record found');
    } else {
      console.log('✅ Calendar record exists');
      console.log('   Calendar ID:', calendar.id);
      console.log('   Name:', calendar.name);
      console.log('   Is Primary:', calendar.is_primary);
      console.log('   Historical sync completed:', calendar.historical_sync_completed);
    }
    
    console.log('\n✨ Calendar sync test complete!');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

// Run the test
testCalendarSync();