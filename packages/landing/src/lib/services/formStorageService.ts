import { supabase } from '@/lib/supabase/clientV2';
import type { FormNodeData } from '@/components/workflows/nodes/FormNode';

export interface StoredFormConfig {
  id: string;
  form_id: string;
  workflow_id?: string;
  config: FormNodeData['config'];
  is_test: boolean;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}

class FormStorageService {
  private formCache: Map<string, StoredFormConfig> = new Map();

  /**
   * Store form configuration in database
   */
  async storeFormConfig(
    formId: string,
    config: FormNodeData['config'],
    workflowId?: string,
    isTest: boolean = false
  ): Promise<StoredFormConfig | null> {
    try {
      const { data: user } = await supabase.auth.getUser();
      
      const formData = {
        form_id: formId,
        workflow_id: workflowId,
        config: config,
        is_test: isTest,
        created_by: user?.user?.id
      };

      const { data, error } = await supabase
        .from('workflow_forms')
        .upsert(formData, {
          onConflict: 'form_id'
        })
        .select()
        .single();

      if (error) {
        // Fallback to local storage for development
        this.storeFormLocally(formId, config, workflowId, isTest);
        return null;
      }

      // Update cache
      if (data) {
        this.formCache.set(formId, data);
      }

      return data;
    } catch (error) {
      // Fallback to local storage
      this.storeFormLocally(formId, config, workflowId, isTest);
      return null;
    }
  }

  /**
   * Retrieve form configuration from database
   */
  async getFormConfig(formId: string): Promise<StoredFormConfig | null> {
    try {
      // Check cache first
      if (this.formCache.has(formId)) {
        return this.formCache.get(formId)!;
      }

      const { data, error } = await supabase
        .from('workflow_forms')
        .select('*')
        .eq('form_id', formId)
        .single();

      if (error) {
        // Fallback to local storage
        return this.getFormLocally(formId);
      }

      // Update cache
      if (data) {
        this.formCache.set(formId, data);
      }

      return data;
    } catch (error) {
      // Fallback to local storage
      return this.getFormLocally(formId);
    }
  }

  /**
   * Delete form configuration
   */
  async deleteFormConfig(formId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('workflow_forms')
        .delete()
        .eq('form_id', formId);

      if (error) {
        return false;
      }

      // Remove from cache
      this.formCache.delete(formId);
      // Remove from local storage
      localStorage.removeItem(`form_${formId}`);

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Local storage fallback for development
   */
  private storeFormLocally(
    formId: string,
    config: FormNodeData['config'],
    workflowId?: string,
    isTest: boolean = false
  ): void {
    const formData: StoredFormConfig = {
      id: formId,
      form_id: formId,
      workflow_id: workflowId,
      config: config,
      is_test: isTest,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    localStorage.setItem(`form_${formId}`, JSON.stringify(formData));
    this.formCache.set(formId, formData);
  }

  /**
   * Retrieve from local storage
   */
  private getFormLocally(formId: string): StoredFormConfig | null {
    const stored = localStorage.getItem(`form_${formId}`);
    if (stored) {
      try {
        const formData = JSON.parse(stored);
        this.formCache.set(formId, formData);
        return formData;
      } catch (error) {
      }
    }
    return null;
  }

  /**
   * Clear form cache
   */
  clearCache(): void {
    this.formCache.clear();
  }
}

// Export singleton instance
export const formStorageService = new FormStorageService();