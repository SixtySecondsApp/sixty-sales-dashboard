import React, { useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SuggestionCard } from './SuggestionCard';
import { PlusCircle, TrendingUp } from 'lucide-react';

interface RoadmapColumnProps {
  status: {
    id: string;
    name: string;
    color: string;
  };
  suggestions: any[];
  onSuggestionClick: (suggestion: any) => void;
  onAddSuggestionClick: (statusId: string) => void;
}

export function RoadmapColumn({
  status,
  suggestions,
  onSuggestionClick,
  onAddSuggestionClick
}: RoadmapColumnProps) {
  // Set up droppable behavior
  const { setNodeRef, isOver, active } = useDroppable({
    id: status.id,
    data: {
      type: 'column',
      statusId: status.id
    }
  });

  // Get suggestion IDs for sortable context
  // Always ensure we have at least an empty array for SortableContext
  const suggestionIds = suggestions.length > 0 
    ? suggestions.map(suggestion => String(suggestion.id))
    : [];

  // Calculate total votes in this status
  const totalVotes = useMemo(() => {
    return suggestions.reduce((sum, suggestion) => sum + (suggestion.votes_count || 0), 0);
  }, [suggestions]);

  // Calculate priority distribution
  const priorityStats = useMemo(() => {
    const stats = { critical: 0, high: 0, medium: 0, low: 0 };
    suggestions.forEach(suggestion => {
      if (stats[suggestion.priority] !== undefined) {
        stats[suggestion.priority]++;
      }
    });
    return stats;
  }, [suggestions]);

  return (
    <div
      data-testid={`roadmap-column-${status.id}`}
      className="flex-1 min-w-[280px] max-w-[400px] bg-gray-900/50 backdrop-blur-xl
        rounded-xl border border-gray-800/50 flex flex-col max-h-[calc(100vh-250px)]"
      style={{
        isolation: 'isolate',
        transition: 'border-color 150ms ease'
      }}
    >
      {/* Column Header with Status Metrics */}
      <div
        className="p-4 border-b border-gray-800/50 sticky top-0 z-10 bg-gray-900/80 backdrop-blur-xl"
        style={{
          borderBottomColor: isOver ? `${status.color}80` : undefined
        }}
      >
        {/* Status Name and Count */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className="w-4 h-4 rounded-md"
              style={{ backgroundColor: status.color }}
            />
            <h3 className="font-semibold text-white text-lg">{status.name}</h3>
          </div>
          <div className="bg-gray-800/50 px-2.5 py-0.5 rounded-full text-xs text-gray-400">
            {suggestions.length}
          </div>
        </div>

        {/* Status Metrics */}
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <TrendingUp className="w-3.5 h-3.5" />
          <span className="font-medium text-emerald-400">{totalVotes}</span>
          <span className="text-gray-500">votes</span>
          {priorityStats.critical > 0 && (
            <span className="ml-auto text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">
              {priorityStats.critical} critical
            </span>
          )}
        </div>
      </div>

      {/* Droppable Suggestion Container */}
      <div
        ref={setNodeRef}
        data-droppable-id={status.id}
        data-column-status={status.id}
        className={`
          flex-1 overflow-y-auto p-4 space-y-3
          ${isOver ? 'bg-gray-800/30 ring-2 ring-inset' : ''}
          scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent
          transition-all duration-150
        `}
        style={{
          position: 'relative',
          zIndex: 1,
          minHeight: '250px',
          ...(isOver ? { 
            '--ring-color': status.color,
            borderColor: status.color,
            backgroundColor: `${status.color}10`
          } as any : {})
        }}
      >
        {/* Always render SortableContext to maintain drop target */}
        <SortableContext 
          items={suggestions.length === 0 ? [`${status.id}-placeholder`] : suggestionIds} 
          strategy={verticalListSortingStrategy}
        >
          {suggestions.length === 0 ? (
            // Empty state that's still droppable
            <div 
              className={`
                text-gray-500 text-center text-sm flex flex-col items-center justify-center 
                border-2 border-dashed rounded-lg transition-all duration-200
                ${isOver 
                  ? 'border-opacity-100 bg-gray-800/50 text-white' 
                  : 'border-gray-800/50 hover:border-gray-700/70'
                }
              `}
              style={{ 
                minHeight: '200px',
                borderColor: isOver ? status.color : undefined
              }}
            >
              <div className="p-8">
                {isOver ? (
                  <>
                    <div className="text-lg font-medium mb-2">Drop here</div>
                    <div className="text-sm opacity-70">Release to add to {status.name}</div>
                  </>
                ) : (
                  <>
                    <div className="text-base mb-2">No suggestions yet</div>
                    <div className="text-sm opacity-70">Drag suggestions here or click below to add</div>
                  </>
                )}
              </div>
            </div>
          ) : (
            // Render suggestions
            suggestions.map((suggestion, index) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                index={index}
                onClick={onSuggestionClick}
              />
            ))
          )}
        </SortableContext>

        {/* Add Suggestion Button */}
        <button
          onClick={() => onAddSuggestionClick(status.id)}
          className="w-full h-12 flex items-center justify-center gap-2
            bg-transparent border border-dashed border-gray-700 rounded-lg
            text-gray-400 hover:text-gray-300 hover:bg-gray-800/30
            transition-colors mt-3"
        >
          <PlusCircle className="w-4 h-4" />
          <span className="text-sm">Add suggestion</span>
        </button>
      </div>

      {/* Bottom Summary */}
      {suggestions.length > 0 && (
        <div className="p-3 border-t border-gray-800/50 bg-gray-900/70">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <div className="flex gap-3">
              {priorityStats.high > 0 && (
                <span>High: {priorityStats.high}</span>
              )}
              {priorityStats.medium > 0 && (
                <span>Medium: {priorityStats.medium}</span>
              )}
            </div>
            <span>Total: {suggestions.length}</span>
          </div>
        </div>
      )}
    </div>
  );
}