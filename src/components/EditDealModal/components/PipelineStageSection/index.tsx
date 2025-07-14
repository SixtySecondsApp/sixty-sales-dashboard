import React, { useEffect, useRef } from 'react';
import { Box, Timer, TrendingUp } from 'lucide-react';
import { useEditDeal } from '../../contexts/EditDealContext';
import StageOption from './StageOption';
import { Slider } from '../../../ui/slider';
import { usePipeline } from '@/lib/contexts/PipelineContext';

interface PipelineStageSectionProps {
  onStageChange?: (stage: string) => void;
  currentStage?: string;
}

const PipelineStageSection: React.FC<PipelineStageSectionProps> = ({ 
  onStageChange,
  currentStage
}) => {
  const { state, updateField } = useEditDeal();
  const { stages: pipelineStages } = usePipeline();
  
  // Add ref for initial focus
  const firstStageOptionRef = useRef<HTMLDivElement>(null);
  
  // Set focus when component mounts
  useEffect(() => {
    if (firstStageOptionRef.current) {
      firstStageOptionRef.current.focus();
    }
  }, []);
  
  // Use stages from pipeline context if available, otherwise fallback to hardcoded stages
  const stages = pipelineStages && pipelineStages.length > 0 
    ? pipelineStages.map(stage => ({
        id: stage.id,
        name: stage.name,
        probability: stage.default_probability || 0,
        color: `bg-${stage.color || 'blue'}-500`
      }))
    : [
        { id: 'lead', name: 'Lead', probability: 20, color: 'bg-blue-500' },
        { id: 'discovery', name: 'Discovery', probability: 40, color: 'bg-violet-500' },
        { id: 'proposal', name: 'Proposal', probability: 60, color: 'bg-orange-500' },
        { id: 'negotiation', name: 'Negotiation', probability: 80, color: 'bg-yellow-500' },
        { id: 'closed', name: 'Closed/Won', probability: 100, color: 'bg-emerald-500' }
      ];
  
  const nextActionOptions = [
    { value: 'demo', label: 'Schedule Demo', icon: '🎯', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    { value: 'proposal', label: 'Send Proposal', icon: '📋', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    { value: 'follow-up', label: 'Follow-up Call', icon: '📞', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
    { value: 'quote', label: 'Send Quote', icon: '💰', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    { value: 'contract', label: 'Send Contract', icon: '📄', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' },
    { value: 'meeting', label: 'Schedule Meeting', icon: '🤝', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
    { value: 'none', label: 'No Action', icon: '✅', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' }
  ];
  
  const handleStageChange = (stageId: string) => {
    updateField('stage', stageId);
    
    // Find the default probability for this stage
    const stage = stages.find(s => s.id === stageId);
    if (stage) {
      updateField('probability', stage.probability);
    }
    
    // Notify parent component
    if (onStageChange) {
      onStageChange(stageId);
    }
  };

  // Handle keyboard navigation between stages
  const handleStageKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = (index + 1) % stages.length;
      const stageElements = document.querySelectorAll('[data-stage-option]');
      if (stageElements[nextIndex]) {
        (stageElements[nextIndex] as HTMLElement).focus();
      }
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = (index - 1 + stages.length) % stages.length;
      const stageElements = document.querySelectorAll('[data-stage-option]');
      if (stageElements[prevIndex]) {
        (stageElements[prevIndex] as HTMLElement).focus();
      }
    }
  };

  // Determine which stage is selected
  const getIsSelected = (stageId: string) => {
    // If currentStage is provided as a prop, use that
    if (currentStage) {
      return stageId === currentStage;
    }
    // Otherwise fall back to state.stage
    return state.stage === stageId;
  };
  
  return (
    <div id="stage-section" role="tabpanel" aria-labelledby="tab-stage" className="space-y-6">
      <div>
        <SectionHeading 
          icon={<Box className="w-4 h-4" />} 
          title="Current Pipeline Stage"
        />
        
        <div 
          className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-2 mt-3"
          role="radiogroup"
          aria-label="Pipeline stages"
        >
          {stages.map((stage, index) => (
            <StageOption
              key={stage.id}
              id={stage.id}
              name={stage.name}
              probability={stage.probability}
              color={stage.color}
              isSelected={getIsSelected(stage.id)}
              onClick={() => handleStageChange(stage.id)}
              ref={index === 0 ? firstStageOptionRef : undefined}
              onKeyDown={(e) => handleStageKeyDown(e, index)}
              aria-checked={getIsSelected(stage.id)}
              data-stage-option
              tabIndex={getIsSelected(stage.id) || (index === 0 && !currentStage && !state.stage) ? 0 : -1}
            />
          ))}
        </div>
      </div>
      
      <div>
        <SectionHeading 
          icon={<Timer className="w-4 h-4" />} 
          title="Next Action"
        />
        
        <div className="mt-3">
          <div className="grid grid-cols-2 gap-2 mb-3">
            {nextActionOptions.slice(0, 4).map((action) => (
              <button
                key={action.value}
                type="button"
                onClick={() => updateField('nextAction', action.value)}
                className={`p-3 rounded-xl border transition-all ${
                  state.nextAction === action.value
                    ? `${action.color} ring-2 ring-opacity-50`
                    : 'bg-gray-800/30 border-gray-600/30 text-gray-400 hover:bg-gray-700/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{action.icon}</span>
                  <span className="text-xs font-medium">{action.label}</span>
                </div>
              </button>
            ))}
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            {nextActionOptions.slice(4).map((action) => (
              <button
                key={action.value}
                type="button"
                onClick={() => updateField('nextAction', action.value)}
                className={`p-3 rounded-xl border transition-all ${
                  state.nextAction === action.value
                    ? `${action.color} ring-2 ring-opacity-50`
                    : 'bg-gray-800/30 border-gray-600/30 text-gray-400 hover:bg-gray-700/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{action.icon}</span>
                  <span className="text-xs font-medium">{action.label}</span>
                </div>
              </button>
            ))}
          </div>
          
          {/* Clear Selection Button */}
          {state.nextAction && (
            <button
              type="button"
              onClick={() => updateField('nextAction', '')}
              className="mt-2 w-full p-2 text-xs text-gray-400 hover:text-white transition-colors"
            >
              Clear Selection
            </button>
          )}
        </div>
      </div>
      
      <div>
        <SectionHeading 
          icon={<TrendingUp className="w-4 h-4" />} 
          title="Win Probability"
        />
        
        <div className="mt-3">
          <div className="flex items-center gap-3 mb-2">
            <input
              type="text"
              value={`${state.probability}%`}
              readOnly
              aria-label="Current probability percentage"
              className="w-14 text-center bg-gray-900/80 border border-gray-700 rounded-lg py-2 
                text-white focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500"
            />
            
            <Slider
              value={[Number(state.probability)]}
              onValueChange={(value) => updateField('probability', value[0])}
              min={0}
              max={100}
              step={5}
              className="w-full"
              aria-label="Adjust win probability"
            />
          </div>
          
          <div className="flex justify-between">
            <p className="text-xs text-gray-500">0%</p>
            <p className="text-xs text-gray-500">100%</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper component
interface SectionHeadingProps {
  icon: React.ReactNode;
  title: string;
}

const SectionHeading: React.FC<SectionHeadingProps> = ({ icon, title }) => (
  <div className="flex items-center gap-2 text-gray-400 text-sm font-medium">
    <div className="flex items-center justify-center">
      {icon}
    </div>
    <span>{title}</span>
  </div>
);

export default PipelineStageSection; 