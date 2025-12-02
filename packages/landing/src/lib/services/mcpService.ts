/**
 * MCP Service - Manages connections and communications with MCP servers
 * Provides a unified interface for workflow nodes to interact with MCP servers
 */

export interface MCPServerConfig {
  name: string;
  type: 'calendar' | 'email' | 'custom';
  url?: string;
  transport: 'stdio' | 'http' | 'websocket';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  timeout?: number;
  retries?: number;
  // Authentication
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  // Server-specific config
  serverConfig?: Record<string, any>;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface MCPToolCall {
  tool: string;
  input: any;
  output?: any;
  error?: string;
  duration?: number;
  timestamp: string;
}

export interface MCPServerStatus {
  name: string;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  lastConnected?: Date;
  error?: string;
  tools?: MCPTool[];
  capabilities?: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
  };
}

export interface MCPRequest {
  id: string;
  method: 'tools/list' | 'tools/call' | 'resources/list' | 'resources/get' | 'prompts/list' | 'prompts/get';
  params?: any;
}

export interface MCPResponse {
  id: string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

/**
 * MCP Server Connection Manager
 */
class MCPServerConnection {
  public config: MCPServerConfig;
  public status: MCPServerStatus;
  private process?: any;
  private websocket?: WebSocket;
  private requestCallbacks: Map<string, {
    resolve: (value: any) => void;
    reject: (error: any) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();

  constructor(config: MCPServerConfig) {
    this.config = config;
    this.status = {
      name: config.name,
      status: 'disconnected',
      capabilities: {}
    };
  }

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    if (this.status.status === 'connected' || this.status.status === 'connecting') {
      return;
    }

    this.status.status = 'connecting';
    this.status.error = undefined;

    try {
      switch (this.config.transport) {
        case 'stdio':
          await this.connectStdio();
          break;
        case 'websocket':
          await this.connectWebSocket();
          break;
        case 'http':
          // HTTP transport doesn't maintain persistent connection
          this.status.status = 'connected';
          break;
        default:
          throw new Error(`Unsupported transport: ${this.config.transport}`);
      }

      this.status.status = 'connected';
      this.status.lastConnected = new Date();

      // Discover capabilities
      await this.discoverCapabilities();

    } catch (error) {
      this.status.status = 'error';
      this.status.error = error instanceof Error ? error.message : 'Connection failed';
      throw error;
    }
  }

  /**
   * Connect via stdio (for local MCP servers)
   */
  private async connectStdio(): Promise<void> {
    if (!this.config.command) {
      throw new Error('Command required for stdio transport');
    }

    // In browser environment, we can't spawn processes directly
    // This would typically be handled by a backend service
    if (typeof window !== 'undefined') {
      throw new Error('Stdio transport not supported in browser environment');
    }

    // Node.js environment - spawn process
    const { spawn } = await import('child_process');
    
    this.process = spawn(this.config.command, this.config.args || [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...this.config.env }
    });

    this.process.stdout.on('data', (data: Buffer) => {
      this.handleMessage(data.toString());
    });

    this.process.stderr.on('data', (data: Buffer) => {
    });

    this.process.on('exit', (code: number) => {
      this.status.status = 'disconnected';
    });
  }

