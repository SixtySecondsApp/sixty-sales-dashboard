import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  closestCorners,
  rectIntersection,
  closestCenter,
  pointerWithin,
  getFirstCollision,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragEndEvent,
  MeasuringStrategy,
  DragOverEvent,
  DragStartEvent,
  CollisionDetection,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { RoadmapProvider, useRoadmapContext } from '@/lib/contexts/RoadmapContext';
import { RoadmapHeader, type RoadmapFilters } from './RoadmapHeader';
import { RoadmapColumn } from './RoadmapColumn';
import { SuggestionCard } from './SuggestionCard';
import { SuggestionForm } from './SuggestionForm';
import { RoadmapTable } from './RoadmapTable';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { RoadmapSuggestion } from '@/lib/hooks/useRoadmap';

import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/clientV2';
import { ConfettiService } from '@/lib/services/confettiService';
import logger from '@/lib/utils/logger';

// TypeScript interfaces for component state
interface DragState {
  draggedId: string | null;
  draggedFromStatus: string | null;
  draggedOverStatus: string | null;
  draggedOverIndex: number | null;
}

interface RoadmapKanbanState {
  localSuggestionsByStatus: Record<string, RoadmapSuggestion[]>;
  dragState: DragState;
}

export interface RoadmapKanbanHandle {
  openSuggestionForm: () => void;
  openSuggestionModal: (suggestion: RoadmapSuggestion) => void;
}




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

