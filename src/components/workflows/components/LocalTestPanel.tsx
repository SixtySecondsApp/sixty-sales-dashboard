import React from 'react';
import { Play, Pause, Square, X, CheckSquare, GitBranch, Database } from 'lucide-react';
import { TestExecutionState, TEST_SCENARIOS } from '@/lib/utils/workflowTestEngine';

interface LocalTestPanelProps {
  testExecutionState: TestExecutionState;
  selectedScenario: string;
  onScenarioChange: (id: string) => void;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  onSpeedChange: (speed: number) => void;
  onClose: () => void;
}

export const LocalTestPanel: React.FC<LocalTestPanelProps> = ({
  testExecutionState,
  selectedScenario,
  onScenarioChange,
  onStart,
  onStop,
  onPause,
  onResume,
  onSpeedChange,
  onClose
}) => {
  return (
    <div className="h-full flex flex-col">
      {/* Test Panel Header */}
      <div className="bg-white dark:bg-gray-800 p-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Play className="w-4 h-4 text-[#37bd7e]" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Test Execution</h3>
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors"
          title="Close test panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      
      {/* Test Controls */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
        {!testExecutionState.isRunning ? (
          <>
            <div>
              <label className="text-xs font-semibold text-gray-400 mb-1 block">Test Scenario</label>
              <select
                value={selectedScenario}
                onChange={(e) => onScenarioChange(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm"
              >
                {TEST_SCENARIOS.map(scenario => (
                  <option key={scenario.id} value={scenario.id}>
                    {scenario.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={onStart}
              className="w-full px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              Start Test
            </button>
          </>
        ) : (
          <div className="flex gap-2">
            {testExecutionState.isPaused ? (
              <button
                onClick={onResume}
                className="flex-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4" />
                Resume
              </button>
            ) : (
              <button
                onClick={onPause}
                className="flex-1 px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
              >
                <Pause className="w-4 h-4" />
                Pause
              </button>
            )}
            <button
              onClick={onStop}
              className="flex-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
            >
              <Square className="w-4 h-4" />
              Stop
            </button>
          </div>
        )}
        
        {/* Speed Control */}
        {testExecutionState.isRunning && (
          <div>
            <label className="text-xs font-semibold text-gray-400 mb-1 block">Execution Speed</label>
            <select
              value={testExecutionState.executionSpeed}
              onChange={(e) => onSpeedChange(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm placeholder-gray-400 dark:placeholder-gray-500"
            >
              <option value={0.5}>0.5x Speed</option>
              <option value={1}>1x Speed</option>
              <option value={2}>2x Speed</option>
              <option value={5}>5x Speed</option>
            </select>
          </div>
        )}
      </div>
      
      {/* Test Data */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h4 className="text-xs font-semibold text-gray-400 mb-2">Test Data Context</h4>
        <pre className="text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded p-2 overflow-x-auto max-h-32">
          {JSON.stringify(testExecutionState.testData, null, 2)}
        </pre>
      </div>
      
      {/* Execution Logs */}
      <div className="flex-1 overflow-y-auto p-4">
        <h4 className="text-xs font-semibold text-gray-400 mb-3">Execution Log</h4>
        <div className="space-y-2">
          {testExecutionState.logs.map((log, index) => (
            <div
              key={index}
              className={`p-2 rounded-lg text-xs ${
                log.type === 'error' ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50' :
                log.type === 'complete' ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50' :
                log.type === 'condition' ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50' :
                'bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50'
              }`}
            >
              <div className="flex items-start gap-2">
                <div className="flex items-center gap-1">
                  {log.type === 'error' && <X className="w-3 h-3 text-red-400" />}
                  {log.type === 'complete' && <CheckSquare className="w-3 h-3 text-green-400" />}
                  {log.type === 'condition' && <GitBranch className="w-3 h-3 text-blue-400" />}
                  {log.type === 'start' && <Play className="w-3 h-3 text-purple-400" />}
                  {log.type === 'data' && <Database className="w-3 h-3 text-yellow-400" />}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-white">{log.nodeName}</div>
                  <div className="text-gray-400">{log.message}</div>
                  {log.data && (
                    <div className="mt-1">
                      <pre className="text-xs text-gray-500 bg-gray-900 rounded p-1 overflow-x-auto">
                        {JSON.stringify(log.data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
                <div className="text-gray-500 text-xs">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

