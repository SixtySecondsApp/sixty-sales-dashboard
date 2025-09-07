import { supabase } from '../supabase/clientV2';
import type { AINodeConfig } from '../../components/workflows/AIAgentConfigModal';
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
import { z } from 'zod';

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
export class AIProviderService {
  private static instance: AIProviderService;
  private apiKeys: Map<string, string> = new Map();

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
        return;
      }

      if (data?.ai_provider_keys) {
        const keys = data.ai_provider_keys as Record<string, string>;
        Object.entries(keys).forEach(([provider, key]) => {
          this.apiKeys.set(provider, key);
        });
      }
    } catch (error) {
      console.error('Error loading AI provider keys:', error);
    }
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
      // Interpolate variables in prompts
      const systemPrompt = interpolateVariables(config.systemPrompt, variables);
      const userPrompt = interpolateVariables(config.userPrompt, variables);

      // Add chain-of-thought if enabled
      let enhancedSystemPrompt = systemPrompt;
      if (config.chainOfThought) {
        enhancedSystemPrompt += '\n\nPlease think step-by-step through your reasoning before providing the final answer.';
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
          case 'cohere':
            response = await this.completeWithCohere(config, enhancedSystemPrompt, enhancedUserPrompt);
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
    // Check for tool calls in the response
    if (config.enableTools && config.autoExecuteTools) {
      const toolCall = parseToolCall(response.content);
      
      if (toolCall.toolName && userId) {
        const toolRegistry = ToolRegistry.getInstance();
        const context: ToolExecutionContext = {
          userId,
          workflowId: undefined, // Will be set by workflow engine
          nodeId: undefined, // Will be set by workflow engine
        };
        
        const toolResult = await toolRegistry.executeTool(
          toolCall.toolName,
          toolCall.parameters || {},
          context
        );
        
        if (!response.toolCalls) {
          response.toolCalls = [];
        }
        
        response.toolCalls.push({
          toolName: toolCall.toolName,
          parameters: toolCall.parameters || {},
          result: toolResult,
        });
        
        // If tool execution was successful, append results to content
        if (toolResult.success) {
          response.content += `\n\nTool Result: ${JSON.stringify(toolResult.data, null, 2)}`;
        } else {
          response.content += `\n\nTool Error: ${toolResult.error}`;
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

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
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
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    
    return {
      content: data.choices[0].message.content,
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
      provider: 'openai',
      model: config.model,
    };
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
   * Complete using Cohere API
   */
  private async completeWithCohere(
    config: AINodeConfig,
    systemPrompt: string,
    userPrompt: string
  ): Promise<AIResponse> {
    const apiKey = this.apiKeys.get('cohere');
    if (!apiKey) {
      throw new Error('Cohere API key not configured. Please add it in settings.');
    }

    const response = await fetch('https://api.cohere.ai/v1/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        prompt: `${systemPrompt}\n\n${userPrompt}`,
        max_tokens: config.maxTokens || 1000,
        temperature: config.temperature || 0.7,
        return_likelihoods: 'NONE',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Cohere API error: ${error.message || response.statusText}`);
    }

    const data = await response.json();
    
    return {
      content: data.generations?.[0]?.text || '',
      provider: 'cohere',
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
               provider === 'anthropic' ? 'claude-3-haiku' : 
               provider === 'gemini' ? 'gemini-pro' :
               provider === 'cohere' ? 'command' :
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
}