import { supabase } from '../supabase/clientV2';
import type { AINodeConfig } from '../../components/workflows/AIAgentConfigModal';
import type { CustomGPTNodeConfig } from '../../components/workflows/CustomGPTConfigModal';
import { interpolateVariables, VariableContext } from '../utils/promptVariables';
import { 
  parseJSONResponse, 
  extractFields, 
  validateResponse,
  processWithRetry,
  ExtractionRule,
  ProcessingResult 
} from '../utils/responseProcessing';
import { 
  ToolRegistry, 
  formatToolsForAI, 
  parseToolCall,
  ToolExecutionContext 
} from '../services/workflowTools';
import { 
  MCPServerManager,
  MCPRequest,
  MCPResponse 
} from '../mcp/mcpServer';
import { z } from 'zod';
import { openaiAssistantService, type AssistantResponse } from './openaiAssistantService';
import type { AssistantManagerNodeConfig } from '../../components/workflows/AssistantManagerConfigModal';

export interface AIResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  error?: string;
  provider?: string;
  model?: string;
  processedData?: any;
  extractedFields?: Record<string, any>;
  toolCalls?: Array<{
    toolName: string;
    parameters: Record<string, any>;
    result?: any;
  }>;
}

export interface AIProviderConfig {
  apiKey: string;
  baseUrl?: string;
  organization?: string;
}

/**
 * Service for managing AI provider integrations
 */
interface ModelCache {
  models: Array<{ value: string; label: string }>;
  timestamp: number;
}

export class AIProviderService {
  private static instance: AIProviderService;
  private apiKeys: Map<string, string> = new Map();
  private modelCache: Map<string, ModelCache> = new Map();
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  private constructor() {}

  public static getInstance(): AIProviderService {
    if (!AIProviderService.instance) {
      AIProviderService.instance = new AIProviderService();
    }
    return AIProviderService.instance;
  }