  /**
   * Connect via WebSocket
   */
  private async connectWebSocket(): Promise<void> {
    if (!this.config.url) {
      throw new Error('URL required for websocket transport');
    }

    return new Promise((resolve, reject) => {
      this.websocket = new WebSocket(this.config.url!);

      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, this.config.timeout || 30000);

      this.websocket.onopen = () => {
        clearTimeout(timeout);
        resolve();
      };

      this.websocket.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };

      this.websocket.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.websocket.onclose = () => {
        this.status.status = 'disconnected';
      };
    });
  }

  /**
   * Handle incoming messages from MCP server
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as MCPResponse;
      
      const callback = this.requestCallbacks.get(message.id);
      if (callback) {
        clearTimeout(callback.timeout);
        this.requestCallbacks.delete(message.id);

        if (message.error) {
          callback.reject(new Error(message.error.message));
        } else {
          callback.resolve(message.result);
        }
      }
    } catch (error) {
    }
  }

  /**
   * Send request to MCP server
   */
  private async sendRequest(method: string, params?: any): Promise<any> {
    if (this.status.status !== 'connected') {
      throw new Error(`Server ${this.config.name} is not connected`);
    }

    const id = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const request: MCPRequest = { id, method: method as any, params };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.requestCallbacks.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, this.config.timeout || 30000);

      this.requestCallbacks.set(id, { resolve, reject, timeout });

      const message = JSON.stringify(request);

      if (this.config.transport === 'stdio' && this.process) {
        this.process.stdin.write(message + '\n');
      } else if (this.config.transport === 'websocket' && this.websocket) {
        this.websocket.send(message);
      } else if (this.config.transport === 'http') {
        // Handle HTTP transport
        this.sendHttpRequest(request).then(resolve).catch(reject);
        clearTimeout(timeout);
        this.requestCallbacks.delete(id);
      }
    });
  }

  /**
   * Send HTTP request for HTTP transport
   */
  private async sendHttpRequest(request: MCPRequest): Promise<any> {
    if (!this.config.url) {
      throw new Error('URL required for HTTP transport');
    }

    const response = await fetch(this.config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.accessToken && {
          'Authorization': `Bearer ${this.config.accessToken}`
        })
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.error) {
      throw new Error(result.error.message);
    }

    return result.result;
  }

  /**
   * Discover server capabilities
   */
  private async discoverCapabilities(): Promise<void> {
    try {
      // Try to list tools to check tool capability
      const tools = await this.sendRequest('tools/list');
      this.status.tools = tools?.tools || [];
      this.status.capabilities!.tools = true;
    } catch (error) {
      this.status.capabilities!.tools = false;
    }

    try {
      // Try to list resources
      await this.sendRequest('resources/list');
      this.status.capabilities!.resources = true;
    } catch (error) {
      this.status.capabilities!.resources = false;
    }

    try {
      // Try to list prompts
      await this.sendRequest('prompts/list');
      this.status.capabilities!.prompts = true;
    } catch (error) {
      this.status.capabilities!.prompts = false;
    }
  }

  /**
   * List available tools
   */
  async listTools(): Promise<MCPTool[]> {
    const result = await this.sendRequest('tools/list');
    return result?.tools || [];
  }

  /**
   * Call a tool
   */
  async callTool(toolName: string, args: any): Promise<MCPToolCall> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    try {
      const result = await this.sendRequest('tools/call', {
        name: toolName,
        arguments: args
      });

      return {
        tool: toolName,
        input: args,
        output: result,
        duration: Date.now() - startTime,
        timestamp
      };
    } catch (error) {
      return {
        tool: toolName,
        input: args,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
        timestamp
      };
    }
  }

  /**
   * Disconnect from server
   */
  async disconnect(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = undefined;
    }

    if (this.websocket) {
      this.websocket.close();
      this.websocket = undefined;
    }

    // Clear pending callbacks
    for (const [id, callback] of this.requestCallbacks) {
      clearTimeout(callback.timeout);
      callback.reject(new Error('Connection closed'));
    }
    this.requestCallbacks.clear();

    this.status.status = 'disconnected';
  }
}

/**
 * MCP Service - Main service class for managing MCP servers
 */
export class MCPService {
  private static instance: MCPService;
  private servers: Map<string, MCPServerConnection> = new Map();
  private predefinedConfigs: Map<string, Partial<MCPServerConfig>> = new Map();

  private constructor() {
    this.initializePredefinedConfigs();
  }

  public static getInstance(): MCPService {
    if (!MCPService.instance) {
      MCPService.instance = new MCPService();
    }
    return MCPService.instance;
  }

  /**
   * Initialize predefined server configurations
   */
  private initializePredefinedConfigs(): void {
    // Calendar MCP Server
    this.predefinedConfigs.set('calendar', {
      name: 'calendar',
      type: 'calendar',
      transport: 'stdio',
      command: 'node',
      args: ['mcp-servers/calendar-mcp/dist/index.js'],
      timeout: 30000,
      retries: 3
    });

    // Gmail MCP Server  
    this.predefinedConfigs.set('gmail', {
      name: 'gmail',
      type: 'email',
      transport: 'stdio',
      command: 'node',
      args: ['mcp-servers/gmail-mcp/dist/index.js'],
      timeout: 30000,
      retries: 3
    });

    // HTTP-based MCP Server example
    this.predefinedConfigs.set('http-calendar', {
      name: 'http-calendar',
      type: 'calendar',
      transport: 'http',
      url: 'http://localhost:3001/mcp',
      timeout: 10000,
      retries: 2
    });
  }

  /**
   * Register a new MCP server
   */
  async registerServer(config: MCPServerConfig): Promise<void> {
    // Merge with predefined config if it exists
    const predefinedConfig = this.predefinedConfigs.get(config.name);
    const finalConfig = { ...predefinedConfig, ...config };

    const connection = new MCPServerConnection(finalConfig);
    this.servers.set(config.name, connection);
  }

