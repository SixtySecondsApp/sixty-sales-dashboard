// Suppress Supabase logs FIRST, before any other imports
import { suppressSupabaseLogs } from './lib/utils/suppressSupabaseLogs';
suppressSupabaseLogs();

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import App from './App';
import './index.css';
import { initializeTheme } from './hooks/useTheme';
import { clearCacheAndReload } from './lib/config/version';

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
    // Clear cache and reload after a short delay to allow logging
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
    // Clear cache and reload after a short delay
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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>
);