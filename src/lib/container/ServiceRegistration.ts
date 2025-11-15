/**
 * Service Registration Configuration
 * Sets up dependency injection container with all services
 * Follows Dependency Inversion Principle by registering abstractions
 */

import { container, SERVICE_TOKENS } from './DIContainer';
import { ApplicationConfig } from '../configuration/ApplicationConfig';

// Import concrete implementations
import { DealService } from '../services/concrete/DealService';
import { ValidationService } from '../services/concrete/ValidationService';
import { FinancialService } from '../services/concrete/FinancialService';

// Import repositories
import { DealRepository } from '../repositories/DealRepository';

// Import Supabase client
import { createClient } from '@supabase/supabase-js';

/**
 * Configure and register all services in the DI container
 */
export function configureServices(): void {
  // Configuration Services (Singleton)
  container.registerSingleton(
    SERVICE_TOKENS.APPLICATION_CONFIG,
    () => new ApplicationConfig()
  );

  // Database Client (Singleton)
  container.registerSingleton(
    SERVICE_TOKENS.DATABASE_CLIENT,
    () => {
      const config = container.resolve<ApplicationConfig>(SERVICE_TOKENS.APPLICATION_CONFIG);
      const supabaseUrl = config.getConnectionString();
      const supabaseKey = config.getEnvValue('VITE_SUPABASE_ANON_KEY', '');
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase configuration is missing');
      }

      return createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          debug: false, // Disable debug logging
        },
        db: {
          schema: 'public'
        }
      });
    }
  );

  // Repository Layer (Scoped - new instance per request scope)
  container.registerScoped(
    SERVICE_TOKENS.DEAL_REPOSITORY,
    () => {
      const supabase = container.resolve(SERVICE_TOKENS.DATABASE_CLIENT);
      return new DealRepository(supabase);
    }
  );

  // Business Service Layer (Scoped)
  container.registerScoped(
    SERVICE_TOKENS.VALIDATION_SERVICE,
    () => new ValidationService()
  );

  container.registerScoped(
    SERVICE_TOKENS.FINANCIAL_SERVICE,
    () => new FinancialService()
  );

  container.registerScoped(
    SERVICE_TOKENS.DEAL_SERVICE,
    () => {
      const dealRepository = container.resolve(SERVICE_TOKENS.DEAL_REPOSITORY);
      const validationService = container.resolve(SERVICE_TOKENS.VALIDATION_SERVICE);
      const auditService = container.resolve(SERVICE_TOKENS.AUDIT_SERVICE);
      const permissionService = container.resolve(SERVICE_TOKENS.PERMISSION_SERVICE);
      
      return new DealService(
        dealRepository,
        validationService,
        auditService,
        permissionService
      );
    }
  );

  // Mock implementations for services not yet created (to avoid breaking dependencies)
  container.registerScoped(
    SERVICE_TOKENS.AUDIT_SERVICE,
    () => ({
      logDealChange: async () => {},
      logActivityCreation: async () => {},
      logFinancialChange: async () => {},
      getAuditLog: async () => []
    })
  );

  container.registerScoped(
    SERVICE_TOKENS.PERMISSION_SERVICE,
    () => ({
      canUserEditDeal: async () => true,
      canUserDeleteDeal: async () => true,
      canUserSplitRevenue: async () => true,
      hasAdminAccess: async () => true
    })
  );

  container.registerScoped(
    SERVICE_TOKENS.NOTIFICATION_SERVICE,
    () => ({
      sendDealStatusUpdate: async () => true,
      sendActivityReminder: async () => true,
      sendTaskNotification: async () => true
    })
  );

  // Additional service registrations can be added here
  registerDevelopmentServices();
}

/**
 * Register development-specific services
 */
function registerDevelopmentServices(): void {
  const config = container.resolve<ApplicationConfig>(SERVICE_TOKENS.APPLICATION_CONFIG);
  
  if (config.isDevelopment()) {
    // Development-only logger with console output
    container.registerSingleton(
      SERVICE_TOKENS.LOGGER,
      () => ({
        debug: (message: string, ...args: any[]) => undefined,
        info: (message: string, ...args: any[]) => undefined,
        warn: (message: string, ...args: any[]) => undefined,
        error: (message: string, ...args: any[]) => undefined,
      })
    );

    // Mock cache provider for development
    container.registerSingleton(
      SERVICE_TOKENS.CACHE_PROVIDER,
      () => {
        const cache = new Map<string, { value: any; expiry: number }>();
        
        return {
          get: async <T>(key: string): Promise<T | null> => {
            const item = cache.get(key);
            if (!item || Date.now() > item.expiry) {
              cache.delete(key);
              return null;
            }
            return item.value;
          },
          set: async <T>(key: string, value: T, ttlMs: number = 3600000): Promise<void> => {
            cache.set(key, {
              value,
              expiry: Date.now() + ttlMs
            });
          },
          delete: async (key: string): Promise<void> => {
            cache.delete(key);
          },
          clear: async (): Promise<void> => {
            cache.clear();
          }
        };
      }
    );
  }
}

/**
 * Register production-specific services
 */
function registerProductionServices(): void {
  const config = container.resolve<ApplicationConfig>(SERVICE_TOKENS.APPLICATION_CONFIG);
  
  if (config.isProduction()) {
    // Production logger with structured logging
    container.registerSingleton(
      SERVICE_TOKENS.LOGGER,
      () => ({
        debug: (message: string, ...args: any[]) => {
          // In production, you might send to a logging service
        },
        info: (message: string, ...args: any[]) => {
        },
        warn: (message: string, ...args: any[]) => {
        },
        error: (message: string, ...args: any[]) => {
        },
      })
    );
  }
}

/**
 * Initialize the service container with all dependencies
 */
export function initializeServices(): void {
  try {
    configureServices();
    
    // Validate configuration
    const config = container.resolve<ApplicationConfig>(SERVICE_TOKENS.APPLICATION_CONFIG);
    const errors = config.validateConfig();
    
    if (errors.length > 0) {
      throw new Error(`Configuration errors: ${errors.join(', ')}`);
    }
  } catch (error) {
    throw error;
  }
}

/**
 * Get a service from the container with type safety
 */
export function getService<T>(token: symbol): T {
  return container.resolve<T>(token);
}

/**
 * Check if a service is registered
 */
export function hasService(token: symbol): boolean {
  return container.isRegistered(token);
}

/**
 * Clear scoped services (call at end of request/operation)
 */
export function clearServiceScope(): void {
  container.clearScope();
}

/**
 * Get all registered services (for debugging)
 */
export function getRegisteredServices(): (string | symbol)[] {
  return container.getRegisteredServices();
}