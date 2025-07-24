import { useEffect, useState } from 'react';
import { useUser } from './useUser';
import { 
  generateSessionId, 
  setSessionId, 
  getSessionId, 
  clearSession,
  initializeSession 
} from '@/lib/utils/sessionContext';

/**
 * Hook to manage audit session tracking
 * Automatically initializes and manages session IDs for audit logging
 */
export function useAuditSession() {
  const { userData } = useUser();
  const [sessionId, setSessionIdState] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize session when user is authenticated
  useEffect(() => {
    if (userData?.id && !isInitialized) {
      let currentSessionId = getSessionId();
      
      // If no session exists, create a new one
      if (!currentSessionId) {
        currentSessionId = initializeSession();
      }
      
      setSessionIdState(currentSessionId);
      setIsInitialized(true);
    }
  }, [userData?.id, isInitialized]);

  // Clear session when user logs out
  useEffect(() => {
    if (!userData?.id && isInitialized) {
      clearSession();
      setSessionIdState(null);
      setIsInitialized(false);
    }
  }, [userData?.id, isInitialized]);

  /**
   * Generate a new session ID
   */
  const renewSession = () => {
    const newSessionId = generateSessionId();
    setSessionId(newSessionId);
    setSessionIdState(newSessionId);
    return newSessionId;
  };

  /**
   * Clear the current session
   */
  const endSession = () => {
    clearSession();
    setSessionIdState(null);
  };

  return {
    sessionId,
    renewSession,
    endSession,
    isInitialized
  };
}

/**
 * Hook to automatically initialize session context on app start
 * This should be used in the main App component or a context provider
 */
export function useInitializeAuditSession() {
  const { sessionId, isInitialized } = useAuditSession();

  useEffect(() => {
    if (isInitialized && sessionId) {
      console.log('Audit session initialized:', sessionId);
    }
  }, [sessionId, isInitialized]);

  return { sessionId, isInitialized };
}