// Custom collision detection that works better with empty columns
const customCollisionDetection: CollisionDetection = (args) => {
  // First try rect intersection which works well with empty areas
  const rectCollisions = rectIntersection(args);
  if (rectCollisions.length > 0) {
    return rectCollisions;
  }
  
  // Then try pointer within for more precise detection
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) {
    return pointerCollisions;
  }
  
  // Finally try closest center as last resort
  return closestCenter(args);
};

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
  const [localSuggestionsByStatus, setLocalSuggestionsByStatus] = useState<Record<string, RoadmapSuggestion[]>>({});
  const [showSuggestionForm, setShowSuggestionForm] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<RoadmapSuggestion | null>(null);
  const [initialStatusId, setInitialStatusId] = useState<string | null>(null);
  const [activeSuggestion, setActiveSuggestion] = useState<RoadmapSuggestion | null>(null);
  const [sortBy, setSortBy] = useState<'votes' | 'date' | 'priority' | 'none'>('none');
  const [filters, setFilters] = useState<RoadmapFilters>({
    search: '',
    type: [],
    priority: [],
    assignee: []
  });

  // DnD state
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [draggedFromStatus, setDraggedFromStatus] = useState<string | null>(null);
  const [draggedOverStatus, setDraggedOverStatus] = useState<string | null>(null);
  const [draggedOverIndex, setDraggedOverIndex] = useState<number | null>(null);

  // Keep a ref to the last valid over status for drop fallback
  const lastValidOverStatusRef = useRef<string | null>(null);

  // State for the edit modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Expose methods to parent component
  React.useImperativeHandle(ref, () => ({
    openSuggestionForm: () => handleAddSuggestionClick(null),
    openSuggestionModal: (suggestion: RoadmapSuggestion) => {
      setSelectedSuggestion(suggestion);
      setIsEditModalOpen(true);
    }
  }), []);

  // Update local state when the context data changes (with performance optimization)
  const updateLocalSuggestions = useCallback((newSuggestions: Record<string, RoadmapSuggestion[]>) => {
    setLocalSuggestionsByStatus(prev => {
      // Efficient shallow comparison to prevent unnecessary re-renders
      const statusIds = Object.keys(newSuggestions);
      const prevStatusIds = Object.keys(prev);
      
      // Quick checks for obvious changes
      if (statusIds.length !== prevStatusIds.length) {
        return { ...newSuggestions };
      }
      
      // Check if any status has different suggestion count or ids
      for (const statusId of statusIds) {
        const prevSuggestions = prev[statusId] || [];
        const newSuggestionsList = newSuggestions[statusId] || [];
        
        if (prevSuggestions.length !== newSuggestionsList.length) {
          return { ...newSuggestions };
        }
        
        // Check if suggestion IDs changed (most common change)
        for (let i = 0; i < newSuggestionsList.length; i++) {
          if (prevSuggestions[i]?.id !== newSuggestionsList[i]?.id) {
            return { ...newSuggestions };
          }
        }
      }
      
      return prev; // No changes detected
    });
  }, []);

  useEffect(() => {
    updateLocalSuggestions(contextSuggestionsByStatus);
  }, [contextSuggestionsByStatus, updateLocalSuggestions]);

  // Apply filtering and sorting to the local state
  useEffect(() => {
    let filteredSuggestions = { ...contextSuggestionsByStatus };

    // Apply filters
    const hasActiveFilters = filters.search.trim() !== '' || 
                            filters.type.length > 0 || 
                            filters.priority.length > 0;

    if (hasActiveFilters) {
      Object.keys(filteredSuggestions).forEach(statusId => {
        filteredSuggestions[statusId] = filteredSuggestions[statusId].filter(suggestion => {
          // Search filter
          if (filters.search.trim()) {
            const searchTerm = filters.search.toLowerCase();
            const matchesSearch = 
              suggestion.title.toLowerCase().includes(searchTerm) ||
              suggestion.description.toLowerCase().includes(searchTerm) ||
              suggestion.submitted_by_profile?.full_name?.toLowerCase().includes(searchTerm) ||
              suggestion.assigned_to_profile?.full_name?.toLowerCase().includes(searchTerm);
            
            if (!matchesSearch) return false;
          }

          // Type filter
          if (filters.type.length > 0 && !filters.type.includes(suggestion.type)) {
            return false;
          }

          // Priority filter
          if (filters.priority.length > 0 && !filters.priority.includes(suggestion.priority)) {
            return false;
          }

          return true;
        });
      });
    }

    // Apply sorting
    if (sortBy !== 'none') {
      Object.keys(filteredSuggestions).forEach(statusId => {
        filteredSuggestions[statusId] = [...filteredSuggestions[statusId]].sort((a, b) => {
          switch (sortBy) {
            case 'votes':
              return b.votes_count - a.votes_count;
            case 'date':
              return new Date(b.submitted_at || 0).getTime() - new Date(a.submitted_at || 0).getTime();
            case 'priority':
              const priorityOrder: Record<RoadmapSuggestion['priority'], number> = { critical: 0, high: 1, medium: 2, low: 3 };
              return (priorityOrder[a.priority] || 999) - (priorityOrder[b.priority] || 999);
            default:
              return 0;
          }
        });
      });
    }

    setLocalSuggestionsByStatus(filteredSuggestions);
  }, [contextSuggestionsByStatus, sortBy, filters]);

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
    if (!suggestion || !suggestion.id) {
      logger.error('Invalid suggestion clicked:', suggestion);
      toast.error('Unable to open suggestion - invalid data');
      return;
    }
    
    const foundSuggestion = suggestions.find(s => s.id === suggestion.id);
    if (!foundSuggestion) {
      logger.error('Suggestion not found in list:', suggestion.id);
      toast.error('Unable to find suggestion');
      return;
    }
    
    setSelectedSuggestion(foundSuggestion);
    setIsEditModalOpen(true);
    setInitialStatusId(null);
  };

  const handleSaveSuggestion = async (formData: any) => {
    let success = false;
    let savedOrCreatedSuggestion = null;

    try {
      logger.log('handleSaveSuggestion called with:', {
        selectedSuggestionId: selectedSuggestion?.id,
        selectedSuggestionTitle: selectedSuggestion?.title,
        formData,
        hasId: !!selectedSuggestion?.id,
        idType: typeof selectedSuggestion?.id,
        idLength: selectedSuggestion?.id?.length,
        idValue: JSON.stringify(selectedSuggestion?.id)
      });

      // Check if we have a valid suggestion with proper ID
      const hasValidId = selectedSuggestion && 
                        selectedSuggestion.id && 
                        typeof selectedSuggestion.id === 'string' && 
                        selectedSuggestion.id.trim() !== '' &&
                        selectedSuggestion.id.length >= 10; // UUIDs should be at least 36 chars

      if (selectedSuggestion && hasValidId) {
        // This is an update operation
        const suggestionId = selectedSuggestion.id.trim();
        logger.log('Updating suggestion with ID:', suggestionId);
        await updateSuggestion(suggestionId, formData);
        success = true;
      } else if (!selectedSuggestion || !hasValidId) {
        // This is a create operation (either no suggestion or invalid ID)
        logger.log('Creating new suggestion');
        savedOrCreatedSuggestion = await createSuggestion(formData);
        success = !!savedOrCreatedSuggestion;
      }

      if (success) {
        setShowSuggestionForm(false);
        setIsEditModalOpen(false);
        toast.success(selectedSuggestion ? 'Suggestion updated' : 'Suggestion created');
      }
    } catch (error) {
      logger.error('Save error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save suggestion';
      toast.error(errorMessage);
    }
  };



  // Find the statusId for a given suggestionId or statusId (memoized for performance)
  const findStatusForId = useCallback((id: string): string | undefined => {
    // Check if it's a status ID directly
    if (statuses.some(s => s.id === id)) {
      return id;
    }
    // Check if it's in the local suggestions mapping
    if (id in localSuggestionsByStatus) {
      return id;
    }
    // Otherwise find which status contains this suggestion
    const foundStatus = Object.keys(localSuggestionsByStatus).find(statusId =>
      localSuggestionsByStatus[statusId].some(suggestion => suggestion.id === id)
    );
    return foundStatus;
  }, [localSuggestionsByStatus, statuses]);

  // --- DND HANDLERS ---

  // On drag start, set the draggedId and fromStatus, and set activeSuggestion for overlay (memoized)
  const handleDragStart = useCallback((event: DragStartEvent) => {
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
  }, [findStatusForId, localSuggestionsByStatus, sortBy]);

  // On drag over, update the localSuggestionsByStatus for visual feedback
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    const fromStatus = findStatusForId(activeId);
    let toStatus = findStatusForId(overId);

    // Check if overId is a status ID directly (empty column drop)
    if (!toStatus && statuses.some(s => s.id === overId)) {
      toStatus = overId;
    }

    if (!fromStatus || !toStatus) {
      logger.log('Drag over - status detection:', { 
        activeId, 
        overId, 
        fromStatus, 
        toStatus,
        isOverIdAStatus: statuses.some(s => s.id === overId),
        availableStatuses: statuses.map(s => s.id)
      });
      return;
    }

    // If dropped on the same status and same position, do nothing
    if (fromStatus === toStatus && overId === activeId) return;

    // Find the index in the target status
    let toIndex = localSuggestionsByStatus[toStatus].findIndex(s => s.id === overId);
    if (toIndex === -1 || overId === toStatus || overId.endsWith('-placeholder')) {
      // If dropped on the column itself, empty space, placeholder, or overId is the status ID, add to end
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
        toSuggestions.splice(toIndex, 0, { ...suggestion, status: toStatus as RoadmapSuggestion['status'] });
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
    let toStatus = null;
    if (over) {
      const overId = String(over.id);
      // Check if it's a placeholder ID for empty column
      if (overId.endsWith('-placeholder')) {
        toStatus = overId.replace('-placeholder', '');
      } else if (statuses.find(s => s.id === overId)) {
        // Check if it's a status ID (empty column)
        toStatus = overId;
      } else {
        // Otherwise find which status contains this item
        toStatus = findStatusForId(overId);
      }
    }
    
    // Use last valid status as fallback
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
      // Handle placeholder IDs for empty columns
      if (overId.endsWith('-placeholder') || overId === toStatus) {
        toIndex = 0; // Place at beginning of empty column
      } else {
        toIndex = localSuggestionsByStatus[toStatus].findIndex(s => s.id === overId);
        if (toIndex === -1) {
          toIndex = localSuggestionsByStatus[toStatus].length;
        }
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
      // Remove the refreshKey update to prevent unnecessary re-renders
      // The real-time subscription will handle updates automatically
    } catch (err) {
      // Rollback UI on error
      logger.error('Failed to move suggestion:', err);
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
      logger.error('Failed to delete suggestion:', error);
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
        filters={filters}
        onFiltersChange={setFilters}
      />

      {view === 'kanban' ? (
        <>

          <DndContext
            sensors={sensors}
            collisionDetection={customCollisionDetection}
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

      {/* Centered modal for suggestion form - rendered as portal to ensure full coverage */}
      {(showSuggestionForm || isEditModalOpen) && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" style={{ margin: 0 }}>
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
        </div>,
        document.body
      )}
    </>
  );
});
RoadmapContent.displayName = 'RoadmapContent';

export const RoadmapKanban = React.forwardRef<RoadmapKanbanHandle>((props, ref) => {
  return (
    <RoadmapProvider>
      <RoadmapContent ref={ref} />
    </RoadmapProvider>
  );
});
RoadmapKanban.displayName = 'RoadmapKanban';