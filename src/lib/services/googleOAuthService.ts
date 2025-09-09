import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { supabase } from '../supabase/clientV2';

// Google OAuth configuration
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = import.meta.env.VITE_GOOGLE_REDIRECT_URI || 'http://localhost:5173/auth/google/callback';

// Required scopes for all Google services
const SCOPES = [
  // Google Docs
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/drive.file',
  
  // Google Drive
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  
  // Gmail
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.labels',
  
  // Google Calendar
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  
  // User info
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

class GoogleOAuthService {
  private oauth2Client: OAuth2Client;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      REDIRECT_URI
    );
  }

  /**
   * Generate the OAuth authorization URL
   */
  getAuthorizationUrl(state?: string): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
      state: state
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string) {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);
      
      // Get user info
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
      const { data: userInfo } = await oauth2.userinfo.get();
      
      return {
        tokens,
        userInfo
      };
    } catch (error) {
      console.error('Error exchanging code for tokens:', error);
      throw new Error('Failed to exchange authorization code');
    }
  }

  /**
   * Save tokens to database
   */
  async saveTokens(userId: string, email: string, tokens: any) {
    const expiresAt = tokens.expiry_date 
      ? new Date(tokens.expiry_date).toISOString()
      : null;

    const { data, error } = await supabase
      .from('google_integrations')
      .upsert({
        user_id: userId,
        email: email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        scopes: SCOPES.join(' '),
        is_active: true,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,email'
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving tokens:', error);
      throw new Error('Failed to save authentication tokens');
    }

    return data;
  }

  /**
   * Get tokens from database
   */
  async getTokens(userId: string) {
    const { data, error } = await supabase
      .from('google_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return null;
    }

    return data;
  }

  /**
   * Refresh access token if expired
   */
  async refreshAccessToken(userId: string) {
    const integration = await this.getTokens(userId);
    
    if (!integration || !integration.refresh_token) {
      throw new Error('No refresh token available');
    }

    this.oauth2Client.setCredentials({
      refresh_token: integration.refresh_token
    });

    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      
      // Update tokens in database
      const { error } = await supabase
        .from('google_integrations')
        .update({
          access_token: credentials.access_token,
          expires_at: credentials.expiry_date 
            ? new Date(credentials.expiry_date).toISOString()
            : null,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (error) {
        console.error('Error updating tokens:', error);
        throw new Error('Failed to update tokens');
      }

      return credentials;
    } catch (error) {
      console.error('Error refreshing token:', error);
      
      // Mark integration as inactive if refresh fails
      await supabase
        .from('google_integrations')
        .update({ is_active: false })
        .eq('user_id', userId);
      
      throw new Error('Failed to refresh access token');
    }
  }

  /**
   * Get authenticated OAuth client for user
   */
  async getAuthenticatedClient(userId: string): Promise<OAuth2Client> {
    const integration = await this.getTokens(userId);
    
    if (!integration) {
      throw new Error('No Google integration found for user');
    }

    // Check if token is expired
    const now = new Date();
    const expiresAt = integration.expires_at ? new Date(integration.expires_at) : null;
    
    if (expiresAt && expiresAt <= now) {
      // Token expired, refresh it
      const newCredentials = await this.refreshAccessToken(userId);
      this.oauth2Client.setCredentials(newCredentials);
    } else {
      // Token still valid
      this.oauth2Client.setCredentials({
        access_token: integration.access_token,
        refresh_token: integration.refresh_token
      });
    }

    return this.oauth2Client;
  }

  /**
   * Revoke Google authorization
   */
  async revokeAuthorization(userId: string) {
    const integration = await this.getTokens(userId);
    
    if (!integration) {
      return;
    }

    try {
      // Revoke the token with Google
      await this.oauth2Client.revokeToken(integration.access_token);
    } catch (error) {
      console.error('Error revoking token:', error);
    }

    // Mark as inactive in database
    const { error } = await supabase
      .from('google_integrations')
      .update({ is_active: false })
      .eq('user_id', userId);

    if (error) {
      console.error('Error deactivating integration:', error);
      throw new Error('Failed to deactivate integration');
    }
  }

  /**
   * Check if user has valid Google integration
   */
  async hasValidIntegration(userId: string): Promise<boolean> {
    const integration = await this.getTokens(userId);
    return !!integration && integration.is_active;
  }

  /**
   * Log service activity
   */
  async logActivity(
    integrationId: string,
    service: string,
    action: string,
    status: string,
    requestData?: any,
    responseData?: any,
    errorMessage?: string
  ) {
    await supabase
      .from('google_service_logs')
      .insert({
        integration_id: integrationId,
        service,
        action,
        status,
        request_data: requestData,
        response_data: responseData,
        error_message: errorMessage,
        created_at: new Date().toISOString()
      });
  }

  /**
   * Verify required scopes are granted
   */
  async verifyScopes(userId: string, requiredScopes: string[]): Promise<boolean> {
    const integration = await this.getTokens(userId);
    
    if (!integration) {
      return false;
    }

    const grantedScopes = integration.scopes.split(' ');
    return requiredScopes.every(scope => grantedScopes.includes(scope));
  }

  /**
   * Get all active integrations for a user
   */
  async getUserIntegrations(userId: string) {
    const { data, error } = await supabase
      .from('google_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching integrations:', error);
      return [];
    }

    return data || [];
  }
}

export const googleOAuthService = new GoogleOAuthService();