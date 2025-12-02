import { supabase } from '@/lib/supabase/clientV2';
import { toast } from 'sonner';
import logger from '@/lib/utils/logger';

export interface MergePreview {
  deals: {
    count: number;
    total_value: number;
    total_mrr: number;
  };
  contacts: {
    count: number;
  };
  activities: {
    count: number;
  };
  tasks: {
    count: number;
  };
  notes: {
    count: number;
  };
  clients: {
    count: number;
  };
  source_companies: Array<{
    id: string;
    name: string;
    status: string;
    created_at: string;
  }>;
  target_company: {
    id: string;
    name: string;
    status: string;
    created_at: string;
  };
}

export interface MergeResult {
  merge_id: string;
  deals_transferred: number;
  contacts_transferred: number;
  activities_transferred: number;
  tasks_transferred: number;
  notes_transferred: number;
  clients_transferred: number;
  merged_at: string;
}

export interface CompanyDuplicate {
  id: string;
  name: string;
  similarity_score: number;
  similarity_reasons: string[];
  deal_count: number;
  contact_count: number;
  total_value: number;
  status: string;
  created_at: string;
}

export interface DuplicateGroup {
  target_company: {
    id: string;
    name: string;
    deal_count: number;
    contact_count: number;
    total_value: number;
    status: string;
    created_at: string;
  };
  duplicates: CompanyDuplicate[];
  total_duplicates: number;
  combined_value: number;
}

export class CompanyMergeService {
  /**
   * Find potential duplicate companies using various matching algorithms
   */
  static async findDuplicateCompanies(options?: {
    min_similarity_score?: number;
    include_merged?: boolean;
    owner_id?: string;
  }): Promise<DuplicateGroup[]> {
    try {
      const { min_similarity_score = 0.7, include_merged = false, owner_id } = options || {};

      // Get all companies with their statistics
      let query = supabase
        .from('companies')
        .select(`
          id,
          name,
          domain,
          status,
          created_at,
          is_merged,
          owner_id
        `)
        .order('name');

      if (!include_merged) {
        query = query.eq('is_merged', false);
      }

      if (owner_id) {
        query = query.eq('owner_id', owner_id);
      }

      const { data: companies, error } = await query;

      if (error) throw error;

      const duplicateGroups: DuplicateGroup[] = [];
      const processedCompanies = new Set<string>();

      // Calculate similarity between all companies
      for (let i = 0; i < companies.length; i++) {
        const company1 = companies[i];
        
        if (processedCompanies.has(company1.id)) continue;

        const duplicates: CompanyDuplicate[] = [];

        for (let j = i + 1; j < companies.length; j++) {
          const company2 = companies[j];
          
          if (processedCompanies.has(company2.id)) continue;

          const similarity = this.calculateSimilarity(company1, company2);
          
          if (similarity.score >= min_similarity_score) {
            duplicates.push({
              id: company2.id,
              name: company2.name,
              similarity_score: similarity.score,
              similarity_reasons: similarity.reasons,
              deal_count: 0, // Will be populated with actual data
              contact_count: 0,
              total_value: 0,
              status: company2.status,
              created_at: company2.created_at
            });
            
            processedCompanies.add(company2.id);
          }
        }

        if (duplicates.length > 0) {
          // Get statistics for all companies in this group
          const allCompanyIds = [company1.id, ...duplicates.map(d => d.id)];
          const stats = await this.getCompanyStatistics(allCompanyIds);

          // Update statistics
          const targetStats = stats.find(s => s.company_id === company1.id);
          duplicates.forEach(duplicate => {
            const duplicateStats = stats.find(s => s.company_id === duplicate.id);
            if (duplicateStats) {
              duplicate.deal_count = duplicateStats.deal_count;
              duplicate.contact_count = duplicateStats.contact_count;
              duplicate.total_value = duplicateStats.total_value;
            }
          });

          duplicateGroups.push({
            target_company: {
              id: company1.id,
              name: company1.name,
              deal_count: targetStats?.deal_count || 0,
              contact_count: targetStats?.contact_count || 0,
              total_value: targetStats?.total_value || 0,
              status: company1.status,
              created_at: company1.created_at
            },
            duplicates,
            total_duplicates: duplicates.length,
            combined_value: duplicates.reduce((sum, d) => sum + d.total_value, targetStats?.total_value || 0)
          });

          processedCompanies.add(company1.id);
        }
      }

      return duplicateGroups.sort((a, b) => b.combined_value - a.combined_value);

    } catch (error) {
      logger.error('Error finding duplicate companies:', error);
      throw error;
    }
  }

  /**
   * Calculate similarity score between two companies
   */
  private static calculateSimilarity(company1: any, company2: any): { score: number; reasons: string[] } {
    const reasons: string[] = [];
    let score = 0;
    let maxScore = 0;

    // Name similarity (weighted heavily)
    const nameWeight = 0.6;
    maxScore += nameWeight;
    
    const nameSimilarity = this.calculateStringSimilarity(
      company1.name?.toLowerCase().trim(),
      company2.name?.toLowerCase().trim()
    );
    
    if (nameSimilarity > 0.8) {
      score += nameWeight * nameSimilarity;
      reasons.push(`Names are ${Math.round(nameSimilarity * 100)}% similar`);
    } else if (nameSimilarity > 0.6) {
      score += nameWeight * nameSimilarity * 0.8; // Reduced weight for lower similarity
      reasons.push(`Names are somewhat similar (${Math.round(nameSimilarity * 100)}%)`);
    }

    // Domain similarity (if available)
    if (company1.domain && company2.domain) {
      const domainWeight = 0.3;
      maxScore += domainWeight;
      
      if (company1.domain.toLowerCase() === company2.domain.toLowerCase()) {
        score += domainWeight;
        reasons.push('Same domain');
      } else {
        const domainSimilarity = this.calculateStringSimilarity(
          company1.domain.toLowerCase(),
          company2.domain.toLowerCase()
        );
        if (domainSimilarity > 0.7) {
          score += domainWeight * domainSimilarity;
          reasons.push(`Similar domains (${Math.round(domainSimilarity * 100)}%)`);
        }
      }
    }

    // Abbreviation check
    const abbreviationWeight = 0.1;
    maxScore += abbreviationWeight;
    
    if (this.isAbbreviation(company1.name, company2.name) || 
        this.isAbbreviation(company2.name, company1.name)) {
      score += abbreviationWeight;
      reasons.push('One appears to be an abbreviation of the other');
    }

    // Normalize score to 0-1 range
    const normalizedScore = maxScore > 0 ? score / maxScore : 0;

    return {
      score: Math.min(normalizedScore, 1),
      reasons
    };
  }

