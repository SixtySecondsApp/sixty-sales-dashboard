import { google } from 'googleapis';
import { z } from 'zod';

// OAuth Configuration
export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
  accessToken?: string;
  refreshToken?: string;
}

// Token Schema
const TokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  scope: z.string().optional(),
  token_type: z.string().optional(),
  expiry_date: z.number().optional(),
});

export type Token = z.infer<typeof TokenSchema>;

export const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
];

export class SimpleOAuth {
  private oAuth2Client: any;
  private config: OAuthConfig;

  constructor(config: OAuthConfig) {
    this.config = config;
    
    this.oAuth2Client = new google.auth.OAuth2(
      this.config.clientId,
      this.config.clientSecret,
      this.config.redirectUri || 'urn:ietf:wg:oauth:2.0:oob'
    );

    // Set credentials if tokens are available
    if (this.config.accessToken) {
      this.oAuth2Client.setCredentials({
        access_token: this.config.accessToken,
        refresh_token: this.config.refreshToken,
      });
    }
  }

  generateAuthUrl(): string {
    return this.oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: CALENDAR_SCOPES,
      prompt: 'consent',
    });
  }

  async getAccessToken(code: string): Promise<Token> {
    try {
      // Use a promise wrapper to handle callback-based API
      const response: any = await new Promise((resolve, reject) => {
        this.oAuth2Client.getAccessToken(code, (err: any, tokens: any) => {
          if (err) return reject(err);
          resolve(tokens);
        });
      });
      
      if (!response.access_token) {
        throw new Error('No access token received');
      }

      // Set credentials for future requests
      this.oAuth2Client.setCredentials(response);

      return TokenSchema.parse(response);
    } catch (error: any) {
      throw new Error(`Failed to get access token: ${error?.message || error}`);
    }
  }

  setTokens(tokens: Token): void {
    this.oAuth2Client.setCredentials(tokens);
  }

  async refreshAccessToken(): Promise<Token> {
    try {
      const { credentials } = await this.oAuth2Client.refreshAccessToken();
      
      if (!credentials.access_token) {
        throw new Error('No access token received from refresh');
      }

      this.oAuth2Client.setCredentials(credentials);
      return TokenSchema.parse(credentials);
    } catch (error: any) {
      throw new Error(`Failed to refresh access token: ${error?.message || error}`);
    }
  }

  getTokens(): Token | null {
    const credentials = this.oAuth2Client.credentials;
    
    if (!credentials.access_token) {
      return null;
    }

    try {
      return TokenSchema.parse(credentials);
    } catch {
      return null;
    }
  }

  isTokenValid(): boolean {
    const credentials = this.oAuth2Client.credentials;
    
    if (!credentials.access_token) {
      return false;
    }

    // Check if token is expired
    if (credentials.expiry_date) {
      const now = Date.now();
      const expiry = credentials.expiry_date;
      
      // Token expires in less than 5 minutes, consider it invalid
      return expiry > (now + 5 * 60 * 1000);
    }

    return true;
  }

  getAuthClient(): any {
    if (!this.isTokenValid()) {
      throw new Error('OAuth tokens are invalid or expired. Please re-authenticate.');
    }

    return this.oAuth2Client;
  }

  async testAuthentication(): Promise<boolean> {
    try {
      const calendar = google.calendar({ version: 'v3', auth: this.getAuthClient() });
      await calendar.calendarList.list({ maxResults: 1 });
      return true;
    } catch {
      return false;
    }
  }
}