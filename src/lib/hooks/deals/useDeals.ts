import { useState, useEffect, useMemo } from 'react';
import { useViewMode } from '@/contexts/ViewModeContext';
import { groupDealsByStage } from './utils/dealCalculations';
import { useDealCRUD } from './useDealCRUD';
import { useDealStages } from './useDealStages';
import { 
  DealWithRelationships, 
  DealStage, 
  DealsByStage,
  DealCreateData,
  DealUpdateData
} from './types/dealTypes';

/**
 * Main useDeals hook - composition of specialized deal management hooks
 * Maintains 100% backward compatibility with original API
 */
export function useDeals(ownerId?: string) {
  const { isViewMode, viewedUser } = useViewMode();
  const [deals, setDeals] = useState<DealWithRelationships[]>([]);
  const [stages, setStages] = useState<DealStage[]>([]);
  
  // Use viewed user ID if in view mode
  const effectiveOwnerId = isViewMode && viewedUser ? viewedUser.id : ownerId;

  // Initialize specialized hooks first (without data refresh callback)
  const crudHook = useDealCRUD(effectiveOwnerId, undefined);
  const stageHook = useDealStages(deals, stages, undefined);

  // Data refresh callback to update local state
  const handleDataChange = async () => {
    const [newDeals, newStages] = await Promise.all([
      crudHook.fetchDeals(),
      stageHook.fetchStages()
    ]);
    setDeals(newDeals);
    setStages(newStages);
  };

  // Group deals by stage for pipeline display (memoized for performance)
  const dealsByStage: DealsByStage = useMemo(() => {
    return groupDealsByStage(deals);
  }, [deals]);

  // Load data on mount and when effectiveOwnerId changes
  useEffect(() => {
    // Skip if no owner ID yet (prevents fetching with undefined)
    if (effectiveOwnerId === undefined) {
      return;
    }
    
    const loadData = async () => {
      const [initialDeals, initialStages] = await Promise.all([
        crudHook.fetchDeals(),
        stageHook.fetchStages()
      ]);
      setDeals(initialDeals);
      setStages(initialStages);
    };

    loadData();
  }, [effectiveOwnerId]);

  // Direct API forwarding (data refresh handled in individual hooks)
  const { createDeal, updateDeal, deleteDeal } = crudHook;
  const { moveDealToStage, forceUpdateDealStage } = stageHook;

  // Alias for backward compatibility
  const refreshDeals = handleDataChange;

  // Return exact same API as original hook
  return {
    deals,
    stages,
    dealsByStage,
    isLoading: crudHook.isLoading,
    error: crudHook.error || stageHook.error,
    createDeal,
    updateDeal,
    deleteDeal,
    moveDealToStage,
    forceUpdateDealStage,
    refreshDeals
  };
}

// Re-export types for backward compatibility
export type { DealWithRelationships, DealStage } from './types/dealTypes';