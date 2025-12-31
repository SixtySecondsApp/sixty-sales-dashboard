/**
 * Organization Context Service
 *
 * CRUD operations for organization context key-value pairs.
 * Used to store variables that are interpolated into platform skill templates.
 *
 * @see /platform-controlled-skills-for-orgs.md for full architecture
 * @see /src/lib/utils/skillCompiler.ts for template interpolation
 */

import { supabase } from '@/lib/supabase/clientV2';
import logger from '@/lib/utils/logger';

// ============================================================================
// Types
// ============================================================================

/**
 * Source of the context value
 */
export type ContextSource = 'scrape' | 'manual' | 'user' | 'enrichment' | 'migration';

/**
 * Type hint for the value
 */
export type ContextValueType = 'string' | 'array' | 'object';

/**
 * A single context entry
 */
export interface OrganizationContextEntry {
  id: string;
  organization_id: string;
  context_key: string;
  value: unknown;
  value_type: ContextValueType;
  source: ContextSource;
  confidence: number;
  created_at: string;
  updated_at: string;
}

/**
 * Flattened context object for skill compilation
 */
export type OrganizationContext = Record<string, unknown>;

/**
 * Service result wrapper
 */
export interface ServiceResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================================
// Custom Error Class
// ============================================================================

export class OrganizationContextServiceError extends Error {
  public status: number;
  public details?: string;

