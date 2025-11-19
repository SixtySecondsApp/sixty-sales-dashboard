import React from 'react';
import { useReactFlow } from 'reactflow';
import { CheckSquare } from 'lucide-react';
import { FaSlack } from 'react-icons/fa';
import { iconMap } from '../../utils';
import { ModernNodeCard } from '../ModernNodeCard';

export const ActionNode = ({ data, selected, id }: any) => {
  const Icon = data.iconName === 'Slack' ? FaSlack : (data.iconName ? iconMap[data.iconName] : CheckSquare);
  
  // Special styling for Multiple Actions and Join Actions nodes
  const isMultiAction = data.type === 'multi_action';
  const isJoinAction = data.type === 'join_actions';
  
  let color = "text-emerald-400";
  let subtitle = "Action";
  
  if (isMultiAction) {
    color = "text-purple-400";
    subtitle = "Multi Action";
  } else if (isJoinAction) {
    color = "text-teal-400";
    subtitle = "Join Actions";
  }

  // Get connection count
  const { getEdges } = useReactFlow();
  const outgoingCount = isMultiAction ? getEdges().filter(e => e.source === id).length : 0;
  
  const Badge = isMultiAction && outgoingCount > 0 ? (
    <div className="bg-purple-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
      {outgoingCount}
    </div>
  ) : null;

  return (
    <ModernNodeCard
      selected={selected}
      icon={Icon}
      title={data.label}
      subtitle={subtitle}
      color={color}
      status={data.testStatus}
      badge={Badge}
      handleLeft={true}
      handleRight={true}
    >
      <div className="p-3 bg-zinc-900/50">
        {isMultiAction && data.executionMode && (
          <div className="mb-2">
            <span className="text-[10px] uppercase font-bold text-yellow-500/80 bg-yellow-500/10 px-1.5 py-0.5 rounded">
              {data.executionMode === 'parallel' ? '⚡ ASYNC' : '⏩ SYNC'}
            </span>
          </div>
        )}
        {data.description && (
          <div className="text-xs text-zinc-400 leading-relaxed">
            {data.description}
          </div>
        )}
      </div>
    </ModernNodeCard>
  );
};
