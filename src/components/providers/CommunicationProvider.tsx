/**
 * Communication Layer Provider
 * Initializes and provides the decoupling infrastructure
 * Wraps the application with event-driven communication capabilities
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  initializeCommunicationLayer, 
  checkCommunicationHealth,
  StateProvider 
} from '@/lib/communication';

interface CommunicationContextValue {
  isInitialized: boolean;
  isHealthy: boolean;
  error: string | null;
  enableDecoupling: boolean;
}

const CommunicationContext = createContext<CommunicationContextValue>({
  isInitialized: false,
  isHealthy: false,
  error: null,
  enableDecoupling: false
});

interface CommunicationProviderProps {
  children: ReactNode;
  enableDecoupling?: boolean;
  fallbackToOriginal?: boolean;
}

export function CommunicationProvider({ 
  children, 
  enableDecoupling = true,
  fallbackToOriginal = true 
}: CommunicationProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isHealthy, setIsHealthy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enableDecoupling) {
      setIsInitialized(true);
      setIsHealthy(true);
      return;
    }

    let isMounted = true;

    async function initializeCommunication() {
      try {
        await initializeCommunicationLayer();
        
        if (isMounted) {
          setIsInitialized(true);
          
          // Check health
          const health = await checkCommunicationHealth();
          setIsHealthy(health.healthy);
          
          if (!health.healthy && !fallbackToOriginal) {
            setError('Communication layer unhealthy and fallback disabled');
          }
        }
      } catch (initError) {
        if (isMounted) {
          const errorMessage = initError instanceof Error ? initError.message : 'Initialization failed';
          setError(errorMessage);
          
          if (fallbackToOriginal) {
            console.warn('Communication layer initialization failed, falling back to original implementation');
            setIsInitialized(true);
            setIsHealthy(false); // Marked as unhealthy but initialized for fallback
          }
        }
      }
    }

    initializeCommunication();

    return () => {
      isMounted = false;
    };
  }, [enableDecoupling, fallbackToOriginal]);

  const contextValue: CommunicationContextValue = {
    isInitialized,
    isHealthy,
    error,
    enableDecoupling: enableDecoupling && isHealthy
  };

  if (!isInitialized) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p>Initializing Communication Layer...</p>
          {error && (
            <p className="text-red-400 text-sm mt-2">
              {fallbackToOriginal ? 'Falling back to original implementation' : error}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <CommunicationContext.Provider value={contextValue}>
      {enableDecoupling && isHealthy ? (
        <StateProvider>
          {children}
        </StateProvider>
      ) : (
        children
      )}
    </CommunicationContext.Provider>
  );
}

export function useCommunicationContext(): CommunicationContextValue {
  const context = useContext(CommunicationContext);
  if (!context) {
    throw new Error('useCommunicationContext must be used within CommunicationProvider');
  }
  return context;
}

/**
 * Hook to check if decoupled features are available
 */
export function useDecouplingEnabled(): boolean {
  const { enableDecoupling, isHealthy } = useCommunicationContext();
  return enableDecoupling && isHealthy;
}

/**
 * Higher-order component for conditional decoupling
 */
export function withDecouplingFallback<P extends object>(
  DecoupledComponent: React.ComponentType<P>,
  OriginalComponent: React.ComponentType<P>
) {
  return function ConditionalComponent(props: P) {
    const isDecouplingEnabled = useDecouplingEnabled();
    
    return isDecouplingEnabled ? 
      <DecoupledComponent {...props} /> : 
      <OriginalComponent {...props} />;
  };
}

/**
 * Development utilities provider
 */
export function CommunicationDebugProvider({ 
  children, 
  enableDebugging = false 
}: { 
  children: ReactNode; 
  enableDebugging?: boolean;
}) {
  useEffect(() => {
    if (enableDebugging && process.env.NODE_ENV === 'development') {
      import('@/lib/communication').then(({ communicationDevUtils }) => {
        const cleanup = communicationDevUtils.enableFullDebugging();
        
        // Expose debug utilities to window for development
        (window as any).communicationDebug = communicationDevUtils;
        
        return cleanup;
      });
    }
  }, [enableDebugging]);

  return <>{children}</>;
}