import { useState } from 'react';
import { supabase } from '@/lib/supabase/clientV2';

/**
 * Fathom Token Test Component
 *
 * Purpose: Quick UI to test if Fathom OAuth token is valid
 * Usage: Add to Integrations page or admin panel
 */
export function FathomTokenTest() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const testToken = async () => {
    setTesting(true);
    setResult(null);

    try {
      console.log('🧪 Testing Fathom token...');

      const { data, error } = await supabase.functions.invoke('test-fathom-token');

      if (error) {
        console.error('❌ Edge Function error:', error);
        throw error;
      }

      console.log('📊 Test result:', data);
      setResult(data);

      // Show user-friendly alert
      if (data.success) {
        alert(`✅ Success!\n\nYour Fathom token is valid and working.\n\nMeetings found: ${data.api_test?.meetings_count || 0}\n\nYou can now run a full sync.`);
      } else {
        alert(`❌ Token Invalid\n\n${data.message}\n\nRecommendation: ${data.recommendation || 'Reconnect your Fathom account'}`);
      }
    } catch (error) {
      console.error('❌ Test error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setResult({
        success: false,
        error: errorMessage,
        details: error
      });
      alert(`❌ Test Failed\n\nError: ${errorMessage}\n\nCheck the browser console for details.`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Test Button */}
      <button
        onClick={testToken}
        disabled={testing}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-wait transition-colors font-medium"
      >
        {testing ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Testing Connection...
          </span>
        ) : (
          '🧪 Test Fathom Connection'
        )}
      </button>

      {/* Results Display */}
      {result && (
        <div className={`p-4 rounded-lg border ${
          result.success
            ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
            : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
        }`}>
          {/* Success/Failure Header */}
          <div className="flex items-center gap-2 mb-3">
            {result.success ? (
              <>
                <span className="text-2xl">✅</span>
                <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">
                  Connection Successful
                </h3>
              </>
            ) : (
              <>
                <span className="text-2xl">❌</span>
                <h3 className="text-lg font-semibold text-red-800 dark:text-red-200">
                  Connection Failed
                </h3>
              </>
            )}
          </div>

          {/* Integration Details */}
          {result.integration && (
            <div className="mb-3 space-y-1 text-sm">
              <p><strong>Email:</strong> {result.integration.email}</p>
              <p><strong>Expires:</strong> {new Date(result.integration.expires_at).toLocaleString()}</p>
              <p><strong>Scopes:</strong> {result.integration.scopes?.join(', ')}</p>
            </div>
          )}

          {/* API Test Results */}
          {result.api_test && (
            <div className="mb-3 space-y-1 text-sm">
              <p><strong>Status:</strong> {result.api_test.status}</p>
              <p><strong>Meetings Found:</strong> {result.api_test.meetings_count}</p>
              <p><strong>Has More:</strong> {result.api_test.has_cursor ? 'Yes' : 'No'}</p>
            </div>
          )}

          {/* Error Details */}
          {result.error && (
            <div className="mb-3 text-sm">
              <p className="font-semibold text-red-700 dark:text-red-300">Error:</p>
              <p className="text-red-600 dark:text-red-400">{JSON.stringify(result.error, null, 2)}</p>
            </div>
          )}

          {/* Recommendation */}
          {result.recommendation && (
            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>💡 Recommendation:</strong> {result.recommendation}
              </p>
            </div>
          )}

          {/* Raw JSON Toggle */}
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
              Show Raw Response
            </summary>
            <pre className="mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-auto max-h-64">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}

      {/* Help Text */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        <p>
          Click the button above to test if your Fathom OAuth token is valid and working with the Fathom API.
        </p>
        <p className="mt-2">
          If the test fails with a 401 error, you'll need to reconnect your Fathom account to generate fresh tokens.
        </p>
      </div>
    </div>
  );
}
