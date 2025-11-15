import React, { useState, useEffect } from 'react';
import { GoogleTasksDuplicateCleanup } from '../../lib/services/duplicateCleanup';

interface DuplicateStats {
  taskDuplicates: number;
  mappingDuplicates: number;
  orphanedMappings: number;
}

export function GoogleTasksDuplicateChecker() {
  const [stats, setStats] = useState<DuplicateStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [cleanupResults, setCleanupResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const checkForDuplicates = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [taskDuplicates, mappingDuplicates, orphanedMappings] = await Promise.all([
        GoogleTasksDuplicateCleanup.findDuplicateTasks(),
        GoogleTasksDuplicateCleanup.findDuplicateMappings(),
        GoogleTasksDuplicateCleanup.findOrphanedMappings()
      ]);

      setStats({
        taskDuplicates: taskDuplicates.length,
        mappingDuplicates: mappingDuplicates.length,
        orphanedMappings: orphanedMappings.length
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const performCleanup = async () => {
    setLoading(true);
    setError(null);
    setCleanupResults(null);

    try {
      const results = await GoogleTasksDuplicateCleanup.performFullCleanup();
      const orphanedCleaned = await GoogleTasksDuplicateCleanup.cleanupOrphanedMappings();
      
      setCleanupResults({
        ...results,
        orphanedMappingsCleaned: orphanedCleaned
      });

      // Refresh stats after cleanup
      setTimeout(() => {
        checkForDuplicates();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkForDuplicates();
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Google Tasks Duplicate Checker
        </h2>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <div className="flex gap-4 mb-6">
          <button
            onClick={checkForDuplicates}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Checking...' : 'Check for Duplicates'}
          </button>

          {stats && (stats.taskDuplicates > 0 || stats.mappingDuplicates > 0 || stats.orphanedMappings > 0) && (
            <button
              onClick={performCleanup}
              disabled={loading}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? 'Cleaning...' : 'Clean Up Duplicates'}
            </button>
          )}
        </div>

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">
                {stats.taskDuplicates}
              </div>
              <div className="text-sm text-gray-600">Duplicate Task Sets</div>
              {stats.taskDuplicates > 0 && (
                <div className="text-xs text-orange-600 mt-1">
                  ⚠️ Multiple tasks with same Google ID
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">
                {stats.mappingDuplicates}
              </div>
              <div className="text-sm text-gray-600">Duplicate Mapping Sets</div>
              {stats.mappingDuplicates > 0 && (
                <div className="text-xs text-orange-600 mt-1">
                  ⚠️ Multiple mappings for same Google task
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">
                {stats.orphanedMappings}
              </div>
              <div className="text-sm text-gray-600">Orphaned Mappings</div>
              {stats.orphanedMappings > 0 && (
                <div className="text-xs text-orange-600 mt-1">
                  ⚠️ Mappings without corresponding tasks
                </div>
              )}
            </div>
          </div>
        )}

        {cleanupResults && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-md">
            <h3 className="font-semibold text-green-900 mb-2">Cleanup Results</h3>
            <ul className="text-sm text-green-800 space-y-1">
              <li>• {cleanupResults.taskDuplicatesFound} sets of duplicate tasks found</li>
              <li>• {cleanupResults.tasksDeleted} duplicate tasks deleted</li>
              <li>• {cleanupResults.mappingDuplicatesFound} sets of duplicate mappings found</li>
              <li>• {cleanupResults.mappingsDeleted} duplicate mappings deleted</li>
              <li>• {cleanupResults.orphanedMappingsCleaned} orphaned mappings cleaned</li>
            </ul>
          </div>
        )}

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <h3 className="font-semibold text-blue-900 mb-2">About Duplicate Prevention</h3>
          <div className="text-sm text-blue-800 space-y-2">
            <p>The sync process now includes:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>Comprehensive duplicate detection</strong> - Checks both mappings and tasks tables</li>
              <li><strong>Database constraints</strong> - Unique constraints prevent duplicates at the database level</li>
              <li><strong>Race condition protection</strong> - Double-checks before creating new tasks</li>
              <li><strong>Automatic mapping repair</strong> - Creates missing mappings for existing tasks</li>
              <li><strong>Error recovery</strong> - Gracefully handles constraint violations</li>
            </ul>
            <p className="mt-2 font-medium">
              🎯 <strong>Result:</strong> Each Google task will only exist once in your local database, preventing duplicate imports during sync.
            </p>
          </div>
        </div>

        {stats && (
          <div className="mt-4 text-xs text-gray-500">
            Last checked: {new Date().toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}