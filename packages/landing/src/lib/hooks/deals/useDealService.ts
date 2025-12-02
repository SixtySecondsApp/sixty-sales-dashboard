/**
 * Service-Based Deal Management Hook
 * Follows Dependency Inversion Principle by depending on service abstractions
 * Maintains backward compatibility with existing useDeals API
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useViewMode } from '@/contexts/ViewModeContext';
import { useServices } from '@/lib/services/ServiceLocator.tsx';
import { 
  DealWithRelationships, 
  DealStage, 
  DealsByStage,
  DealCreateData,
  DealUpdateData
} from './types/dealTypes';

/**
 * Service-based hook for deal management
 * Acts as an adapter between React components and business services
 */
export function useDealService(ownerId?: string) {
  const { isViewMode, viewedUser } = useViewMode();
  const services = useServices();
  
  // Local state
  const [deals, setDeals] = useState<DealWithRelationships[]>([]);
  const [stages, setStages] = useState<DealStage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Use viewed user ID if in view mode
  const effectiveOwnerId = isViewMode && viewedUser ? viewedUser.id : ownerId;

  // Memoized deals grouped by stage
  const dealsByStage: DealsByStage = useMemo(() => {
    const grouped: DealsByStage = {};
    
    stages.forEach(stage => {
      grouped[stage.id] = {
        stage,
        deals: deals.filter(deal => deal.stage_id === stage.id)
      };
    });

    return grouped;
  }, [deals, stages]);

  // Load deals and stages
  const loadData = useCallback(async () => {
    if (!services.isFeatureEnabled('deal_management')) {
      setError('Deal management feature is disabled');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [dealsData, stagesData] = await Promise.all([
        effectiveOwnerId 
          ? services.dealService.getDealsByOwner(effectiveOwnerId)
          : services.dealService.getDealsByOwner(),
        services.dealService.getAllStages ? services.dealService.getAllStages() : [] // TODO: implement stage service
      ]);

      setDeals(dealsData);
      setStages(stagesData as any[]); // TODO: fix type when stage service is implemented

      // Log successful data load
      services.logger.info('Deal data loaded successfully', {
        dealCount: dealsData.length,
        stageCount: stagesData.length,
        ownerId: effectiveOwnerId
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load deals';
      setError(errorMessage);
      
      // Log error
      services.logger.error('Failed to load deal data', {
        error: errorMessage,
        ownerId: effectiveOwnerId
      });

    } finally {
      setIsLoading(false);
    }
  }, [effectiveOwnerId, services]);

  // Create deal with validation
  const createDeal = useCallback(async (data: DealCreateData): Promise<DealWithRelationships> => {
    setError(null);

    try {
      // Use service layer for creation
      const newDeal = await services.dealService.createDeal({
        ...data,
        owner_id: effectiveOwnerId || data.owner_id
      });

      // Update local state
      setDeals(prev => [...prev, newDeal]);

      // Send notification if enabled
      if (services.isFeatureEnabled('deal_notifications')) {
        await services.notificationService.sendDealStatusUpdate(newDeal.id, 'created');
      }

      services.logger.info('Deal created successfully', { dealId: newDeal.id });
      return newDeal;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create deal';
      setError(errorMessage);
      services.logger.error('Failed to create deal', { error: errorMessage, data });
      throw err;
    }
  }, [effectiveOwnerId, services]);

  // Update deal with validation and audit
  const updateDeal = useCallback(async (id: string, data: DealUpdateData): Promise<DealWithRelationships> => {
    setError(null);

    try {
      const updatedDeal = await services.dealService.updateDeal(id, {
        ...data,
        owner_id: effectiveOwnerId || data.owner_id
      });

      // Update local state
      setDeals(prev => prev.map(deal => 
        deal.id === id ? updatedDeal : deal
      ));

      // Calculate financial changes for notifications
      const oldDeal = deals.find(d => d.id === id);
      if (oldDeal && services.isFeatureEnabled('financial_notifications')) {
        const oldValue = services.financialService.calculateAnnualValue(
          oldDeal.monthly_mrr || 0,
          oldDeal.one_off_revenue || 0
        );
        const newValue = services.financialService.calculateAnnualValue(
          updatedDeal.monthly_mrr || 0,
          updatedDeal.one_off_revenue || 0
        );

        if (oldValue !== newValue) {
          await services.auditService.logFinancialChange(
            id,
            oldValue,
            newValue,
            effectiveOwnerId || ''
          );
        }
      }

      services.logger.info('Deal updated successfully', { dealId: id });
      return updatedDeal;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update deal';
      setError(errorMessage);
      services.logger.error('Failed to update deal', { error: errorMessage, dealId: id, data });
      throw err;
    }
  }, [effectiveOwnerId, services, deals]);

  // Delete deal with permission check
  const deleteDeal = useCallback(async (id: string): Promise<boolean> => {
    setError(null);

    try {
      const success = await services.dealService.deleteDeal(id);

      if (success) {
        // Update local state
        setDeals(prev => prev.filter(deal => deal.id !== id));
        services.logger.info('Deal deleted successfully', { dealId: id });
      }

      return success;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete deal';
      setError(errorMessage);
      services.logger.error('Failed to delete deal', { error: errorMessage, dealId: id });
      throw err;
    }
  }, [services]);

  // Move deal to stage with business logic
  const moveDealToStage = useCallback(async (dealId: string, newStageId: string): Promise<DealWithRelationships> => {
    setError(null);

    try {
      const deal = deals.find(d => d.id === dealId);
      if (!deal) {
        throw new Error('Deal not found');
      }

      // Check if this is a transition to Opportunity stage (triggers proposal confirmation)
      const newStage = stages.find(s => s.id === newStageId);
      if (newStage?.name === 'Opportunity' && services.isFeatureEnabled('proposal_confirmation')) {
        // This would trigger proposal confirmation modal in the UI layer
        services.logger.info('Stage transition requires proposal confirmation', {
          dealId,
          fromStage: deal.stage_id,
          toStage: newStageId
        });
      }

      const updatedDeal = await services.dealService.moveDealToStage(dealId, newStageId);

      // Update local state
      setDeals(prev => prev.map(d => 
        d.id === dealId ? updatedDeal : d
      ));

      // Send stage change notification
      if (services.isFeatureEnabled('stage_notifications')) {
        await services.notificationService.sendDealStatusUpdate(dealId, 'stage_changed');
      }

      services.logger.info('Deal moved to new stage', {
        dealId,
        fromStage: deal.stage_id,
        toStage: newStageId
      });

      return updatedDeal;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to move deal';
      setError(errorMessage);
      services.logger.error('Failed to move deal to stage', { 
        error: errorMessage, 
        dealId, 
        newStageId 
      });
      throw err;
    }
  }, [deals, stages, services]);

  // Force update deal stage (for admin operations)
  const forceUpdateDealStage = useCallback(async (dealId: string, stageId: string): Promise<void> => {
    // Check admin permissions
    const hasAdminAccess = await services.permissionService.hasAdminAccess(effectiveOwnerId || '');
    if (!hasAdminAccess) {
      throw new Error('Admin access required for force stage update');
    }

    await moveDealToStage(dealId, stageId);
    services.logger.info('Admin force updated deal stage', { dealId, stageId });
  }, [moveDealToStage, services, effectiveOwnerId]);

  // Refresh data
  const refreshDeals = useCallback(() => {
    return loadData();
  }, [loadData]);

  // Load data on mount and when dependencies change
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Calculate financial summary using service
  const financialSummary = useMemo(() => {
    if (services.isFeatureEnabled('financial_calculations')) {
      return services.financialService.getFinancialSummary(deals);
    }
    return null;
  }, [deals, services]);

  // Return backward-compatible API
  return {
    // Data
    deals,
    stages,
    dealsByStage,
    
    // State
    isLoading,
    error,
    
    // Actions
    createDeal,
    updateDeal,
    deleteDeal,
    moveDealToStage,
    forceUpdateDealStage,
    refreshDeals,
    
    // New service-based features
    financialSummary,
    
    // Service access for advanced use cases
    services: services
  };
}