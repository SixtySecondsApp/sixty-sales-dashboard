import { supabase } from '@/lib/supabase/clientV2';

export interface GoogleIntegration {
  id: string;
  user_id: string;
  email: string;
  expires_at: string;
  scopes: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GoogleServiceStatus {
  gmail: boolean;
  calendar: boolean;
  drive: boolean;
}

export interface GoogleOAuthResponse {
  authUrl: string;
  state: string;
}

export class GoogleIntegrationAPI {
  /**
   * Initiate Google OAuth flow
   * Calls the google-oauth-initiate Edge Function to generate an authorization URL
   */
  static async initiateOAuth(): Promise<GoogleOAuthResponse> {
    const { data, error } = await supabase.functions.invoke('google-oauth-initiate', {
      body: {}
    });

    if (error) {
      throw new Error(error.message || 'Failed to initiate Google OAuth');
    }

    if (!data?.authUrl) {
      throw new Error('No authorization URL received from OAuth initiation');
    }

    return data;
  }

  /**
   * Get current Google integration status for the authenticated user
   */
  static async getIntegrationStatus(): Promise<GoogleIntegration | null> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('google_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (error) {
      // If no integration found, return null (not an error)
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(error.message || 'Failed to fetch integration status');
    }

    return data;
  }

  /**
   * Disconnect Google integration for the authenticated user
   */
  static async disconnectIntegration(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Set integration as inactive instead of deleting to preserve audit trail
    const { error } = await supabase
      .from('google_integrations')
      .update({ is_active: false })
      .eq('user_id', user.id);

    if (error) {
      throw new Error(error.message || 'Failed to disconnect Google integration');
    }

    // Also clean up any cached data (calendars, labels, folders)
    await GoogleIntegrationAPI.cleanupCachedData();
  }

  /**
   * Clean up cached Google data when integration is disconnected
   */
  private static async cleanupCachedData(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    // Get the integration ID to clean up related data
    const { data: integration } = await supabase
      .from('google_integrations')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!integration) return;

    // Clean up cached data - these will cascade delete due to foreign key constraints
    await Promise.all([
      supabase
        .from('google_calendars')
        .delete()
        .eq('integration_id', integration.id),
      
      supabase
        .from('google_email_labels')
        .delete()
        .eq('integration_id', integration.id),
      
      supabase
        .from('google_drive_folders')
        .delete()
        .eq('integration_id', integration.id)
    ]);
  }

  /**
   * Get service-specific status (this will be expanded when we add service proxy functions)
   * For now, returns basic status based on integration existence
   */
  static async getServiceStatus(): Promise<GoogleServiceStatus> {
    const integration = await GoogleIntegrationAPI.getIntegrationStatus();
    
    if (!integration) {
      return { gmail: false, calendar: false, drive: false };
    }

    // For now, if integration exists and is active, assume all services are available
    // This will be refined when we add individual service management
    return { gmail: true, calendar: true, drive: true };
  }

  /**
   * Toggle a specific Google service (placeholder for future implementation)
   * This will be implemented when we add service proxy Edge Functions
   */
  static async toggleService(service: keyof GoogleServiceStatus, enabled: boolean): Promise<void> {
    // For now, this is a placeholder
    // In the future, this would call service-specific Edge Functions
    // to enable/disable specific Google services
    console.log(`Toggle ${service}: ${enabled}`);
    
    // TODO: Implement when service proxy functions are created
    // This would involve:
    // 1. Updating service preferences in database
    // 2. Calling service-specific setup/teardown functions
    // 3. Managing service-specific permissions
  }

  /**
   * Check if tokens need refreshing and refresh if necessary
   * This will be called automatically by service proxy functions
   */
  static async refreshTokensIfNeeded(): Promise<boolean> {
    const integration = await GoogleIntegrationAPI.getIntegrationStatus();
    
    if (!integration) {
      return false;
    }

    const expiresAt = new Date(integration.expires_at);
    const now = new Date();
    const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds

    // Check if token expires within 5 minutes
    if (expiresAt.getTime() - now.getTime() < fiveMinutes) {
      // TODO: Implement token refresh logic
      // This would involve calling a refresh-token Edge Function
      console.log('Token needs refreshing');
      return false;
    }

    return true;
  }

  /**
   * Get integration health status
   */
  static async getIntegrationHealth(): Promise<{
    isConnected: boolean;
    hasValidTokens: boolean;
    expiresAt: string | null;
    email: string | null;
    lastSync: string | null;
  }> {
    const integration = await GoogleIntegrationAPI.getIntegrationStatus();
    
    if (!integration) {
      return {
        isConnected: false,
        hasValidTokens: false,
        expiresAt: null,
        email: null,
        lastSync: null
      };
    }

    const hasValidTokens = await GoogleIntegrationAPI.refreshTokensIfNeeded();
    
    return {
      isConnected: integration.is_active,
      hasValidTokens,
      expiresAt: integration.expires_at,
      email: integration.email,
      lastSync: integration.updated_at
    };
  }
}

// Export convenience methods for easier imports
export const googleApi = {
  initiateOAuth: GoogleIntegrationAPI.initiateOAuth,
  getStatus: GoogleIntegrationAPI.getIntegrationStatus,
  getServiceStatus: GoogleIntegrationAPI.getServiceStatus,
  getHealth: GoogleIntegrationAPI.getIntegrationHealth,
  disconnect: GoogleIntegrationAPI.disconnectIntegration,
  toggleService: GoogleIntegrationAPI.toggleService,
  refreshTokens: GoogleIntegrationAPI.refreshTokensIfNeeded,
};

export default googleApi;