/**
 * Generic Supabase Repository Implementation
 * Follows Repository pattern and Interface Segregation Principle
 * Base class that can be extended for specific entity repositories
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { 
  IRepository, 
  IBaseRepository, 
  IQueryableRepository, 
  IPaginatedRepository, 
  IRelationalRepository, 
  IBulkRepository 
} from '@/lib/interfaces/IDataRepository';

export abstract class SupabaseRepository<T extends { id: string }, TCreate = Omit<T, 'id' | 'created_at' | 'updated_at'>> 
  implements IRepository<T> {
  
  constructor(
    protected readonly supabase: SupabaseClient,
    protected readonly tableName: string
  ) {}

  // Abstract method to get table reference - allows for RLS policies
  protected abstract getTableQuery(): any;

  // Base repository methods
  async findById(id: string): Promise<T | null> {
    const { data, error } = await this.getTableQuery()
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to find record: ${error.message}`);
    }

    return data;
  }

  async findAll(filters?: Record<string, any>): Promise<T[]> {
    let query = this.getTableQuery().select('*');

    // Apply filters
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch records: ${error.message}`);
    }

    return data || [];
  }

  async create(entity: TCreate): Promise<T> {
    const { data, error } = await this.getTableQuery()
      .insert(entity)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create record: ${error.message}`);
    }

    return data;
  }

  async update(id: string, updates: Partial<T>): Promise<T> {
    const { data, error } = await this.getTableQuery()
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to update record: ${error.message}`);
    }

    return data;
  }

  async delete(id: string): Promise<boolean> {
    const { error } = await this.getTableQuery()
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete record: ${error.message}`);
    }

    return true;
  }

  // Queryable repository methods
  async findBy(criteria: Record<string, any>): Promise<T[]> {
    let query = this.getTableQuery().select('*');

    Object.entries(criteria).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        query = query.in(key, value);
      } else if (typeof value === 'object' && value !== null) {
        // Handle range queries, etc.
        if (value.gte !== undefined) query = query.gte(key, value.gte);
        if (value.lte !== undefined) query = query.lte(key, value.lte);
        if (value.gt !== undefined) query = query.gt(key, value.gt);
        if (value.lt !== undefined) query = query.lt(key, value.lt);
        if (value.like !== undefined) query = query.like(key, value.like);
        if (value.ilike !== undefined) query = query.ilike(key, value.ilike);
      } else {
        query = query.eq(key, value);
      }
    });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to query records: ${error.message}`);
    }

    return data || [];
  }

  async count(criteria?: Record<string, any>): Promise<number> {
    let query = this.getTableQuery().select('*', { count: 'exact', head: true });

    if (criteria) {
      Object.entries(criteria).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
    }

    const { count, error } = await query;

    if (error) {
      throw new Error(`Failed to count records: ${error.message}`);
    }

    return count || 0;
  }

  async exists(criteria: Record<string, any>): Promise<boolean> {
    const count = await this.count(criteria);
    return count > 0;
  }

  // Paginated repository methods
  async findWithPagination(
    page: number, 
    limit: number, 
    filters?: Record<string, any>
  ): Promise<{
    data: T[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const offset = (page - 1) * limit;
    
    let query = this.getTableQuery().select('*', { count: 'exact' });

    // Apply filters
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch paginated records: ${error.message}`);
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return {
      data: data || [],
      total,
      page,
      totalPages,
    };
  }

  // Relational repository methods
  async findWithRelations(id: string, relations: string[]): Promise<T | null> {
    const selectQuery = this.buildRelationalSelect(relations);
    
    const { data, error } = await this.getTableQuery()
      .select(selectQuery)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to find record with relations: ${error.message}`);
    }

    return data;
  }

  async findAllWithRelations(relations: string[], filters?: Record<string, any>): Promise<T[]> {
    const selectQuery = this.buildRelationalSelect(relations);
    let query = this.getTableQuery().select(selectQuery);

    // Apply filters
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch records with relations: ${error.message}`);
    }

    return data || [];
  }

  // Bulk repository methods
  async createMany(entities: TCreate[]): Promise<T[]> {
    const { data, error } = await this.getTableQuery()
      .insert(entities)
      .select('*');

    if (error) {
      throw new Error(`Failed to create records: ${error.message}`);
    }

    return data || [];
  }

  async updateMany(criteria: Record<string, any>, updates: Partial<T>): Promise<number> {
    let query = this.getTableQuery().update(updates);

    // Apply criteria
    Object.entries(criteria).forEach(([key, value]) => {
      query = query.eq(key, value);
    });

    const { count, error } = await query.select('*', { count: 'exact', head: true });

    if (error) {
      throw new Error(`Failed to update records: ${error.message}`);
    }

    return count || 0;
  }

  async deleteMany(criteria: Record<string, any>): Promise<number> {
    let query = this.getTableQuery().delete({ count: 'exact' });

    // Apply criteria
    Object.entries(criteria).forEach(([key, value]) => {
      query = query.eq(key, value);
    });

    const { count, error } = await query;

    if (error) {
      throw new Error(`Failed to delete records: ${error.message}`);
    }

    return count || 0;
  }

  /**
   * Build select query string for relational data
   * Override in subclasses for entity-specific relations
   */
  protected buildRelationalSelect(relations: string[]): string {
    const baseFields = '*';
    const relationSelects = relations.map(relation => this.mapRelation(relation));
    return [baseFields, ...relationSelects].join(', ');
  }

  /**
   * Map relation name to Supabase select syntax
   * Override in subclasses for entity-specific relation mapping
   */
  protected mapRelation(relation: string): string {
    // Default mapping - override in subclasses
    return `${relation}(*)`;
  }

  /**
   * Execute raw SQL query (use with caution)
   */
  protected async executeRaw(sql: string, params?: any[]): Promise<any> {
    const { data, error } = await this.supabase.rpc('execute_sql', {
      sql_query: sql,
      parameters: params || []
    });

    if (error) {
      throw new Error(`Failed to execute raw query: ${error.message}`);
    }

    return data;
  }
}