/**
 * Application Entry Point with Service Layer Initialization
 * Demonstrates how to integrate SOLID principles architecture with React application
 * IMPORTANT: This preserves 100% design integrity - no visual or functional changes
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Import service layer
import { 
  initializeServiceLayer, 
  ServiceErrorBoundary, 
  getServiceLayerHealth 
} from '@/lib/services';

/**
 * Initialize application with service layer
 */
async function initializeApp() {
  try {
    // Initialize service layer following SOLID principles
    await initializeServiceLayer();
    
    // Verify service health
    const health = await getServiceLayerHealth();
    if (!health.healthy) {
      console.warn('Service layer health check failed:', health.errors);
      // Continue with degraded functionality rather than blocking
    }

    console.log('🚀 Application initialized with SOLID architecture');
    
  } catch (error) {
    console.error('❌ Service layer initialization failed:', error);
    // Application can still run without service layer (fallback to existing hooks)
    console.log('⚠️ Falling back to legacy hook architecture');
  }
}

// Initialize app
initializeApp().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ServiceErrorBoundary
        fallback={({ error, services }) => (
          <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
            <div className="bg-red-900/20 border border-red-700 rounded-xl p-6 max-w-md">
              <h2 className="text-red-400 font-medium mb-2">Application Error</h2>
              <p className="text-red-300 text-sm mb-4">
                Something went wrong with the service layer. The application will continue 
                to function with legacy components.
              </p>
              {services.config?.isDevelopment() && (
                <details className="text-xs text-gray-400">
                  <summary>Error Details</summary>
                  <pre className="mt-2 p-2 bg-gray-900 rounded text-xs overflow-auto">
                    {error.stack}
                  </pre>
                </details>
              )}
            </div>
          </div>
        )}
      >
        <App />
      </ServiceErrorBoundary>
    </React.StrictMode>
  );
});

// Service layer health monitoring in development
if (import.meta.env.DEV) {
  // Monitor service health every 30 seconds in development
  setInterval(async () => {
    const health = await getServiceLayerHealth();
    if (!health.healthy) {
      console.warn('Service health degraded:', health.errors);
    }
  }, 30000);
}

// Add service layer information to window for debugging
if (import.meta.env.DEV) {
  (window as any).__SERVICE_LAYER_DEBUG = {
    async getHealth() {
      return await getServiceLayerHealth();
    },
    async getConfig() {
      const { devUtils } = await import('@/lib/services');
      return devUtils.getServiceConfig();
    },
    async testServices() {
      const { devUtils } = await import('@/lib/services');
      return await devUtils.testServices();
    }
  };
  
  console.log('🛠️ Service layer debug tools available at window.__SERVICE_LAYER_DEBUG');
}