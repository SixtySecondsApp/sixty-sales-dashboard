/**
 * usePageTracking Hook
 * 
 * Automatically tracks page views when route changes.
 * Add to App.tsx to enable automatic page tracking.
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '@/lib/analytics';

// Map route paths to friendly page names
const PAGE_NAMES: Record<string, string> = {
  '/': 'Home',
  '/dashboard': 'Dashboard',
  '/meetings': 'Meetings',
  '/meetings/:id': 'Meeting Detail',
  '/meeting-intelligence': 'Meeting Intelligence',
  '/proposals': 'Proposals',
  '/tasks': 'Tasks',
  '/calendar': 'Calendar',
  '/contacts': 'Contacts',
  '/deals': 'Deals',
  '/pipeline': 'Pipeline',
  '/analytics': 'Analytics',
  '/settings': 'Settings',
  '/onboarding': 'Onboarding',
  '/pricing': 'Pricing',
  '/platform': 'Platform Admin',
  '/platform/activation': 'Activation Dashboard',
  '/platform/customers': 'Customer Management',
  '/admin': 'Admin',
};

/**
 * Get friendly page name from path
 */
function getPageName(pathname: string): string {
  // Direct match
  if (PAGE_NAMES[pathname]) {
    return PAGE_NAMES[pathname];
  }
  
  // Check for dynamic routes (e.g., /meetings/123)
  if (pathname.startsWith('/meetings/')) {
    return 'Meeting Detail';
  }
  if (pathname.startsWith('/proposals/')) {
    return 'Proposal Detail';
  }
  if (pathname.startsWith('/contacts/')) {
    return 'Contact Detail';
  }
  if (pathname.startsWith('/deals/')) {
    return 'Deal Detail';
  }
  if (pathname.startsWith('/platform/')) {
    return 'Platform Admin';
  }
  if (pathname.startsWith('/admin/')) {
    return 'Admin';
  }
  
  // Fallback: capitalize path segments
  return pathname
    .split('/')
    .filter(Boolean)
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' > ') || 'Home';
}

/**
 * Hook to automatically track page views
 */
export function usePageTracking() {
  const location = useLocation();

  useEffect(() => {
    const pageName = getPageName(location.pathname);
    
    trackPageView(pageName, {
      path: location.pathname,
      search: location.search,
      hash: location.hash,
    });
  }, [location.pathname, location.search]);
}

export default usePageTracking;
