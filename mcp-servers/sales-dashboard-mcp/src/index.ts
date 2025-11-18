#!/usr/bin/env node

/**
 * Sales Dashboard MCP Server
 * 
 * Provides MCP tools for interacting with the Sixty Sales Dashboard:
 * - Create roadmap items
 * - Summarize meetings
 * - Find coldest deals
 * - Create tasks
 * - Write impactful emails
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import {
  SALES_DASHBOARD_TOOLS,
  executeTool,
  SalesDashboardClient
} from './tools/index.js';

class SalesDashboardMCPServer {
  private server: Server;
  private client: SalesDashboardClient | null = null;

  constructor() {
    this.server = new Server({
      name: '@sixty-sales/sales-dashboard-mcp',
      version: '1.0.0',
    });

    this.setupHandlers();
    this.initializeClient();
  }

  /**
   * Initialize Supabase client from environment
   * Supports both VITE_ prefixed (for Vite projects) and non-prefixed variables
   */
  private initializeClient(): void {
    // Check for both VITE_ prefixed and non-prefixed versions
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = 
      process.env.SUPABASE_SERVICE_ROLE_KEY || 
      process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY;
    const userId = process.env.USER_ID || '';

    if (!supabaseUrl || !supabaseKey) {
      return;
    }

    this.client = {
      supabaseUrl: supabaseUrl.replace('/rest/v1', ''),
      supabaseKey,
      userId
    };
  }

  /**
   * Setup MCP handlers
   */
  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: SALES_DASHBOARD_TOOLS,
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (!this.client) {
        throw new McpError(
          ErrorCode.InternalError,
          'Sales Dashboard client not initialized. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.'
        );
      }

      try {
        const result = await executeTool(name, args || {}, this.client);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to execute ${name}: ${errorMessage}`
        );
      }
    });
  }

  /**
   * Start the server
   */
  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}

// Start the server
const server = new SalesDashboardMCPServer();
server.run().catch(console.error);

