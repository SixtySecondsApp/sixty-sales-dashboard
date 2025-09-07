import React, { useState } from 'react';

export default function TestingLabDebug() {
  const [count, setCount] = useState(0);
  const [testMode, setTestMode] = useState<'simulated' | 'real'>('simulated');

  const handleClick = () => {
    console.log('Button clicked! Current count:', count);
    setCount(count + 1);
  };

  const handleModeChange = (mode: 'simulated' | 'real') => {
    console.log('Mode changing to:', mode);
    setTestMode(mode);
  };

  return (
    <div className="p-6 bg-gray-900 rounded-lg">
      <h2 className="text-xl font-bold text-white mb-4">Testing Lab Debug</h2>
      
      <div className="space-y-4">
        <div>
          <p className="text-gray-400 mb-2">Counter Test:</p>
          <button
            onClick={handleClick}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
          >
            Click me (Count: {count})
          </button>
        </div>

        <div>
          <p className="text-gray-400 mb-2">Mode Toggle Test:</p>
          <div className="flex gap-2">
            <button
              onClick={() => handleModeChange('simulated')}
              className={`px-4 py-2 rounded-lg ${
                testMode === 'simulated' 
                  ? 'bg-green-500 text-white' 
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              Simulated
            </button>
            <button
              onClick={() => handleModeChange('real')}
              className={`px-4 py-2 rounded-lg ${
                testMode === 'real' 
                  ? 'bg-green-500 text-white' 
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              Real
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-2">Current mode: {testMode}</p>
        </div>

        <div>
          <p className="text-gray-400 mb-2">Console Test:</p>
          <button
            onClick={() => {
              console.log('Testing console log');
              console.warn('Testing console warning');
              console.error('Testing console error');
              alert('Check the console for logs!');
            }}
            className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg"
          >
            Test Console Logs
          </button>
        </div>
      </div>
    </div>
  );
}