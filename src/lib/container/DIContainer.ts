/**
 * Dependency Injection Container
 * Implements Dependency Inversion Principle by managing dependencies through abstractions
 */

type Constructor<T = {}> = new (...args: any[]) => T;
type Factory<T = any> = () => T;
type ServiceLifetime = 'singleton' | 'transient' | 'scoped';

interface ServiceDescriptor {
  lifetime: ServiceLifetime;
  implementation: Constructor | Factory | any;
  instance?: any;
}

export class DIContainer {
  private services = new Map<string | symbol, ServiceDescriptor>();
  private scopedInstances = new Map<string | symbol, any>();

  /**
   * Register a singleton service
   */
  registerSingleton<T>(token: string | symbol, implementation: Constructor<T> | Factory<T>): void {
    this.services.set(token, {
      lifetime: 'singleton',
      implementation,
    });
  }

  /**
   * Register a transient service (new instance each time)
   */
  registerTransient<T>(token: string | symbol, implementation: Constructor<T> | Factory<T>): void {
    this.services.set(token, {
      lifetime: 'transient',
      implementation,
    });
  }

  /**
   * Register a scoped service (same instance within scope)
   */
  registerScoped<T>(token: string | symbol, implementation: Constructor<T> | Factory<T>): void {
    this.services.set(token, {
      lifetime: 'scoped',
      implementation,
    });
  }

  /**
   * Register an instance directly
   */
  registerInstance<T>(token: string | symbol, instance: T): void {
    this.services.set(token, {
      lifetime: 'singleton',
      implementation: instance,
      instance,
    });
  }

  /**
   * Resolve a service from the container
   */
  resolve<T>(token: string | symbol): T {
    const serviceDescriptor = this.services.get(token);
    
    if (!serviceDescriptor) {
      throw new Error(`Service ${String(token)} not found in container`);
    }

    switch (serviceDescriptor.lifetime) {
      case 'singleton':
        if (serviceDescriptor.instance) {
          return serviceDescriptor.instance;
        }
        serviceDescriptor.instance = this.createInstance(serviceDescriptor.implementation);
        return serviceDescriptor.instance;

      case 'transient':
        return this.createInstance(serviceDescriptor.implementation);

      case 'scoped':
        if (this.scopedInstances.has(token)) {
          return this.scopedInstances.get(token);
        }
        const scopedInstance = this.createInstance(serviceDescriptor.implementation);
        this.scopedInstances.set(token, scopedInstance);
        return scopedInstance;

      default:
        throw new Error(`Unknown service lifetime: ${serviceDescriptor.lifetime}`);
    }
  }

  /**
   * Check if a service is registered
   */
  isRegistered(token: string | symbol): boolean {
    return this.services.has(token);
  }

  /**
   * Clear scoped instances (typically called at end of request/scope)
   */
  clearScope(): void {
    this.scopedInstances.clear();
  }

  /**
   * Get all registered service tokens
   */
  getRegisteredServices(): (string | symbol)[] {
    return Array.from(this.services.keys());
  }

  /**
   * Create an instance from constructor or factory
   */
  private createInstance<T>(implementation: Constructor<T> | Factory<T> | T): T {
    if (typeof implementation === 'function') {
      try {
        // Try as factory function first
        return (implementation as Factory<T>)();
      } catch {
        // Try as constructor
        return new (implementation as Constructor<T>)();
      }
    }
    
    // Already an instance
    return implementation as T;
  }
}

// Service tokens - using symbols to avoid naming collisions
export const SERVICE_TOKENS = {
  // Configuration
  APPLICATION_CONFIG: Symbol('IApplicationConfig'),
  FEATURE_FLAGS: Symbol('IFeatureFlags'),
  
  // Data Access
  DEAL_REPOSITORY: Symbol('IDealRepository'),
  ACTIVITY_REPOSITORY: Symbol('IActivityRepository'),
  COMPANY_REPOSITORY: Symbol('ICompanyRepository'),
  
  // Business Services
  DEAL_SERVICE: Symbol('IDealService'),
  STAGE_SERVICE: Symbol('IStageService'),
  ACTIVITY_SERVICE: Symbol('IActivityService'),
  COMPANY_SERVICE: Symbol('ICompanyService'),
  FINANCIAL_SERVICE: Symbol('IFinancialService'),
  VALIDATION_SERVICE: Symbol('IValidationService'),
  NOTIFICATION_SERVICE: Symbol('INotificationService'),
  PERMISSION_SERVICE: Symbol('IPermissionService'),
  AUDIT_SERVICE: Symbol('IAuditService'),
  
  // Infrastructure
  DATABASE_CLIENT: Symbol('IDatabaseClient'),
  CACHE_PROVIDER: Symbol('ICacheProvider'),
  LOGGER: Symbol('ILogger'),
} as const;

// Global container instance
export const container = new DIContainer();