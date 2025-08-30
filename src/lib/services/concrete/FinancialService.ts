/**
 * Concrete Financial Service Implementation
 * Follows Single Responsibility Principle - only handles financial calculations
 * Follows Open/Closed Principle - extensible through calculation strategies
 */

import { IFinancialService } from '@/lib/interfaces/IBusinessServices';
import { DealWithRelationships } from '@/lib/hooks/deals/types/dealTypes';

// Calculation strategy interface for Open/Closed Principle
interface CalculationStrategy {
  calculate(monthlyMRR: number, oneOffRevenue: number): number;
}

// LTV calculation strategies
class StandardLTVStrategy implements CalculationStrategy {
  calculate(monthlyMRR: number, oneOffRevenue: number): number {
    // Business rule: LTV = (Monthly MRR × 3) + One-off Revenue
    return (monthlyMRR * 3) + oneOffRevenue;
  }
}

class PremiumLTVStrategy implements CalculationStrategy {
  calculate(monthlyMRR: number, oneOffRevenue: number): number {
    // Alternative calculation for premium deals
    return (monthlyMRR * 5) + oneOffRevenue;
  }
}

// Annual value calculation strategies
class StandardAnnualValueStrategy implements CalculationStrategy {
  calculate(monthlyMRR: number, oneOffRevenue: number): number {
    // Business rule: Annual Value = (Monthly MRR × 12) + One-off Revenue
    return (monthlyMRR * 12) + oneOffRevenue;
  }
}

export class FinancialService implements IFinancialService {
  private ltvStrategy: CalculationStrategy = new StandardLTVStrategy();
  private annualValueStrategy: CalculationStrategy = new StandardAnnualValueStrategy();

  calculateLTV(monthlyMRR: number, oneOffRevenue: number): number {
    // Validate inputs
    if (monthlyMRR < 0 || oneOffRevenue < 0) {
      throw new Error('Revenue values cannot be negative');
    }

    return this.ltvStrategy.calculate(monthlyMRR || 0, oneOffRevenue || 0);
  }

  calculateAnnualValue(monthlyMRR: number, oneOffRevenue: number): number {
    // Validate inputs
    if (monthlyMRR < 0 || oneOffRevenue < 0) {
      throw new Error('Revenue values cannot be negative');
    }

    return this.annualValueStrategy.calculate(monthlyMRR || 0, oneOffRevenue || 0);
  }

  validateSplitDeal(deal: DealWithRelationships): boolean {
    const hasOneOff = (deal.one_off_revenue || 0) > 0;
    const hasMonthly = (deal.monthly_mrr || 0) > 0;
    
    // A split deal has both one-off AND monthly revenue
    return hasOneOff && hasMonthly;
  }

  calculateTotalValue(deals: DealWithRelationships[]): number {
    return deals.reduce((total, deal) => {
      const oneOff = deal.one_off_revenue || 0;
      const monthly = deal.monthly_mrr || 0;
      return total + this.calculateAnnualValue(monthly, oneOff);
    }, 0);
  }

  /**
   * Calculate pipeline value by stage
   */
  calculatePipelineValueByStage(deals: DealWithRelationships[]): Record<string, number> {
    const valueByStage: Record<string, number> = {};
    
    deals.forEach(deal => {
      const stageName = deal.stages?.name || 'Unknown';
      if (!valueByStage[stageName]) {
        valueByStage[stageName] = 0;
      }
      
      const oneOff = deal.one_off_revenue || 0;
      const monthly = deal.monthly_mrr || 0;
      valueByStage[stageName] += this.calculateAnnualValue(monthly, oneOff);
    });

    return valueByStage;
  }

  /**
   * Calculate conversion rates between stages
   */
  calculateStageConversionRates(deals: DealWithRelationships[]): Record<string, number> {
    const stageCount: Record<string, number> = {};
    
    // Count deals in each stage
    deals.forEach(deal => {
      const stageName = deal.stages?.name || 'Unknown';
      stageCount[stageName] = (stageCount[stageName] || 0) + 1;
    });

    // Calculate conversion rates (simplified example)
    const conversionRates: Record<string, number> = {};
    const stageNames = Object.keys(stageCount);
    
    for (let i = 0; i < stageNames.length - 1; i++) {
      const currentStage = stageNames[i];
      const nextStage = stageNames[i + 1];
      const currentCount = stageCount[currentStage];
      const nextCount = stageCount[nextStage];
      
      if (currentCount > 0) {
        conversionRates[`${currentStage} → ${nextStage}`] = (nextCount / currentCount) * 100;
      }
    }

    return conversionRates;
  }

  /**
   * Calculate average deal size
   */
  calculateAverageDealSize(deals: DealWithRelationships[]): number {
    if (deals.length === 0) return 0;
    
    const totalValue = this.calculateTotalValue(deals);
    return totalValue / deals.length;
  }

  /**
   * Calculate MRR growth
   */
  calculateMRRGrowth(currentDeals: DealWithRelationships[], previousDeals: DealWithRelationships[]): number {
    const currentMRR = currentDeals.reduce((total, deal) => total + (deal.monthly_mrr || 0), 0);
    const previousMRR = previousDeals.reduce((total, deal) => total + (deal.monthly_mrr || 0), 0);
    
    if (previousMRR === 0) return currentMRR > 0 ? 100 : 0;
    
    return ((currentMRR - previousMRR) / previousMRR) * 100;
  }

  /**
   * Set custom LTV calculation strategy (Open/Closed Principle)
   */
  setLTVCalculationStrategy(strategy: CalculationStrategy): void {
    this.ltvStrategy = strategy;
  }

  /**
   * Set custom annual value calculation strategy (Open/Closed Principle)
   */
  setAnnualValueCalculationStrategy(strategy: CalculationStrategy): void {
    this.annualValueStrategy = strategy;
  }

  /**
   * Get financial summary for deals
   */
  getFinancialSummary(deals: DealWithRelationships[]): {
    totalValue: number;
    totalMRR: number;
    totalOneOff: number;
    averageDealSize: number;
    splitDealsCount: number;
    valueByStage: Record<string, number>;
  } {
    const totalMRR = deals.reduce((total, deal) => total + (deal.monthly_mrr || 0), 0);
    const totalOneOff = deals.reduce((total, deal) => total + (deal.one_off_revenue || 0), 0);
    const splitDealsCount = deals.filter(deal => this.validateSplitDeal(deal)).length;

    return {
      totalValue: this.calculateTotalValue(deals),
      totalMRR,
      totalOneOff,
      averageDealSize: this.calculateAverageDealSize(deals),
      splitDealsCount,
      valueByStage: this.calculatePipelineValueByStage(deals),
    };
  }
}