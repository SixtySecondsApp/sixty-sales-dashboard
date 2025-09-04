import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TestTube, Play, CheckCircle, XCircle, Info, Settings, Loader } from 'lucide-react';

interface TestingInterfaceProps {
  workflow: any;
  onTestComplete: () => void;
}

const TestingInterface: React.FC<TestingInterfaceProps> = ({ workflow, onTestComplete }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);
  const [testConfig, setTestConfig] = useState({
    simulateData: true,
    dryRun: true,
    verbose: false
  });

  const handleRunTest = async () => {
    if (!workflow) {
      setTestResult({
        success: false,
        message: 'Please select a workflow to test',
      });
      return;
    }

    setIsRunning(true);
    setTestResult(null);

    // Simulate test execution
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Mock test result
    const success = Math.random() > 0.3;
    setTestResult({
      success,
      message: success 
        ? `Test passed! The workflow "${workflow.rule_name}" executed successfully.`
        : `Test failed. The workflow encountered an error during execution.`,
      details: {
        trigger: workflow.trigger_type,
        action: workflow.action_type,
        executionTime: Math.floor(Math.random() * 1000) + 'ms',
        simulatedData: testConfig.simulateData,
        dryRun: testConfig.dryRun
      }
    });

    setIsRunning(false);
    onTestComplete();
  };

  return (
    <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-lg">
      <div className="p-4 border-b border-gray-800/50">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <TestTube className="w-5 h-5 text-purple-400" />
            Test Automation
          </h3>
          <button
            onClick={handleRunTest}
            disabled={isRunning || !workflow}
            className={`px-3 py-1 rounded text-sm transition-colors flex items-center gap-2 ${
              isRunning || !workflow
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-[#37bd7e] hover:bg-[#37bd7e]/90 text-white'
            }`}
          >
            {isRunning ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run Test
              </>
            )}
          </button>
        </div>
      </div>
      
      <div className="p-4 space-y-4">
        {!workflow ? (
          <div className="p-4 bg-gray-800/30 rounded-lg text-center text-gray-400">
            <TestTube className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Select a workflow to test</p>
          </div>
        ) : (
          <>
            {/* Test Configuration */}
            <div className="p-3 bg-blue-600/10 border border-blue-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium text-blue-400">Test Configuration</span>
              </div>
              <p className="text-xs text-gray-300 mb-3">
                Testing workflow: <span className="text-white font-medium">{workflow.rule_name}</span>
              </p>
              
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={testConfig.simulateData}
                    onChange={(e) => setTestConfig(prev => ({ ...prev, simulateData: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-[#37bd7e] focus:ring-[#37bd7e] focus:ring-offset-0"
                  />
                  Simulate test data
                </label>
                <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={testConfig.dryRun}
                    onChange={(e) => setTestConfig(prev => ({ ...prev, dryRun: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-[#37bd7e] focus:ring-[#37bd7e] focus:ring-offset-0"
                  />
                  Dry run (no actual changes)
                </label>
                <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={testConfig.verbose}
                    onChange={(e) => setTestConfig(prev => ({ ...prev, verbose: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-[#37bd7e] focus:ring-[#37bd7e] focus:ring-offset-0"
                  />
                  Verbose logging
                </label>
              </div>
            </div>

            {/* Expected Outcome */}
            <div className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg">
              <span className="text-sm text-gray-300">Expected outcome</span>
              <span className="text-sm text-[#37bd7e]">
                {workflow.action_type === 'create_task' && 'Create new task'}
                {workflow.action_type === 'create_activity' && 'Log activity'}
                {workflow.action_type === 'send_notification' && 'Send notification'}
              </span>
            </div>
          </>
        )}

        {/* Test Result */}
        <AnimatePresence>
          {testResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`p-4 rounded-lg border ${
                testResult.success
                  ? 'bg-[#37bd7e]/10 border-[#37bd7e]/30'
                  : 'bg-red-400/10 border-red-400/30'
              }`}
            >
              <div className="flex items-start gap-3">
                {testResult.success ? (
                  <CheckCircle className="w-5 h-5 text-[#37bd7e] mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-400 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="text-sm text-white font-medium mb-1">
                    {testResult.success ? 'Test Passed' : 'Test Failed'}
                  </p>
                  <p className="text-xs text-gray-300">
                    {testResult.message}
                  </p>
                  {testResult.details && (
                    <div className="mt-3 space-y-1">
                      <p className="text-xs text-gray-400">
                        <span className="text-gray-500">Trigger:</span>{' '}
                        <span className="text-gray-300">{testResult.details.trigger}</span>
                      </p>
                      <p className="text-xs text-gray-400">
                        <span className="text-gray-500">Action:</span>{' '}
                        <span className="text-gray-300">{testResult.details.action}</span>
                      </p>
                      <p className="text-xs text-gray-400">
                        <span className="text-gray-500">Execution time:</span>{' '}
                        <span className="text-gray-300">{testResult.details.executionTime}</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default TestingInterface;