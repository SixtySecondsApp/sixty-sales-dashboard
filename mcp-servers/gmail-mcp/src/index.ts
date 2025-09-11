#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { GmailOAuthManager, OAuthError, TokenExpiredError, AuthenticationError } from './auth/oauth.js';
import { GmailClient } from './gmail-client.js';
import { createGmailTools, executeGmailTool } from './tools/index.js';

/**
 * Gmail MCP Server
 * Provides comprehensive Gmail integration through the Model Context Protocol
 */

class GmailMCPServer {
  private server: Server;
  private authManager: GmailOAuthManager | null = null;
  private gmailClient: GmailClient | null = null;
  private tools: any[] = [];

  constructor() {
    this.server = new Server({
      name: '@sixty-sales/gmail-mcp',
      version: '1.0.0',
    });

    this.setupHandlers();
    this.initializeAuth();
  }

  /**
   * Initialize OAuth authentication
   */
  private async initializeAuth(): Promise<void> {
    try {
      // Create OAuth manager from environment variables
      this.authManager = GmailOAuthManager.fromEnvironment();
      
      // Check if we have stored tokens (in a real implementation, you'd load from secure storage)
      const storedTokens = this.loadStoredTokens();
      if (storedTokens) {
        await this.authManager.setTokens(storedTokens);
        this.gmailClient = new GmailClient(this.authManager);
        this.tools = createGmailTools(this.gmailClient);
        console.error('Gmail MCP Server: Authenticated successfully');
      } else {
        console.error('Gmail MCP Server: No stored tokens found. Authentication required.');
        console.error('Gmail MCP Server: Use the "gmail_authenticate" resource to get auth URL');
      }
    } catch (error) {
      console.error('Gmail MCP Server: Failed to initialize authentication:', error);
      // Continue without authentication - tools will show authentication requirements
    }
  }

  /**
   * Load stored tokens (placeholder - implement with secure storage)
   */
  private loadStoredTokens(): any {
    // In a real implementation, load tokens from secure storage
    // For now, return null to require fresh authentication
    const tokenEnv = process.env.GMAIL_STORED_TOKENS;
    if (tokenEnv) {
      try {
        return JSON.parse(tokenEnv);
      } catch (error) {
        console.error('Failed to parse stored tokens:', error);
      }
    }
    return null;
  }

  /**
   * Save tokens (placeholder - implement with secure storage)
   */
  private saveTokens(_tokens: any): void {
    // In a real implementation, save tokens to secure storage
    console.error('Gmail MCP Server: Tokens received. In production, these would be securely stored.');
    console.error('Gmail MCP Server: Set GMAIL_STORED_TOKENS environment variable for persistence.');
  }

  /**
   * Setup MCP handlers
   */
  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      if (!this.gmailClient) {
        // Return authentication tools when not authenticated
        return {
          tools: [
            {
              name: 'gmail_authenticate',
              description: 'Get Gmail OAuth authentication URL and complete authentication flow',
              inputSchema: {
                type: 'object',
                properties: {
                  action: {
                    type: 'string',
                    enum: ['get_auth_url', 'exchange_code'],
                    description: 'Authentication action to perform',
                  },
                  code: {
                    type: 'string',
                    description: 'Authorization code from OAuth callback (required for exchange_code)',
                  },
                },
                required: ['action'],
              },
            },
          ],
        };
      }

