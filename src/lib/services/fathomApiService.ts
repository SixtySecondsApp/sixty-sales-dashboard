import { supabase } from '@/lib/supabase/clientV2';

/**
 * Fathom API Service
 *
 * Purpose: Complete TypeScript client for Fathom API v1
 * Features:
 * - OAuth token management with auto-refresh
 * - All Fathom API endpoints
 * - Type-safe responses
 * - Error handling and retry logic
 * - Rate limiting support
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface FathomCall {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  duration: number; // seconds
  host_email: string;
  host_name: string;
  share_url: string;
  app_url: string;
  transcript_url?: string;
  ai_summary?: {
    text: string;
    key_points?: string[];
  };
  participants?: FathomParticipant[];
  recording_status: 'processing' | 'ready' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface FathomParticipant {
  name: string;
  email?: string;
  is_host: boolean;
  join_time?: string;
  leave_time?: string;
}

export interface FathomAnalytics {
  call_id: string;
  sentiment?: {
    score: number; // -1 to 1
    label: 'positive' | 'neutral' | 'negative';
  };
  performance_score?: number; // 0 to 100
  speaker_stats?: {
    host_percentage: number;
    guest_percentage: number;
    total_speaking_time: number;
  };
  talk_time_analysis?: {
    rep_percentage: number;
    customer_percentage: number;
    judgement: 'good' | 'high' | 'low';
  };
  key_moments?: Array<{
    timestamp: number;
    description: string;
    type: 'question' | 'objection' | 'next_step' | 'highlight';
  }>;
}

export interface FathomHighlight {
  id: string;
  call_id: string;
  title: string;
  description?: string;
  start_time: number; // seconds from start
  end_time: number;
  created_at: string;
  created_by: string;
  share_url: string;
}

export interface ListCallsParams {
  limit?: number;
  offset?: number;
  start_date?: string; // ISO 8601
  end_date?: string;
  host_email?: string;
  status?: 'processing' | 'ready' | 'failed';
  sort_by?: 'start_time' | 'created_at' | 'duration';
  sort_order?: 'asc' | 'desc';
}

export interface SearchCallsQuery {
  query: string;
  limit?: number;
  filters?: {
    start_date?: string;
    end_date?: string;
    participants?: string[];
  };
}

export interface SyncResult {
  success: boolean;
  calls_synced: number;
  errors: Array<{
    call_id: string;
    error: string;
  }>;
  cursor?: string;
}

export interface DateRange {
  start: Date;
  end: Date;
}

// ============================================================================
// Fathom API Service Class
// ============================================================================

export class FathomAPIService {
  private baseUrl: string;
  private maxRetries: number = 3;
  private retryDelay: number = 1000; // ms

  constructor() {
    this.baseUrl = import.meta.env.FATHOM_API_BASE_URL || 'https://api.fathom.video/v1';
  }

  // ==========================================================================
  // Authentication & Token Management
  // ==========================================================================

  /**
   * Get valid access token for user, refreshing if needed
   */
  private async getValidToken(userId: string): Promise<string> {
    const { data: integration, error } = await supabase
      .from('fathom_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (error || !integration) {
      throw new Error('No active Fathom integration found');
    }

    // Check if token is expired or will expire in next 5 minutes
    const expiresAt = new Date(integration.token_expires_at);
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    if (expiresAt < fiveMinutesFromNow) {
      console.log('🔄 Token expired or expiring soon, refreshing...');
      await this.refreshAccessToken(userId);

      // Fetch updated token
      const { data: refreshedIntegration, error: refreshError } = await supabase
        .from('fathom_integrations')
        .select('access_token')
        .eq('user_id', userId)
        .single();

      if (refreshError || !refreshedIntegration) {
        throw new Error('Failed to get refreshed token');
      }

      return refreshedIntegration.access_token;
    }

    return integration.access_token;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(userId: string): Promise<void> {
    const { data: integration, error } = await supabase
      .from('fathom_integrations')
      .select('refresh_token')
      .eq('user_id', userId)
      .single();

    if (error || !integration) {
      throw new Error('No integration found to refresh');
    }

    const response = await fetch('https://app.fathom.video/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: integration.refresh_token,
        client_id: import.meta.env.VITE_FATHOM_CLIENT_ID,
        client_secret: import.meta.env.VITE_FATHOM_CLIENT_SECRET,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh token');
    }

    const tokenData = await response.json();

    // Calculate new expiry
    const expiresIn = tokenData.expires_in || 3600;
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

    // Update tokens in database
    await supabase
      .from('fathom_integrations')
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || integration.refresh_token,
        token_expires_at: tokenExpiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    console.log('✅ Token refreshed successfully');
  }

  // ==========================================================================
  // HTTP Request Helper with Retry Logic
  // ==========================================================================

  private async request<T>(
    userId: string,
    endpoint: string,
    options: RequestInit = {},
    attempt: number = 1
  ): Promise<T> {
    try {
      const token = await this.getValidToken(userId);
      const url = `${this.baseUrl}${endpoint}`;

      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
        console.warn(`⚠️  Rate limited, retrying after ${retryAfter}s`);

        if (attempt < this.maxRetries) {
          await this.sleep(retryAfter * 1000);
          return this.request(userId, endpoint, options, attempt + 1);
        }

        throw new Error('Rate limit exceeded');
      }

      // Handle token expiration
      if (response.status === 401) {
        console.log('🔄 Token invalid, refreshing and retrying...');
        await this.refreshAccessToken(userId);

        if (attempt < this.maxRetries) {
          return this.request(userId, endpoint, options, attempt + 1);
        }

        throw new Error('Authentication failed');
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      if (attempt < this.maxRetries && this.isRetryableError(error)) {
        console.log(`⚠️  Request failed, retrying (${attempt}/${this.maxRetries})...`);
        await this.sleep(this.retryDelay * attempt);
        return this.request(userId, endpoint, options, attempt + 1);
      }

      throw error;
    }
  }

  private isRetryableError(error: any): boolean {
    // Retry on network errors but not on client errors
    return (
      error instanceof TypeError || // Network errors
      error.message?.includes('fetch failed') ||
      error.message?.includes('timeout')
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ==========================================================================
  // Calls/Meetings API
  // ==========================================================================

  /**
   * List all calls with pagination and filtering
   */
  async listCalls(userId: string, params: ListCallsParams = {}): Promise<{ data: FathomCall[]; pagination: any }> {
    const queryParams = new URLSearchParams();

    if (params.limit) queryParams.set('limit', params.limit.toString());
    if (params.offset) queryParams.set('offset', params.offset.toString());
    if (params.start_date) queryParams.set('start_date', params.start_date);
    if (params.end_date) queryParams.set('end_date', params.end_date);
    if (params.host_email) queryParams.set('host_email', params.host_email);
    if (params.status) queryParams.set('status', params.status);
    if (params.sort_by) queryParams.set('sort_by', params.sort_by);
    if (params.sort_order) queryParams.set('sort_order', params.sort_order);

    const endpoint = `/calls?${queryParams.toString()}`;
    return this.request<{ data: FathomCall[]; pagination: any }>(userId, endpoint);
  }

  /**
   * Get detailed information about a specific call
   */
  async getCallDetails(userId: string, callId: string): Promise<FathomCall> {
    return this.request<FathomCall>(userId, `/calls/${callId}`);
  }

  /**
   * Search calls by keywords
   */
  async searchCalls(userId: string, query: SearchCallsQuery): Promise<{ data: FathomCall[] }> {
    return this.request<{ data: FathomCall[] }>(userId, '/calls/search', {
      method: 'POST',
      body: JSON.stringify(query),
    });
  }

  // ==========================================================================
  // Analytics API
  // ==========================================================================

  /**
   * Get analytics for a specific call
   */
  async getCallAnalytics(userId: string, callId: string): Promise<FathomAnalytics> {
    return this.request<FathomAnalytics>(userId, `/calls/${callId}/analytics`);
  }

  // ==========================================================================
  // Highlights API (Future)
  // ==========================================================================

  /**
   * Create a highlight from a call
   */
  async createHighlight(
    userId: string,
    callId: string,
    data: { title: string; start_time: number; end_time: number; description?: string }
  ): Promise<FathomHighlight> {
    return this.request<FathomHighlight>(userId, `/calls/${callId}/highlights`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * List highlights for a call
   */
  async listHighlights(userId: string, callId: string): Promise<{ data: FathomHighlight[] }> {
    return this.request<{ data: FathomHighlight[] }>(userId, `/calls/${callId}/highlights`);
  }

  // ==========================================================================
  // Sync Operations (High-Level)
  // ==========================================================================

  /**
   * Sync all calls for a user within a date range
   */
  async syncAllCalls(userId: string, dateRange?: DateRange): Promise<SyncResult> {
    const params: ListCallsParams = {
      limit: 100, // Process in batches of 100
      sort_by: 'start_time',
      sort_order: 'desc',
    };

    if (dateRange) {
      params.start_date = dateRange.start.toISOString();
      params.end_date = dateRange.end.toISOString();
    }

    const result: SyncResult = {
      success: true,
      calls_synced: 0,
      errors: [],
    };

    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      try {
        params.offset = offset;
        const response = await this.listCalls(userId, params);

        for (const call of response.data) {
          try {
            // Get full details and analytics
            const [details, analytics] = await Promise.all([
              this.getCallDetails(userId, call.id),
              this.getCallAnalytics(userId, call.id).catch(() => null), // Analytics might not be available yet
            ]);

            // This will be handled by the sync engine Edge Function
            // For now, just track the count
            result.calls_synced++;
          } catch (error) {
            result.errors.push({
              call_id: call.id,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }

        // Check if there are more results
        hasMore = response.data.length === params.limit;
        offset += params.limit;
      } catch (error) {
        result.success = false;
        throw error;
      }
    }

    return result;
  }

  /**
   * Sync a single call by ID
   */
  async syncSingleCall(userId: string, callId: string): Promise<FathomCall & { analytics?: FathomAnalytics }> {
    const [details, analytics] = await Promise.all([
      this.getCallDetails(userId, callId),
      this.getCallAnalytics(userId, callId).catch(() => null),
    ]);

    return {
      ...details,
      analytics: analytics || undefined,
    };
  }
}

// Export singleton instance
export const fathomApi = new FathomAPIService();
