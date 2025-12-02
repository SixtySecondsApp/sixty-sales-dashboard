import { useState, useCallback } from 'react';
import { CompanyMergeService, MergePreview, MergeResult, DuplicateGroup } from '@/lib/services/companyMergeService';
import { toast } from 'sonner';

export function useCompanyMerge() {
  const [isLoading, setIsLoading] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [mergePreview, setMergePreview] = useState<MergePreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Find duplicate companies
  const findDuplicates = useCallback(async (options?: {
    min_similarity_score?: number;
    include_merged?: boolean;
    owner_id?: string;
  }) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const duplicateGroups = await CompanyMergeService.findDuplicateCompanies(options);
      setDuplicates(duplicateGroups);
      
      return duplicateGroups;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to find duplicate companies';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Preview merge operation
  const previewMerge = useCallback(async (sourceCompanyIds: string[], targetCompanyId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const preview = await CompanyMergeService.previewMerge(sourceCompanyIds, targetCompanyId);
      setMergePreview(preview);
      
      return preview;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to preview merge';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Execute merge operation
  const executeMerge = useCallback(async (
    sourceCompanyIds: string[], 
    targetCompanyId: string,
    mergeData?: any
  ): Promise<MergeResult> => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Validate permissions first
      const validation = await CompanyMergeService.validateMergePermissions([
        ...sourceCompanyIds, 
        targetCompanyId
      ]);
      
      if (!validation.valid) {
        throw new Error(validation.errors.join(', '));
      }
      
      const result = await CompanyMergeService.executeMerge(
        sourceCompanyIds, 
        targetCompanyId, 
        mergeData
      );
      
      // Clear preview after successful merge
      setMergePreview(null);
      
      // Refresh duplicates list to remove merged companies
      await findDuplicates();
      
      return result;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to execute merge';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [findDuplicates]);

  // Get merge history for a company
  const getMergeHistory = useCallback(async (companyId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const history = await CompanyMergeService.getMergeHistory(companyId);
      return history;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to get merge history';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Validate merge permissions
  const validateMergePermissions = useCallback(async (companyIds: string[]) => {
    try {
      return await CompanyMergeService.validateMergePermissions(companyIds);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to validate permissions';
      setError(errorMessage);
      return { valid: false, errors: [errorMessage] };
    }
  }, []);

  // Clear current state
  const clearState = useCallback(() => {
    setDuplicates([]);
    setMergePreview(null);
    setError(null);
  }, []);

  return {
    // State
    isLoading,
    duplicates,
    mergePreview,
    error,
    
    // Actions
    findDuplicates,
    previewMerge,
    executeMerge,
    getMergeHistory,
    validateMergePermissions,
    clearState,
    
    // Computed
    hasDuplicates: duplicates.length > 0,
    totalDuplicates: duplicates.reduce((sum, group) => sum + group.total_duplicates, 0),
    potentialSavings: duplicates.reduce((sum, group) => sum + group.combined_value, 0)
  };
}