      return { tools: this.tools };
    });

    // Execute tools
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // Handle authentication tool
        if (name === 'gmail_authenticate') {
          return await this.handleAuthentication(args);
        }

        // Check if authenticated for Gmail tools
        if (!this.gmailClient) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            'Gmail client not authenticated. Use gmail_authenticate tool first.'
          );
        }

        // Execute Gmail tool
        const result = await executeGmailTool(name, args, this.gmailClient);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        // Handle specific error types
        if (error instanceof TokenExpiredError) {
          // Try to refresh token
          try {
            if (this.authManager) {
              await this.authManager.refreshTokenIfNeeded();
              // Retry the operation
              const result = await executeGmailTool(name, args, this.gmailClient!);
              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(result, null, 2),
                  },
                ],
              };
            }
          } catch (refreshError) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'Authentication expired and refresh failed. Please re-authenticate.'
            );
          }
        }

        if (error instanceof OAuthError || error instanceof AuthenticationError) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Authentication error: ${error.message}`
          );
        }

        if (error instanceof McpError) {
          throw error;
        }

        throw new McpError(
          ErrorCode.InternalError,
          `Gmail tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });

    // List resources (for authentication status and configuration)
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: 'gmail://auth/status',
            name: 'Gmail Authentication Status',
            description: 'Current authentication status and user information',
            mimeType: 'application/json',
          },
          {
            uri: 'gmail://auth/url',
            name: 'Gmail OAuth URL',
            description: 'Generate OAuth authentication URL',
            mimeType: 'text/plain',
          },
        ],
      };
    });

    // Read resources
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      switch (uri) {
        case 'gmail://auth/status':
          const status = {
            authenticated: !!this.gmailClient,
            authManager: !!this.authManager,
            userProfile: null as any,
          };

          if (this.authManager && this.authManager.isAuthenticated()) {
            try {
              status.userProfile = await this.authManager.getUserProfile();
            } catch (error) {
              // Ignore profile fetch errors
            }
          }

          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(status, null, 2),
              },
            ],
          };

        case 'gmail://auth/url':
          if (!this.authManager) {
            throw new McpError(
              ErrorCode.InternalError,
              'OAuth manager not initialized'
            );
          }

          const authUrl = this.authManager.generateAuthUrl();
          return {
            contents: [
              {
                uri,
                mimeType: 'text/plain',
                text: authUrl,
              },
            ],
          };

        default:
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Unknown resource: ${uri}`
          );
      }
    });
  }

  /**
   * Handle authentication flow
   */
  private async handleAuthentication(args: any): Promise<any> {
    if (!this.authManager) {
      throw new McpError(
        ErrorCode.InternalError,
        'OAuth manager not initialized. Check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.'
      );
    }

    const { action, code } = args;

    switch (action) {
      case 'get_auth_url':
        const authUrl = this.authManager.generateAuthUrl();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                authUrl,
                instructions: [
                  '1. Visit the provided URL in your browser',
                  '2. Sign in to your Google account',
                  '3. Grant permissions to the application',
                  '4. Copy the authorization code from the redirect URL',
                  '5. Use gmail_authenticate with action "exchange_code" and the code',
                ],
              }, null, 2),
            },
          ],
        };

      case 'exchange_code':
        if (!code) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            'Authorization code is required for exchange_code action'
          );
        }

        try {
          const tokenData = await this.authManager.exchangeCodeForTokens(code);
          this.saveTokens(tokenData);
          
          // Initialize Gmail client
          this.gmailClient = new GmailClient(this.authManager);
          this.tools = createGmailTools(this.gmailClient);

          // Get user profile
          const profile = await this.authManager.getUserProfile();

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  message: 'Authentication successful',
                  profile: {
                    emailAddress: profile.emailAddress,
                    messagesTotal: profile.messagesTotal,
                    threadsTotal: profile.threadsTotal,
                  },
                  availableTools: this.tools.length,
                }, null, 2),
              },
            ],
          };
        } catch (error) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Failed to exchange authorization code: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }

      default:
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Unknown authentication action: ${action}`
        );
    }
  }

  /**
   * Start the server
   */
  public async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Gmail MCP Server running on stdio');
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    // Validate required environment variables
    const requiredEnvVars = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.error('Gmail MCP Server: Missing required environment variables:');
      missingVars.forEach(varName => {
        console.error(`  - ${varName}`);
      });
      console.error('\nPlease set these environment variables and restart the server.');
      process.exit(1);
    }

    // Create and start server
    const server = new GmailMCPServer();
    await server.run();
  } catch (error) {
    console.error('Gmail MCP Server: Fatal error:', error);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Gmail MCP Server: Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Gmail MCP Server: Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.error('Gmail MCP Server: Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('Gmail MCP Server: Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}