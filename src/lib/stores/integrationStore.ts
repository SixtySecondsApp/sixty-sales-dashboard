import { create } from 'zustand';
import { googleApi, GoogleIntegration, GoogleServiceStatus } from '@/lib/api/googleIntegration';

interface GoogleState {
  isConnected: boolean;
  integration: GoogleIntegration | null;
  email: string | null;
  services: GoogleServiceStatus;
  lastSync: Date | null;
  status: 'connected' | 'disconnected' | 'error' | 'refreshing';
  isLoading: boolean;
  error: string | null;
}

interface IntegrationState {
  google: GoogleState;
  
  // Actions
  checkGoogleConnection: () => Promise<void>;
  connectGoogle: () => Promise<string>; // Returns auth URL
  disconnectGoogle: () => Promise<void>;
  toggleService: (service: keyof GoogleServiceStatus) => Promise<void>;
  syncGoogle: () => Promise<void>;
  refreshGoogleTokens: () => Promise<void>;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
  
  // Selectors
  isServiceEnabled: (service: keyof GoogleServiceStatus) => boolean;
  getConnectionHealth: () => { isHealthy: boolean; issues: string[] };
}

const initialGoogleState: GoogleState = {
  isConnected: false,
  integration: null,
  email: null,
  services: {
    gmail: false,
    calendar: false,
    drive: false
  },
  lastSync: null,
  status: 'disconnected',
  isLoading: false,
  error: null
};

