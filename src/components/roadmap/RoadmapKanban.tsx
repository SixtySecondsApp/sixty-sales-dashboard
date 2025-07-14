// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import {
  DndContext,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragEndEvent,
  MeasuringStrategy,
  DragOverEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { RoadmapProvider, useRoadmapContext } from '@/lib/contexts/RoadmapContext';
import { RoadmapHeader } from './RoadmapHeader';
import { RoadmapColumn } from './RoadmapColumn';
import { SuggestionCard } from './SuggestionCard';
import { SuggestionForm } from './SuggestionForm';
import { RoadmapTable } from './RoadmapTable';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/clientV2';
import { ConfettiService } from '@/lib/services/confettiService';




function RoadmapSkeleton() {
  return (
    <div className="space-y-6">
      <div className="mb-6 space-y-4">
        <div className="h-8 bg-gray-800 rounded-lg w-48" />
        <div className="h-4 bg-gray-800 rounded-lg w-80" />
        <div className="flex justify-between mt-4">
          <div className="flex gap-2">
            <div className="h-10 bg-gray-800 rounded-lg w-32" />
            <div className="h-10 bg-gray-800 rounded-lg w-24" />
          </div>
          <div className="h-10 bg-gray-800 rounded-lg w-64" />
        </div>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-6">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div
            key={i}
            className="min-w-[320px] bg-gray-900/50 rounded-xl border border-gray-800/50 flex flex-col h-[600px]"
          >
            <div className="p-4 border-b border-gray-800/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-md bg-gray-800" />
                <div className="h-5 bg-gray-800 rounded-lg w-20" />
              </div>
              <div className="bg-gray-800/50 rounded-full w-8 h-5" />
            </div>
            <div className="p-4 space-y-3 flex-1">
              {[1, 2, 3].map(j => (
                <div key={j} className="bg-gray-800/50 rounded-xl p-4 h-32" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- DRAG AND DROP IMPROVEMENTS ---

const RoadmapContent = React.forwardRef<RoadmapKanbanHandle>((props, ref) => {
  const {
    suggestions,
    statuses,
    isLoading,
    error,
    suggestionsByStatus: contextSuggestionsByStatus,
    createSuggestion,
    updateSuggestion,
    deleteSuggestion,
    moveSuggestionToStatus,
    voteForSuggestion,
    removeVote,
    refreshSuggestions
  } = useRoadmapContext();

  const [view, setView] = useState<'kanban' | 'table'>('kanban');
  const [localSuggestionsByStatus, setLocalSuggestionsByStatus] = useState<Record<string, any[]>>({});
  const [showSuggestionForm, setShowSuggestionForm] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<any>(null);
  const [initialStatusId, setInitialStatusId] = useState<string | null>(null);
  const [activeSuggestion, setActiveSuggestion] = useState<any>(null);
  const [sortBy, setSortBy] = useState<'votes' | 'date' | 'priority' | 'none'>('none');
  const [refreshKey, setRefreshKey] = useState(0);

  // DnD state
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [draggedFromStatus, setDraggedFromStatus] = useState<string | null>(null);
  const [draggedOverStatus, setDraggedOverStatus] = useState<string | null>(null);
  const [draggedOverIndex, setDraggedOverIndex] = useState<number | null>(null);

  // Keep a ref to the last valid over status for drop fallback
  const lastValidOverStatusRef = useRef<string | null>(null);

  // State for the edit modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Expose method to parent component
  React.useImperativeHandle(ref, () => ({
    openSuggestionForm: () => handleAddSuggestionClick(null)
  }), []);

  // Update local state when the context data changes
  useEffect(() => {
    setLocalSuggestionsByStatus(structuredClone(contextSuggestionsByStatus));
  }, [contextSuggestionsByStatus]);

  // Apply sorting to the local state
  useEffect(() => {
    if (sortBy === 'none') {
      setLocalSuggestionsByStatus(contextSuggestionsByStatus);
      return;
    }
    const sortedSuggestions = { ...localSuggestionsByStatus };
    Object.keys(sortedSuggestions).forEach(statusId => {
      sortedSuggestions[statusId] = [...sortedSuggestions[statusId]].sort((a, b) => {
        switch (sortBy) {
          case 'votes':
            return b.votes_count - a.votes_count;
          case 'date':
            return new Date(b.submitted_at || 0).getTime() - new Date(a.submitted_at || 0).getTime();
          case 'priority':
            const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
          default:
            return 0;
        }
      });
    });
    setLocalSuggestionsByStatus(sortedSuggestions);
  }, [sortBy, contextSuggestionsByStatus]);

  useEffect(() => {
    return () => {
      setDraggedId(null);
      setDraggedFromStatus(null);
      setDraggedOverStatus(null);
      setDraggedOverIndex(null);
      lastValidOverStatusRef.current = null;
      setActiveSuggestion(null);
    };
  }, []);

  // Configure sensors for drag operations
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleAddSuggestionClick = (statusId: string | null = null) => {
    setSelectedSuggestion(null);
    setInitialStatusId(statusId);
    setShowSuggestionForm(true);
  };

  const handleSuggestionClick = (suggestion: any) => {
    const foundSuggestion = suggestions.find(s => s.id === suggestion.id);
    setSelectedSuggestion(foundSuggestion);
    setIsEditModalOpen(true);
    setInitialStatusId(null);
  };

  const handleSaveSuggestion = async (formData: any) => {
    let success = false;
    let savedOrCreatedSuggestion = null;

    try {
      if (selectedSuggestion) {
        await updateSuggestion(selectedSuggestion.id, formData);
        success = true;
      } else {
        savedOrCreatedSuggestion = await createSuggestion(formData);
        success = !!savedOrCreatedSuggestion;
      }

      if (success) {
        setShowSuggestionForm(false);
        setIsEditModalOpen(false);
        toast.success(selectedSuggestion ? 'Suggestion updated' : 'Suggestion created');
      }
    } catch (error) {
      toast.error('Failed to save suggestion');
    }
  };



  // Find the statusId for a given suggestionId or statusId
  const findStatusForId = (id: string): string | undefined => {
    if (id in localSuggestionsByStatus) return id;
    return Object.keys(localSuggestionsByStatus).find(statusId =>
      localSuggestionsByStatus[statusId].some(suggestion => suggestion.id === id)
    );
  };

  // --- DND HANDLERS ---

  // On drag start, set the draggedId and fromStatus, and set activeSuggestion for overlay
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const id = String(active.id);
    setDraggedId(id);
    const fromStatus = findStatusForId(id);
    setDraggedFromStatus(fromStatus || null);
    setDraggedOverStatus(fromStatus || null);
    setDraggedOverIndex(
      fromStatus && localSuggestionsByStatus[fromStatus]
        ? localSuggestionsByStatus[fromStatus].findIndex(s => s.id === id)
        : null
    );
    // Set activeSuggestion for overlay
    let suggestion = null;
    for (const statusId in localSuggestionsByStatus) {
      suggestion = localSuggestionsByStatus[statusId].find(s => s.id === id);
      if (suggestion) break;
    }
    setActiveSuggestion(suggestion);
    // Disable sorting during drag
    if (sortBy !== 'none') setSortBy('none');
  };

  // On drag over, update the localSuggestionsByStatus for visual feedback
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    const fromStatus = findStatusForId(activeId);
    let toStatus = findStatusForId(overId);

    // If overId is a statusId (column), use it directly
    if (!toStatus && statuses.find(s => s.id === overId)) {
      toStatus = overId;
    }
    if (!fromStatus || !toStatus) return;

    // If dropped on the same status and same position, do nothing
    if (fromStatus === toStatus && overId === activeId) return;

    // Find the index in the target status
    let toIndex = localSuggestionsByStatus[toStatus].findIndex(s => s.id === overId);
    if (toIndex === -1 || overId === toStatus) {
      // If dropped on the column itself or empty space, add to end
      toIndex = localSuggestionsByStatus[toStatus].length;
    }

    // Prevent unnecessary updates
    if (
      draggedId === activeId &&
      draggedFromStatus === fromStatus &&
      draggedOverStatus === toStatus &&
      draggedOverIndex === toIndex
    ) {
      return;
    }

    // Store last valid over status for drop fallback
    lastValidOverStatusRef.current = toStatus;

    // Optimistically update localSuggestionsByStatus for visual feedback
    setLocalSuggestionsByStatus(prev => {
      // Remove from old status
      const fromSuggestions = [...prev[fromStatus]];
      const suggestionIdx = fromSuggestions.findIndex(s => s.id === activeId);
      if (suggestionIdx === -1) return prev;
      const [suggestion] = fromSuggestions.splice(suggestionIdx, 1);

      // Insert into new status
      const toSuggestions = [...prev[toStatus]];
      // Prevent duplicate
      if (!toSuggestions.some(s => s.id === activeId)) {
        toSuggestions.splice(toIndex, 0, { ...suggestion, status: toStatus });
      }

      return {
        ...prev,
        [fromStatus]: fromSuggestions,
        [toStatus]: toSuggestions,
      };
    });

    setDraggedOverStatus(toStatus);
    setDraggedOverIndex(toIndex);
  };

  // On drag end, persist the change and clean up
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    const activeId = String(active.id);

    // Determine the final status
    let toStatus = over ? findStatusForId(String(over.id)) : null;
    if (!toStatus && over && statuses.find(s => s.id === String(over.id))) {
      toStatus = String(over.id);
    }
    if (!toStatus) {
      toStatus = lastValidOverStatusRef.current;
    }
    const fromStatus = draggedFromStatus;

    // If no move, cleanup and return
    if (!fromStatus || !toStatus || fromStatus === toStatus) {
      setDraggedId(null);
      setDraggedFromStatus(null);
      setDraggedOverStatus(null);
      setDraggedOverIndex(null);
      setActiveSuggestion(null);
      lastValidOverStatusRef.current = null;
      return;
    }

    // Find the suggestion and its new index
    let toIndex = draggedOverIndex;
    if (over) {
      const overId = String(over.id);
      toIndex = localSuggestionsByStatus[toStatus].findIndex(s => s.id === overId);
      if (toIndex === -1 || overId === toStatus) {
        toIndex = localSuggestionsByStatus[toStatus].length;
      }
    } else if (toIndex == null) {
      toIndex = localSuggestionsByStatus[toStatus].length;
    }

    // Update localSuggestionsByStatus for final state
    setLocalSuggestionsByStatus(prev => {
      // Remove from old status
      const fromSuggestions = [...prev[fromStatus]];
      const suggestionIdx = fromSuggestions.findIndex(s => s.id === activeId);
      if (suggestionIdx === -1) return prev;
      const [suggestion] = fromSuggestions.splice(suggestionIdx, 1);

      // Insert into new status
      const toSuggestions = [...prev[toStatus]];
      // Remove if already present (shouldn't happen, but for safety)
      const existingIdx = toSuggestions.findIndex(s => s.id === activeId);
      if (existingIdx !== -1) toSuggestions.splice(existingIdx, 1);
      toSuggestions.splice(toIndex!, 0, { ...suggestion, status: toStatus });

      return {
        ...prev,
        [fromStatus]: fromSuggestions,
        [toStatus]: toSuggestions,
      };
    });

    // Persist to DB
    try {
      await moveSuggestionToStatus(activeId, toStatus);
      
      // Celebrate if moved to Completed
      if (toStatus === 'completed') {
        ConfettiService.celebrate();
      }
      setTimeout(() => {
        setRefreshKey(prev => prev + 1);
      }, 100);
    } catch (err) {
      // Rollback UI on error
      toast.error('Failed to move suggestion. Please try again.');
      setLocalSuggestionsByStatus(contextSuggestionsByStatus);
    }

    // Cleanup
    setDraggedId(null);
    setDraggedFromStatus(null);
    setDraggedOverStatus(null);
    setDraggedOverIndex(null);
    setActiveSuggestion(null);
    lastValidOverStatusRef.current = null;
  };

  const handleDeleteSuggestion = async (suggestionId: string) => {
    try {
      await deleteSuggestion(suggestionId);
      
      // Close the modal and clear the selected suggestion if this was the deleted one
      if (selectedSuggestion && selectedSuggestion.id === suggestionId) {
        setIsEditModalOpen(false);
        setSelectedSuggestion(null);
        setInitialStatusId(null);
      }
      
      toast.success('Suggestion deleted');
    } catch (error) {
      toast.error('Failed to delete suggestion');
    }
  };

  if (isLoading) {
    return <RoadmapSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <div className="text-red-500 mb-4">Error loading roadmap data</div>
        <div className="text-gray-400">{error}</div>
      </div>
    );
  }

  return (
    <>
      <RoadmapHeader
        onAddSuggestionClick={() => handleAddSuggestionClick()}
        view={view}
        onViewChange={setView}
        sortBy={sortBy}
        onSortChange={setSortBy}
      />

      {view === 'kanban' ? (
        <>

          <DndContext
            key={`dnd-context-${refreshKey}`}
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            measuring={{
              droppable: {
                strategy: MeasuringStrategy.Always,
              },
            }}
            autoScroll={{
              threshold: {
                x: 0.2,
                y: 0.2,
              },
              interval: 10,
            }}
          >
            <div className="grid gap-3 pb-6 overflow-x-auto" style={{
              gridTemplateColumns: statuses.length <= 4 
                ? `repeat(${statuses.length}, minmax(280px, 1fr))`
                : `repeat(${statuses.length}, minmax(280px, 350px))`,
              maxWidth: '100%'
            }}>
              {statuses.map(status => (
                <RoadmapColumn
                  key={status.id}
                  status={status}
                  suggestions={localSuggestionsByStatus[status.id] || []}
                  onAddSuggestionClick={() => handleAddSuggestionClick(status.id)}
                  onSuggestionClick={handleSuggestionClick}
                />
              ))}
            </div>
            <DragOverlay>
              {activeSuggestion && (
                <SuggestionCard
                  key={`overlay-${activeSuggestion.id}`}
                  suggestion={activeSuggestion}
                  onClick={() => {}}
                  isDragOverlay={true}
                />
              )}
            </DragOverlay>
          </DndContext>
        </>
      ) : (
        <RoadmapTable
          onSuggestionClick={handleSuggestionClick}
          onDeleteSuggestion={handleDeleteSuggestion}
        />
      )}

      {/* Centered modal for suggestion form */}
      {(showSuggestionForm || isEditModalOpen) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-xl p-6 shadow-xl w-full max-w-xl border border-gray-800 max-h-[90vh] overflow-y-auto">
            <SuggestionForm
              key={selectedSuggestion?.id || initialStatusId || 'new-suggestion'}
              suggestion={selectedSuggestion}
              onSave={handleSaveSuggestion}
              onCancel={() => {
                setShowSuggestionForm(false);
                setIsEditModalOpen(false);
                setSelectedSuggestion(null);
                setInitialStatusId(null);
              }}
              onDelete={selectedSuggestion ? handleDeleteSuggestion : undefined}
              initialStatusId={initialStatusId}
            />
          </div>
        </div>
      )}
    </>
  );
});
RoadmapContent.displayName = 'RoadmapContent';

export interface RoadmapKanbanHandle {
  openSuggestionForm: () => void;
}

export const RoadmapKanban = React.forwardRef<RoadmapKanbanHandle>((props, ref) => {
  return (
    <RoadmapProvider>
      <RoadmapContent ref={ref} />
    </RoadmapProvider>
  );
});
RoadmapKanban.displayName = 'RoadmapKanban';