  constructor(message: string, status: number, details?: string) {
    super(message);
    this.name = 'OrganizationContextServiceError';
    this.status = status;
    this.details = details;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Infer value type from a JavaScript value
 */
function inferValueType(value: unknown): ContextValueType {
  if (Array.isArray(value)) {
    return 'array';
  }
  if (typeof value === 'object' && value !== null) {
    return 'object';
  }
  return 'string';
}

/**
 * Wrap a value in JSONB format for database storage
 */
function wrapValueForStorage(value: unknown): unknown {
  // JSONB columns store values directly, but strings need to be wrapped
  // to distinguish from JSON null/boolean/number
  if (typeof value === 'string') {
    return value;
  }
  return value;
}

// ============================================================================
// Organization Context Service Class
// ============================================================================

export class OrganizationContextService {
  /**
   * Get all context for an organization as a flat object
   *
   * This is the primary method used for skill template compilation.
   * It returns a simple key-value object suitable for interpolation.
   *
   * @param orgId - Organization ID
   * @returns Flat object with all context key-value pairs
   */
  async getContext(orgId: string): Promise<Record<string, unknown>> {
    try {
      // Try using the PostgreSQL function first (most efficient)
      const { data: contextObject, error: rpcError } = await supabase.rpc(
        'get_organization_context_object',
        { p_org_id: orgId }
      );

      if (!rpcError && contextObject) {
        // The function returns JSONB which is already a parsed object
        // But values are stored as JSONB, so we need to unwrap them
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(contextObject as Record<string, unknown>)) {
          // JSONB values are already unwrapped by Supabase
          result[key] = value;
        }
        return result;
      }

      // Fallback: Query the table directly
      const { data, error } = await supabase
        .from('organization_context')
        .select('context_key, value')
        .eq('organization_id', orgId);

      if (error) {
        throw new OrganizationContextServiceError(
          'Failed to fetch organization context',
          500,
          error.message
        );
      }

      // Build flat object
      const result: Record<string, unknown> = {};
      for (const entry of data || []) {
        result[entry.context_key] = entry.value;
      }

      return result;
    } catch (error) {
      if (error instanceof OrganizationContextServiceError) {
        throw error;
      }

      logger.error('Error fetching organization context:', error);
      throw new OrganizationContextServiceError(
        'Failed to fetch organization context',
        500,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Get all context entries with full metadata
   *
   * Use this when you need source, confidence, and timestamp information.
   *
   * @param orgId - Organization ID
   * @returns Array of context entries with full metadata
   */
  async getContextEntries(orgId: string): Promise<OrganizationContextEntry[]> {
    try {
      const { data, error } = await supabase
        .from('organization_context')
        .select('*')
        .eq('organization_id', orgId)
        .order('context_key');

      if (error) {
        throw new OrganizationContextServiceError(
          'Failed to fetch context entries',
          500,
          error.message
        );
      }

      return (data as OrganizationContextEntry[]) || [];
    } catch (error) {
      if (error instanceof OrganizationContextServiceError) {
        throw error;
      }

      logger.error('Error fetching context entries:', error);
      throw new OrganizationContextServiceError(
        'Failed to fetch context entries',
        500,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Get a single context value by key
   *
   * @param orgId - Organization ID
   * @param key - Context key
   * @returns The value or null if not found
   */
  async getContextValue(orgId: string, key: string): Promise<unknown | null> {
    try {
      const { data, error } = await supabase
        .from('organization_context')
        .select('value')
        .eq('organization_id', orgId)
        .eq('context_key', key)
        .maybeSingle();

      if (error) {
        throw new OrganizationContextServiceError(
          'Failed to fetch context value',
          500,
          error.message
        );
      }

      return data?.value ?? null;
    } catch (error) {
      if (error instanceof OrganizationContextServiceError) {
        throw error;
      }

      logger.error('Error fetching context value:', error);
      throw new OrganizationContextServiceError(
        'Failed to fetch context value',
        500,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Set a single context value
   *
   * Uses PostgreSQL upsert function for atomic insert/update.
   *
   * @param orgId - Organization ID
   * @param key - Context key
   * @param value - Value to set (string, array, or object)
   * @param source - Source of the value
   * @param confidence - Confidence score (0.00-1.00)
   */
  async setContextValue(
    orgId: string,
    key: string,
    value: unknown,
    source: ContextSource = 'manual',
    confidence: number = 1.0
  ): Promise<void> {
    try {
      // Use the PostgreSQL function for atomic upsert
      const { error } = await supabase.rpc('upsert_organization_context', {
        p_org_id: orgId,
        p_key: key,
        p_value: wrapValueForStorage(value),
        p_source: source,
        p_confidence: confidence,
      });

      if (error) {
        throw new OrganizationContextServiceError(
          'Failed to set context value',
          500,
          error.message
        );
      }
    } catch (error) {
      if (error instanceof OrganizationContextServiceError) {
        throw error;
      }

      logger.error('Error setting context value:', error);
      throw new OrganizationContextServiceError(
        'Failed to set context value',
        500,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Bulk set multiple context values
   *
   * Efficient for setting many values at once, such as during enrichment.
   *
   * @param orgId - Organization ID
   * @param context - Object with key-value pairs to set
   * @param source - Source for all values
   * @param confidence - Confidence score for all values
   */
  async bulkSetContext(
    orgId: string,
    context: Record<string, unknown>,
    source: ContextSource = 'manual',
    confidence: number = 1.0
  ): Promise<void> {
    try {
      // Process each key-value pair
      const entries = Object.entries(context).filter(
        ([_, value]) => value !== null && value !== undefined
      );

      if (entries.length === 0) {
        return;
      }

      // Use a transaction-like approach with sequential calls
      // Note: True transactions would require a PostgreSQL function
      const errors: string[] = [];

      for (const [key, value] of entries) {
        try {
          await this.setContextValue(orgId, key, value, source, confidence);
        } catch (error) {
          errors.push(`${key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      if (errors.length > 0) {
        throw new OrganizationContextServiceError(
          `Failed to set some context values: ${errors.join(', ')}`,
          500,
          errors.join('\n')
        );
      }
    } catch (error) {
      if (error instanceof OrganizationContextServiceError) {
        throw error;
      }

      logger.error('Error bulk setting context:', error);
      throw new OrganizationContextServiceError(
        'Failed to bulk set context',
        500,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Delete a context value
   *
   * @param orgId - Organization ID
   * @param key - Context key to delete
   */
  async deleteContextValue(orgId: string, key: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('organization_context')
        .delete()
        .eq('organization_id', orgId)
        .eq('context_key', key);

      if (error) {
        throw new OrganizationContextServiceError(
          'Failed to delete context value',
          500,
          error.message
        );
      }
    } catch (error) {
      if (error instanceof OrganizationContextServiceError) {
        throw error;
      }

      logger.error('Error deleting context value:', error);
      throw new OrganizationContextServiceError(
        'Failed to delete context value',
        500,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Delete all context for an organization
   *
   * @param orgId - Organization ID
   */
  async clearContext(orgId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('organization_context')
        .delete()
        .eq('organization_id', orgId);

      if (error) {
        throw new OrganizationContextServiceError(
          'Failed to clear context',
          500,
          error.message
        );
      }
    } catch (error) {
      if (error instanceof OrganizationContextServiceError) {
        throw error;
      }

      logger.error('Error clearing context:', error);
      throw new OrganizationContextServiceError(
        'Failed to clear context',
        500,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Get context entries filtered by source
   *
   * Useful for auditing or updating specific types of data.
   *
   * @param orgId - Organization ID
   * @param source - Filter by source
   */
  async getContextBySource(
    orgId: string,
    source: ContextSource
  ): Promise<OrganizationContextEntry[]> {
    try {
      const { data, error } = await supabase
        .from('organization_context')
        .select('*')
        .eq('organization_id', orgId)
        .eq('source', source)
        .order('context_key');

      if (error) {
        throw new OrganizationContextServiceError(
          'Failed to fetch context by source',
          500,
          error.message
        );
      }

      return (data as OrganizationContextEntry[]) || [];
    } catch (error) {
      if (error instanceof OrganizationContextServiceError) {
        throw error;
      }

      logger.error('Error fetching context by source:', error);
      throw new OrganizationContextServiceError(
        'Failed to fetch context by source',
        500,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Update source and confidence for existing context values
   *
   * Useful when data is verified or enriched.
   *
   * @param orgId - Organization ID
   * @param key - Context key
   * @param source - New source
   * @param confidence - New confidence score
   */
  async updateContextMetadata(
    orgId: string,
    key: string,
    source: ContextSource,
    confidence: number
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('organization_context')
        .update({
          source,
          confidence,
          updated_at: new Date().toISOString(),
        })
        .eq('organization_id', orgId)
        .eq('context_key', key);

      if (error) {
        throw new OrganizationContextServiceError(
          'Failed to update context metadata',
          500,
          error.message
        );
      }
    } catch (error) {
      if (error instanceof OrganizationContextServiceError) {
        throw error;
      }

      logger.error('Error updating context metadata:', error);
      throw new OrganizationContextServiceError(
        'Failed to update context metadata',
        500,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }
}

// ============================================================================
// Export Singleton Instance
// ============================================================================

export const organizationContextService = new OrganizationContextService();

export default organizationContextService;
