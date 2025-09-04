/**
 * Workflow System Hook
 * 
 * React hook for integrating the workflow system with the application
 * Handles initialization, real-time updates, and state management
 */

import { useState, useEffect, useCallback } from 'react';
import { workflowRealtimeService } from '@/lib/services/workflowRealtimeService';
import { workflowAPI } from '@/lib/api/workflowApi';
import { useUser } from './useUser';
import logger from '@/lib/utils/logger';

export interface UseWorkflowSystemReturn {
  // Initialization state
  isInitialized: boolean;
  initializationError: string | null;
  
  // Service methods
  initialize: () => Promise<void>;
  cleanup: () => void;
  
  // Workflow operations
  createWorkflow: typeof workflowAPI.createWorkflow;
  updateWorkflow: typeof workflowAPI.updateWorkflow;
  deleteWorkflow: typeof workflowAPI.deleteWorkflow;
  getWorkflow: typeof workflowAPI.getWorkflow;
  getWorkflows: typeof workflowAPI.getWorkflows;
  
  // Execution operations
  triggerWorkflow: typeof workflowAPI.triggerWorkflow;
  testWorkflow: typeof workflowAPI.testWorkflow;
  cancelExecution: typeof workflowAPI.cancelExecution;
  
  // Analytics operations
  getPerformanceMetrics: typeof workflowAPI.getPerformanceMetrics;
  getWorkflowAnalytics: typeof workflowAPI.getWorkflowAnalytics;
  getWorkflowHealth: typeof workflowAPI.getWorkflowHealth;
  
  // Template operations
  getTemplates: typeof workflowAPI.getTemplates;
  createFromTemplate: typeof workflowAPI.createFromTemplate;
  
  // Import/Export operations
  exportWorkflow: typeof workflowAPI.exportWorkflow;
  importWorkflow: typeof workflowAPI.importWorkflow;
  
  // Validation
  validateWorkflow: typeof workflowAPI.validateWorkflow;
}

export function useWorkflowSystem(): UseWorkflowSystemReturn {
  const { userData: user } = useUser();
  const [isInitialized, setIsInitialized] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);

  /**
   * Initialize the workflow system
   */
  const initialize = useCallback(async (): Promise<void> => {
    try {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      setInitializationError(null);
      
      // Initialize the real-time service
      await workflowRealtimeService.initialize(user.id);
      
      setIsInitialized(true);
      logger.log('✅ Workflow system initialized');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown initialization error';
      setInitializationError(errorMessage);
      logger.error('❌ Failed to initialize workflow system:', error);
      throw error;
    }
  }, [user?.id]);

  /**
   * Cleanup the workflow system
   */
  const cleanup = useCallback((): void => {
    try {
      workflowRealtimeService.cleanup();
      setIsInitialized(false);
      setInitializationError(null);
      logger.log('🧹 Workflow system cleaned up');
    } catch (error) {
      logger.error('Failed to cleanup workflow system:', error);
    }
  }, []);

  /**
   * Auto-initialize when user becomes available
   */
  useEffect(() => {
    if (user?.id && !isInitialized && !initializationError) {
      initialize().catch(error => {
        logger.error('Auto-initialization failed:', error);
      });
    }
  }, [user?.id, isInitialized, initializationError, initialize]);

  /**
   * Auto-cleanup when user logs out
   */
  useEffect(() => {
    if (!user?.id && isInitialized) {
      cleanup();
    }
  }, [user?.id, isInitialized, cleanup]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (isInitialized) {
        cleanup();
      }
    };
  }, [isInitialized, cleanup]);

  return {
    // State
    isInitialized,
    initializationError,
    
    // Control methods
    initialize,
    cleanup,
    
    // API methods - these will throw errors if not initialized
    createWorkflow: workflowAPI.createWorkflow,
    updateWorkflow: workflowAPI.updateWorkflow,
    deleteWorkflow: workflowAPI.deleteWorkflow,
    getWorkflow: workflowAPI.getWorkflow,
    getWorkflows: workflowAPI.getWorkflows,
    
    triggerWorkflow: workflowAPI.triggerWorkflow,
    testWorkflow: workflowAPI.testWorkflow,
    cancelExecution: workflowAPI.cancelExecution,
    
    getPerformanceMetrics: workflowAPI.getPerformanceMetrics,
    getWorkflowAnalytics: workflowAPI.getWorkflowAnalytics,
    getWorkflowHealth: workflowAPI.getWorkflowHealth,
    
    getTemplates: workflowAPI.getTemplates,
    createFromTemplate: workflowAPI.createFromTemplate,
    
    exportWorkflow: workflowAPI.exportWorkflow,
    importWorkflow: workflowAPI.importWorkflow,
    
    validateWorkflow: workflowAPI.validateWorkflow
  };
}

/**
 * Workflow System Provider Hook
 * 
 * For components that need to ensure the workflow system is initialized
 * before performing operations
 */
export function useWorkflowSystemWithGuard(): UseWorkflowSystemReturn & {
  isReady: boolean;
} {
  const workflowSystem = useWorkflowSystem();
  
  return {
    ...workflowSystem,
    isReady: workflowSystem.isInitialized && !workflowSystem.initializationError
  };
}