import React, { memo, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { 
  Calendar, 
  Settings2, 
  CheckCircle, 
  XCircle, 
  Clock, 
  PlayCircle, 
  Plus, 
  Edit, 
  Search,
  Trash2,
  Users,
  MapPin,
  Video,
  Repeat,
  Bell,
  Zap
} from 'lucide-react';

export interface CalendarMCPNodeData {
  label: string;
  config?: {
    serverName?: 'google' | 'outlook' | 'custom';
    operation?: 'create_event' | 'update_event' | 'delete_event' | 'list_events' | 'find_free_slots' | 
                'schedule_meeting' | 'check_availability' | 'create_recurring' | 'reschedule_event' | 
                'respond_to_invite' | 'block_time' | 'sync_with_crm';
    serverUrl?: string;
    clientId?: string;
    parameters?: {
      summary?: string;
      description?: string;
      location?: string;
      startDateTime?: string;
      endDateTime?: string;
      timeZone?: string;
      attendees?: string[];
      duration?: number;
      calendarId?: string;
      eventId?: string;
      query?: string;
      maxResults?: number;
      createMeetLink?: boolean;
      frequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
      workingHoursStart?: string;
      workingHoursEnd?: string;
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
    eventId?: string;
    meetLink?: string;
  };
  executionStatus?: 'pending' | 'running' | 'completed' | 'failed';
}

const CalendarMCPNode = memo(({ data, selected }: NodeProps<CalendarMCPNodeData>) => {
  const [isConfigExpanded, setIsConfigExpanded] = useState(false);

  const getOperationIcon = () => {
    const operation = data.config?.operation;
    const iconClass = "w-3 h-3";
    
    switch (operation) {
      case 'create_event':
        return <Plus className={iconClass} />;
      case 'update_event':
        return <Edit className={iconClass} />;
      case 'delete_event':
        return <Trash2 className={iconClass} />;
      case 'list_events':
        return <Search className={iconClass} />;
      case 'find_free_slots':
        return <Clock className={iconClass} />;
      case 'schedule_meeting':
        return <Users className={iconClass} />;
      case 'check_availability':
        return <Calendar className={iconClass} />;
      case 'create_recurring':
        return <Repeat className={iconClass} />;
      case 'reschedule_event':
        return <Edit className={iconClass} />;
      case 'respond_to_invite':
        return <Bell className={iconClass} />;
      case 'block_time':
        return <Clock className={iconClass} />;
      case 'sync_with_crm':
        return <Zap className={iconClass} />;
      default:
        return <Calendar className={iconClass} />;
    }
  };

  const getOperationColor = () => {
    const operation = data.config?.operation;
    
    switch (operation) {
      case 'create_event':
        return 'text-green-300';
      case 'update_event':
        return 'text-blue-300';
      case 'delete_event':
        return 'text-red-300';
      case 'list_events':
        return 'text-purple-300';
      case 'find_free_slots':
        return 'text-yellow-300';
      case 'schedule_meeting':
        return 'text-orange-300';
      case 'check_availability':
        return 'text-cyan-300';
      case 'create_recurring':
        return 'text-indigo-300';
      case 'reschedule_event':
        return 'text-pink-300';
      case 'respond_to_invite':
        return 'text-emerald-300';
      case 'block_time':
        return 'text-amber-300';
      case 'sync_with_crm':
        return 'text-violet-300';
      default:
        return 'text-emerald-300';
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
      case 'google':
        return <Calendar className="w-3 h-3 text-blue-400" />;
      case 'outlook':
        return <Calendar className="w-3 h-3 text-orange-400" />;
      default:
        return <Calendar className="w-3 h-3 text-gray-400" />;
    }
  };

  const formatOperationName = (operation?: string) => {
    if (!operation) return 'Calendar Action';
    return operation.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const formatDateTime = (dateTime?: string) => {
    if (!dateTime) return '';
    try {
      return new Date(dateTime).toLocaleDateString() + ' ' + 
             new Date(dateTime).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
    } catch {
      return dateTime;
    }
  };

  return (
    <div
      className={`relative min-w-[160px] max-w-[280px] rounded-lg border-2 transition-all ${
        selected
          ? 'border-emerald-500 shadow-lg shadow-emerald-500/20'
          : 'border-emerald-400/50 hover:border-emerald-400'
      } ${getExecutionStatusColor()} bg-gradient-to-br from-emerald-900/90 via-emerald-800/90 to-teal-900/90 backdrop-blur-sm`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-emerald-500 !border-emerald-600"
        style={{ width: 10, height: 10 }}
      />
      
      <div className="p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <div className="p-1 bg-emerald-500/20 rounded-md">
              <Calendar className="w-3 h-3 text-emerald-300" />
            </div>
            <span className="text-xs font-semibold text-emerald-100">
              Calendar MCP
            </span>
          </div>
          
          <div className="flex items-center gap-1">
            {getServerIcon()}
            <button
              onClick={() => setIsConfigExpanded(!isConfigExpanded)}
              className="p-0.5 hover:bg-emerald-500/20 rounded-md transition-colors"
            >
              <Settings2 className="w-3 h-3 text-emerald-400" />
            </button>
          </div>
        </div>
        
        {/* Operation Display */}
        <div className="flex items-center gap-2 mb-2">
          <div className={`p-1 bg-black/20 rounded-md ${getOperationColor()}`}>
            {getOperationIcon()}
          </div>
          <div>
            <div className="text-[10px] font-medium text-emerald-200">
              {formatOperationName(data.config?.operation)}
            </div>
            <div className="text-[9px] text-emerald-300/60">
              {data.config?.serverName || 'Custom Server'}
            </div>
          </div>
        </div>

        {/* Label */}
        <div className="text-[10px] text-emerald-200/80 mb-2">
          {data.label || 'Calendar Operation'}
        </div>

        {/* Configuration Preview */}
        {data.config && (
          <div className="space-y-1">
            {data.config.parameters?.summary && (
              <div className="text-[9px] text-emerald-300/60 truncate">
                Event: {data.config.parameters.summary}
              </div>
            )}
            
            {data.config.parameters?.startDateTime && (
              <div className="text-[9px] text-emerald-300/60 truncate">
                Start: {formatDateTime(data.config.parameters.startDateTime)}
              </div>
            )}
            
            {data.config.parameters?.attendees && data.config.parameters.attendees.length > 0 && (
              <div className="flex items-center gap-1 text-[9px] text-emerald-300/60">
                <Users className="w-2 h-2" />
                {data.config.parameters.attendees.length} attendee{data.config.parameters.attendees.length > 1 ? 's' : ''}
              </div>
            )}
            
            {data.config.parameters?.location && (
              <div className="flex items-center gap-1 text-[9px] text-emerald-300/60">
                <MapPin className="w-2 h-2" />
                {data.config.parameters.location}
              </div>
            )}
            
            {data.config.parameters?.createMeetLink && (
              <div className="flex items-center gap-1 text-[9px] text-emerald-300/60">
                <Video className="w-2 h-2" />
                Meet Link
              </div>
            )}
          </div>
        )}

        {/* Expanded Configuration */}
        {isConfigExpanded && data.config && (
          <div className="mt-2 p-2 bg-black/20 rounded-md space-y-1">
            <div className="text-[8px] text-emerald-200/70 font-semibold mb-1">Configuration:</div>
            
            {data.config.parameters?.calendarId && (
              <div className="text-[8px] text-emerald-300/60 truncate">
                Calendar: {data.config.parameters.calendarId}
              </div>
            )}
            
            {data.config.parameters?.timeZone && (
              <div className="text-[8px] text-emerald-300/60">
                Timezone: {data.config.parameters.timeZone}
              </div>
            )}
            
            {data.config.parameters?.duration && (
              <div className="text-[8px] text-emerald-300/60">
                Duration: {data.config.parameters.duration} min
              </div>
            )}
            
            {data.config.parameters?.frequency && (
              <div className="text-[8px] text-emerald-300/60">
                Recurring: {data.config.parameters.frequency}
              </div>
            )}
            
            {data.config.timeout && (
              <div className="text-[8px] text-emerald-300/60">
                Timeout: {data.config.timeout}ms
              </div>
            )}
            
            {data.config.retries && (
              <div className="text-[8px] text-emerald-300/60">
                Retries: {data.config.retries}
              </div>
            )}
          </div>
        )}

        {/* Execution Status */}
        {data.executionMode && (
          <div className="mt-2 pt-2 border-t border-emerald-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getExecutionStatusIcon()}
                <span className="text-[8px] text-emerald-200/70 capitalize">
                  {data.executionStatus}
                </span>
              </div>
              
              {data.executionData?.duration && (
                <span className="text-[8px] text-emerald-300/50">
                  {data.executionData.duration}ms
                </span>
              )}
            </div>

            {/* Execution Results */}
            {data.executionData?.output && (
              <div className="mt-1 p-1.5 bg-green-500/10 rounded-md">
                <div className="text-[8px] text-green-300/80 font-semibold mb-0.5">Success:</div>
                <div className="space-y-0.5">
                  {data.executionData.eventId && (
                    <div className="text-[8px] text-green-200/60">
                      Event ID: {data.executionData.eventId.slice(0, 12)}...
                    </div>
                  )}
                  {data.executionData.meetLink && (
                    <div className="flex items-center gap-1 text-[8px] text-green-200/60">
                      <Video className="w-2 h-2" />
                      Meet link created
                    </div>
                  )}
                  {typeof data.executionData.output === 'object' && (
                    <div className="text-[8px] text-green-200/60">
                      {Object.keys(data.executionData.output).length} items returned
                    </div>
                  )}
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
        className="!bg-emerald-500 !border-emerald-600"
        style={{ width: 10, height: 10 }}
      />
      
      {/* Connection Indicator */}
      {data.config?.clientId && (
        <div className="absolute -top-2 -right-2 w-3 h-3 bg-green-500 rounded-full animate-pulse flex items-center justify-center">
          <Zap className="w-1.5 h-1.5 text-white" />
        </div>
      )}

      {/* MCP Badge */}
      <div className="absolute -top-1 -left-1 px-1 py-0.5 bg-emerald-600 rounded-md">
        <span className="text-[7px] text-white font-bold">MCP</span>
      </div>
    </div>
  );
});

CalendarMCPNode.displayName = 'CalendarMCPNode';

export default CalendarMCPNode;