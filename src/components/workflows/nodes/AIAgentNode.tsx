import React, { memo, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { 
  Sparkles, 
  CheckCircle, 
  XCircle, 
  Clock, 
  PlayCircle, 
  Settings2, 
  Zap, 
  Bot,
  Network,
  Brain
} from 'lucide-react';

export interface AIAgentNodeData {
  label: string;
  config?: {
    modelProvider?: 'openai' | 'anthropic' | 'openrouter';
    model?: string;
    systemPrompt?: string;
    userPrompt?: string;
    temperature?: number;
    maxTokens?: number;
    // MCP Support
    mcpEnabled?: boolean;
    mcpServers?: string[];
    mcpTools?: string[];
    mcpResources?: string[];
    toolExecutionMode?: 'sequential' | 'parallel' | 'conditional';
    maxToolCalls?: number;
    toolCallTimeout?: number;
  };
  executionMode?: boolean;
  executionData?: {
    output?: any;
    error?: string;
    duration?: number;
    timestamp?: string;
    toolCalls?: Array<{
      tool: string;
      input: any;
      output?: any;
      error?: string;
      duration?: number;
    }>;
    mcpConnections?: Array<{
      server: string;
      status: 'connected' | 'failed' | 'timeout';
      tools?: string[];
    }>;
  };
  executionStatus?: 'pending' | 'running' | 'completed' | 'failed';
}

const AIAgentNode = memo(({ data, selected }: NodeProps<AIAgentNodeData>) => {
  const [isConfigExpanded, setIsConfigExpanded] = useState(false);

  const getExecutionStatusIcon = () => {
    if (!data.executionMode) return null;
    
    switch (data.executionStatus) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-400" />;
      case 'running':
        return <PlayCircle className="w-4 h-4 text-blue-400 animate-pulse" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getExecutionStatusColor = () => {
    if (!data.executionMode) return '';
    
    switch (data.executionStatus) {
      case 'completed':
        return 'ring-2 ring-green-400/30';
      case 'failed':
        return 'ring-2 ring-red-400/30';
      case 'running':
        return 'ring-2 ring-blue-400/30 animate-pulse';
      default:
        return 'ring-2 ring-gray-400/30';
    }
  };

  const getModelProviderIcon = () => {
    switch (data.config?.modelProvider) {
      case 'openai':
        return <Bot className="w-3 h-3 text-green-400" />;
      case 'anthropic':
        return <Brain className="w-3 h-3 text-orange-400" />;
      case 'openrouter':
        return <Network className="w-3 h-3 text-blue-400" />;
      default:
        return <Sparkles className="w-3 h-3 text-purple-400" />;
    }
  };

  return (
    <div
      className={`relative min-w-[160px] max-w-[280px] rounded-lg border-2 transition-all ${
        selected
          ? 'border-purple-500 shadow-lg shadow-purple-500/20 ring-offset-white dark:ring-offset-gray-950'
          : 'border-purple-400/50 hover:border-purple-400'
      } ${getExecutionStatusColor()} bg-purple-600 dark:bg-purple-600/20 backdrop-blur-sm border border-purple-500 dark:border-purple-500/30 shadow-sm dark:shadow-none`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-purple-500 !border-purple-600"
        style={{ width: 10, height: 10 }}
      />
      
      <div className="p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <div className="p-1 bg-purple-500/20 rounded-md">
              <Sparkles className="w-3 h-3 text-purple-300" />
            </div>
            <span className="text-xs font-semibold text-purple-100">
              AI Agent
            </span>
          </div>
          
          <div className="flex items-center gap-1">
            {getModelProviderIcon()}
            <button
              onClick={() => setIsConfigExpanded(!isConfigExpanded)}
              className="p-0.5 hover:bg-purple-500/20 rounded-md transition-colors"
            >
              <Settings2 className="w-3 h-3 text-purple-400" />
            </button>
          </div>
        </div>
        
        {/* Label */}
        <div className="text-[10px] text-purple-200/80 mb-2">
          {data.label || 'AI Processing'}
        </div>
        
        {/* Model Info */}
        {data.config?.model && (
          <div className="mb-2">
            <div className="text-[9px] text-purple-300/60 truncate">
              Model: {data.config.model}
            </div>
            <div className="text-[8px] text-purple-400/50 capitalize">
              {data.config.modelProvider} Provider
            </div>
          </div>
        )}

        {/* MCP Status */}
        {data.config?.mcpEnabled && (
          <div className="mb-2 p-2 bg-purple-600/20 rounded-md">
            <div className="flex items-center gap-1 mb-1">
              <Network className="w-2.5 h-2.5 text-purple-300" />
              <span className="text-[8px] text-purple-200 font-semibold">MCP Enabled</span>
            </div>
            
            {data.config.mcpServers && data.config.mcpServers.length > 0 && (
              <div className="text-[8px] text-purple-300/60">
                Servers: {data.config.mcpServers.join(', ')}
              </div>
            )}
            
            {data.config.mcpTools && data.config.mcpTools.length > 0 && (
              <div className="text-[8px] text-purple-300/60">
                Tools: {data.config.mcpTools.length} available
              </div>
            )}
          </div>
        )}

        {/* Expanded Configuration */}
        {isConfigExpanded && data.config && (
          <div className="mt-2 p-2 bg-black/20 rounded-md space-y-1">
            <div className="text-[8px] text-purple-200/70 font-semibold mb-1">Configuration:</div>
            
            {data.config.temperature !== undefined && (
              <div className="text-[8px] text-purple-300/60">
                Temperature: {data.config.temperature}
              </div>
            )}
            
            {data.config.maxTokens && (
              <div className="text-[8px] text-purple-300/60">
                Max Tokens: {data.config.maxTokens}
              </div>
            )}
            
            {data.config.toolExecutionMode && (
              <div className="text-[8px] text-purple-300/60">
                Tool Mode: {data.config.toolExecutionMode}
              </div>
            )}
            
            {data.config.maxToolCalls && (
              <div className="text-[8px] text-purple-300/60">
                Max Tool Calls: {data.config.maxToolCalls}
              </div>
            )}
          </div>
        )}

        {/* Execution Status */}
        {data.executionMode && (
          <div className="mt-2 pt-2 border-t border-purple-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getExecutionStatusIcon()}
                <span className="text-[8px] text-purple-200/70 capitalize">
                  {data.executionStatus}
                </span>
              </div>
              
              {data.executionData?.duration && (
                <span className="text-[8px] text-purple-300/50">
                  {data.executionData.duration}ms
                </span>
              )}
            </div>

            {/* Tool Calls Summary */}
            {data.executionData?.toolCalls && data.executionData.toolCalls.length > 0 && (
              <div className="mt-1 p-1.5 bg-blue-500/10 rounded-md">
                <div className="text-[8px] text-blue-300/80 font-semibold mb-0.5">
                  Tool Calls: {data.executionData.toolCalls.length}
                </div>
                <div className="space-y-0.5">
                  {data.executionData.toolCalls.slice(0, 3).map((call, idx) => (
                    <div key={idx} className="text-[8px] text-blue-200/60 truncate">
                      {call.tool}: {call.error ? 'Failed' : 'Success'}
                    </div>
                  ))}
                  {data.executionData.toolCalls.length > 3 && (
                    <div className="text-[8px] text-blue-200/40">
                      +{data.executionData.toolCalls.length - 3} more...
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* MCP Connections Status */}
            {data.executionData?.mcpConnections && data.executionData.mcpConnections.length > 0 && (
              <div className="mt-1 p-1.5 bg-indigo-500/10 rounded-md">
                <div className="text-[8px] text-indigo-300/80 font-semibold mb-0.5">
                  MCP Connections:
                </div>
                <div className="space-y-0.5">
                  {data.executionData.mcpConnections.map((conn, idx) => (
                    <div key={idx} className="flex items-center justify-between text-[8px]">
                      <span className="text-indigo-200/60">{conn.server}</span>
                      <span className={`${
                        conn.status === 'connected' ? 'text-green-400' : 
                        conn.status === 'failed' ? 'text-red-400' : 'text-yellow-400'
                      }`}>
                        {conn.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Execution Output */}
            {data.executionData?.output && (
              <div className="mt-1 p-1.5 bg-green-500/10 rounded-md">
                <div className="text-[8px] text-green-300/80 font-semibold mb-0.5">Output:</div>
                <div className="text-[8px] text-green-200/60 break-words">
                  {typeof data.executionData.output === 'string' 
                    ? data.executionData.output.slice(0, 100) + (data.executionData.output.length > 100 ? '...' : '')
                    : 'Complex output available'
                  }
                </div>
              </div>
            )}

            {/* Execution Error */}
            {data.executionData?.error && (
              <div className="mt-1 p-1.5 bg-red-500/10 rounded-md">
                <div className="text-[8px] text-red-300/80 font-semibold mb-0.5">Error:</div>
                <div className="text-[8px] text-red-200/60 break-words">
                  {data.executionData.error.slice(0, 100)}
                  {data.executionData.error.length > 100 ? '...' : ''}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-purple-500 !border-purple-600"
        style={{ width: 10, height: 10 }}
      />
      
      {/* Configuration Indicator */}
      {data.config && (
        <div className="absolute -top-2 -right-2 w-3 h-3 bg-green-500 rounded-full animate-pulse flex items-center justify-center">
          <Zap className="w-1.5 h-1.5 text-white" />
        </div>
      )}

      {/* MCP Badge */}
      {data.config?.mcpEnabled && (
        <div className="absolute -top-1 -left-1 px-1 py-0.5 bg-indigo-600 rounded-md">
          <span className="text-[7px] text-white font-bold">MCP</span>
        </div>
      )}
    </div>
  );
});

AIAgentNode.displayName = 'AIAgentNode';

export default AIAgentNode;