  /**
   * Initialize the service and load API keys from user settings
   */
  public async initialize(userId: string): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('ai_provider_keys')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.warn('No AI provider keys found for user:', error);
        // Try to load from environment variables as fallback
        this.loadFromEnvironment();
        return;
      }

      if (data?.ai_provider_keys) {
        const keys = data.ai_provider_keys as Record<string, string>;
        Object.entries(keys).forEach(([provider, key]) => {
          this.apiKeys.set(provider, key);
        });
      }
      
      // Also check environment variables for any missing keys
      this.loadFromEnvironment();
    } catch (error) {
      console.error('Error loading AI provider keys:', error);
      this.loadFromEnvironment();
    }
  }

  /**
   * Load API keys from environment variables
   */
  private loadFromEnvironment(): void {
    const envKeys = {
      openai: import.meta.env.VITE_OPENAI_API_KEY,
      anthropic: import.meta.env.VITE_ANTHROPIC_API_KEY,
      openrouter: import.meta.env.VITE_OPENROUTER_API_KEY,
      gemini: import.meta.env.VITE_GEMINI_API_KEY,
    };

    Object.entries(envKeys).forEach(([provider, key]) => {
      if (key && !this.apiKeys.has(provider)) {
        this.apiKeys.set(provider, key);
      }
    });
  }

  /**
   * Save API key for a provider
   */
  public async saveApiKey(userId: string, provider: string, apiKey: string): Promise<void> {
    this.apiKeys.set(provider, apiKey);

    const allKeys = Object.fromEntries(this.apiKeys);
    
    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: userId,
        ai_provider_keys: allKeys,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      throw new Error(`Failed to save API key: ${error.message}`);
    }
  }

  /**
   * Complete a prompt using the specified AI model
   */
  public async complete(
    config: AINodeConfig,
    variables: VariableContext,
    userId?: string
  ): Promise<AIResponse> {
    try {
      // Ensure we have a user ID for tracking and tools
      const effectiveUserId = userId || 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459'; // Fallback to dev user ID
      // Interpolate variables in prompts
      const systemPrompt = interpolateVariables(config.systemPrompt, variables);
      const userPrompt = interpolateVariables(config.userPrompt, variables);

      // Add chain-of-thought if enabled
      let enhancedSystemPrompt = systemPrompt;
      if (config.chainOfThought) {
        enhancedSystemPrompt += '\n\nPlease think step-by-step through your reasoning before providing the final answer.';
      }

      // Auto-enhance system prompt for CRM queries
      const crmKeywords = ['crm', 'contact', 'deal', 'company', 'record', 'database', 'search', 'find', 'lookup'];
      const isCRMQuery = crmKeywords.some(keyword => 
        userPrompt.toLowerCase().includes(keyword) || 
        systemPrompt.toLowerCase().includes(keyword)
      );
      
      if (isCRMQuery && !systemPrompt.includes('CRM access')) {
        enhancedSystemPrompt += '\n\nYou have direct access to the CRM database and can search for contacts, companies, and deals. ';
        enhancedSystemPrompt += 'When asked about CRM records, always use the available tools to search the actual database. ';
        enhancedSystemPrompt += 'Provide specific information and links when records are found.';
      }

      // Add tool instructions if enabled
      if (config.enableTools && config.selectedTools && config.selectedTools.length > 0) {
        const toolRegistry = ToolRegistry.getInstance();
        const selectedTools = config.selectedTools
          .map(name => toolRegistry.getTool(name)?.definition)
          .filter(Boolean);
        
        if (selectedTools.length > 0) {
          const toolDescriptions = formatToolsForAI(selectedTools);
          enhancedSystemPrompt += `\n\nYou have access to the following tools:\n\n${toolDescriptions}\n\n`;
          enhancedSystemPrompt += 'To use a tool, format your response as:\n';
          enhancedSystemPrompt += '<tool>tool_name</tool>\n';
          enhancedSystemPrompt += '<parameters>{"param1": "value1", "param2": "value2"}</parameters>\n';
          enhancedSystemPrompt += 'Then provide your analysis of the results.';
        }
      }

      // Add MCP server instructions if enabled
      if (config.enableMCP && config.selectedMCPServers && config.selectedMCPServers.length > 0 && userId) {
        const mcpManager = MCPServerManager.getInstance();
        
        // Initialize user servers if not already done
        mcpManager.initializeUserServers(effectiveUserId);
        
        enhancedSystemPrompt += '\n\nYou have access to MCP (Model Context Protocol) servers:\n';
        
        for (const serverName of config.selectedMCPServers) {
          enhancedSystemPrompt += `- ${serverName}: Access to ${serverName} data and operations\n`;
        }
        
        enhancedSystemPrompt += '\nTo use MCP, format requests as:\n';
        enhancedSystemPrompt += '<mcp server="server_name" method="method_name">{"params": {...}}</mcp>\n';
        enhancedSystemPrompt += 'Available methods: tools/list, tools/call, resources/list, resources/get, prompts/list, prompts/get';
      }

      // Add output format instructions
      if (config.outputFormat === 'json') {
        enhancedSystemPrompt += '\n\nYou must respond with valid JSON only. Do not include any explanatory text outside the JSON structure.';
        if (config.jsonSchema) {
          enhancedSystemPrompt += `\n\nThe JSON must conform to this schema:\n${config.jsonSchema}`;
        }
      }

      // Add few-shot examples if provided
      let enhancedUserPrompt = userPrompt;
      if (config.fewShotExamples && config.fewShotExamples.length > 0) {
        const examples = config.fewShotExamples.map(ex => 
          `Example:\nInput: ${ex.input}\nOutput: ${ex.output}`
        ).join('\n\n');
        enhancedUserPrompt = `${examples}\n\nNow process this:\n${userPrompt}`;
      }

      // Execute with retry logic if enabled
      const executeFn = async () => {
        let response: AIResponse;
        
        switch (config.modelProvider) {
          case 'openai':
            response = await this.completeWithOpenAI(config, enhancedSystemPrompt, enhancedUserPrompt);
            break;
          case 'anthropic':
            response = await this.completeWithAnthropic(config, enhancedSystemPrompt, enhancedUserPrompt);
            break;
          case 'openrouter':
            response = await this.completeWithOpenRouter(config, enhancedSystemPrompt, enhancedUserPrompt);
            break;
          case 'gemini':
            response = await this.completeWithGemini(config, enhancedSystemPrompt, enhancedUserPrompt);
            break;
          default:
            throw new Error(`Unsupported provider: ${config.modelProvider}`);
        }

        // Process response if needed
        if (!response.error && response.content) {
          response = await this.processResponse(response, config, userId);
        }

        return response;
      };

      // Use retry logic if configured
      if (config.retryOnError && config.maxRetries) {
        const result = await processWithRetry(executeFn, config.maxRetries, 1000);
        if (!result.success) {
          return {
            content: '',
            error: result.error,
          };
        }
        return result.data!;
      } else {
        return await executeFn();
      }
    } catch (error) {
      console.error('AI completion error:', error);
      return {
        content: '',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Process AI response based on configuration
   */
  private async processResponse(
    response: AIResponse,
    config: AINodeConfig,
    userId?: string
  ): Promise<AIResponse> {
    // Check for MCP requests in the response
    if (config.enableMCP && userId) {
      const mcpMatch = response.content.match(/<mcp\s+server="([^"]+)"\s+method="([^"]+)">([^<]*)<\/mcp>/);
      
      if (mcpMatch) {
        const [, serverName, method, paramsStr] = mcpMatch;
        
        try {
          const params = paramsStr ? JSON.parse(paramsStr) : {};
          const mcpManager = MCPServerManager.getInstance();
          
          const mcpRequest: MCPRequest = {
            id: `req_${Date.now()}`,
            method: method as any,
            params
          };
          
          const mcpResponse = await mcpManager.handleRequest(serverName, mcpRequest);
          
          if (mcpResponse.error) {
            response.content += `\n\nMCP Error: ${mcpResponse.error.message}`;
          } else {
            response.content += `\n\nMCP Result: ${JSON.stringify(mcpResponse.result, null, 2)}`;
          }
        } catch (error) {
          response.content += `\n\nMCP Parse Error: ${error}`;
        }
      }
    }
    
    // Check for tool calls in the response
    if (config.enableTools && config.autoExecuteTools) {
      const toolCall = parseToolCall(response.content);
      console.log('[AIProvider] Parsed tool call:', toolCall);
      
      if (toolCall.toolName) {
        const toolRegistry = ToolRegistry.getInstance();
        const context: ToolExecutionContext = {
          userId: effectiveUserId,
          workflowId: undefined, // Will be set by workflow engine
          nodeId: undefined, // Will be set by workflow engine
        };
        
        console.log('[AIProvider] Executing tool:', toolCall.toolName, 'with params:', toolCall.parameters);
        
        try {
          const toolResult = await toolRegistry.executeTool(
            toolCall.toolName,
            toolCall.parameters || {},
            context
          );
          
          console.log('[AIProvider] Tool execution result:', toolResult);
          
          if (!response.toolCalls) {
            response.toolCalls = [];
          }
          
          response.toolCalls.push({
            toolName: toolCall.toolName,
            parameters: toolCall.parameters || {},
            result: toolResult,
          });
          
          // Format the response based on tool results
          if (toolResult.success && toolResult.data) {
            const data = Array.isArray(toolResult.data) ? toolResult.data : [toolResult.data];
            
            if (data.length > 0) {
              // For contact search, format a user-friendly response
              if (toolCall.toolName === 'search_contacts') {
                const contacts = data;
                response.content = `Found ${contacts.length} contact(s) matching your search:\n\n`;
                contacts.forEach((contact: any) => {
                  response.content += `**${contact.name}**\n`;
                  response.content += `- Email: ${contact.email}\n`;
                  if (contact.company) response.content += `- Company: ${contact.company}\n`;
                  response.content += `- CRM Link: ${contact.crm_link || contact.view_url}\n\n`;
                });
              } else {
                // Generic tool result formatting
                response.content = `Tool executed successfully. Results:\n\n${JSON.stringify(data, null, 2)}`;
              }
            } else {
              response.content = 'No records found matching your search criteria.';
            }
          } else if (toolResult.error) {
            response.content = `I encountered an error while searching: ${toolResult.error}`;
          } else {
            response.content = 'The search completed but returned no results.';
          }
        } catch (error) {
          console.error('[AIProvider] Tool execution error:', error);
          response.content = `Error executing tool: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      }
    }
    
    // Parse JSON if output format is JSON
    if (config.outputFormat === 'json' || config.outputFormat === 'structured') {
      const parseResult = parseJSONResponse(response.content);
      if (parseResult.success) {
        response.processedData = parseResult.data;
        
        // Validate against schema if provided
        if (config.jsonSchema) {
          try {
            const schema = z.object(JSON.parse(config.jsonSchema));
            const validationResult = validateResponse(parseResult.data, schema);
            if (!validationResult.success) {
              response.error = `JSON validation failed: ${validationResult.error}`;
            } else {
              response.processedData = validationResult.data;
            }
          } catch (error) {
            console.warn('Invalid JSON schema provided:', error);
          }
        }
      } else if (config.outputFormat === 'json') {
        response.error = parseResult.error;
      }
    }

    // Extract fields if rules are provided
    if (config.extractionRules && config.extractionRules.length > 0) {
      const extractionResult = extractFields(
        response.processedData || response.content,
        config.extractionRules
      );
      
      if (extractionResult.success || extractionResult.extractedFields) {
        response.extractedFields = extractionResult.extractedFields;
      }
      
      if (!extractionResult.success && extractionResult.error) {
        response.error = response.error 
          ? `${response.error}; ${extractionResult.error}`
          : extractionResult.error;
      }
    }

    return response;
  }

  /**
   * Complete using OpenAI API
   */
  private async completeWithOpenAI(
    config: AINodeConfig,
    systemPrompt: string,
    userPrompt: string
  ): Promise<AIResponse> {
    const apiKey = this.apiKeys.get('openai');
    if (!apiKey) {
      throw new Error('OpenAI API key not configured. Please add it in settings.');
    }

    // Map invalid model names to valid ones
    let model = config.model;
    const modelMapping: Record<string, string> = {
      'gpt-5-mini': 'gpt-4o-mini',
      'gpt-5': 'gpt-4o',
      'gpt-3.5': 'gpt-3.5-turbo',
      'gpt-4': 'gpt-4-turbo',
    };
    
    if (modelMapping[model]) {
      console.warn(`Model "${model}" is not valid. Using "${modelMapping[model]}" instead.`);
      model = modelMapping[model];
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: config.temperature || 0.7,
          max_tokens: config.maxTokens || 1000,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        const errorMessage = error.error?.message || response.statusText;
        console.error('OpenAI API error:', errorMessage);
        throw new Error(`OpenAI API error: ${errorMessage}`);
      }

      const data = await response.json();
      
      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response from OpenAI API');
      }
      
      return {
        content: data.choices[0].message.content || '',
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
        provider: 'openai',
        model: model,
      };
    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      return {
        content: '',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        provider: 'openai',
        model: model,
      };
    }
  }

  /**
   * Complete using Anthropic API
   */
  private async completeWithAnthropic(
    config: AINodeConfig,
    systemPrompt: string,
    userPrompt: string
  ): Promise<AIResponse> {
    const apiKey = this.apiKeys.get('anthropic');
    if (!apiKey) {
      throw new Error('Anthropic API key not configured. Please add it in settings.');
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt },
        ],
        temperature: config.temperature || 0.7,
        max_tokens: config.maxTokens || 1000,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    
    return {
      content: data.content[0].text,
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      },
      provider: 'anthropic',
      model: config.model,
    };
  }

  /**
   * Complete using OpenRouter API
   */
  private async completeWithOpenRouter(
    config: AINodeConfig,
    systemPrompt: string,
    userPrompt: string
  ): Promise<AIResponse> {
    const apiKey = this.apiKeys.get('openrouter');
    if (!apiKey) {
      throw new Error('OpenRouter API key not configured. Please add it in settings.');
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Sixty Sales Dashboard',
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: config.temperature || 0.7,
        max_tokens: config.maxTokens || 1000,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenRouter API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    
    return {
      content: data.choices[0].message.content,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
      provider: 'openrouter',
      model: config.model,
    };
  }

  /**
   * Complete using Google Gemini API
   */
  private async completeWithGemini(
    config: AINodeConfig,
    systemPrompt: string,
    userPrompt: string
  ): Promise<AIResponse> {
    const apiKey = this.apiKeys.get('gemini');
    if (!apiKey) {
      throw new Error('Gemini API key not configured. Please add it in settings.');
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: `${systemPrompt}\n\n${userPrompt}` },
              ],
            },
          ],
          generationConfig: {
            temperature: config.temperature || 0.7,
            maxOutputTokens: config.maxTokens || 1000,
            topP: 0.95,
            topK: 40,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Gemini API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    return {
      content,
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount || 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata?.totalTokenCount || 0,
      },
      provider: 'gemini',
      model: config.model,
    };
  }


  /**
   * Test API key validity
   */
  public async testApiKey(provider: string, apiKey: string): Promise<boolean> {
    try {
      // Store temporarily for testing
      const originalKey = this.apiKeys.get(provider);
      this.apiKeys.set(provider, apiKey);

      const testConfig: AINodeConfig = {
        modelProvider: provider as any,
        model: provider === 'openai' ? 'gpt-3.5-turbo' : 
               provider === 'anthropic' ? 'claude-3-haiku-20240307' : 
               provider === 'gemini' ? 'gemini-pro' :
               'openai/gpt-3.5-turbo',
        systemPrompt: 'You are a test assistant.',
        userPrompt: 'Say "API key is valid" if you can read this.',
        temperature: 0.1,
        maxTokens: 10,
      };

      const response = await this.complete(testConfig, {});

      // Restore original key if it existed
      if (originalKey) {
        this.apiKeys.set(provider, originalKey);
      } else {
        this.apiKeys.delete(provider);
      }

      return !response.error && response.content.length > 0;
    } catch (error) {
      console.error('API key test failed:', error);
      return false;
    }
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(provider: string): boolean {
    const cache = this.modelCache.get(provider);
    if (!cache) return false;
    return Date.now() - cache.timestamp < this.CACHE_DURATION;
  }

  /**
   * Clear cache for a specific provider or all providers
   */
  public clearModelCache(provider?: string): void {
    if (provider) {
      this.modelCache.delete(provider);
    } else {
      this.modelCache.clear();
    }
  }

  /**
   * Fetch available models from OpenAI with caching
   */
  public async fetchOpenAIModels(forceRefresh = false): Promise<Array<{ value: string; label: string }>> {
    // Check cache first
    if (!forceRefresh && this.isCacheValid('openai')) {
      return this.modelCache.get('openai')!.models;
    }

    const apiKey = this.apiKeys.get('openai');
    if (!apiKey) {
      return [
        { value: 'gpt-4-turbo-preview', label: 'GPT-4 Turbo' },
        { value: 'gpt-4', label: 'GPT-4' },
        { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
      ];
    }

    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch models');
      }

      const data = await response.json();
      const chatModels = data.data
        .filter((model: any) => 
          model.id.includes('gpt') || model.id.includes('o1')
        )
        .map((model: any) => ({
          value: model.id,
          label: model.id.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        }))
        .sort((a: any, b: any) => {
          // Sort to put newer models first
          if (a.value.includes('gpt-5') && !b.value.includes('gpt-5')) return -1;
          if (!a.value.includes('gpt-5') && b.value.includes('gpt-5')) return 1;
          if (a.value.includes('gpt-4.1') && !b.value.includes('gpt-4.1')) return -1;
          if (!a.value.includes('gpt-4.1') && b.value.includes('gpt-4.1')) return 1;
          if (a.value.includes('gpt-4') && !b.value.includes('gpt-4')) return -1;
          if (!a.value.includes('gpt-4') && b.value.includes('gpt-4')) return 1;
          if (a.value.includes('o1') && !b.value.includes('o1')) return -1;
          if (!a.value.includes('o1') && b.value.includes('o1')) return 1;
          return a.value.localeCompare(b.value);
        });

      const models = chatModels.length > 0 ? chatModels : [
        { value: 'gpt-4-turbo-preview', label: 'GPT-4 Turbo' },
        { value: 'gpt-4', label: 'GPT-4' },
        { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
      ];

      // Cache the results
      this.modelCache.set('openai', {
        models,
        timestamp: Date.now(),
      });

      return models;
    } catch (error) {
      console.error('Error fetching OpenAI models:', error);
      return [
        { value: 'gpt-4-turbo-preview', label: 'GPT-4 Turbo' },
        { value: 'gpt-4', label: 'GPT-4' },
        { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
      ];
    }
  }

  /**
   * Fetch available models from Anthropic with caching
   */
  public async fetchAnthropicModels(forceRefresh = false): Promise<Array<{ value: string; label: string }>> {
    // Check cache first
    if (!forceRefresh && this.isCacheValid('anthropic')) {
      return this.modelCache.get('anthropic')!.models;
    }

    const apiKey = this.apiKeys.get('anthropic');
    if (!apiKey) {
      return [
        { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
        { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
        { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
        { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' },
        { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
      ];
    }

    try {
      // Anthropic now has a models endpoint!
      const response = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch models');
      }

      const data = await response.json();
      const models = data.data
        .map((model: any) => ({
          value: model.id,
          label: model.display_name || model.id,
        }))
        .sort((a: any, b: any) => {
          // Sort newest models first
          if (a.label.includes('4.1') && !b.label.includes('4.1')) return -1;
          if (!a.label.includes('4.1') && b.label.includes('4.1')) return 1;
          if (a.label.includes('4') && !b.label.includes('4')) return -1;
          if (!a.label.includes('4') && b.label.includes('4')) return 1;
          if (a.label.includes('3.7') && !b.label.includes('3.7')) return -1;
          if (!a.label.includes('3.7') && b.label.includes('3.7')) return 1;
          return b.label.localeCompare(a.label);
        });

      const result = models.length > 0 ? models : [
        { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
        { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' },
        { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
      ];

      // Cache the results
      this.modelCache.set('anthropic', {
        models: result,
        timestamp: Date.now(),
      });

      return result;
    } catch (error) {
      console.error('Error fetching Anthropic models:', error);
      // Return fallback models
      return [
        { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
        { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' },
        { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
      ];
    }
  }

  /**
   * Fetch available models from OpenRouter with caching
   */
  public async fetchOpenRouterModels(forceRefresh = false): Promise<Array<{ value: string; label: string }>> {
    // Check cache first
    if (!forceRefresh && this.isCacheValid('openrouter')) {
      return this.modelCache.get('openrouter')!.models;
    }

    const apiKey = this.apiKeys.get('openrouter');
    if (!apiKey) {
      return [
        { value: 'openai/gpt-4-turbo-preview', label: 'GPT-4 Turbo (via OpenRouter)' },
        { value: 'anthropic/claude-3-opus', label: 'Claude 3 Opus (via OpenRouter)' },
        { value: 'meta-llama/llama-3-70b', label: 'Llama 3 70B' },
      ];
    }

    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch models');
      }

      const data = await response.json();
      const models = data.data
        .filter((model: any) => !model.id.includes('instruct') && !model.id.includes('free'))
        .slice(0, 20) // Limit to top 20 models
        .map((model: any) => ({
          value: model.id,
          label: model.name || model.id,
        }));

      const result = models.length > 0 ? models : [
        { value: 'openai/gpt-4-turbo-preview', label: 'GPT-4 Turbo (via OpenRouter)' },
        { value: 'anthropic/claude-3-opus', label: 'Claude 3 Opus (via OpenRouter)' },
        { value: 'meta-llama/llama-3-70b', label: 'Llama 3 70B' },
      ];

      // Cache the results
      this.modelCache.set('openrouter', {
        models: result,
        timestamp: Date.now(),
      });

      return result;
    } catch (error) {
      console.error('Error fetching OpenRouter models:', error);
      return [
        { value: 'openai/gpt-4-turbo-preview', label: 'GPT-4 Turbo (via OpenRouter)' },
        { value: 'anthropic/claude-3-opus', label: 'Claude 3 Opus (via OpenRouter)' },
        { value: 'meta-llama/llama-3-70b', label: 'Llama 3 70B' },
      ];
    }
  }

  /**
   * Fetch available models from Google Gemini with caching
   */
  public async fetchGeminiModels(forceRefresh = false): Promise<Array<{ value: string; label: string }>> {
    // Check cache first
    if (!forceRefresh && this.isCacheValid('gemini')) {
      return this.modelCache.get('gemini')!.models;
    }

    const apiKey = this.apiKeys.get('gemini');
    if (!apiKey) {
      return [
        { value: 'gemini-pro', label: 'Gemini Pro' },
        { value: 'gemini-pro-vision', label: 'Gemini Pro Vision' },
        { value: 'gemini-1.5-pro-latest', label: 'Gemini 1.5 Pro' },
      ];
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch models');
      }

      const data = await response.json();
      const models = data.models
        .filter((model: any) => model.supportedGenerationMethods?.includes('generateContent'))
        .map((model: any) => ({
          value: model.name.replace('models/', ''),
          label: model.displayName || model.name.replace('models/', ''),
        }));

      const result = models.length > 0 ? models : [
        { value: 'gemini-pro', label: 'Gemini Pro' },
        { value: 'gemini-pro-vision', label: 'Gemini Pro Vision' },
        { value: 'gemini-1.5-pro-latest', label: 'Gemini 1.5 Pro' },
      ];

      // Cache the results
      this.modelCache.set('gemini', {
        models: result,
        timestamp: Date.now(),
      });

      return result;
    } catch (error) {
      console.error('Error fetching Gemini models:', error);
      return [
        { value: 'gemini-pro', label: 'Gemini Pro' },
        { value: 'gemini-pro-vision', label: 'Gemini Pro Vision' },
        { value: 'gemini-1.5-pro-latest', label: 'Gemini 1.5 Pro' },
      ];
    }
  }

  /**
   * Fetch all available models for a provider with optional force refresh
   */
  public async fetchModelsForProvider(provider: string, forceRefresh = false): Promise<Array<{ value: string; label: string }>> {
    switch (provider) {
      case 'openai':
        return this.fetchOpenAIModels(forceRefresh);
      case 'anthropic':
        return this.fetchAnthropicModels(forceRefresh);
      case 'openrouter':
        return this.fetchOpenRouterModels(forceRefresh);
      case 'gemini':
        return this.fetchGeminiModels(forceRefresh);
      default:
        return [];
    }
  }

  /**
   * Get usage statistics for a user
   */
  public async getUsageStats(userId: string): Promise<any> {
    const { data, error } = await supabase
      .from('ai_usage_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching usage stats:', error);
      return null;
    }

    return data;
  }

  /**
   * Log AI usage for billing and monitoring
   */
  public async logUsage(
    userId: string,
    response: AIResponse,
    workflowId?: string
  ): Promise<void> {
    if (!response.usage) return;

    const { error } = await supabase
      .from('ai_usage_logs')
      .insert({
        user_id: userId,
        workflow_id: workflowId,
        provider: response.provider,
        model: response.model,
        prompt_tokens: response.usage.promptTokens,
        completion_tokens: response.usage.completionTokens,
        total_tokens: response.usage.totalTokens,
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Error logging AI usage:', error);
    }
  }

  /**
   * Execute a Custom GPT assistant
   */
  public async executeCustomGPT(
    config: CustomGPTNodeConfig,
    variables: VariableContext,
    userId?: string
  ): Promise<AIResponse> {
    try {
      // Initialize the OpenAI Assistant service with user's API key
      if (userId) {
        await openaiAssistantService.initialize(userId);
      } else {
        // Try to use API key from environment or existing keys
        const openaiKey = this.apiKeys.get('openai');
        if (openaiKey) {
          openaiAssistantService.setApiKey(openaiKey);
        } else {
          await openaiAssistantService.initialize();
        }
      }

      // Execute the assistant
      const result = await openaiAssistantService.executeAssistant({
        assistantId: config.assistantId,
        threadId: config.threadId,
        createNewThread: config.createNewThread,
        message: config.message,
        variables,
        imageUrls: config.imageUrls,
        additionalInstructions: config.additionalInstructions,
        metadata: config.metadata,
        toolChoice: config.toolChoice,
        temperature: config.temperature,
        maxPromptTokens: config.maxPromptTokens,
        maxCompletionTokens: config.maxCompletionTokens,
        responseFormat: config.responseFormat,
        truncationStrategy: config.truncationStrategy,
      });

      // Convert to AIResponse format
      const response: AIResponse = {
        content: result.content || '',
        usage: result.usage,
        error: result.error,
        provider: 'openai',
        model: config.assistantName || 'custom-gpt',
        metadata: result.metadata,
      };

      // Parse JSON if response format is JSON
      if (config.responseFormat === 'json_object' && result.content) {
        try {
          response.processedData = JSON.parse(result.content);
        } catch (error) {
          console.warn('Failed to parse JSON response from assistant:', error);
        }
      }

      return response;
    } catch (error) {
      console.error('Custom GPT execution error:', error);
      return {
        content: '',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        provider: 'openai',
        model: 'custom-gpt',
      };
    }
  }

  /**
   * Execute Assistant Manager operations (create or update assistant)
   */
  public async executeAssistantManager(
    config: AssistantManagerNodeConfig,
    variables: VariableContext,
    userId?: string
  ): Promise<AIResponse> {
    try {
      // Initialize the OpenAI Assistant service with user's API key
      if (userId) {
        await openaiAssistantService.initialize(userId);
      } else {
        // Try to use API key from environment or existing keys
        const openaiKey = this.apiKeys.get('openai');
        if (openaiKey) {
          openaiAssistantService.setApiKey(openaiKey);
        } else {
          await openaiAssistantService.initialize();
        }
      }

      let result: any = {};
      
      if (config.operation === 'create') {
        // Create a new assistant
        const assistant = await openaiAssistantService.createAssistant({
          name: interpolateVariables(config.assistantName || 'New Assistant', variables),
          description: config.description ? interpolateVariables(config.description, variables) : undefined,
          model: config.model || 'gpt-4-turbo-preview',
          instructions: config.instructions ? interpolateVariables(config.instructions, variables) : undefined,
          tools: config.tools,
          metadata: config.metadata,
          temperature: config.temperature,
          topP: config.topP,
          responseFormat: config.responseFormat,
        });

        // Handle file uploads if provided
        if (config.files && config.files.length > 0) {
          const fileIds: string[] = [];
          for (const file of config.files) {
            // Note: Files should be uploaded through the UI before execution
            // The config.files array should contain file IDs
            if (typeof file === 'string') {
              fileIds.push(file);
            } else if (file.id) {
              fileIds.push(file.id);
            }
          }

          // Create or attach to vector store if file search is enabled
          if (config.tools?.fileSearch && fileIds.length > 0) {
            let vectorStoreId = config.vectorStoreId;
            
            if (!vectorStoreId && config.vectorStoreName) {
              // Create a new vector store
              const vectorStore = await openaiAssistantService.createVectorStore({
                name: interpolateVariables(config.vectorStoreName, variables),
                fileIds,
              });
              vectorStoreId = vectorStore.id;
            } else if (vectorStoreId) {
              // Attach files to existing vector store
              await openaiAssistantService.attachFilesToVectorStore(vectorStoreId, fileIds);
            }

            // Attach vector store to assistant
            if (vectorStoreId) {
              await openaiAssistantService.attachVectorStoreToAssistant(assistant.id, vectorStoreId);
            }
          }
        }

        result = {
          assistantId: assistant.id,
          assistantName: assistant.name,
          operation: 'created',
          model: assistant.model,
          tools: assistant.tools,
        };
      } else if (config.operation === 'update' && config.assistantId) {
        // Update existing assistant
        const assistant = await openaiAssistantService.updateAssistant(
          config.assistantId,
          {
            name: config.assistantName ? interpolateVariables(config.assistantName, variables) : undefined,
            description: config.description ? interpolateVariables(config.description, variables) : undefined,
            model: config.model,
            instructions: config.instructions ? interpolateVariables(config.instructions, variables) : undefined,
            tools: config.tools,
            metadata: config.metadata,
            temperature: config.temperature,
            topP: config.topP,
            responseFormat: config.responseFormat,
          }
        );

        // Handle file updates if provided
        if (config.files && config.files.length > 0) {
          const fileIds: string[] = [];
          for (const file of config.files) {
            if (typeof file === 'string') {
              fileIds.push(file);
            } else if (file.id) {
              fileIds.push(file.id);
            }
          }

          // Update vector store if needed
          if (config.tools?.fileSearch && fileIds.length > 0) {
            let vectorStoreId = config.vectorStoreId;
            
            if (!vectorStoreId && config.vectorStoreName) {
              // Create a new vector store
              const vectorStore = await openaiAssistantService.createVectorStore({
                name: interpolateVariables(config.vectorStoreName, variables),
                fileIds,
              });
              vectorStoreId = vectorStore.id;
              await openaiAssistantService.attachVectorStoreToAssistant(assistant.id, vectorStoreId);
            } else if (vectorStoreId) {
              // Attach new files to existing vector store
              await openaiAssistantService.attachFilesToVectorStore(vectorStoreId, fileIds);
            }
          }
        }

        result = {
          assistantId: assistant.id,
          assistantName: assistant.name,
          operation: 'updated',
          model: assistant.model,
          tools: assistant.tools,
        };
      } else {
        throw new Error('Invalid operation or missing assistant ID for update');
      }

      // Return response
      return {
        content: JSON.stringify(result, null, 2),
        provider: 'openai',
        model: 'assistant-manager',
        processedData: result,
      };
    } catch (error) {
      console.error('Assistant Manager execution error:', error);
      return {
        content: '',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        provider: 'openai',
        model: 'assistant-manager',
      };
    }
  }
}