/**
 * Concrete Deal Service Implementation
 * Follows Single Responsibility Principle - only handles deal business logic
 * Follows Dependency Inversion Principle - depends on abstractions
 */

import { IDealService, IValidationService, IAuditService, IPermissionService } from '@/lib/interfaces/IBusinessServices';
import { IRepository } from '@/lib/interfaces/IDataRepository';
import { DealWithRelationships, DealStage, DealCreateData, DealUpdateData } from '@/lib/hooks/deals/types/dealTypes';

export class DealService implements IDealService {
  constructor(
    private readonly dealRepository: IRepository<DealWithRelationships>,
    private readonly validationService: IValidationService,
    private readonly auditService: IAuditService,
    private readonly permissionService: IPermissionService
  ) {}

  async createDeal(data: DealCreateData): Promise<DealWithRelationships> {
    // Validate input data
    const validationErrors = await this.validationService.validateDeal(data);
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
    }

    // Create deal
    const deal = await this.dealRepository.create(data);

    // Log creation
    await this.auditService.logDealChange(deal.id, { action: 'created', ...data }, data.owner_id);

    return deal;
  }

  async updateDeal(id: string, data: DealUpdateData): Promise<DealWithRelationships> {
    // Check permissions
    const canEdit = await this.permissionService.canUserEditDeal(data.owner_id || '', id);
    if (!canEdit) {
      throw new Error('Permission denied: Cannot edit this deal');
    }

    // Get current deal for audit trail
    const currentDeal = await this.dealRepository.findById(id);
    if (!currentDeal) {
      throw new Error('Deal not found');
    }

    // Validate update data
    const validationErrors = await this.validationService.validateDeal(data);
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
    }

    // Update deal
    const updatedDeal = await this.dealRepository.update(id, data);

    // Log changes
    const changes = this.getChanges(currentDeal, data);
    if (Object.keys(changes).length > 0) {
      await this.auditService.logDealChange(id, changes, data.owner_id || '');
    }

    return updatedDeal;
  }

  async deleteDeal(id: string): Promise<boolean> {
    const deal = await this.dealRepository.findById(id);
    if (!deal) {
      throw new Error('Deal not found');
    }

    // Check permissions
    const canDelete = await this.permissionService.canUserDeleteDeal(deal.owner_id, id);
    if (!canDelete) {
      throw new Error('Permission denied: Cannot delete this deal');
    }

    // Delete deal
    const deleted = await this.dealRepository.delete(id);

    // Log deletion
    if (deleted) {
      await this.auditService.logDealChange(id, { action: 'deleted' }, deal.owner_id);
    }

    return deleted;
  }

  async getDealById(id: string): Promise<DealWithRelationships | null> {
    return this.dealRepository.findWithRelations(id, ['owner', 'company', 'stage', 'activities']);
  }

  async getDealsByOwner(ownerId?: string): Promise<DealWithRelationships[]> {
    const filters = ownerId ? { owner_id: ownerId } : {};
    return this.dealRepository.findAllWithRelations(['owner', 'company', 'stage'], filters);
  }

  async moveDealToStage(dealId: string, newStageId: string): Promise<DealWithRelationships> {
    const deal = await this.dealRepository.findById(dealId);
    if (!deal) {
      throw new Error('Deal not found');
    }

    // Check permissions
    const canEdit = await this.permissionService.canUserEditDeal(deal.owner_id, dealId);
    if (!canEdit) {
      throw new Error('Permission denied: Cannot move this deal');
    }

    const previousStageId = deal.stage_id;
    
    // Update stage
    const updatedDeal = await this.dealRepository.update(dealId, { 
      stage_id: newStageId,
      stage_updated_at: new Date().toISOString()
    });

    // Log stage change
    await this.auditService.logDealChange(dealId, {
      stage_id: { from: previousStageId, to: newStageId },
      action: 'stage_moved'
    }, deal.owner_id);

    return updatedDeal;
  }

  /**
   * Helper method to track changes between current and updated data
   */
  private getChanges(current: DealWithRelationships, updates: DealUpdateData): Record<string, any> {
    const changes: Record<string, any> = {};
    
    Object.keys(updates).forEach(key => {
      const newValue = updates[key as keyof DealUpdateData];
      const currentValue = current[key as keyof DealWithRelationships];
      
      if (newValue !== currentValue) {
        changes[key] = {
          from: currentValue,
          to: newValue
        };
      }
    });

    return changes;
  }
}