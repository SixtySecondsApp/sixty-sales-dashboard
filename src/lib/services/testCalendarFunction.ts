import { supabase } from '@/lib/supabase/clientV2';

export async function testCalendarFunction() {
  try {
    // Get the current user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      console.error('User not authenticated:', userError);
      return;
    }

    console.log('Testing calendar function for user:', userData.user.id);

    // First, let's check if the function exists by trying to call it
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 2, 0);

    console.log('Date range:', {
      start: startDate.toISOString(),
      end: endDate.toISOString()
    });

    // Try calling the RPC function
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_calendar_events_in_range', {
      p_user_id: userData.user.id,
      p_start_date: startDate.toISOString(),
      p_end_date: endDate.toISOString(),
      p_calendar_ids: null,
    });

    if (rpcError) {
      console.error('RPC function error:', rpcError);
      
      // If function doesn't exist, try direct query instead
      console.log('Falling back to direct query...');
      
      const { data: directData, error: directError } = await supabase
        .from('calendar_events')
        .select(`
          id,
          external_id,
          calendar_id,
          title,
          description,
          location,
          start_time,
          end_time,
          all_day,
          status,
          meeting_url,
          attendees_count,
          contact_id,
          color,
          sync_status,
          creator_email,
          organizer_email,
          html_link,
          raw_data
        `)
        .eq('user_id', userData.user.id)
        .gte('start_time', startDate.toISOString())
        .lte('end_time', endDate.toISOString())
        .order('start_time', { ascending: true });

      if (directError) {
        console.error('Direct query error:', directError);
        return [];
      }

      console.log('Direct query results:', directData?.length || 0, 'events');
      return directData || [];
    }

    console.log('RPC function results:', rpcData?.length || 0, 'events');
    return rpcData || [];
  } catch (error) {
    console.error('Test failed:', error);
    return [];
  }
}

// Run the test
testCalendarFunction().then(results => {
  console.log('Test complete. Found', results.length, 'events');
  if (results.length > 0) {
    console.log('Sample event:', results[0]);
  }
});