  /**
   * Calculate Levenshtein distance-based similarity
   */
  private static calculateStringSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 1;

    const matrix: number[][] = [];
    const len1 = str1.length;
    const len2 = str2.length;

    // Initialize matrix
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,     // deletion
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }

    const maxLength = Math.max(len1, len2);
    return (maxLength - matrix[len1][len2]) / maxLength;
  }

  /**
   * Check if one string is an abbreviation of another
   */
  private static isAbbreviation(short: string, long: string): boolean {
    if (!short || !long) return false;
    
    const shortClean = short.replace(/[^a-zA-Z]/g, '').toLowerCase();
    const longWords = long.split(/\s+/).filter(word => word.length > 0);
    
    if (shortClean.length !== longWords.length) return false;
    
    return longWords.every((word, index) => 
      word.toLowerCase().charAt(0) === shortClean.charAt(index)
    );
  }

  /**
   * Get statistics for companies
   */
  private static async getCompanyStatistics(companyIds: string[]): Promise<Array<{
    company_id: string;
    deal_count: number;
    contact_count: number;
    total_value: number;
  }>> {
    try {
      // Get deal statistics
      const { data: dealStats } = await supabase
        .rpc('get_company_deal_stats', { company_ids: companyIds });

      // Get contact statistics  
      const { data: contactStats } = await supabase
        .rpc('get_company_contact_stats', { company_ids: companyIds });

      // Combine statistics
      return companyIds.map(id => {
        const deals = dealStats?.find((d: any) => d.company_id === id) || {};
        const contacts = contactStats?.find((c: any) => c.company_id === id) || {};
        
        return {
          company_id: id,
          deal_count: deals.deal_count || 0,
          contact_count: contacts.contact_count || 0,
          total_value: deals.total_value || 0
        };
      });

    } catch (error) {
      logger.warn('Error getting company statistics:', error);
      // Return empty statistics if RPC functions don't exist yet
      return companyIds.map(id => ({
        company_id: id,
        deal_count: 0,
        contact_count: 0,
        total_value: 0
      }));
    }
  }

  /**
   * Preview what will be transferred in a merge operation
   */
  static async previewMerge(sourceCompanyIds: string[], targetCompanyId: string): Promise<MergePreview> {
    try {
      const { data, error } = await supabase.rpc('get_company_merge_preview', {
        source_company_ids: sourceCompanyIds,
        target_company_id: targetCompanyId
      });

      if (error) throw error;

      return data[0] as MergePreview;

    } catch (error) {
      logger.error('Error previewing merge:', error);
      throw error;
    }
  }

  /**
   * Execute the merge operation
   */
  static async executeMerge(
    sourceCompanyIds: string[], 
    targetCompanyId: string, 
    mergeData?: any
  ): Promise<MergeResult> {
    try {
      const { data, error } = await supabase.rpc('execute_company_merge', {
        source_company_ids: sourceCompanyIds,
        target_company_id: targetCompanyId,
        merge_data: mergeData || {}
      });

      if (error) throw error;

      toast.success('Companies merged successfully!');
      return data as MergeResult;

    } catch (error) {
      logger.error('Error executing merge:', error);
      toast.error('Failed to merge companies');
      throw error;
    }
  }

  /**
   * Get merge history for a company
   */
  static async getMergeHistory(companyId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('company_merges')
        .select(`
          *,
          source_company:companies!source_company_id(id, name),
          target_company:companies!target_company_id(id, name),
          merged_by_user:profiles!merged_by(id, first_name, last_name, email)
        `)
        .or(`source_company_id.eq.${companyId},target_company_id.eq.${companyId}`)
        .order('merged_at', { ascending: false });

      if (error) throw error;

      return data || [];

    } catch (error) {
      logger.error('Error getting merge history:', error);
      throw error;
    }
  }

  /**
   * Check if a company can be merged (not already merged, user has permission, etc.)
   */
  static async validateMergePermissions(companyIds: string[]): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    try {
      const errors: string[] = [];

      // Check if all companies exist and are not merged
      const { data: companies, error } = await supabase
        .from('companies')
        .select('id, name, is_merged, owner_id, assigned_to')
        .in('id', companyIds);

      if (error) throw error;

      if (companies.length !== companyIds.length) {
        errors.push('One or more companies not found');
      }

      companies.forEach(company => {
        if (company.is_merged) {
          errors.push(`Company "${company.name}" is already merged`);
        }
      });

      // Check user permissions (simplified - would need actual user context)
      // This would be enhanced based on your permission model

      return {
        valid: errors.length === 0,
        errors
      };

    } catch (error) {
      logger.error('Error validating merge permissions:', error);
      return {
        valid: false,
        errors: ['Failed to validate permissions']
      };
    }
  }
}