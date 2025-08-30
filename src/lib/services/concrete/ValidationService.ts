/**
 * Concrete Validation Service Implementation
 * Follows Single Responsibility Principle - only handles validation logic
 * Follows Open/Closed Principle - extensible through validation strategies
 */

import { IValidationService } from '@/lib/interfaces/IBusinessServices';
import { DealCreateData, DealUpdateData } from '@/lib/hooks/deals/types/dealTypes';
import { Activity } from '@/lib/hooks/useActivities';
import { Company } from '@/lib/hooks/useCompany';

// Validation strategy interface for Open/Closed Principle
interface ValidationStrategy<T> {
  validate(data: T): string[];
}

// Deal validation strategies
class DealRequiredFieldsStrategy implements ValidationStrategy<DealCreateData | DealUpdateData> {
  validate(data: DealCreateData | DealUpdateData): string[] {
    const errors: string[] = [];
    
    if ('company_name' in data && (!data.company_name || data.company_name.trim() === '')) {
      errors.push('Company name is required');
    }
    
    if ('title' in data && (!data.title || data.title.trim() === '')) {
      errors.push('Deal title is required');
    }

    return errors;
  }
}

class DealFinancialValidationStrategy implements ValidationStrategy<DealCreateData | DealUpdateData> {
  validate(data: DealCreateData | DealUpdateData): string[] {
    const errors: string[] = [];
    
    const oneOff = data.one_off_revenue || 0;
    const monthly = data.monthly_mrr || 0;
    
    if (oneOff < 0) {
      errors.push('One-off revenue cannot be negative');
    }
    
    if (monthly < 0) {
      errors.push('Monthly MRR cannot be negative');
    }
    
    if (oneOff === 0 && monthly === 0) {
      errors.push('Deal must have either one-off revenue or monthly MRR');
    }
    
    // Business rule: max deal value
    const totalValue = (monthly * 12) + oneOff;
    if (totalValue > 1000000) {
      errors.push('Deal value exceeds maximum allowed amount');
    }

    return errors;
  }
}

class DealBusinessRulesStrategy implements ValidationStrategy<DealCreateData | DealUpdateData> {
  validate(data: DealCreateData | DealUpdateData): string[] {
    const errors: string[] = [];
    
    // Split deal validation
    if (data.one_off_revenue && data.monthly_mrr && 
        data.one_off_revenue > 0 && data.monthly_mrr > 0) {
      // This is a split deal - check if user has permission (will be checked at service level)
      if (!data.owner_id) {
        errors.push('Owner ID required for split deals');
      }
    }
    
    // Date validations
    if (data.expected_close_date) {
      const closeDate = new Date(data.expected_close_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (closeDate < today) {
        errors.push('Expected close date cannot be in the past');
      }
    }

    return errors;
  }
}

// Activity validation strategies
class ActivityRequiredFieldsStrategy implements ValidationStrategy<Partial<Activity>> {
  validate(data: Partial<Activity>): string[] {
    const errors: string[] = [];
    
    if (!data.type || data.type.trim() === '') {
      errors.push('Activity type is required');
    }
    
    if (!data.title || data.title.trim() === '') {
      errors.push('Activity title is required');
    }
    
    if (!data.owner_id || data.owner_id.trim() === '') {
      errors.push('Activity owner is required');
    }

    return errors;
  }
}

class ActivityBusinessRulesStrategy implements ValidationStrategy<Partial<Activity>> {
  validate(data: Partial<Activity>): string[] {
    const errors: string[] = [];
    
    // Date validations
    if (data.date) {
      const activityDate = new Date(data.date);
      const maxFutureDate = new Date();
      maxFutureDate.setFullYear(maxFutureDate.getFullYear() + 1);
      
      if (activityDate > maxFutureDate) {
        errors.push('Activity date cannot be more than 1 year in the future');
      }
    }
    
    // Value validations for sales
    if (data.type === 'sale') {
      const oneOff = data.one_off_revenue || 0;
      const monthly = data.monthly_mrr || 0;
      
      if (oneOff === 0 && monthly === 0) {
        errors.push('Sale activities must have revenue value');
      }
    }

    return errors;
  }
}

// Company validation strategies
class CompanyRequiredFieldsStrategy implements ValidationStrategy<Partial<Company>> {
  validate(data: Partial<Company>): string[] {
    const errors: string[] = [];
    
    if (!data.name || data.name.trim() === '') {
      errors.push('Company name is required');
    }

    return errors;
  }
}

class CompanyFormatValidationStrategy implements ValidationStrategy<Partial<Company>> {
  validate(data: Partial<Company>): string[] {
    const errors: string[] = [];
    
    // Website validation
    if (data.website) {
      const websiteRegex = /^https?:\/\/.+\..+/;
      if (!websiteRegex.test(data.website)) {
        errors.push('Website must be a valid URL');
      }
    }
    
    // Domain validation
    if (data.domain) {
      const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,}$/;
      if (!domainRegex.test(data.domain)) {
        errors.push('Domain must be valid (e.g., example.com)');
      }
    }

    return errors;
  }
}

export class ValidationService implements IValidationService {
  // Deal validation strategies
  private readonly dealValidationStrategies: ValidationStrategy<DealCreateData | DealUpdateData>[] = [
    new DealRequiredFieldsStrategy(),
    new DealFinancialValidationStrategy(),
    new DealBusinessRulesStrategy(),
  ];

  // Activity validation strategies
  private readonly activityValidationStrategies: ValidationStrategy<Partial<Activity>>[] = [
    new ActivityRequiredFieldsStrategy(),
    new ActivityBusinessRulesStrategy(),
  ];

  // Company validation strategies  
  private readonly companyValidationStrategies: ValidationStrategy<Partial<Company>>[] = [
    new CompanyRequiredFieldsStrategy(),
    new CompanyFormatValidationStrategy(),
  ];

  async validateDeal(data: DealCreateData | DealUpdateData): Promise<string[]> {
    const errors: string[] = [];
    
    for (const strategy of this.dealValidationStrategies) {
      errors.push(...strategy.validate(data));
    }
    
    return errors;
  }

  async validateActivity(data: Partial<Activity>): Promise<string[]> {
    const errors: string[] = [];
    
    for (const strategy of this.activityValidationStrategies) {
      errors.push(...strategy.validate(data));
    }
    
    return errors;
  }

  async validateCompany(data: Partial<Company>): Promise<string[]> {
    const errors: string[] = [];
    
    for (const strategy of this.companyValidationStrategies) {
      errors.push(...strategy.validate(data));
    }
    
    return errors;
  }

  validateFinancialData(data: { monthly_mrr?: number; one_off_revenue?: number }): string[] {
    const strategy = new DealFinancialValidationStrategy();
    return strategy.validate(data as any);
  }

  /**
   * Add custom validation strategy (Open/Closed Principle)
   */
  addDealValidationStrategy(strategy: ValidationStrategy<DealCreateData | DealUpdateData>): void {
    this.dealValidationStrategies.push(strategy);
  }

  addActivityValidationStrategy(strategy: ValidationStrategy<Partial<Activity>>): void {
    this.activityValidationStrategies.push(strategy);
  }

  addCompanyValidationStrategy(strategy: ValidationStrategy<Partial<Company>>): void {
    this.companyValidationStrategies.push(strategy);
  }
}