  /**
   * Connect to a server
   */
  async connectServer(name: string): Promise<void> {
    const server = this.servers.get(name);
    if (!server) {
      throw new Error(`Server ${name} not registered`);
    }

    await server.connect();
  }

  /**
   * Connect to multiple servers
   */
  async connectServers(names: string[]): Promise<MCPServerStatus[]> {
    const results = await Promise.allSettled(
      names.map(name => this.connectServer(name))
    );

    return names.map((name, index) => {
      const server = this.servers.get(name);
      if (!server) {
        return { name, status: 'error', error: 'Server not registered' };
      }

      const result = results[index];
      if (result.status === 'rejected') {
        server.status.error = result.reason?.message || 'Connection failed';
        server.status.status = 'error';
      }

      return server.status;
    });
  }

  /**
   * Get server status
   */
  getServerStatus(name: string): MCPServerStatus | undefined {
    return this.servers.get(name)?.status;
  }

  /**
   * Get all server statuses
   */
  getAllServerStatuses(): MCPServerStatus[] {
    return Array.from(this.servers.values()).map(server => server.status);
  }

  /**
   * List tools from a specific server
   */
  async listTools(serverName: string): Promise<MCPTool[]> {
    const server = this.servers.get(serverName);
    if (!server) {
      throw new Error(`Server ${serverName} not found`);
    }

    if (server.status.status !== 'connected') {
      throw new Error(`Server ${serverName} is not connected`);
    }

    return server.listTools();
  }

  /**
   * List tools from all connected servers
   */
  async listAllTools(): Promise<Record<string, MCPTool[]>> {
    const result: Record<string, MCPTool[]> = {};

    for (const [name, server] of this.servers) {
      if (server.status.status === 'connected') {
        try {
          result[name] = await server.listTools();
        } catch (error) {
          result[name] = [];
        }
      }
    }

    return result;
  }

  /**
   * Call a tool on a specific server
   */
  async callTool(serverName: string, toolName: string, args: any): Promise<MCPToolCall> {
    const server = this.servers.get(serverName);
    if (!server) {
      throw new Error(`Server ${serverName} not found`);
    }

    if (server.status.status !== 'connected') {
      throw new Error(`Server ${serverName} is not connected`);
    }

    return server.callTool(toolName, args);
  }

  /**
   * Call multiple tools in sequence
   */
  async callToolsSequential(
    calls: Array<{ server: string; tool: string; args: any }>
  ): Promise<MCPToolCall[]> {
    const results: MCPToolCall[] = [];

    for (const call of calls) {
      try {
        const result = await this.callTool(call.server, call.tool, call.args);
        results.push(result);

        // Stop on first error if needed
        if (result.error) {
          break;
        }
      } catch (error) {
        results.push({
          tool: call.tool,
          input: call.args,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: 0,
          timestamp: new Date().toISOString()
        });
        break;
      }
    }

    return results;
  }

  /**
   * Call multiple tools in parallel
   */
  async callToolsParallel(
    calls: Array<{ server: string; tool: string; args: any }>
  ): Promise<MCPToolCall[]> {
    const promises = calls.map(async call => {
      try {
        return await this.callTool(call.server, call.tool, call.args);
      } catch (error) {
        return {
          tool: call.tool,
          input: call.args,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: 0,
          timestamp: new Date().toISOString()
        };
      }
    });

    return Promise.all(promises);
  }

  /**
   * Disconnect from a server
   */
  async disconnectServer(name: string): Promise<void> {
    const server = this.servers.get(name);
    if (server) {
      await server.disconnect();
    }
  }

  /**
   * Disconnect from all servers
   */
  async disconnectAll(): Promise<void> {
    await Promise.all(
      Array.from(this.servers.values()).map(server => server.disconnect())
    );
  }

  /**
   * Remove a server registration
   */
  async unregisterServer(name: string): Promise<void> {
    await this.disconnectServer(name);
    this.servers.delete(name);
  }

  /**
   * Get predefined server configuration
   */
  getPredefinedConfig(name: string): Partial<MCPServerConfig> | undefined {
    return this.predefinedConfigs.get(name);
  }

  /**
   * Set authentication credentials for a server
   */
  setServerCredentials(serverName: string, credentials: {
    clientId?: string;
    clientSecret?: string;
    accessToken?: string;
    refreshToken?: string;
  }): void {
    const server = this.servers.get(serverName);
    if (server) {
      Object.assign(server.config, credentials);
    }
  }
}

export default MCPService;