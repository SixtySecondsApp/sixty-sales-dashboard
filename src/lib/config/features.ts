// Feature flags for controlled rollout of new features
export const FEATURES = {
  // Dashboard optimization feature flag
  USE_OPTIMIZED_DASHBOARD: import.meta.env.VITE_USE_OPTIMIZED_DASHBOARD === 'true' || import.meta.env.DEV || false,
  
  // Percentage of users to get optimized dashboard (0-100)
  DASHBOARD_OPTIMIZATION_PERCENTAGE: parseInt(import.meta.env.VITE_DASHBOARD_OPT_PERCENTAGE || '100'),
  
  // Enable performance monitoring
  ENABLE_PERFORMANCE_MONITORING: import.meta.env.VITE_ENABLE_PERF_MONITORING === 'true' || true,
  
  // Use Edge Functions
  USE_EDGE_FUNCTIONS: import.meta.env.VITE_USE_EDGE_FUNCTIONS === 'true' || false,
  
  // Cache TTL in seconds
  CACHE_TTL: parseInt(import.meta.env.VITE_CACHE_TTL || '60'),
};

// Progressive rollout control based on user ID
export function shouldUseOptimizedDashboard(userId?: string): boolean {
  // If no user ID, use optimized version in development only
  if (!userId) {
    return import.meta.env.DEV;
  }
  
  // Check if feature is enabled at all
  if (!FEATURES.USE_OPTIMIZED_DASHBOARD) {
    return false;
  }
  
  // 100% rollout
  if (FEATURES.DASHBOARD_OPTIMIZATION_PERCENTAGE >= 100) {
    return true;
  }
  
  // 0% rollout
  if (FEATURES.DASHBOARD_OPTIMIZATION_PERCENTAGE <= 0) {
    return false;
  }
  
  // Gradual rollout based on consistent user ID hash
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const userPercentage = hash % 100;
  
  return userPercentage < FEATURES.DASHBOARD_OPTIMIZATION_PERCENTAGE;
}

// Check if Edge Functions should be used
export function shouldUseEdgeFunctions(): boolean {
  return FEATURES.USE_EDGE_FUNCTIONS && !import.meta.env.VITE_DISABLE_EDGE_FUNCTIONS;
}

// Get cache TTL in milliseconds
export function getCacheTTL(): number {
  return FEATURES.CACHE_TTL * 1000;
}

// Performance monitoring flag
export function isPerformanceMonitoringEnabled(): boolean {
  return FEATURES.ENABLE_PERFORMANCE_MONITORING;
}