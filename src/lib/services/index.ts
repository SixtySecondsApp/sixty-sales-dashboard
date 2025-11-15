/**
 * Service Layer Entry Point
 * Provides clean exports and initialization for the service layer
 * Follows Single Responsibility Principle - only handles service layer setup
 */

// Export main service interfaces
export type {
  IDealService,
  IStageService,
  IActivityService,
  ICompanyService,
  IFinancialService,
  IValidationService,
  INotificationService,
  IPermissionService,
  IAuditService
} from '../interfaces/IBusinessServices';

export type {
  IRepository,
  IBaseRepository,
  IQueryableRepository,
  IPaginatedRepository,
  IRelationalRepository,
  IBulkRepository
} from '../interfaces/IDataRepository';

export type {
  IApplicationConfig,
  IDatabaseConfig,
  IFeatureFlags,
  IEnvironmentConfig,
  ISecurityConfig,
  IBusinessConfig,
  IIntegrationConfig,
  IPerformanceConfig
} from '../interfaces/IConfiguration';

// Export concrete implementations
export { DealService } from './concrete/DealService';
export { ValidationService } from './concrete/ValidationService';
export { FinancialService } from './concrete/FinancialService';

// Export repositories
export { SupabaseRepository } from '../repositories/SupabaseRepository';
export { DealRepository } from '../repositories/DealRepository';

// Export configuration
export { ApplicationConfig } from '../configuration/ApplicationConfig';

// Export container and service registration
export { 
  DIContainer, 
  container, 
  SERVICE_TOKENS 
} from '../container/DIContainer';

export { 
  configureServices, 
  initializeServices,
  getService,
  hasService,
  clearServiceScope,
  getRegisteredServices
} from '../container/ServiceRegistration';

// Export service locator
export { 
  ServiceLocator, 
  getServices, 
  useServices,
  withServices,
  ServiceErrorBoundary
} from './ServiceLocator';

// Export service-based hooks
export { useDealService } from '../hooks/deals/useDealService';

// Application initialization flag
let isInitialized = false;

/**
 * Initialize the service layer
 * Should be called once at application startup
 */
export function initializeServiceLayer(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      if (isInitialized) {
        resolve();
        return;
      }

      // Initialize services
      initializeServices();
      
      // Validate service health
      const services = getServices();
      const healthCheck = services.validateServices();
      
      if (healthCheck.length > 0) {
        throw new Error(`Service validation failed: ${healthCheck.join(', ')}`);
      }

      isInitialized = true;
      resolve();

    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Check if service layer is initialized
 */
export function isServiceLayerInitialized(): boolean {
  return isInitialized;
}

/**
 * Get service layer health status
 */
export async function getServiceLayerHealth(): Promise<{
  healthy: boolean;
  initialized: boolean;
  services: Record<string, boolean>;
  errors: string[];
}> {
  if (!isInitialized) {
    return {
      healthy: false,
      initialized: false,
      services: {},
      errors: ['Service layer not initialized']
    };
  }

  const services = getServices();
  const health = await services.getServiceHealth();

  return {
    ...health,
    initialized: isInitialized
  };
}

/**
 * Reset service layer (for testing)
 */
export function resetServiceLayer(): void {
  clearServiceScope();
  isInitialized = false;
}

/**
 * Service layer middleware for error handling
 */
export function createServiceMiddleware() {
  return {
    async handleServiceError(error: Error, context: string): Promise<void> {
      if (isInitialized) {
        const services = getServices();
        services.logger.error(`Service error in ${context}:`, error);
        
        // Could implement error recovery strategies here
        if (error.message.includes('network') || error.message.includes('timeout')) {
          // Network error - could implement retry logic
          services.logger.warn('Network error detected, considering retry');
        }
      } else {
      }
    },

    async logServiceOperation(operation: string, data?: any): Promise<void> {
      if (isInitialized) {
        const services = getServices();
        services.logger.info(`Service operation: ${operation}`, data);
      }
    }
  };
}

/**
 * Development utilities
 */
export const devUtils = {
  /**
   * Get all registered services for debugging
   */
  getRegisteredServices,

  /**
   * Test service connectivity
   */
  async testServices(): Promise<Record<string, boolean>> {
    if (!isInitialized) {
      return { error: false };
    }

    const services = getServices();
    const results: Record<string, boolean> = {};

    // Test each service
    try {
      services.config.validateConfig();
      results.config = true;
    } catch {
      results.config = false;
    }

    try {
      await services.validationService.validateDeal({ title: 'test', company_name: 'test' } as any);
      results.validation = true;
    } catch {
      results.validation = false;
    }

    try {
      services.financialService.calculateLTV(100, 500);
      results.financial = true;
    } catch {
      results.financial = false;
    }

    return results;
  },

  /**
   * Get service configuration for debugging
   */
  getServiceConfig(): any {
    if (!isInitialized) {
      return null;
    }

    const services = getServices();
    return {
      environment: services.config.getEnvironmentName(),
      features: services.config.getAllFeatures(),
      businessConfig: {
        ltvMultiplier: services.config.getLTVMultiplier(),
        defaultStages: services.config.getDefaultStages(),
        maxDealValue: services.config.getMaxDealValue()
      }
    };
  }
};

// Add global error handler for unhandled service errors
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', async (event) => {
    if (event.reason?.message?.includes('Service') || event.reason?.message?.includes('Repository')) {
      const middleware = createServiceMiddleware();
      await middleware.handleServiceError(event.reason, 'unhandled_rejection');
    }
  });
}