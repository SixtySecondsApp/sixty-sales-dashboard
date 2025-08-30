/**
 * Deal Repository Implementation
 * Follows Repository pattern and Liskov Substitution Principle
 * Extends SupabaseRepository while maintaining contract compliance
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseRepository } from './SupabaseRepository';
import { DealWithRelationships, DealCreateData } from '@/lib/hooks/deals/types/dealTypes';

export class DealRepository extends SupabaseRepository<DealWithRelationships, DealCreateData> {
  constructor(supabase: SupabaseClient) {
    super(supabase, 'deals');
  }

  protected getTableQuery() {
    return this.supabase.from(this.tableName);
  }

  /**
   * Deal-specific relation mapping
   */
  protected mapRelation(relation: string): string {
    const relationMap: Record<string, string> = {
      'owner': 'profiles!deals_owner_id_fkey(id, first_name, last_name, email)',
      'company': 'companies!deals_company_id_fkey(id, name, domain, website)',
      'stage': 'stages!deals_stage_id_fkey(id, name, order_index, color)',
      'activities': 'activities(id, type, title, date, owner_id)',
      'splits': 'deal_splits(id, user_id, one_off_revenue, monthly_mrr, profiles(first_name, last_name))',
      'stage_history': 'deal_stage_history(id, previous_stage_id, new_stage_id, changed_at, changed_by)',
    };

    return relationMap[relation] || `${relation}(*)`;
  }

  /**
   * Find deals by owner with all relations loaded
   */
  async findByOwner(ownerId: string): Promise<DealWithRelationships[]> {
    return this.findAllWithRelations(['owner', 'company', 'stage', 'activities'], { owner_id: ownerId });
  }

  /**
   * Find deals by stage
   */
  async findByStage(stageId: string): Promise<DealWithRelationships[]> {
    return this.findAllWithRelations(['owner', 'company', 'stage'], { stage_id: stageId });
  }

  /**
   * Find deals by company
   */
  async findByCompany(companyId: string): Promise<DealWithRelationships[]> {
    return this.findAllWithRelations(['owner', 'stage', 'activities'], { company_id: companyId });
  }

  /**
   * Find deals within date range
   */
  async findByDateRange(startDate: string, endDate: string): Promise<DealWithRelationships[]> {
    return this.findBy({
      created_at: {
        gte: startDate,
        lte: endDate
      }
    });
  }

  /**
   * Find deals by value range
   */
  async findByValueRange(minValue: number, maxValue: number): Promise<DealWithRelationships[]> {
    // Calculate total value using both one_off_revenue and monthly_mrr
    const { data, error } = await this.supabase.rpc('find_deals_by_value_range', {
      min_value: minValue,
      max_value: maxValue
    });

    if (error) {
      throw new Error(`Failed to find deals by value range: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Find split deals (deals with both one-off and monthly revenue)
   */
  async findSplitDeals(): Promise<DealWithRelationships[]> {
    return this.findBy({
      one_off_revenue: { gt: 0 },
      monthly_mrr: { gt: 0 }
    });
  }

  /**
   * Search deals by company name or deal title
   */
  async searchDeals(query: string): Promise<DealWithRelationships[]> {
    const { data, error } = await this.getTableQuery()
      .select(`
        *,
        profiles!deals_owner_id_fkey(id, first_name, last_name, email),
        companies!deals_company_id_fkey(id, name, domain, website),
        stages!deals_stage_id_fkey(id, name, order_index, color)
      `)
      .or(`title.ilike.%${query}%,company_name.ilike.%${query}%`);

    if (error) {
      throw new Error(`Failed to search deals: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get deals pipeline statistics
   */
  async getPipelineStats(): Promise<{
    totalDeals: number;
    totalValue: number;
    dealsByStage: Record<string, number>;
    valueByStage: Record<string, number>;
  }> {
    const { data, error } = await this.supabase.rpc('get_pipeline_stats');

    if (error) {
      throw new Error(`Failed to get pipeline statistics: ${error.message}`);
    }

    return data || {
      totalDeals: 0,
      totalValue: 0,
      dealsByStage: {},
      valueByStage: {}
    };
  }

  /**
   * Update deal stage with history tracking
   */
  async updateDealStage(
    dealId: string, 
    newStageId: string, 
    previousStageId: string, 
    userId: string
  ): Promise<DealWithRelationships> {
    // Use a transaction to update deal and create history record
    const { data, error } = await this.supabase.rpc('update_deal_stage_with_history', {
      deal_id: dealId,
      new_stage_id: newStageId,
      previous_stage_id: previousStageId,
      user_id: userId
    });

    if (error) {
      throw new Error(`Failed to update deal stage: ${error.message}`);
    }

    // Return updated deal with relations
    const updatedDeal = await this.findWithRelations(dealId, ['owner', 'company', 'stage']);
    if (!updatedDeal) {
      throw new Error('Deal not found after stage update');
    }

    return updatedDeal;
  }

  /**
   * Get recent deal activity
   */
  async getRecentActivity(limit: number = 10): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('deal_stage_history')
      .select(`
        id,
        changed_at,
        previous_stage_id,
        new_stage_id,
        deals(id, title, company_name),
        profiles(first_name, last_name),
        previous_stage:stages!deal_stage_history_previous_stage_id_fkey(name),
        new_stage:stages!deal_stage_history_new_stage_id_fkey(name)
      `)
      .order('changed_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get recent activity: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Archive old deals (soft delete implementation)
   */
  async archiveOldDeals(daysOld: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    return this.updateMany(
      {
        updated_at: { lt: cutoffDate.toISOString() },
        archived: false
      },
      { archived: true }
    );
  }

  /**
   * Get deal conversion funnel
   */
  async getConversionFunnel(): Promise<{
    stageName: string;
    dealCount: number;
    totalValue: number;
    conversionRate: number;
  }[]> {
    const { data, error } = await this.supabase.rpc('get_deal_conversion_funnel');

    if (error) {
      throw new Error(`Failed to get conversion funnel: ${error.message}`);
    }

    return data || [];
  }
}