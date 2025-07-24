import React, { useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { DealCard } from './DealCard';
import { PlusCircle, PoundSterling } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface PipelineColumnProps {
  stage: {
    id: string;
    name: string;
    color: string;
    default_probability: number;
  };
  deals: any[];
  onDealClick: (deal: any) => void;
  onAddDealClick: (stageId: string) => void;
}

export function PipelineColumn({
  stage,
  deals,
  onDealClick,
  onAddDealClick
}: PipelineColumnProps) {
  // Set up droppable behavior
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id
  });

  // Get deal IDs for sortable context
  const dealIds = deals.map(deal => String(deal.id));

  // Calculate total value of deals in this stage
  const totalValue = useMemo(() => {
    return deals.reduce((sum, deal) => sum + parseFloat(deal.value || 0), 0);
  }, [deals]);

  // Calculate weighted value based on stage probability
  const weightedValue = useMemo(() => {
    const probability = stage.default_probability / 100;
    return totalValue * probability;
  }, [totalValue, stage.default_probability]);

  // Format values for display
  const formattedWeighted = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
    notation: weightedValue >= 1000000 ? 'compact' : 'standard'
  }).format(weightedValue);
  
  const formattedTotal = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
    notation: totalValue >= 1000000 ? 'compact' : 'standard'
  }).format(totalValue);

  return (
    <div
      data-testid={`pipeline-column-${stage.id}`}
      className="flex-1 min-w-[280px] max-w-[400px] bg-gray-900/50 backdrop-blur-xl
        rounded-xl border border-gray-800/50 flex flex-col max-h-[calc(100vh-250px)]"
      style={{
        isolation: 'isolate',
        transition: 'border-color 150ms ease'
      }}
    >
      {/* Column Header with Stage Metrics */}
      <div
        className="p-4 border-b border-gray-800/50 sticky top-0 z-10 bg-gray-900/80 backdrop-blur-xl"
        style={{
          borderBottomColor: isOver ? `${stage.color}80` : undefined
        }}
      >
        {/* Stage Name and Count */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className="w-4 h-4 rounded-md"
              style={{ backgroundColor: stage.color }}
            />
            <h3 className="font-semibold text-white text-lg">{stage.name}</h3>
            {deals.length === 0 && (
              <span className="text-xs text-gray-500 bg-gray-800/50 px-2 py-0.5 rounded-full">
                Empty
              </span>
            )}
          </div>
          <div className="bg-gray-800/50 px-2.5 py-0.5 rounded-full text-xs text-gray-400">
            {deals.length}
          </div>
        </div>

        {/* Stage Metrics */}
        <div className="text-sm text-gray-400">
          <span className="font-medium text-emerald-400">{formattedWeighted}</span>
          <span className="text-gray-500"> of </span>
          <span className="text-gray-300">{formattedTotal}</span>
        </div>
      </div>

      {/* Droppable Deal Container */}
      <div
        ref={setNodeRef}
        className={`
          flex-1 overflow-y-auto p-4 space-y-3
          ${isOver ? 'bg-gray-800/30 ring-1 ring-inset' : ''}
          scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent
          transition-all duration-150
        `}
        style={{
          position: 'relative',
          zIndex: 1,
          ...(isOver ? { '--ring-color': `${stage.color}40` } as any : {})
        }}
      >
        {/* Empty state when no deals */}
        {deals.length === 0 && !isOver && (
          <div className="text-gray-500 text-center text-sm space-y-2">
            <div className="h-20 flex items-center justify-center border border-dashed border-gray-800/50 rounded-lg">
              Drop deals here
            </div>
            <div className="text-xs text-gray-600">
              {stage.default_probability}% probability • Included in pipeline total
            </div>
          </div>
        )}

        <SortableContext items={dealIds} strategy={verticalListSortingStrategy}>
          {deals.map((deal, index) => (
            <DealCard
              key={deal.id}
              deal={deal}
              index={index}
              onClick={onDealClick}
            />
          ))}
        </SortableContext>

        {/* Add Deal Button */}
        <button
          onClick={() => onAddDealClick(stage.id)}
          className="w-full h-12 flex items-center justify-center gap-2
            bg-transparent border border-dashed border-gray-700 rounded-lg
            text-gray-400 hover:text-gray-300 hover:bg-gray-800/30
            transition-colors mt-3"
        >
          <PlusCircle className="w-4 h-4" />
          <span className="text-sm">Add deal</span>
        </button>
      </div>

      {/* Bottom Summary (Optional - can be removed if you prefer the header metrics only) */}
      {deals.length > 0 && (
        <div className="p-3 border-t border-gray-800/50 bg-gray-900/70">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Probability: {stage.default_probability}%</span>
            <span>Total Deals: {deals.length}</span>
          </div>
        </div>
      )}
    </div>
  );
}