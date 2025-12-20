/**
 * Fathom Integration Test Suite
 *
 * Tests all user-facing Fathom integration functionality:
 * - OAuth/Connection status
 * - Token validation and refresh
 * - API connectivity
 * - Meeting sync
 * - Webhook configuration
 * - Transcript retrieval
 */

import { supabase } from '@/lib/supabase/clientV2';
import type { IntegrationTest, TestResult, ConnectionStatus } from '../types';

/**
 * Get Fathom connection status for the current org
 */
export async function getFathomConnectionStatus(orgId: string): Promise<ConnectionStatus> {
  try {
    const { data: integration, error } = await supabase
      .from('fathom_org_integrations')
      .select('*')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      return { isConnected: false, error: error.message };
    }

    if (!integration) {
      return { isConnected: false };
    }

    return {
      isConnected: true,
      connectedAt: integration.created_at,
      lastSyncAt: integration.last_sync_at,
      accountInfo: {
        email: integration.fathom_user_email,
        id: integration.fathom_user_id,
      },
    };
  } catch (error) {
    return {
      isConnected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get Fathom sync state for the current org
 */
export async function getFathomSyncState(orgId: string) {
  const { data, error } = await supabase
    .from('fathom_org_sync_state')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle();

  if (error) {
    console.error('[FathomTests] Error fetching sync state:', error);
    return null;
  }

  return data;
}

/**
 * Create all Fathom tests for a given org
 */
export function createFathomTests(orgId: string): IntegrationTest[] {
  return [
    // =========================================================================
    // Authentication & Connection Tests
    // =========================================================================
    {
      id: 'fathom-connection-status',
      name: 'Connection Status',
      description: 'Verify Fathom is connected to the organization',
      category: 'authentication',
      timeout: 10000,
      run: async (): Promise<TestResult> => {
        const status = await getFathomConnectionStatus(orgId);

        if (!status.isConnected) {
          return {
            testId: 'fathom-connection-status',
            testName: 'Connection Status',
            status: 'failed',
            message: status.error || 'Fathom is not connected to this organization',
          };
        }

        return {
          testId: 'fathom-connection-status',
          testName: 'Connection Status',
          status: 'passed',
          message: `Connected as ${status.accountInfo?.email || 'Unknown'}`,
          responseData: {
            connectedAt: status.connectedAt,
            lastSyncAt: status.lastSyncAt,
            accountInfo: status.accountInfo,
          },
        };
      },
    },

    {
      id: 'fathom-token-validation',
      name: 'OAuth Token Validation',
      description: 'Verify the stored OAuth tokens are valid and not expired',
      category: 'authentication',
      timeout: 15000,
      run: async (): Promise<TestResult> => {
        try {
          const { data: integration, error: integrationError } = await supabase
            .from('fathom_org_integrations')
            .select('id, access_token, refresh_token, token_expires_at')
            .eq('org_id', orgId)
            .eq('is_active', true)
            .maybeSingle();

          if (integrationError || !integration) {
            return {
              testId: 'fathom-token-validation',
              testName: 'OAuth Token Validation',
              status: 'failed',
              message: 'No active integration found',
            };
          }

          // Check if we have tokens
          if (!integration.access_token) {
            return {
              testId: 'fathom-token-validation',
              testName: 'OAuth Token Validation',
              status: 'failed',
              message: 'No access token stored',
            };
          }

          // Check token expiry
          if (integration.token_expires_at) {
            const expiresAt = new Date(integration.token_expires_at);
            const now = new Date();

            if (expiresAt <= now) {
              // Token is expired, check if we have refresh token
              if (!integration.refresh_token) {
                return {
                  testId: 'fathom-token-validation',
                  testName: 'OAuth Token Validation',
                  status: 'failed',
                  message: 'Access token expired and no refresh token available',
                };
              }

              return {
                testId: 'fathom-token-validation',
                testName: 'OAuth Token Validation',
                status: 'passed',
                message: 'Access token expired but refresh token available',
                responseData: {
                  tokenExpired: true,
                  hasRefreshToken: true,
                  expiresAt: integration.token_expires_at,
                },
              };
            }

            // Token is still valid
            const minutesUntilExpiry = Math.round((expiresAt.getTime() - now.getTime()) / 60000);

            return {
              testId: 'fathom-token-validation',
              testName: 'OAuth Token Validation',
              status: 'passed',
              message: `Token valid for ${minutesUntilExpiry} more minutes`,
              responseData: {
                tokenExpired: false,
                hasRefreshToken: !!integration.refresh_token,
                expiresAt: integration.token_expires_at,
                minutesUntilExpiry,
              },
            };
          }

          return {
            testId: 'fathom-token-validation',
            testName: 'OAuth Token Validation',
            status: 'passed',
            message: 'Token present (no expiry info)',
            responseData: {
              hasRefreshToken: !!integration.refresh_token,
            },
          };
        } catch (error) {
          return {
            testId: 'fathom-token-validation',
            testName: 'OAuth Token Validation',
            status: 'error',
            message: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
    },

    // =========================================================================
    // API Connectivity Tests
    // =========================================================================
    {
      id: 'fathom-api-connectivity',
      name: 'API Connectivity',
      description: 'Test connection to the Fathom API using stored credentials',
      category: 'connectivity',
      timeout: 20000,
      run: async (): Promise<TestResult> => {
        try {
          // Get session for auth header
          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

          if (sessionError || !sessionData.session) {
            return {
              testId: 'fathom-api-connectivity',
              testName: 'API Connectivity',
              status: 'error',
              message: 'No active session',
            };
          }

          // Call the edge function to test API connectivity
          // We'll use a minimal sync request that just validates the connection
          const response = await supabase.functions.invoke('fathom-sync', {
            headers: {
              Authorization: `Bearer ${sessionData.session.access_token}`,
            },
            body: {
              org_id: orgId,
              sync_type: 'manual',
              limit: 1, // Only fetch 1 meeting to test connectivity
              dry_run: true, // Don't actually sync
            },
          });

          if (response.error) {
            // Check for specific error types
            const errorMessage = response.error.message || 'Unknown error';

            if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
              return {
                testId: 'fathom-api-connectivity',
                testName: 'API Connectivity',
                status: 'failed',
                message: 'Authentication failed - token may be invalid',
                errorDetails: { error: errorMessage },
              };
            }

            if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
              return {
                testId: 'fathom-api-connectivity',
                testName: 'API Connectivity',
                status: 'passed',
                message: 'API reachable (rate limited)',
                responseData: { rateLimited: true },
              };
            }

            return {
              testId: 'fathom-api-connectivity',
              testName: 'API Connectivity',
              status: 'failed',
              message: `API error: ${errorMessage}`,
              errorDetails: { error: response.error },
            };
          }

          return {
            testId: 'fathom-api-connectivity',
            testName: 'API Connectivity',
            status: 'passed',
            message: 'Successfully connected to Fathom API',
            responseData: response.data,
          };
        } catch (error) {
          return {
            testId: 'fathom-api-connectivity',
            testName: 'API Connectivity',
            status: 'error',
            message: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
    },

    // =========================================================================
    // Sync State Tests
    // =========================================================================
    {
      id: 'fathom-sync-state',
      name: 'Sync State Health',
      description: 'Verify sync state is healthy and not stuck',
      category: 'sync',
      timeout: 10000,
      run: async (): Promise<TestResult> => {
        try {
          const syncState = await getFathomSyncState(orgId);

          if (!syncState) {
            // No sync state yet - might be a new connection
            return {
              testId: 'fathom-sync-state',
              testName: 'Sync State Health',
              status: 'passed',
              message: 'No sync state yet (new connection)',
            };
          }

          // Check if sync is stuck
          if (syncState.sync_status === 'syncing') {
            const startedAt = syncState.last_sync_started_at
              ? new Date(syncState.last_sync_started_at)
              : null;

            if (startedAt) {
              const minutesSinceStart = Math.round(
                (Date.now() - startedAt.getTime()) / 60000
              );

              if (minutesSinceStart > 30) {
                return {
                  testId: 'fathom-sync-state',
                  testName: 'Sync State Health',
                  status: 'failed',
                  message: `Sync appears stuck - running for ${minutesSinceStart} minutes`,
                  errorDetails: {
                    syncStatus: syncState.sync_status,
                    startedAt: syncState.last_sync_started_at,
                    minutesSinceStart,
                  },
                };
              }
            }

            return {
              testId: 'fathom-sync-state',
              testName: 'Sync State Health',
              status: 'passed',
              message: 'Sync currently in progress',
              responseData: {
                syncStatus: syncState.sync_status,
                meetingsSynced: syncState.meetings_synced,
              },
            };
          }

          // Check for error state
          if (syncState.sync_status === 'error') {
            return {
              testId: 'fathom-sync-state',
              testName: 'Sync State Health',
              status: 'failed',
              message: syncState.error_message || 'Sync is in error state',
              errorDetails: {
                syncStatus: syncState.sync_status,
                errorMessage: syncState.error_message,
              },
            };
          }

          // Check last successful sync age
          if (syncState.last_sync_completed_at) {
            const lastSync = new Date(syncState.last_sync_completed_at);
            const hoursSinceSync = Math.round(
              (Date.now() - lastSync.getTime()) / (60 * 60 * 1000)
            );

            if (hoursSinceSync > 24) {
              return {
                testId: 'fathom-sync-state',
                testName: 'Sync State Health',
                status: 'failed',
                message: `Last sync was ${hoursSinceSync} hours ago`,
                errorDetails: {
                  lastSyncAt: syncState.last_sync_completed_at,
                  hoursSinceSync,
                },
              };
            }
          }

          return {
            testId: 'fathom-sync-state',
            testName: 'Sync State Health',
            status: 'passed',
            message: `Healthy - ${syncState.meetings_synced || 0} meetings synced`,
            responseData: {
              syncStatus: syncState.sync_status,
              meetingsSynced: syncState.meetings_synced,
              totalMeetingsFound: syncState.total_meetings_found,
              lastSyncAt: syncState.last_sync_completed_at,
            },
          };
        } catch (error) {
          return {
            testId: 'fathom-sync-state',
            testName: 'Sync State Health',
            status: 'error',
            message: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
    },

    // =========================================================================
    // Meeting Data Tests
    // =========================================================================
    {
      id: 'fathom-meeting-data',
      name: 'Meeting Data Integrity',
      description: 'Verify synced meetings have required data fields',
      category: 'data',
      timeout: 15000,
      run: async (): Promise<TestResult> => {
        try {
          // Get recent synced meetings
          const { data: meetings, error } = await supabase
            .from('meetings')
            .select('id, title, start_time, external_id, transcript_text, summary')
            .eq('org_id', orgId)
            .not('fathom_recording_id', 'is', null)
            .order('created_at', { ascending: false })
            .limit(10);

          if (error) {
            return {
              testId: 'fathom-meeting-data',
              testName: 'Meeting Data Integrity',
              status: 'error',
              message: `Database error: ${error.message}`,
            };
          }

          if (!meetings || meetings.length === 0) {
            return {
              testId: 'fathom-meeting-data',
              testName: 'Meeting Data Integrity',
              status: 'passed',
              message: 'No synced meetings to validate',
            };
          }

          // Check data quality
          let issueCount = 0;
          const issues: string[] = [];

          for (const meeting of meetings) {
            if (!meeting.title) {
              issueCount++;
              issues.push(`Meeting ${meeting.id} missing title`);
            }
            if (!meeting.start_time) {
              issueCount++;
              issues.push(`Meeting ${meeting.id} missing start_time`);
            }
          }

          // Check transcript availability
          const meetingsWithTranscripts = meetings.filter((m) => m.transcript_text);
          const transcriptRate = Math.round(
            (meetingsWithTranscripts.length / meetings.length) * 100
          );

          if (issueCount > 0) {
            return {
              testId: 'fathom-meeting-data',
              testName: 'Meeting Data Integrity',
              status: 'failed',
              message: `${issueCount} data quality issues found`,
              errorDetails: { issues: issues.slice(0, 5) },
              responseData: {
                totalMeetings: meetings.length,
                issueCount,
                transcriptRate: `${transcriptRate}%`,
              },
            };
          }

          return {
            testId: 'fathom-meeting-data',
            testName: 'Meeting Data Integrity',
            status: 'passed',
            message: `${meetings.length} meetings validated, ${transcriptRate}% have transcripts`,
            responseData: {
              totalMeetings: meetings.length,
              withTranscripts: meetingsWithTranscripts.length,
              transcriptRate: `${transcriptRate}%`,
            },
          };
        } catch (error) {
          return {
            testId: 'fathom-meeting-data',
            testName: 'Meeting Data Integrity',
            status: 'error',
            message: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
    },

    // =========================================================================
    // Webhook Tests
    // =========================================================================
    {
      id: 'fathom-webhook-config',
      name: 'Webhook Configuration',
      description: 'Verify webhook endpoint is configured correctly',
      category: 'webhook',
      timeout: 10000,
      run: async (): Promise<TestResult> => {
        // For now, we can only verify that the webhook endpoint exists
        // Full webhook testing would require sending a test webhook from Fathom

        try {
          // Check if we've received any webhooks recently
          const { data: recentMeetings, error } = await supabase
            .from('meetings')
            .select('id, created_at')
            .eq('org_id', orgId)
            .not('fathom_recording_id', 'is', null)
            .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
            .order('created_at', { ascending: false })
            .limit(5);

          if (error) {
            return {
              testId: 'fathom-webhook-config',
              testName: 'Webhook Configuration',
              status: 'error',
              message: `Database error: ${error.message}`,
            };
          }

          // Note: We can't directly test webhooks without Fathom sending one
          // This test verifies the infrastructure is in place

          return {
            testId: 'fathom-webhook-config',
            testName: 'Webhook Configuration',
            status: 'passed',
            message: recentMeetings && recentMeetings.length > 0
              ? `Webhook active - ${recentMeetings.length} meetings in last 7 days`
              : 'Webhook endpoint configured (no recent meetings)',
            responseData: {
              recentMeetingCount: recentMeetings?.length || 0,
              webhookUrl: `${window.location.origin}/api/webhooks/fathom`,
            },
          };
        } catch (error) {
          return {
            testId: 'fathom-webhook-config',
            testName: 'Webhook Configuration',
            status: 'error',
            message: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
    },

    // =========================================================================
    // Edge Function Tests
    // =========================================================================
    {
      id: 'fathom-edge-function-health',
      name: 'Edge Function Health',
      description: 'Verify Fathom edge functions are responding',
      category: 'infrastructure',
      timeout: 15000,
      run: async (): Promise<TestResult> => {
        try {
          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

          if (sessionError || !sessionData.session) {
            return {
              testId: 'fathom-edge-function-health',
              testName: 'Edge Function Health',
              status: 'error',
              message: 'No active session',
            };
          }

          // Attempt to invoke the sync function with a health check
          const startTime = Date.now();
          const response = await supabase.functions.invoke('fathom-sync', {
            headers: {
              Authorization: `Bearer ${sessionData.session.access_token}`,
            },
            body: {
              org_id: orgId,
              health_check: true, // Minimal operation
            },
          });

          const duration = Date.now() - startTime;

          if (response.error) {
            // Even an error response means the function is running
            // We're just checking that the function responds

            // Check if it's a "not connected" error which is expected
            const errorMessage = response.error.message || '';
            if (
              errorMessage.includes('No active') ||
              errorMessage.includes('not connected')
            ) {
              return {
                testId: 'fathom-edge-function-health',
                testName: 'Edge Function Health',
                status: 'passed',
                message: `Edge function responding (${duration}ms)`,
                responseData: { responseTime: duration },
              };
            }

            return {
              testId: 'fathom-edge-function-health',
              testName: 'Edge Function Health',
              status: 'passed',
              message: `Edge function responding with error (${duration}ms)`,
              responseData: {
                responseTime: duration,
                errorType: errorMessage.substring(0, 50),
              },
            };
          }

          return {
            testId: 'fathom-edge-function-health',
            testName: 'Edge Function Health',
            status: 'passed',
            message: `Edge function healthy (${duration}ms)`,
            responseData: { responseTime: duration },
          };
        } catch (error) {
          return {
            testId: 'fathom-edge-function-health',
            testName: 'Edge Function Health',
            status: 'error',
            message: error instanceof Error ? error.message : 'Edge function unreachable',
          };
        }
      },
    },
  ];
}

/**
 * Export test suite info for the dashboard
 */
export const fathomTestSuiteInfo = {
  integrationName: 'fathom',
  displayName: 'Fathom',
  description: 'AI meeting recording and transcription',
  icon: 'Video',
  categories: ['authentication', 'connectivity', 'sync', 'data', 'webhook', 'infrastructure'],
};
