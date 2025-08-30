import { DealWithRelationships } from '../types/dealTypes';

// Calculate days in stage for a deal
export function calculateDaysInStage(stageChangedAt: string): number {
  if (!stageChangedAt) return 0;
  
  return Math.floor(
    (new Date().getTime() - new Date(stageChangedAt).getTime()) / (1000 * 60 * 60 * 24)
  );
}

// Determine time status based on days in stage
export function getTimeStatus(daysInStage: number): 'normal' | 'warning' | 'danger' {
  // Default to normal - this can be enhanced with business rules later
  return 'normal';
}

// Process raw deal data to include computed fields
export function processDealData(deal: any): DealWithRelationships {
  const daysInStage = calculateDaysInStage(deal.stage_changed_at);
  
  return {
    ...deal,
    company: deal.company || '',
    contact_name: deal.contact_name || '',
    daysInStage,
    timeStatus: getTimeStatus(daysInStage)
  };
}

// Group deals by stage for pipeline display
export function groupDealsByStage(deals: DealWithRelationships[]): Record<string, DealWithRelationships[]> {
  return deals.reduce((acc, deal) => {
    const stageId = deal.stage_id;
    if (!acc[stageId]) {
      acc[stageId] = [];
    }
    acc[stageId].push(deal);
    return acc;
  }, {} as Record<string, DealWithRelationships[]>);
}