#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { CalendarClient } from './calendar-client.js';
import { CalendarToolHandler, CALENDAR_TOOLS } from './tools/index.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Environment validation
const REQUIRED_ENV_VARS = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
] as const;

const OPTIONAL_ENV_VARS = [
  'GOOGLE_REDIRECT_URI',
  'GOOGLE_ACCESS_TOKEN',
  'GOOGLE_REFRESH_TOKEN',
] as const;

interface EnvConfig {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI?: string;
  GOOGLE_ACCESS_TOKEN?: string;
  GOOGLE_REFRESH_TOKEN?: string;
}

function validateEnvironment(): EnvConfig {
  const config: Partial<EnvConfig> = {};
  const missingVars: string[] = [];

  // Check required variables
  for (const varName of REQUIRED_ENV_VARS) {
    const value = process.env[varName];
    if (!value) {
      missingVars.push(varName);
    } else {
      config[varName] = value;
    }
  }

  // Check optional variables
  for (const varName of OPTIONAL_ENV_VARS) {
    const value = process.env[varName];
    if (value) {
      config[varName] = value;
    }
  }

  if (missingVars.length > 0) {
    missingVars.forEach(varName => {
    });
    process.exit(1);
  }

  return config as EnvConfig;
}

class CalendarMcpServer {
  private server: Server;
  private calendarClient: CalendarClient | null = null;
  private toolHandler: CalendarToolHandler | null = null;
  private envConfig: EnvConfig;

  constructor() {
    this.envConfig = validateEnvironment();
    
    this.server = new Server({
      name: 'calendar-mcp-server',
      version: '1.0.0',
      capabilities: {
        tools: {},
      },
    });

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: CALENDAR_TOOLS,
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // Initialize calendar client if not already done
        if (!this.calendarClient) {
          await this.initializeCalendarClient();
        }

        if (!this.toolHandler) {
          throw new McpError(
            ErrorCode.InternalError,
            'Calendar client not properly initialized'
          );
        }

        // Handle authentication-specific tools
        if (name === 'calendar_authenticate') {
          return this.handleAuthentication(args);
        }

        if (name === 'calendar_get_auth_url') {
          return this.getAuthUrl();
        }

        if (name === 'calendar_check_auth') {
          return this.checkAuthentication();
        }

        // Handle regular calendar tools
        const result = await this.toolHandler.handleToolCall(name, args);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };

      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        // Handle authentication errors
        if (errorMessage.includes('authentication') || errorMessage.includes('OAuth')) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: 'Authentication required',
                  message: 'Please authenticate with Google Calendar first using calendar_get_auth_url and calendar_authenticate tools',
                  authUrl: this.calendarClient?.generateAuthUrl(),
                }, null, 2),
              },
            ],
          };
        }

        throw new McpError(ErrorCode.InternalError, errorMessage);
      }
    });
  }

  private setupErrorHandling() {
    this.server.onerror = (error) => {
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private async initializeCalendarClient() {
    try {
      this.calendarClient = new CalendarClient({
        clientId: this.envConfig.GOOGLE_CLIENT_ID,
        clientSecret: this.envConfig.GOOGLE_CLIENT_SECRET,
        redirectUri: this.envConfig.GOOGLE_REDIRECT_URI || 'urn:ietf:wg:oauth:2.0:oob',
        accessToken: this.envConfig.GOOGLE_ACCESS_TOKEN,
        refreshToken: this.envConfig.GOOGLE_REFRESH_TOKEN,
      });

      // If we have tokens in environment, set them
      if (this.envConfig.GOOGLE_ACCESS_TOKEN) {
        this.calendarClient.setTokens({
          access_token: this.envConfig.GOOGLE_ACCESS_TOKEN,
          refresh_token: this.envConfig.GOOGLE_REFRESH_TOKEN,
        });
      }

      this.toolHandler = new CalendarToolHandler(this.calendarClient);
      // Test authentication if tokens are available
      if (this.calendarClient.isAuthenticated()) {
      } else {
      }

    } catch (error) {
      throw error;
    }
  }

  private async handleAuthentication(args: any): Promise<any> {
    if (!this.calendarClient) {
      throw new McpError(ErrorCode.InternalError, 'Calendar client not initialized');
    }

    const { code } = args;
    
    if (!code) {
      throw new McpError(ErrorCode.InvalidParams, 'Authorization code is required');
    }

    try {
      const tokens = await this.calendarClient.authenticate(code);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Authentication successful! Calendar tools are now available.',
              tokens: {
                hasAccessToken: !!tokens.access_token,
                hasRefreshToken: !!tokens.refresh_token,
                expiryDate: tokens.expiry_date,
              },
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      throw new McpError(ErrorCode.InternalError, errorMessage);
    }
  }

  private getAuthUrl(): any {
    if (!this.calendarClient) {
      throw new McpError(ErrorCode.InternalError, 'Calendar client not initialized');
    }

    const authUrl = this.calendarClient.generateAuthUrl();
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            authUrl,
            instructions: [
              '1. Open the provided URL in your browser',
              '2. Sign in to your Google account',
              '3. Grant calendar permissions',
              '4. Copy the authorization code from the redirect page',
              '5. Use the calendar_authenticate tool with the code',
            ],
          }, null, 2),
        },
      ],
    };
  }

  private checkAuthentication(): any {
    if (!this.calendarClient) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              authenticated: false,
              message: 'Calendar client not initialized',
            }, null, 2),
          },
        ],
      };
    }

    const isAuthenticated = this.calendarClient.isAuthenticated();
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            authenticated: isAuthenticated,
            message: isAuthenticated 
              ? 'Calendar client is authenticated and ready to use'
              : 'Authentication required. Use calendar_get_auth_url to start authentication flow',
          }, null, 2),
        },
      ],
    };
  }

  async run() {
    try {
      // Initialize calendar client
      await this.initializeCalendarClient();
      
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      CALENDAR_TOOLS.forEach(tool => {
      });
      
    } catch (error) {
      process.exit(1);
    }
  }
}

// Run the server if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new CalendarMcpServer();
  server.run().catch(console.error);
}

export { CalendarMcpServer };