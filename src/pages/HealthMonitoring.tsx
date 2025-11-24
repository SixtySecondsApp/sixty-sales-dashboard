/**
 * Unified Health Monitoring Page
 *
 * Provides a tabbed interface for Deal Health and Relationship Health monitoring
 * with unified intervention template support.
 */

import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { DealHealthDashboard } from '@/components/DealHealthDashboard';
import { RelationshipHealthDashboard } from '@/components/relationship-health/RelationshipHealthDashboard';
import { useAuth } from '@/lib/contexts/AuthContext';
import { Activity, Users } from 'lucide-react';

type Tab = 'deals' | 'relationships';

export default function HealthMonitoring() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const tab = searchParams.get('tab');
    return (tab === 'relationships' ? 'relationships' : 'deals') as Tab;
  });

  // Update URL when tab changes
  useEffect(() => {
    const newParams = new URLSearchParams(searchParams);
    if (activeTab === 'relationships') {
      newParams.set('tab', 'relationships');
    } else {
      newParams.delete('tab');
    }
    setSearchParams(newParams, { replace: true });
  }, [activeTab, searchParams, setSearchParams]);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">Please sign in to view health monitoring</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('deals')}
              className={`
                flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${
                  activeTab === 'deals'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }
              `}
            >
              <Activity className="h-4 w-4" />
              Deal Health
            </button>
            <button
              onClick={() => setActiveTab('relationships')}
              className={`
                flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${
                  activeTab === 'relationships'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }
              `}
            >
              <Users className="h-4 w-4" />
              Relationship Health
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'deals' ? (
          <DealHealthDashboard />
        ) : (
          <div className="p-6">
            <RelationshipHealthDashboard userId={user.id} />
          </div>
        )}
      </div>
    </div>
  );
}

