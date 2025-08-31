import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface ViewModeUser {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
}

interface ViewModeContextType {
  isViewMode: boolean;
  viewedUser: ViewModeUser | null;
  startViewMode: (user: ViewModeUser) => void;
  exitViewMode: () => void;
}

export const ViewModeContext = createContext<ViewModeContextType | undefined>(undefined);

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [viewedUser, setViewedUser] = useState<ViewModeUser | null>(null);
  const queryClient = useQueryClient();

  const startViewMode = (user: ViewModeUser) => {
    // Clear cache when entering view mode to prevent data mixing
    queryClient.invalidateQueries({ queryKey: ['activities'] });
    queryClient.invalidateQueries({ queryKey: ['deals'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
    
    setViewedUser(user);
    // Store in sessionStorage to persist across page refreshes
    sessionStorage.setItem('viewMode', JSON.stringify(user));
  };

  const exitViewMode = () => {
    // Clear cache when exiting view mode to prevent data mixing
    queryClient.invalidateQueries({ queryKey: ['activities'] });
    queryClient.invalidateQueries({ queryKey: ['deals'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
    
    setViewedUser(null);
    sessionStorage.removeItem('viewMode');
  };

  // Check for existing view mode on mount
  React.useEffect(() => {
    const stored = sessionStorage.getItem('viewMode');
    if (stored) {
      try {
        const user = JSON.parse(stored);
        setViewedUser(user);
      } catch (error) {
        console.error('Failed to restore view mode:', error);
        sessionStorage.removeItem('viewMode');
      }
    }
  }, []);

  return (
    <ViewModeContext.Provider
      value={{
        isViewMode: !!viewedUser,
        viewedUser,
        startViewMode,
        exitViewMode,
      }}
    >
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  const context = useContext(ViewModeContext);
  if (context === undefined) {
    throw new Error('useViewMode must be used within a ViewModeProvider');
  }
  return context;
}