import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/lib/supabase/clientV2';
import { 
  Loader2, 
  Bug,
  Calendar,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';

interface DebugResult {
  step: string;
  success: boolean;
  data: any;
}

export function CalendarDebugger() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<DebugResult[]>([]);

  const runDebug = async () => {
    setIsRunning(true);
    setResults([]);
    const debugResults: DebugResult[] = [];

    try {
      // Step 1: Check auth and integration
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        debugResults.push({
          step: 'Authentication',
          success: false,
          data: { error: 'Not authenticated' }
        });
        setResults([...debugResults]);
        return;
      }

      debugResults.push({
        step: 'Authentication',
        success: true,
        data: { userId: userData.user.id, email: userData.user.email }
      });
      setResults([...debugResults]);

      // Step 2: Check Google integration details
      const { data: integration, error: intError } = await supabase
        .from('google_integrations')
        .select('*')
        .eq('user_id', userData.user.id)
        .eq('is_active', true)
        .single();

      if (intError || !integration) {
        debugResults.push({
          step: 'Google Integration',
          success: false,
          data: { error: 'No active integration', details: intError }
        });
        setResults([...debugResults]);
        return;
      }

      const tokenExpiry = new Date(integration.expires_at);
      const isExpired = tokenExpiry < new Date();

      debugResults.push({
        step: 'Google Integration',
        success: true,
        data: {
          email: integration.email,
          hasAccessToken: !!integration.access_token,
          hasRefreshToken: !!integration.refresh_token,
          tokenExpired: isExpired,
          expiresAt: tokenExpiry.toLocaleString(),
          scopes: integration.scopes
        }
      });
      setResults([...debugResults]);

      // Step 3: Test direct Edge Function call with different date ranges
      const now = new Date();
      
      // Test current month
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      const { data: currentMonthData, error: currentMonthError } = await supabase.functions.invoke(
        'google-calendar?action=list-events',
        {
          body: {
            calendarId: 'primary',
            timeMin: currentMonthStart.toISOString(),
            timeMax: currentMonthEnd.toISOString(),
            maxResults: 10
          }
        }
      );

      debugResults.push({
        step: 'Current Month Events',
        success: !currentMonthError,
        data: {
          dateRange: `${currentMonthStart.toLocaleDateString()} - ${currentMonthEnd.toLocaleDateString()}`,
          error: currentMonthError,
          response: currentMonthData,
          eventCount: currentMonthData?.events?.length || 0,
          events: currentMonthData?.events?.slice(0, 3).map((e: any) => ({
            id: e.id,
            summary: e.summary,
            start: e.start,
            end: e.end
          }))
        }
      });
      setResults([...debugResults]);

      // Test wider range (6 months)
      const wideRangeStart = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      const wideRangeEnd = new Date(now.getFullYear(), now.getMonth() + 3, 0, 23, 59, 59);

      const { data: wideRangeData, error: wideRangeError } = await supabase.functions.invoke(
        'google-calendar?action=list-events',
        {
          body: {
            calendarId: 'primary',
            timeMin: wideRangeStart.toISOString(),
            timeMax: wideRangeEnd.toISOString(),
            maxResults: 50
          }
        }
      );

      debugResults.push({
        step: '6-Month Range Events',
        success: !wideRangeError,
        data: {
          dateRange: `${wideRangeStart.toLocaleDateString()} - ${wideRangeEnd.toLocaleDateString()}`,
          error: wideRangeError,
          response: wideRangeData,
          eventCount: wideRangeData?.events?.length || 0,
          hasNextPageToken: !!wideRangeData?.nextPageToken,
          events: wideRangeData?.events?.slice(0, 5).map((e: any) => ({
            id: e.id,
            summary: e.summary,
            start: e.start,
            end: e.end
          }))
        }
      });
      setResults([...debugResults]);

      // Test calendar list
      const { data: calendarsData, error: calendarsError } = await supabase.functions.invoke(
        'google-calendar?action=list-calendars',
        {
          body: {}
        }
      );

      debugResults.push({
        step: 'Available Calendars',
        success: !calendarsError,
        data: {
          error: calendarsError,
          calendarCount: calendarsData?.calendars?.length || 0,
          calendars: calendarsData?.calendars?.map((c: any) => ({
            id: c.id,
            summary: c.summary,
            primary: c.primary,
            accessRole: c.accessRole
          }))
        }
      });
      setResults([...debugResults]);

      // Test with specific calendar IDs if multiple calendars exist
      if (calendarsData?.calendars && calendarsData.calendars.length > 0) {
        for (const calendar of calendarsData.calendars.slice(0, 2)) {
          const { data: calData, error: calError } = await supabase.functions.invoke(
            'google-calendar?action=list-events',
            {
              body: {
                calendarId: calendar.id,
                timeMin: currentMonthStart.toISOString(),
                timeMax: currentMonthEnd.toISOString(),
                maxResults: 5
              }
            }
          );

          debugResults.push({
            step: `Calendar: ${calendar.summary || calendar.id}`,
            success: !calError,
            data: {
              calendarId: calendar.id,
              error: calError,
              eventCount: calData?.events?.length || 0,
              events: calData?.events?.slice(0, 3).map((e: any) => ({
                summary: e.summary,
                start: e.start?.dateTime || e.start?.date
              }))
            }
          });
          setResults([...debugResults]);
        }
      }

      // Check if events are being filtered out
      const { data: rawResponse, error: rawError } = await supabase.functions.invoke(
        'google-calendar?action=list-events',
        {
          body: {
            calendarId: 'primary',
            timeMin: new Date(2024, 0, 1).toISOString(), // Start of 2024
            timeMax: new Date(2025, 11, 31).toISOString(), // End of 2025
            maxResults: 100
          }
        }
      );

      debugResults.push({
        step: 'Full 2-Year Range (2024-2025)',
        success: !rawError,
        data: {
          error: rawError,
          totalEvents: rawResponse?.events?.length || 0,
          response: rawResponse,
          timeZone: rawResponse?.timeZone,
          nextSyncToken: rawResponse?.nextSyncToken,
          events: rawResponse?.events?.slice(0, 10).map((e: any) => ({
            id: e.id,
            summary: e.summary,
            start: e.start,
            status: e.status,
            visibility: e.visibility
          }))
        }
      });
      setResults([...debugResults]);

    } catch (error: any) {
      debugResults.push({
        step: 'Unexpected Error',
        success: false,
        data: { error: error.message, stack: error.stack }
      });
      setResults([...debugResults]);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card className="p-6 bg-gray-800 border-gray-700">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
              <Bug className="w-5 h-5 text-orange-400" />
              Calendar API Debugger
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              Debug Google Calendar API responses and date ranges
            </p>
          </div>
          <Button
            onClick={runDebug}
            disabled={isRunning}
            className="bg-orange-500 hover:bg-orange-600"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Debugging...
              </>
            ) : (
              <>
                <Bug className="w-4 h-4 mr-2" />
                Run Debug
              </>
            )}
          </Button>
        </div>

        {results.length > 0 && (
          <div className="space-y-2">
            {results.map((result, index) => (
              <div
                key={index}
                className={`border rounded-lg p-3 ${
                  result.success
                    ? 'border-gray-700 bg-gray-900'
                    : 'border-orange-500/30 bg-orange-500/5'
                }`}
              >
                <div className="flex items-start gap-3">
                  {result.success ? (
                    <CheckCircle className="w-4 h-4 text-green-500 mt-1" />
                  ) : result.data?.error ? (
                    <XCircle className="w-4 h-4 text-red-500 mt-1" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-orange-500 mt-1" />
                  )}
                  <div className="flex-1">
                    <div className="font-medium text-gray-200">{result.step}</div>
                    <pre className="mt-2 text-xs text-gray-400 overflow-auto bg-gray-950 p-2 rounded">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {results.length === 0 && !isRunning && (
          <div className="text-center py-8 text-gray-400">
            <Bug className="w-12 h-12 mx-auto mb-3 text-gray-600" />
            <p>Click "Run Debug" to diagnose calendar sync issues</p>
            <p className="text-sm mt-2">This will test different date ranges and calendar configurations</p>
          </div>
        )}
      </div>
    </Card>
  );
}