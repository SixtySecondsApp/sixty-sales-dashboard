import { supabase } from '@/lib/supabase/clientV2';
import { calendarService } from '@/lib/services/calendarService';

async function testCalendarSync() {
  try {
    // Step 1: Check authentication
    const { data: userData, error: authError } = await supabase.auth.getUser();
    
    if (authError || !userData?.user) {
      return;
    }
    // Step 2: Check Google integration
    const { data: integration, error: integrationError } = await supabase
      .from('google_integrations')
      .select('*')
      .eq('user_id', userData.user.id)
      .eq('is_active', true)
      .single();
    
    if (integrationError || !integration) {
      return;
    }
    // Step 3: Test calendar sync
    const syncResult = await calendarService.syncCalendarEvents(
      'sync-incremental',
      'primary'
    );
    
    if (syncResult.error) {
      return;
    }
    // Step 4: Fetch events from database
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    
    const events = await calendarService.getEventsFromDB(startDate, endDate);
    if (events.length > 0) {
      events.slice(0, 3).forEach((event, index) => {
        if (event.location) {}
        if (event.attendees?.length) {}
      });
    }
    
    // Step 5: Test database function directly
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_calendar_events_in_range', {
      p_user_id: userData.user.id,
      p_start_date: startDate.toISOString(),
      p_end_date: endDate.toISOString(),
      p_calendar_ids: null,
    });
    
    if (rpcError) {
    } else {
    }
    
    // Step 6: Check calendar record
    const { data: calendar, error: calendarError } = await supabase
      .from('calendar_calendars')
      .select('*')
      .eq('user_id', userData.user.id)
      .single();
    
    if (calendarError || !calendar) {
    } else {
    }
  } catch (error) {
  }
}

// Run the test
testCalendarSync();