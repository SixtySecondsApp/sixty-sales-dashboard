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
  onConvertToSubscription?: (deal: any) => void;
  // Performance optimization: Batched metadata
  batchedMetadata?: {
    nextActions: Record<string, { pendingCount: number; highUrgencyCount: number }>;
    healthScores: Record<string, { overall_health_score: number; health_status: string }>;
    sentimentData: Record<string, { avg_sentiment: number | null; sentiment_history: number[]; trend_direction: string; trend_delta: number; meeting_count: number }>;
  };
}

export function PipelineColumn({
  stage,
  deals,
  onDealClick,
  onAddDealClick,
  onConvertToSubscription,
  batchedMetadata = { nextActions: {}, healthScores: {}, sentimentData: {} }
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
      className="flex-1 min-w-[280px] max-w-[400px] bg-white dark:bg-gray-900/80 backdrop-blur-sm
        rounded-xl border border-gray-200 dark:border-gray-700/50 flex flex-col max-h-[calc(100vh-250px)]
        shadow-sm dark:shadow-none"
      style={{
        isolation: 'isolate',
        transition: 'border-color 150ms ease'
      }}
    >
      {/* Column Header with Stage Metrics */}
      <div
        className="p-4 border-b border-gray-200 dark:border-gray-700/50 sticky top-0 z-10 bg-white dark:bg-gray-900/80 backdrop-blur-sm"
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
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-lg">{stage.name}</h3>
            {deals.length === 0 && (
              <span className="text-xs text-gray-700 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/30 px-2 py-0.5 rounded-full">
                Empty
              </span>
            )}
          </div>
          <div className="bg-gray-50 dark:bg-gray-800/30 px-2.5 py-0.5 rounded-full text-xs text-gray-700 dark:text-gray-300 font-semibold">
            {deals.length}
          </div>
        </div>

        {/* Stage Metrics */}
        <div className="text-sm text-gray-700 dark:text-gray-300">
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formattedWeighted}</span>
          <span className="text-gray-500 dark:text-gray-400"> of </span>
          <span className="text-gray-900 dark:text-gray-100 font-semibold">{formattedTotal}</span>
        </div>
      </div>

      {/* Droppable Deal Container */}
      <div
        ref={setNodeRef}
        className={`
          flex-1 overflow-y-auto p-4 space-y-3
          ${isOver ? 'bg-gray-50 dark:bg-gray-800/30 ring-1 ring-inset' : ''}
          scrollbar-none
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
          <div className="text-gray-700 dark:text-gray-400 text-center text-sm space-y-2">
            <div className="h-20 flex items-center justify-center border border-dashed border-gray-300 dark:border-gray-700/50 rounded-lg">
              Drop deals here
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-500">
              {stage.default_probability}% probability • Included in pipeline total
            </div>
          </div>
        )}

        <SortableContext items={dealIds} strategy={verticalListSortingStrategy}>
          {deals.map((deal, index) => {
            const dealId = String(deal.id);
            return (
              <DealCard
                key={deal.id}
                deal={deal}
                index={index}
                onClick={onDealClick}
                onConvertToSubscription={onConvertToSubscription}
                nextActionsPendingCount={batchedMetadata.nextActions[dealId]?.pendingCount || 0}
                highUrgencyCount={batchedMetadata.nextActions[dealId]?.highUrgencyCount || 0}
                healthScore={batchedMetadata.healthScores[dealId] || null}
                sentimentData={batchedMetadata.sentimentData[dealId] || null}
              />
            );
          })}
        </SortableContext>

        {/* Add Deal Button */}
        <button
          onClick={() => onAddDealClick(stage.id)}
          className="w-full h-12 flex items-center justify-center gap-2
            bg-transparent border border-dashed border-gray-300 dark:border-gray-700/50 rounded-lg
            text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800/30
            hover:border-gray-400 dark:hover:border-gray-600 transition-colors mt-3"
        >
          <PlusCircle className="w-4 h-4" />
          <span className="text-sm font-medium">Add deal</span>
        </button>
      </div>

      {/* Bottom Summary (Optional - can be removed if you prefer the header metrics only) */}
      {deals.length > 0 && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-700/50 bg-white dark:bg-gray-900/70">
          <div className="flex items-center justify-between text-xs text-gray-700 dark:text-gray-300">
            <span>Probability: {stage.default_probability}%</span>
            <span>Total Deals: {deals.length}</span>
          </div>
        </div>
      )}
    </div>
  );
}