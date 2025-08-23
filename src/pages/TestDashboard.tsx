import React from 'react';
import { useDashboard } from '@/lib/hooks/useDashboard';
import { format } from 'date-fns';

export default function TestDashboard() {
  const selectedMonth = new Date();
  const { activities, mrr, recentActivities, chartData, isLoading } = useDashboard(selectedMonth);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-900 min-h-screen text-white">
      <h1 className="text-3xl font-bold mb-6">Performance Test Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-800 p-4 rounded-lg">
          <h3 className="text-sm text-gray-400">Revenue</h3>
          <p className="text-2xl font-bold">${activities?.revenue?.toLocaleString() || 0}</p>
          <p className="text-xs text-emerald-500">Trend: {activities?.revenueTrend || 0}%</p>
        </div>
        
        <div className="bg-gray-800 p-4 rounded-lg">
          <h3 className="text-sm text-gray-400">Outbound</h3>
          <p className="text-2xl font-bold">{activities?.outbound || 0}</p>
          <p className="text-xs text-emerald-500">Trend: {activities?.outboundTrend || 0}%</p>
        </div>
        
        <div className="bg-gray-800 p-4 rounded-lg">
          <h3 className="text-sm text-gray-400">Meetings</h3>
          <p className="text-2xl font-bold">{activities?.meetings || 0}</p>
          <p className="text-xs text-emerald-500">Trend: {activities?.meetingsTrend || 0}%</p>
        </div>
        
        <div className="bg-gray-800 p-4 rounded-lg">
          <h3 className="text-sm text-gray-400">Proposals</h3>
          <p className="text-2xl font-bold">{activities?.proposals || 0}</p>
          <p className="text-xs text-emerald-500">Trend: {activities?.proposalsTrend || 0}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <div className="bg-gray-800 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">MRR Summary</h3>
          <p>Total MRR: ${mrr?.totalMRR?.toLocaleString() || 0}</p>
          <p>Active Clients: {mrr?.activeClients || 0}</p>
          <p>Churn Rate: {mrr?.churnRate || 0}%</p>
        </div>
        
        <div className="bg-gray-800 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Recent Activities</h3>
          <div className="space-y-2">
            {recentActivities?.slice(0, 5).map((activity, i) => (
              <div key={i} className="text-sm">
                <span className="text-gray-400">{activity.type}:</span> {activity.client_name}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-gray-800 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">Performance Metrics</h3>
        <p className="text-sm text-gray-400">
          This dashboard is using the optimized data fetching with:
        </p>
        <ul className="text-sm mt-2 space-y-1">
          <li>✓ Unified Edge Function for single API call</li>
          <li>✓ SmartCache with multi-tier caching</li>
          <li>✓ Pre-calculated metrics and trends</li>
          <li>✓ Database indexes and materialized views</li>
        </ul>
      </div>
      
      <div className="mt-4 text-xs text-gray-500">
        Rendered at: {format(new Date(), 'HH:mm:ss.SSS')}
      </div>
    </div>
  );
}