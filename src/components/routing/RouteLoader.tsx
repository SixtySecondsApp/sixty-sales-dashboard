/**
 * RouteLoader - Loading fallback component for lazy-loaded routes
 * Displays a centered spinner while route components are being loaded
 */
export const RouteLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
  </div>
);

export default RouteLoader;
