import React from 'react';
import { Target } from 'lucide-react';
import { iconMap } from '../../utils';
import { ModernNodeCard } from '../ModernNodeCard';

export const TriggerNode = ({ data, selected }: any) => {
  const Icon = data.iconName ? iconMap[data.iconName] : Target;
  
  return (
    <ModernNodeCard
      selected={selected}
      icon={Icon}
      title={data.label}
      subtitle="Trigger"
      color="text-purple-400"
      status={data.testStatus}
      handleLeft={false}
      handleRight={true}
    >
      {data.description && (
        <div className="p-3 bg-zinc-900/50">
          <div className="text-xs text-zinc-400 leading-relaxed">
            {data.description}
          </div>
        </div>
      )}
    </ModernNodeCard>
  );
};
