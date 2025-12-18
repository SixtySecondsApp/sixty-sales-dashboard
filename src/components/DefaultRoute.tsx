import { Navigate } from 'react-router-dom';

/**
 * DefaultRoute - Handles root path (/) routing
 * 
 * Always redirects to /learnmore (the default landing page)
 */
export function DefaultRoute() {
  return <Navigate to="/learnmore" replace />;
}
