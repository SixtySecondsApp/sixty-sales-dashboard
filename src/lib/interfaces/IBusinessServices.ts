/**
 * Business service interfaces following Single Responsibility Principle
 * Each service has a single, well-defined responsibility
 */

import { DealWithRelationships, DealStage, DealCreateData, DealUpdateData } from '@/lib/hooks/deals/types/dealTypes';
import { Activity } from '@/lib/hooks/useActivities';
import { Company } from '@/lib/hooks/useCompany';

// Deal management service interface
export interface IDealService {
  createDeal(data: DealCreateData): Promise<DealWithRelationships>;
  updateDeal(id: string, data: DealUpdateData): Promise<DealWithRelationships>;
  deleteDeal(id: string): Promise<boolean>;
  getDealById(id: string): Promise<DealWithRelationships | null>;
  getDealsByOwner(ownerId?: string): Promise<DealWithRelationships[]>;
  moveDealToStage(dealId: string, newStageId: string): Promise<DealWithRelationships>;
}

// Stage management service interface
export interface IStageService {
  getAllStages(): Promise<DealStage[]>;
  createStage(name: string, order: number): Promise<DealStage>;
  updateStageOrder(stageId: string, newOrder: number): Promise<DealStage>;
  deleteStage(stageId: string): Promise<boolean>;
}

// Activity management service interface
export interface IActivityService {
  createActivity(data: Omit<Activity, 'id' | 'created_at' | 'updated_at'>): Promise<Activity>;
  updateActivity(id: string, data: Partial<Activity>): Promise<Activity>;
  deleteActivity(id: string): Promise<boolean>;
  getActivitiesByOwner(ownerId?: string): Promise<Activity[]>;
  getActivitiesByDeal(dealId: string): Promise<Activity[]>;
}

// Company management service interface
export interface ICompanyService {
  createCompany(data: Omit<Company, 'id' | 'created_at' | 'updated_at'>): Promise<Company>;
  updateCompany(id: string, data: Partial<Company>): Promise<Company>;
  deleteCompany(id: string): Promise<boolean>;
  getCompanyById(id: string): Promise<Company | null>;
  searchCompanies(query: string): Promise<Company[]>;
  mergeCompanies(targetId: string, sourceId: string): Promise<Company>;
}

// Financial calculations service interface
export interface IFinancialService {
  calculateLTV(monthlyMRR: number, oneOffRevenue: number): number;
  calculateAnnualValue(monthlyMRR: number, oneOffRevenue: number): number;
  validateSplitDeal(deal: DealWithRelationships): boolean;
  calculateTotalValue(deals: DealWithRelationships[]): number;
}

// Validation service interface
export interface IValidationService {
  validateDeal(data: DealCreateData | DealUpdateData): Promise<string[]>;
  validateActivity(data: Partial<Activity>): Promise<string[]>;
  validateCompany(data: Partial<Company>): Promise<string[]>;
  validateFinancialData(data: { monthly_mrr?: number; one_off_revenue?: number }): string[];
}

// Notification service interface
export interface INotificationService {
  sendDealStatusUpdate(dealId: string, status: string): Promise<boolean>;
  sendActivityReminder(activityId: string): Promise<boolean>;
  sendTaskNotification(taskId: string, userId: string): Promise<boolean>;
}

// Permission service interface
export interface IPermissionService {
  canUserEditDeal(userId: string, dealId: string): Promise<boolean>;
  canUserDeleteDeal(userId: string, dealId: string): Promise<boolean>;
  canUserSplitRevenue(userId: string): Promise<boolean>;
  hasAdminAccess(userId: string): Promise<boolean>;
}

// Audit service interface
export interface IAuditService {
  logDealChange(dealId: string, changes: Record<string, any>, userId: string): Promise<void>;
  logActivityCreation(activityId: string, userId: string): Promise<void>;
  logFinancialChange(dealId: string, previousValue: number, newValue: number, userId: string): Promise<void>;
  getAuditLog(entityId: string, entityType: string): Promise<any[]>;
}