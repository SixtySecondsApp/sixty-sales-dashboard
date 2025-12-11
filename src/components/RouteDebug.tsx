/**
 * Route Debug Component
 * Helps debug route matching issues
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function RouteDebug() {
  const location = useLocation();

  useEffect(() => {
    console.log('[RouteDebug] ====== ROUTE DEBUG ======');
    console.log('[RouteDebug] Current pathname:', location.pathname);
    console.log('[RouteDebug] Search:', location.search);
    console.log('[RouteDebug] Full URL:', window.location.href);
    
    // Check if we're on platform routes
    if (location.pathname.startsWith('/platform')) {
      console.log('[RouteDebug] ⚠️ Platform route detected:', location.pathname);
    }
  }, [location]);

  return null;
}
