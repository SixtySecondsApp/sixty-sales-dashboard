import React from 'react';
import { FunctionTestSuite } from '@/components/FunctionTestSuite';

export default function FunctionTesting() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 p-6">
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 rounded-xl p-6 shadow-sm dark:shadow-none">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Function Testing Suite</h2>
            <p className="text-sm text-gray-700 dark:text-gray-400">
            Test Quick Add Functions and pipeline operations with comprehensive coverage for create, read, update, and delete operations.
            Includes performance benchmarks, data integrity checks, error handling validation, and automated cleanup processes.
          </p>
        </div>


        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg">
          <h3 className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-2">Test Coverage</h3>
          <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
            <li>• CRUD operations for contacts, companies, deals, tasks, meetings, proposals, sales, and outbound activities</li>
            <li>• Pipeline stage transitions and deal movement validation</li>
            <li>• Performance benchmarks with bulk operations testing</li>
            <li>• Data integrity checks with relationship validation</li>
            <li>• Error handling and validation testing</li>
            <li>• Automated cleanup with manual override capabilities</li>
          </ul>
        </div>


        <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg">
          <h3 className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-2">⚠️ Testing Notes</h3>
          <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
            <li>• Function tests create real data in your database during testing</li>
            <li>• All test data is automatically cleaned up after test completion</li>
            <li>• Manual cleanup option available if automatic cleanup fails</li>
            <li>• Tests may take several minutes to complete depending on system performance</li>
            <li>• Ensure you have proper database backups before running extensive tests</li>
          </ul>
        </div>
        </div>

        <FunctionTestSuite />
      </div>
    </div>
  );
}