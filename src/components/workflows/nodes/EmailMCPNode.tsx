import React, { memo, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { 
  Mail, 
  Settings2, 
  CheckCircle, 
  XCircle, 
  Clock, 
  PlayCircle, 
  Send, 
  Inbox, 
  Search,
  Archive,
  Flag,
  Shield,
  Zap
} from 'lucide-react';

export interface EmailMCPNodeData {
  label: string;
  config?: {
    serverName?: 'gmail' | 'outlook' | 'custom';
    operation?: 'send_email' | 'read_emails' | 'search_emails' | 'archive_email' | 'flag_email' | 'get_attachments';
    serverUrl?: string;
    apiKey?: string;
    parameters?: {
      to?: string;
      cc?: string;
      bcc?: string;
      subject?: string;
      body?: string;
      query?: string;
      maxResults?: number;
      folder?: string;
      emailId?: string;
      priority?: 'low' | 'normal' | 'high';
      format?: 'text' | 'html';
    };
    timeout?: number;
    retries?: number;
  };
  executionMode?: boolean;
  executionData?: {
    output?: any;
    error?: string;
    duration?: number;
    timestamp?: string;
  };
  executionStatus?: 'pending' | 'running' | 'completed' | 'failed';
}

const EmailMCPNode = memo(({ data, selected }: NodeProps<EmailMCPNodeData>) => {
  const [isConfigExpanded, setIsConfigExpanded] = useState(false);

  const getOperationIcon = () => {
    const operation = data.config?.operation;
    const iconClass = "w-3 h-3";
    
    switch (operation) {
      case 'send_email':
        return <Send className={iconClass} />;
      case 'read_emails':
        return <Inbox className={iconClass} />;
      case 'search_emails':
        return <Search className={iconClass} />;
      case 'archive_email':
        return <Archive className={iconClass} />;
      case 'flag_email':
        return <Flag className={iconClass} />;
      case 'get_attachments':
        return <Archive className={iconClass} />;
      default:
        return <Mail className={iconClass} />;
    }
  };

  const getOperationColor = () => {
    const operation = data.config?.operation;
    
    switch (operation) {
      case 'send_email':
        return 'text-blue-300';
      case 'read_emails':
        return 'text-green-300';
      case 'search_emails':
        return 'text-purple-300';
      case 'archive_email':
        return 'text-orange-300';
      case 'flag_email':
        return 'text-red-300';
      case 'get_attachments':
        return 'text-yellow-300';
      default:
        return 'text-cyan-300';
    }
  };

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

  const getServerIcon = () => {
    switch (data.config?.serverName) {
      case 'gmail':
        return <Mail className="w-3 h-3 text-red-400" />;
      case 'outlook':
        return <Mail className="w-3 h-3 text-blue-400" />;
      default:
        return <Shield className="w-3 h-3 text-gray-400" />;
    }
  };

  const formatOperationName = (operation?: string) => {
    if (!operation) return 'Email Action';
    return operation.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  return (
    <div
      className={`relative min-w-[160px] max-w-[280px] rounded-lg border-2 transition-all ${
        selected
          ? 'border-cyan-500 shadow-lg shadow-cyan-500/20'
          : 'border-cyan-400/50 hover:border-cyan-400'
      } ${getExecutionStatusColor()} bg-gradient-to-br from-cyan-900/90 via-cyan-800/90 to-blue-900/90 backdrop-blur-sm`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-cyan-500 !border-cyan-600"
        style={{ width: 10, height: 10 }}
      />
      
      <div className="p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <div className="p-1 bg-cyan-500/20 rounded-md">
              <Mail className="w-3 h-3 text-cyan-300" />
            </div>
            <span className="text-xs font-semibold text-cyan-100">
              Email MCP
            </span>
          </div>
          
          <div className="flex items-center gap-1">
            {getServerIcon()}
            <button
              onClick={() => setIsConfigExpanded(!isConfigExpanded)}
              className="p-0.5 hover:bg-cyan-500/20 rounded-md transition-colors"
            >
              <Settings2 className="w-3 h-3 text-cyan-400" />
            </button>
          </div>
        </div>
        
        {/* Operation Display */}
        <div className="flex items-center gap-2 mb-2">
          <div className={`p-1 bg-black/20 rounded-md ${getOperationColor()}`}>
            {getOperationIcon()}
          </div>
          <div>
            <div className="text-[10px] font-medium text-cyan-200">
              {formatOperationName(data.config?.operation)}
            </div>
            <div className="text-[9px] text-cyan-300/60">
              {data.config?.serverName || 'Custom Server'}
            </div>
          </div>
        </div>

        {/* Label */}
        <div className="text-[10px] text-cyan-200/80 mb-2">
          {data.label || 'Email Operation'}
        </div>

        {/* Configuration Preview */}
        {data.config && (
          <div className="space-y-1">
            {data.config.parameters?.to && (
              <div className="text-[9px] text-cyan-300/60 truncate">
                To: {data.config.parameters.to}
              </div>
            )}
            {data.config.parameters?.subject && (
              <div className="text-[9px] text-cyan-300/60 truncate">
                Subject: {data.config.parameters.subject}
              </div>
            )}
            {data.config.parameters?.query && (
              <div className="text-[9px] text-cyan-300/60 truncate">
                Query: {data.config.parameters.query}
              </div>
            )}
          </div>
        )}

        {/* Expanded Configuration */}
        {isConfigExpanded && data.config && (
          <div className="mt-2 p-2 bg-black/20 rounded-md space-y-1">
            <div className="text-[8px] text-cyan-200/70 font-semibold mb-1">Configuration:</div>
            
            {data.config.timeout && (
              <div className="text-[8px] text-cyan-300/60">
                Timeout: {data.config.timeout}ms
              </div>
            )}
            
            {data.config.retries && (
              <div className="text-[8px] text-cyan-300/60">
                Retries: {data.config.retries}
              </div>
            )}
            
            {data.config.parameters?.maxResults && (
              <div className="text-[8px] text-cyan-300/60">
                Max Results: {data.config.parameters.maxResults}
              </div>
            )}
            
            {data.config.parameters?.format && (
              <div className="text-[8px] text-cyan-300/60">
                Format: {data.config.parameters.format.toUpperCase()}
              </div>
            )}
          </div>
        )}

        {/* Execution Status */}
        {data.executionMode && (
          <div className="mt-2 pt-2 border-t border-cyan-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getExecutionStatusIcon()}
                <span className="text-[8px] text-cyan-200/70 capitalize">
                  {data.executionStatus}
                </span>
              </div>
              
              {data.executionData?.duration && (
                <span className="text-[8px] text-cyan-300/50">
                  {data.executionData.duration}ms
                </span>
              )}
            </div>

            {/* Execution Results */}
            {data.executionData?.output && (
              <div className="mt-1 p-1.5 bg-green-500/10 rounded-md">
                <div className="text-[8px] text-green-300/80 font-semibold mb-0.5">Output:</div>
                <div className="text-[8px] text-green-200/60 break-words">
                  {typeof data.executionData.output === 'object' 
                    ? `${Object.keys(data.executionData.output).length} items`
                    : String(data.executionData.output).slice(0, 50) + (String(data.executionData.output).length > 50 ? '...' : '')
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
        className="!bg-cyan-500 !border-cyan-600"
        style={{ width: 10, height: 10 }}
      />
      
      {/* Connection Indicator */}
      {data.config?.serverUrl && (
        <div className="absolute -top-2 -right-2 w-3 h-3 bg-green-500 rounded-full animate-pulse flex items-center justify-center">
          <Zap className="w-1.5 h-1.5 text-white" />
        </div>
      )}

      {/* MCP Badge */}
      <div className="absolute -top-1 -left-1 px-1 py-0.5 bg-cyan-600 rounded-md">
        <span className="text-[7px] text-white font-bold">MCP</span>
      </div>
    </div>
  );
});

EmailMCPNode.displayName = 'EmailMCPNode';

export default EmailMCPNode;