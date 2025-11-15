/**
 * Workflow Test Panel Component
 * Provides UI for testing workflows in Build/Staging/Live environments
 */

import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, PlayCircle, Settings, Database, Globe } from 'lucide-react';
import { supabase } from '@/lib/supabase/clientV2';
import { workflowEnvironmentService } from '@/lib/services/workflowEnvironmentService';
import { fixtureManagementService } from '@/lib/services/fixtureManagementService';
import { replayEngineService } from '@/lib/services/replayEngineService';
import type { WorkflowEnvironment } from '@/lib/services/workflowEnvironmentService';

interface WorkflowTestPanelProps {
  workflowId: string;
  workflowName?: string;
}

export const WorkflowTestPanel: React.FC<WorkflowTestPanelProps> = ({ 
  workflowId, 
  workflowName 
}) => {
  const [currentEnvironment, setCurrentEnvironment] = useState<WorkflowEnvironment>('build');
  const [isLoading, setIsLoading] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTestData();
  }, [workflowId, currentEnvironment]);

  const loadTestData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load fixtures for current environment
      const workflowFixtures = await fixtureManagementService.getWorkflowFixtures(
        workflowId,
        currentEnvironment
      );
      setFixtures(workflowFixtures);

      // Load test scenarios
      const workflowScenarios = await fixtureManagementService.getWorkflowScenarios(
        workflowId
      );
      setScenarios(workflowScenarios);

      // Set current environment in service
      workflowEnvironmentService.setActiveEnvironment(currentEnvironment);
    } catch (err) {
      setError('Failed to load test data');
    } finally {
      setIsLoading(false);
    }
  };

  const runTest = async (scenarioId?: string) => {
    try {
      setIsLoading(true);
      setError(null);
      setTestResults(null);

      // Mock nodes and edges for testing
      const nodes = [
        { id: 'trigger', type: 'trigger', position: { x: 0, y: 0 }, data: {} },
        { id: 'action', type: 'action', position: { x: 200, y: 0 }, data: {} }
      ];
      const edges = [
        { id: 'e1', source: 'trigger', target: 'action' }
      ];

      // Run replay test
      const result = await replayEngineService.startReplay(
        workflowId,
        nodes,
        edges,
        {
          environment: currentEnvironment,
          speed: 'fast',
          scenarioName: scenarioId
        }
      );

      setTestResults(result);
    } catch (err) {
      setError('Test execution failed');
    } finally {
      setIsLoading(false);
    }
  };

  const pinInput = async () => {
    try {
      const testData = {
        trigger: 'manual',
        timestamp: new Date().toISOString(),
        data: { test: true }
      };

      await fixtureManagementService.pinNodeInput(
        workflowId,
        'trigger',
        'test-input',
        testData,
        currentEnvironment,
        { description: 'Test input fixture' }
      );

      await loadTestData();
    } catch (err) {
      setError('Failed to pin input');
    }
  };

  const promoteEnvironment = async (from: WorkflowEnvironment, to: WorkflowEnvironment) => {
    try {
      setIsLoading(true);
      const success = await workflowEnvironmentService.promoteEnvironment(
        workflowId,
        from,
        to
      );

      if (success) {
        setCurrentEnvironment(to);
        await loadTestData();
      } else {
        setError('Failed to promote environment');
      }
    } catch (err) {
      setError('Failed to promote environment');
    } finally {
      setIsLoading(false);
    }
  };

  const getEnvironmentIcon = (env: WorkflowEnvironment) => {
    switch (env) {
      case 'build':
        return <Settings className="w-4 h-4" />;
      case 'staging':
        return <Database className="w-4 h-4" />;
      case 'live':
        return <Globe className="w-4 h-4" />;
    }
  };

  const getEnvironmentColor = (env: WorkflowEnvironment) => {
    switch (env) {
      case 'build':
        return 'bg-blue-500';
      case 'staging':
        return 'bg-yellow-500';
      case 'live':
        return 'bg-green-500';
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white mb-2">
          Workflow Testing System
        </h2>
        <p className="text-gray-400 text-sm">
          {workflowName || workflowId}
        </p>
      </div>

      {/* Environment Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Environment
        </label>
        <div className="flex gap-2">
          {(['build', 'staging', 'live'] as WorkflowEnvironment[]).map(env => (
            <button
              key={env}
              onClick={() => setCurrentEnvironment(env)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg transition-all
                ${currentEnvironment === env 
                  ? `${getEnvironmentColor(env)} text-white` 
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }
              `}
            >
              {getEnvironmentIcon(env)}
              <span className="capitalize">{env}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <span className="text-red-400 text-sm">{error}</span>
        </div>
      )}

      {/* Test Controls */}
      <div className="mb-6 space-y-3">
        <div className="flex gap-3">
          <button
            onClick={() => runTest()}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <PlayCircle className="w-4 h-4" />
            Run Test
          </button>

          <button
            onClick={pinInput}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            Pin Current Input
          </button>
        </div>

        {/* Environment Promotion */}
        {currentEnvironment === 'build' && (
          <button
            onClick={() => promoteEnvironment('build', 'staging')}
            disabled={isLoading}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            Promote to Staging →
          </button>
        )}
        {currentEnvironment === 'staging' && (
          <button
            onClick={() => promoteEnvironment('staging', 'live')}
            disabled={isLoading}
            className="text-sm text-yellow-400 hover:text-yellow-300 transition-colors"
          >
            Promote to Live →
          </button>
        )}
      </div>

      {/* Fixtures Display */}
      {fixtures.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-300 mb-3">
            Test Fixtures ({fixtures.length})
          </h3>
          <div className="space-y-2">
            {fixtures.map((fixture, index) => (
              <div
                key={fixture.id || index}
                className="p-3 bg-gray-800 rounded-lg border border-gray-700"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white">
                    {fixture.fixtureName}
                  </span>
                  <span className="text-xs text-gray-400">
                    {fixture.fixtureType} - {fixture.nodeId}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Test Scenarios */}
      {scenarios.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-300 mb-3">
            Test Scenarios ({scenarios.length})
          </h3>
          <div className="space-y-2">
            {scenarios.map((scenario, index) => (
              <div
                key={scenario.id || index}
                className="p-3 bg-gray-800 rounded-lg border border-gray-700 hover:border-gray-600 cursor-pointer transition-colors"
                onClick={() => runTest(scenario.scenarioName)}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white">
                    {scenario.scenarioName}
                  </span>
                  <span className={`
                    text-xs px-2 py-1 rounded
                    ${scenario.difficulty === 'easy' ? 'bg-green-500/20 text-green-400' : ''}
                    ${scenario.difficulty === 'medium' ? 'bg-yellow-500/20 text-yellow-400' : ''}
                    ${scenario.difficulty === 'hard' ? 'bg-red-500/20 text-red-400' : ''}
                  `}>
                    {scenario.difficulty}
                  </span>
                </div>
                {scenario.description && (
                  <p className="text-xs text-gray-400 mt-1">
                    {scenario.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Test Results */}
      {testResults && (
        <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            {testResults.success ? (
              <CheckCircle className="w-5 h-5 text-green-400" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400" />
            )}
            <h3 className="text-sm font-medium text-white">
              Test Results
            </h3>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Status:</span>
              <span className={testResults.success ? 'text-green-400' : 'text-red-400'}>
                {testResults.success ? 'Passed' : 'Failed'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Execution Time:</span>
              <span className="text-white">{testResults.executionTime}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Nodes Executed:</span>
              <span className="text-white">{testResults.replayedNodes}</span>
            </div>
            
            {testResults.errors && testResults.errors.length > 0 && (
              <div className="mt-3 p-2 bg-red-500/10 rounded">
                <span className="text-xs text-red-400">
                  Errors: {testResults.errors.join(', ')}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      )}
    </div>
  );
};