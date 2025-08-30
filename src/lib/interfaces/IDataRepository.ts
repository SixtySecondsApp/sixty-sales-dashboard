/**
 * Generic repository interface following Repository pattern
 * Implements Interface Segregation Principle (ISP) by providing specific, focused interfaces
 */

// Base repository operations interface
export interface IBaseRepository<T, K = string> {
  findById(id: K): Promise<T | null>;
  findAll(filters?: Record<string, any>): Promise<T[]>;
  create(entity: Omit<T, 'id' | 'created_at' | 'updated_at'>): Promise<T>;
  update(id: K, updates: Partial<T>): Promise<T>;
  delete(id: K): Promise<boolean>;
}

// Queryable repository for complex queries
export interface IQueryableRepository<T> {
  findBy(criteria: Record<string, any>): Promise<T[]>;
  count(criteria?: Record<string, any>): Promise<number>;
  exists(criteria: Record<string, any>): Promise<boolean>;
}

// Repository with pagination support
export interface IPaginatedRepository<T> {
  findWithPagination(
    page: number,
    limit: number,
    filters?: Record<string, any>
  ): Promise<{
    data: T[];
    total: number;
    page: number;
    totalPages: number;
  }>;
}

// Repository with relationship loading
export interface IRelationalRepository<T> {
  findWithRelations(id: string, relations: string[]): Promise<T | null>;
  findAllWithRelations(relations: string[], filters?: Record<string, any>): Promise<T[]>;
}

// Repository with bulk operations
export interface IBulkRepository<T> {
  createMany(entities: Omit<T, 'id' | 'created_at' | 'updated_at'>[]): Promise<T[]>;
  updateMany(criteria: Record<string, any>, updates: Partial<T>): Promise<number>;
  deleteMany(criteria: Record<string, any>): Promise<number>;
}

// Repository with soft delete capability
export interface ISoftDeleteRepository<T> {
  softDelete(id: string): Promise<boolean>;
  restore(id: string): Promise<boolean>;
  findDeleted(filters?: Record<string, any>): Promise<T[]>;
}

// Repository with audit trail
export interface IAuditableRepository<T> {
  getAuditTrail(id: string): Promise<any[]>;
  trackChange(id: string, changes: Record<string, any>, userId: string): Promise<void>;
}

// Full-featured repository combining all interfaces
export interface IRepository<T, K = string> extends 
  IBaseRepository<T, K>,
  IQueryableRepository<T>,
  IPaginatedRepository<T>,
  IRelationalRepository<T>,
  IBulkRepository<T> {
}