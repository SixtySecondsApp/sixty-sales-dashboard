/**
 * Relationship Health Page
 *
 * Main page for the Relationship Health Monitor feature.
 * Wraps the RelationshipHealthDashboard component with authentication and layout.
 */

import { useAuth } from '@/lib/contexts/AuthContext';
import { RelationshipHealthDashboard } from '@/components/relationship-health/RelationshipHealthDashboard';

export default function RelationshipHealth() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">Please sign in to view relationship health</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <RelationshipHealthDashboard userId={user.id} />
    </div>
  );
}
