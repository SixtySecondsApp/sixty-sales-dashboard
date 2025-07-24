import React, { forwardRef } from 'react';

interface StageOptionProps {
  id: string;
  name: string;
  probability: number;
  color: string;
  isSelected: boolean;
  onClick: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  'aria-checked'?: boolean;
  'data-stage-option'?: boolean;
  tabIndex?: number;
}

const StageOption = forwardRef<HTMLDivElement, StageOptionProps>(({
  id,
  name,
  probability,
  color,
  isSelected,
  onClick,
  onKeyDown,
  'aria-checked': ariaChecked,
  'data-stage-option': dataStageOption,
  tabIndex = 0,
  ...props
}, ref) => {
  // Get specific border and bg classes based on the stage
  const getStageClasses = () => {
    if (!isSelected) {
      return 'border-gray-700 bg-gray-900/80 hover:border-gray-600 hover:bg-gray-900';
    }
    
    switch (id) {
      case 'lead':
        return 'border-blue-500/30 bg-blue-500/10 shadow-blue-500/10';
      case 'discovery':
        return 'border-violet-500/30 bg-violet-500/10 shadow-violet-500/10';
      case 'proposal':
        return 'border-orange-500/30 bg-orange-500/10 shadow-orange-500/10';
      case 'negotiation':
        return 'border-yellow-500/30 bg-yellow-500/10 shadow-yellow-500/10';
      case 'closed':
      case 'signed':
      case 'signed & paid':
      case 'lost':
        return 'border-emerald-500/30 bg-emerald-500/10 shadow-emerald-500/10';
      default:
        return 'border-violet-500/30 bg-violet-500/10 shadow-violet-500/10';
    }
  };

  // Handle keyboard events for accessibility
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Trigger click on Enter or Space
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
    
    // Pass other key events to parent handler
    if (onKeyDown) {
      onKeyDown(e);
    }
  };
  
  return (
    <div
      ref={ref}
      role="radio"
      aria-checked={ariaChecked || isSelected}
      tabIndex={tabIndex}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      data-stage-option={dataStageOption}
      className={`relative flex flex-col items-center justify-center gap-1.5 py-3 border rounded-lg transition-all shadow-sm ${getStageClasses()} cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-opacity-50`}
      {...props}
    >
      <div className={`w-3 h-3 rounded-full ${color} mb-1`} aria-hidden="true" />
      
      <div className="text-sm font-medium text-white">{name}</div>
      
      <div className="text-xs text-gray-400">{probability}%</div>
    </div>
  );
});

StageOption.displayName = 'StageOption';

export default StageOption; 