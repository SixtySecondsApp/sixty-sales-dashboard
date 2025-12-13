/**
 * TeamManagement - Organization Team Management (Tier 2)
 *
 * Legacy page for the former /team/team route.
 * Team management is now accessed via /settings (role-gated).
 */

import { Navigate } from 'react-router-dom';

export default function TeamManagement() {
  return <Navigate to="/settings/team-members" replace />;
}
