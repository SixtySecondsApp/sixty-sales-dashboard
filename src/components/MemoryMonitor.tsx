import React from 'react';
import { useMemoryMonitor } from '@/lib/hooks/useMemoryMonitor';

interface MemoryMonitorProps {
  className?: string;
  showDetails?: boolean;
}

export function MemoryMonitor({ className = '', showDetails = false }: MemoryMonitorProps) {
  const { memoryStats, managerStats } = useMemoryMonitor(5000); // Update every 5 seconds

  if (!memoryStats || !managerStats) {
    return null;
  }

  const isHighUsage = memoryStats.usagePercentage > 85;
  const isCriticalUsage = memoryStats.usagePercentage > 95;

  return (
    <div className={`bg-gray-800 border border-gray-700 rounded-lg p-3 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-300">Memory Usage</h3>
        <div className={`text-xs px-2 py-1 rounded-full ${
          isCriticalUsage ? 'bg-red-500/20 text-red-400' :
          isHighUsage ? 'bg-yellow-500/20 text-yellow-400' :
          'bg-green-500/20 text-green-400'
        }`}>
          {memoryStats.usagePercentage}%
        </div>
      </div>

      <div className="space-y-1 text-xs text-gray-400">
        <div className="flex justify-between">
          <span>Used Heap:</span>
          <span>{memoryStats.usedJSHeapSize}MB</span>
        </div>
        <div className="flex justify-between">
          <span>Total Heap:</span>
          <span>{memoryStats.totalJSHeapSize}MB</span>
        </div>

        {showDetails && (
          <>
            <div className="border-t border-gray-700 pt-2 mt-2">
              <div className="flex justify-between">
                <span>Event Listeners:</span>
                <span>{managerStats.eventListeners}</span>
              </div>
              <div className="flex justify-between">
                <span>Timers:</span>
                <span>{managerStats.timers}</span>
              </div>
              <div className="flex justify-between">
                <span>Observers:</span>
                <span>{managerStats.observers}</span>
              </div>
              <div className="flex justify-between">
                <span>Subscriptions:</span>
                <span>{managerStats.subscriptions}</span>
              </div>
            </div>
          </>
        )}

        {isCriticalUsage && (
          <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs">
            Critical memory usage! Consider refreshing the page.
          </div>
        )}
      </div>
    </div>
  );
}

export default MemoryMonitor;