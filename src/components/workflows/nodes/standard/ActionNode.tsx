import React from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import { CheckSquare } from 'lucide-react';
import { FaSlack } from 'react-icons/fa';
import { StatusIndicator } from '../../StatusIndicator';
import { iconMap, mapTestStatusToNodeStatus } from '../../utils';

export const ActionNode = ({ data, selected, id }: any) => {
  const Icon = data.iconName === 'Slack' ? FaSlack : (data.iconName ? iconMap[data.iconName] : CheckSquare);
  const status = data.testStatus;
  const nodeStatus = mapTestStatusToNodeStatus(status || 'idle');
  const isActive = status === 'active';
  
  // Special styling for Multiple Actions and Join Actions nodes
  const isMultiAction = data.type === 'multi_action';
  const isJoinAction = data.type === 'join_actions';
  const bgColor = isMultiAction ? 'bg-gradient-to-r from-purple-600 to-purple-700' : 
                  isJoinAction ? 'bg-gradient-to-r from-teal-600 to-teal-700' : 'bg-[#37bd7e]';
  const borderColor = isMultiAction ? 'border-purple-500' : 
                     isJoinAction ? 'border-teal-500' : 'border-[#37bd7e]';
  
  // Get connection count
  const { getEdges } = useReactFlow();
  const outgoingCount = isMultiAction ? getEdges().filter(e => e.source === id).length : 0;
  const incomingCount = isJoinAction ? getEdges().filter(e => e.target === id).length : 0;
  
  return (
    <div className={`${bgColor} rounded-lg p-3 min-w-[144px] border-2 shadow-lg relative transition-all duration-300 ${
      isActive ? 'border-yellow-400 shadow-yellow-400/50 shadow-xl scale-105' : borderColor
    } ${selected ? 'ring-2 ring-green-300' : ''} ${isMultiAction ? 'shadow-purple-500/30' : isJoinAction ? 'shadow-teal-500/30' : ''}`}>
      {nodeStatus !== 'idle' && (
        <StatusIndicator 
          status={nodeStatus}
          variant="badge"
          position="top-right"
          size="sm"
        />
      )}
      {isMultiAction && outgoingCount > 0 && (
        <div className="absolute -top-2 -right-2 bg-purple-500 text-white text-[8px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
          {outgoingCount}
        </div>
      )}
      <Handle 
        type="target" 
        position={Position.Left} 
        className={`w-2.5 h-2.5 bg-white border-2 ${borderColor}`}
        isConnectable={true}
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        className={`w-2.5 h-2.5 bg-white border-2 ${borderColor} ${isMultiAction ? 'w-3.5 h-3.5 ring-2 ring-purple-300' : ''}`}
        isConnectable={true}
      />
      <div className="flex items-center gap-1.5 text-white">
        <Icon className={`w-6 h-6 ${isMultiAction ? 'animate-pulse' : ''}`} />
        <div>
          <div className="text-sm font-semibold">{data.label}</div>
          <div className="text-xs opacity-80">
            {isMultiAction && data.executionMode && (
              <div className="text-xs uppercase font-bold text-yellow-300">
                {data.executionMode === 'parallel' ? '⚡ ASYNC' : '⏩ SYNC'}
              </div>
            )}
            <div>{data.description}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

