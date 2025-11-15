import { supabase } from '@/lib/supabase/clientV2';
import { calendarService } from '@/lib/services/calendarService';

interface TestResult {
  step: string;
  success: boolean;
  message: string;
  data?: any;
}

async function runComprehensiveCalendarTest(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  try {
    // ============================================
    // STEP 1: Authentication & Setup
    // ============================================
    const { data: userData, error: authError } = await supabase.auth.getUser();
    
    if (authError || !userData?.user) {
      results.push({
        step: 'Authentication',
        success: false,
        message: 'User not authenticated',
        data: authError
      });
      return results;
    }
    
    results.push({
      step: 'Authentication',
      success: true,
      message: `Authenticated as ${userData.user.email}`,
      data: { userId: userData.user.id, email: userData.user.email }
    });
    // ============================================
    // STEP 2: Check Google Integration
    // ============================================
    const { data: integration, error: integrationError } = await supabase
      .from('google_integrations')
      .select('*')
      .eq('user_id', userData.user.id)
      .eq('is_active', true)
      .single();
    
    if (integrationError || !integration) {
      results.push({
        step: 'Google Integration',
        success: false,
        message: 'No active Google integration found',
        data: integrationError
      });
      return results;
    }
    
    results.push({
      step: 'Google Integration',
      success: true,
      message: `Connected to ${integration.email}`,
      data: { 
        email: integration.email,
        expiresAt: integration.expires_at,
        hasRefreshToken: !!integration.refresh_token
      }
    });
    // ============================================
    // STEP 3: Clear existing events (for clean test)
    // ============================================
    const { error: clearError } = await supabase
      .from('calendar_events')
      .delete()
      .eq('user_id', userData.user.id)
      .eq('sync_status', 'synced');
    
    if (clearError) {
    } else {
    }
    
    // ============================================
    // STEP 4: Run Calendar Sync
    // ============================================
    const syncResult = await calendarService.syncCalendarEvents(
      'sync-incremental',
      'primary'
    );
    
    if (syncResult.error) {
      results.push({
        step: 'Calendar Sync',
        success: false,
        message: `Sync failed: ${syncResult.error}`,
        data: syncResult
      });
      return results;
    }
    
    results.push({
      step: 'Calendar Sync',
      success: true,
      message: `Synced ${syncResult.eventsCreated} new events, ${syncResult.eventsUpdated} updated`,
      data: syncResult
    });
    // ============================================
    // STEP 5: Verify Events in Database
    // ============================================
    // Check events directly in database
    const { data: dbEvents, error: dbError } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', userData.user.id)
      .order('start_time', { ascending: true })
      .limit(10);
    
    if (dbError) {
      results.push({
        step: 'Database Verification',
        success: false,
        message: `Database query failed: ${dbError.message}`,
        data: dbError
      });
    } else {
      results.push({
        step: 'Database Verification',
        success: true,
        message: `Found ${dbEvents?.length || 0} events in database`,
        data: { 
          eventCount: dbEvents?.length || 0,
          sampleEvents: dbEvents?.slice(0, 3).map(e => ({
            title: e.title,
            start: e.start_time,
            end: e.end_time
          }))
        }
      });
      if (dbEvents && dbEvents.length > 0) {
        dbEvents.slice(0, 3).forEach((e, i) => {
        });
      }
    }
    
    // ============================================
    // STEP 6: Test Calendar Service getEventsFromDB
    // ============================================
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    
    const serviceEvents = await calendarService.getEventsFromDB(startDate, endDate);
    
    results.push({
      step: 'Calendar Service Fetch',
      success: serviceEvents.length > 0,
      message: `Service returned ${serviceEvents.length} events`,
      data: {
        eventCount: serviceEvents.length,
        dateRange: {
          start: startDate.toLocaleDateString(),
          end: endDate.toLocaleDateString()
        },
        sampleEvents: serviceEvents.slice(0, 3).map(e => ({
          title: e.title,
          start: e.start.toLocaleString(),
          category: e.category
        }))
      }
    });
    // ============================================
    // STEP 7: Test RPC Function
    // ============================================
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_calendar_events_in_range', {
      p_user_id: userData.user.id,
      p_start_date: startDate.toISOString(),
      p_end_date: endDate.toISOString(),
      p_calendar_ids: null
    });
    
    if (rpcError) {
      results.push({
        step: 'RPC Function Test',
        success: false,
        message: `RPC function failed: ${rpcError.message}`,
        data: rpcError
      });
    } else {
      results.push({
        step: 'RPC Function Test',
        success: true,
        message: `RPC function returned ${rpcData?.length || 0} events`,
        data: { eventCount: rpcData?.length || 0 }
      });
    }
    
    // ============================================
    // STEP 8: Check Calendar Configuration
    // ============================================
    const { data: calendar, error: calendarError } = await supabase
      .from('calendar_calendars')
      .select('*')
      .eq('user_id', userData.user.id)
      .single();
    
    if (calendarError || !calendar) {
      results.push({
        step: 'Calendar Configuration',
        success: false,
        message: 'No calendar configuration found',
        data: calendarError
      });
    } else {
      results.push({
        step: 'Calendar Configuration',
        success: true,
        message: `Calendar "${calendar.name}" configured`,
        data: {
          id: calendar.id,
          name: calendar.name,
          isPrimary: calendar.is_primary,
          historicalSyncCompleted: calendar.historical_sync_completed
        }
      });
    }
    
    // ============================================
    // STEP 9: Test Frontend Data Format
    // ============================================
    if (serviceEvents.length > 0) {
      const frontendEvent = serviceEvents[0];
      const hasRequiredFields = !!(
        frontendEvent.id &&
        frontendEvent.title &&
        frontendEvent.start &&
        frontendEvent.category
      );
      
      results.push({
        step: 'Frontend Data Format',
        success: hasRequiredFields,
        message: hasRequiredFields ? 'Event data formatted correctly for frontend' : 'Event data missing required fields',
        data: {
          sampleEvent: {
            id: frontendEvent.id,
            title: frontendEvent.title,
            start: frontendEvent.start,
            end: frontendEvent.end,
            category: frontendEvent.category,
            hasAllFields: hasRequiredFields
          }
        }
      });
    }
    
  } catch (error: any) {
    results.push({
      step: 'Unexpected Error',
      success: false,
      message: error.message || 'Unknown error occurred',
      data: error
    });
  }
  
  // ============================================
  // FINAL SUMMARY
  // ============================================
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  results.forEach((result, index) => {
    const icon = result.success ? '✅' : '❌';
  });
  
  if (successCount === results.length) {
  } else {
  }
  
  return results;
}

// Export for use in components
export { runComprehensiveCalendarTest };