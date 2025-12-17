// Initialize Sentry FIRST for error monitoring
import { initSentry } from './lib/sentry';
initSentry();

// Suppress Supabase logs before other imports
import { suppressSupabaseLogs } from './lib/utils/suppressSupabaseLogs';
suppressSupabaseLogs();

// Note: Supabase client is set in App.tsx which loads before landing pages
// This ensures it's available when landing package lazy-loads

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App';
import './index.css';
import { initializeTheme } from './hooks/useTheme';
import { clearCacheAndReload } from './lib/config/version';

// Clerk configuration
const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const USE_CLERK_AUTH = import.meta.env.VITE_USE_CLERK_AUTH === 'true';

// Initialize theme before React renders to prevent flash of wrong theme
initializeTheme();

// Global error handler for chunk loading errors
// This catches errors that occur during dynamic imports before React error boundaries
window.addEventListener('error', (event) => {
  const error = event.error || event.message;
  const errorString = String(error).toLowerCase();
  
  // Check if it's a chunk loading error
  const isChunkError = 
    errorString.includes('failed to fetch dynamically imported module') ||
    errorString.includes('loading chunk') ||
    errorString.includes('loading css chunk') ||
    (errorString.includes('failed to fetch') && event.filename?.includes('.js')) ||
    (errorString.includes('typeerror') && errorString.includes('failed to fetch'));
  
  if (isChunkError) {
    // In dev, surface the error (Vite overlay) rather than nuking storage/sessions.
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[dev] Chunk/dynamic import error detected; not clearing cache automatically.', event.error || event.message);
      return;
    }

    // Production: clear cache and reload after a short delay to allow logging
    setTimeout(() => {
      clearCacheAndReload();
    }, 500);

    // Prevent default error handling
    event.preventDefault();
  }
});

// Also handle unhandled promise rejections (common with dynamic imports)
window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason;
  const errorString = String(error).toLowerCase();
  
  // Check if it's a chunk loading error
  const isChunkError = 
    errorString.includes('failed to fetch dynamically imported module') ||
    errorString.includes('loading chunk') ||
    errorString.includes('loading css chunk') ||
    (errorString.includes('failed to fetch') && errorString.includes('.js')) ||
    (errorString.includes('typeerror') && errorString.includes('failed to fetch'));
  
  if (isChunkError) {
    // In dev, surface the error (Vite overlay) rather than nuking storage/sessions.
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[dev] Chunk/dynamic import rejection detected; not clearing cache automatically.', event.reason);
      return;
    }

    // Production: clear cache and reload after a short delay
    setTimeout(() => {
      clearCacheAndReload();
    }, 500);

    // Prevent default error handling
    event.preventDefault();
  }
});

// Import debug utilities for development
if (import.meta.env.DEV) {
  import('./debug-notifications');
}

/**
 * App wrapper component that conditionally includes ClerkProvider
 * based on the VITE_USE_CLERK_AUTH feature flag.
 *
 * When USE_CLERK_AUTH=true:
 * - ClerkProvider wraps the app for Clerk authentication
 * - Clerk handles user sessions, tokens, and auth state
 *
 * When USE_CLERK_AUTH=false (default):
 * - App uses Supabase Auth (existing behavior)
 * - ClerkProvider is not loaded
 */
function AppWithProviders() {
  const appContent = (
    <HelmetProvider>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <App />
      </BrowserRouter>
    </HelmetProvider>
  );

  // Conditionally wrap with ClerkProvider based on feature flag
  if (USE_CLERK_AUTH && CLERK_PUBLISHABLE_KEY) {
    return (
      <ClerkProvider
        publishableKey={CLERK_PUBLISHABLE_KEY}
        afterSignOutUrl="/"
        appearance={{
          // Match your existing dark theme
          baseTheme: undefined,
          variables: {
            colorPrimary: '#3b82f6', // blue-500
            colorBackground: '#1f2937', // gray-800
            colorText: '#f9fafb', // gray-50
            colorInputBackground: '#374151', // gray-700
            colorInputText: '#f9fafb', // gray-50
          },
        }}
      >
        {appContent}
      </ClerkProvider>
    );
  }

  // Default: no ClerkProvider (Supabase Auth mode)
  return appContent;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppWithProviders />
  </React.StrictMode>
);