export const useIntegrationStore = create<IntegrationState>((set, get) => ({
  google: initialGoogleState,

  checkGoogleConnection: async () => {
    const { google } = get();
    if (google.isLoading) return; // Prevent concurrent calls
    
    set(state => ({
      google: { 
        ...state.google, 
        isLoading: true, 
        error: null 
      }
    }));

    try {
      // Get integration status
      const integration = await googleApi.getStatus();
      const serviceStatus = await googleApi.getServiceStatus();
      const health = await googleApi.getHealth();

      // Consider near-expiry tokens as connected to avoid false error UI; backend will refresh when needed
      const computedStatus: 'connected' | 'disconnected' | 'error' = integration
        ? (health.isConnected ? 'connected' : 'error')
        : 'disconnected';

      set(state => ({
        google: {
          ...state.google,
          isConnected: !!integration && health.isConnected,
          integration,
          email: integration?.email || null,
          services: serviceStatus,
          lastSync: integration ? new Date(integration.updated_at) : null,
          status: computedStatus,
          isLoading: false,
          error: computedStatus === 'error' ? (state.google.error || null) : null
        }
      }));
    } catch (error: any) {
      console.error('Failed to check Google connection:', error);
      
      set(state => ({
        google: {
          ...state.google,
          isConnected: false,
          status: 'error',
          isLoading: false,
          error: error.message || 'Failed to check connection status'
        }
      }));
    }
  },

  connectGoogle: async (): Promise<string> => {
    set(state => ({
      google: { 
        ...state.google, 
        isLoading: true, 
        error: null 
      }
    }));

    try {
      const { authUrl } = await googleApi.initiateOAuth();
      
      // Don't set loading to false here - the OAuth flow will handle the state change
      // when the user returns from Google
      
      return authUrl;
    } catch (error: any) {
      console.error('Failed to initiate Google connection:', error);
      
      set(state => ({
        google: {
          ...state.google,
          isLoading: false,
          error: error.message || 'Failed to initiate Google connection'
        }
      }));
      
      throw error;
    }
  },

  disconnectGoogle: async () => {
    const { google } = get();
    if (google.isLoading) return;
    
    set(state => ({
      google: { 
        ...state.google, 
        isLoading: true, 
        error: null 
      }
    }));

    try {
      await googleApi.disconnect();
      
      // Reset to initial state
      set(state => ({
        google: {
          ...initialGoogleState,
          status: 'disconnected'
        }
      }));
    } catch (error: any) {
      console.error('Failed to disconnect Google:', error);
      
      set(state => ({
        google: {
          ...state.google,
          isLoading: false,
          error: error.message || 'Failed to disconnect Google account'
        }
      }));
      
      throw error;
    }
  },

  toggleService: async (service: keyof GoogleServiceStatus) => {
    const { google } = get();
    if (!google.isConnected || google.isLoading) return;

    const newValue = !google.services[service];
    
    // Optimistic update
    set(state => ({
      google: {
        ...state.google,
        services: {
          ...state.google.services,
          [service]: newValue
        }
      }
    }));

    try {
      await googleApi.toggleService(service, newValue);
      
      // The optimistic update should already be in place
      // If needed, we could re-fetch the service status here
    } catch (error: any) {
      console.error(`Failed to toggle ${service}:`, error);
      
      // Revert the optimistic update
      set(state => ({
        google: {
          ...state.google,
          services: {
            ...state.google.services,
            [service]: !newValue
          },
          error: error.message || `Failed to toggle ${service}`
        }
      }));
      
      throw error;
    }
  },

  syncGoogle: async () => {
    const { google } = get();
    if (!google.isConnected || google.isLoading) return;
    
    set(state => ({
      google: { 
        ...state.google, 
        status: 'refreshing' 
      }
    }));

    try {
      // Re-fetch all Google data
      await get().checkGoogleConnection();
      
      set(state => ({
        google: {
          ...state.google,
          lastSync: new Date(),
          status: 'connected'
        }
      }));
    } catch (error: any) {
      console.error('Failed to sync Google data:', error);
      
      set(state => ({
        google: {
          ...state.google,
          status: 'error',
          error: error.message || 'Failed to sync Google data'
        }
      }));
    }
  },

  refreshGoogleTokens: async () => {
    const { google } = get();
    if (!google.integration || google.isLoading) return;
    
    set(state => ({
      google: { 
        ...state.google, 
        status: 'refreshing' 
      }
    }));

    try {
      const success = await googleApi.refreshTokens();
      
      if (success) {
        // Re-check connection status after token refresh
        await get().checkGoogleConnection();
      } else {
        throw new Error('Token refresh failed');
      }
    } catch (error: any) {
      console.error('Failed to refresh Google tokens:', error);
      
      set(state => ({
        google: {
          ...state.google,
          status: 'error',
          error: error.message || 'Failed to refresh access tokens'
        }
      }));
    }
  },

  clearError: () => {
    set(state => ({
      google: {
        ...state.google,
        error: null
      }
    }));
  },

  setLoading: (loading: boolean) => {
    set(state => ({
      google: {
        ...state.google,
        isLoading: loading
      }
    }));
  },

  // Selectors
  isServiceEnabled: (service: keyof GoogleServiceStatus): boolean => {
    const { google } = get();
    return google.isConnected && google.services[service];
  },

  getConnectionHealth: (): { isHealthy: boolean; issues: string[] } => {
    const { google } = get();
    const issues: string[] = [];

    if (!google.isConnected) {
      issues.push('Not connected to Google');
    }

    if (google.error) {
      issues.push(google.error);
    }

    if (google.status === 'error') {
      issues.push('Connection error detected');
    }

    if (google.integration && google.integration.expires_at) {
      const expiresAt = new Date(google.integration.expires_at);
      const now = new Date();
      const fiveMinutes = 5 * 60 * 1000;
      
      if (expiresAt.getTime() - now.getTime() < fiveMinutes) {
        issues.push('Access token expires soon');
      }
    }

    return {
      isHealthy: issues.length === 0,
      issues
    };
  }
}));

// Utility hook for Google-specific state
export const useGoogleIntegration = () => {
  const store = useIntegrationStore();
  
  return {
    // State
    isConnected: store.google.isConnected,
    integration: store.google.integration,
    email: store.google.email,
    services: store.google.services,
    status: store.google.status,
    isLoading: store.google.isLoading,
    error: store.google.error,
    lastSync: store.google.lastSync,
    
    // Actions
    checkConnection: store.checkGoogleConnection,
    connect: store.connectGoogle,
    disconnect: store.disconnectGoogle,
    toggleService: store.toggleService,
    sync: store.syncGoogle,
    refreshTokens: store.refreshGoogleTokens,
    clearError: store.clearError,
    
    // Selectors
    isServiceEnabled: store.isServiceEnabled,
    getConnectionHealth: store.getConnectionHealth
  };
};