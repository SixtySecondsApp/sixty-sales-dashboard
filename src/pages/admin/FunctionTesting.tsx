import React from 'react';
import { FunctionTestSuite } from '@/components/FunctionTestSuite';

export default function FunctionTesting() {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-gray-900/80 to-gray-900/40 backdrop-blur-xl rounded-2xl p-6 border border-gray-800/50 shadow-xl">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-100 mb-2">Function Testing Suite</h2>
          <p className="text-sm text-gray-400">
            Test Quick Add Functions and pipeline operations with comprehensive coverage for create, read, update, and delete operations.
            Includes performance benchmarks, data integrity checks, error handling validation, and automated cleanup processes.
          </p>
        </div>
        
        <div className="mb-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <h3 className="text-sm font-medium text-blue-400 mb-2">Test Coverage</h3>
          <ul className="text-xs text-blue-300 space-y-1">
            <li>• CRUD operations for contacts, companies, deals, tasks, meetings, proposals, sales, and outbound activities</li>
            <li>• Pipeline stage transitions and deal movement validation</li>
            <li>• Performance benchmarks with bulk operations testing</li>
            <li>• Data integrity checks with relationship validation</li>
            <li>• Error handling and validation testing</li>
            <li>• Automated cleanup with manual override capabilities</li>
          </ul>
        </div>
        
        <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <h3 className="text-sm font-medium text-amber-400 mb-2">⚠️ Testing Notes</h3>
          <ul className="text-xs text-amber-300 space-y-1">
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
  );
}