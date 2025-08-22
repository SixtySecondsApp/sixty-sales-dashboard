import React, { useState, useEffect } from 'react';
import { useUser } from '@/lib/hooks/useUser';
import { createClient } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import logger from '@/lib/utils/logger';

export default function TestFallback() {
  const { userData, isAuthenticated } = useUser();
  const [testResults, setTestResults] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runTests = async () => {
    setIsRunning(true);
    const results = [];
    
    // Test 1: Check authentication status
    results.push({
      test: 'Authentication Status',
      status: isAuthenticated ? 'PASS' : 'FAIL',
      details: isAuthenticated ? `Logged in as: ${userData?.email} (ID: ${userData?.id})` : 'Not authenticated - This is the main issue!'
    });
    
    // Test 2: Session check
    try {
      const supabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY
      );
      
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      results.push({
        test: 'Session Check',
        status: session ? 'PASS' : 'FAIL',
        details: session 
          ? `Session active: ${session.user?.email}, Token present: ${!!session.access_token}` 
          : `No session found. ${sessionError ? `Error: ${sessionError.message}` : 'Please log in at /auth/login'}`
      });
    } catch (error: any) {
      results.push({
        test: 'Session Check',
        status: 'FAIL',
        details: `Session check failed: ${error.message}`
      });
    }
    
    // Test 3: Service Role Key Fallback (This should always work)
    try {
      logger.log('🧪 Testing service role key fallback...');
      
      const serviceSupabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY
      );
      
      // Test deals with service key
      const { data: deals, error: dealsError } = await (serviceSupabase as any)
        .from('deals')
        .select('*, deal_stages(*)')
        .limit(3);
        
      if (dealsError) {
        results.push({
          test: 'Service Key Deals Query',
          status: 'FAIL',
          details: `Service key failed: ${dealsError.message}`
        });
      } else {
        results.push({
          test: 'Service Key Deals Query', 
          status: 'PASS',
          details: `✅ Retrieved ${deals?.length || 0} deals with service key! This proves fallback should work.`
        });
      }
      
      // Test stages with service key
      const { data: stages, error: stagesError } = await (serviceSupabase as any)
        .from('deal_stages')
        .select('*');
        
      if (stagesError) {
        results.push({
          test: 'Service Key Stages Query',
          status: 'FAIL', 
          details: `Service key stages failed: ${stagesError.message}`
        });
      } else {
        results.push({
          test: 'Service Key Stages Query',
          status: 'PASS',
          details: `✅ Retrieved ${stages?.length || 0} stages: ${stages?.map((s: any) => s.name).join(', ')}`
        });
      }
      
    } catch (error: any) {
      results.push({
        test: 'Service Key Fallback',
        status: 'FAIL',
        details: `Service key test failed: ${error.message}`
      });
    }
    
    // Test 4: Environment Variables
    results.push({
      test: 'Environment Variables',
      status: (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY && import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY) ? 'PASS' : 'FAIL',
      details: [
        `VITE_SUPABASE_URL: ${import.meta.env.VITE_SUPABASE_URL ? '✅ Set' : '❌ Missing'}`,
        `VITE_SUPABASE_ANON_KEY: ${import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'}`,
        `VITE_SUPABASE_SERVICE_ROLE_KEY: ${import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing'}`
      ].join(', ')
    });
    
    setTestResults(results);
    setIsRunning(false);
  };

  useEffect(() => {
    runTests();
  }, [isAuthenticated, userData]);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6 text-white">🧪 Authentication & Fallback Test</h1>
      
      <div className="mb-6 p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
        <h3 className="font-semibold text-blue-400 mb-2">🔍 Quick Diagnosis</h3>
        <p className="text-gray-300 text-sm mb-2">
          This page tests your authentication status and whether the fallback mechanisms should work.
        </p>
        {!isAuthenticated && (
          <p className="text-yellow-400 text-sm">
            ⚠️ <strong>You are not logged in!</strong> Go to <a href="/auth/login" className="text-blue-400 underline">/auth/login</a> to sign in first.
          </p>
        )}
      </div>
      
      <div className="flex gap-4 mb-6">
        <Button 
          onClick={runTests} 
          disabled={isRunning}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {isRunning ? 'Running Tests...' : '🔄 Re-run Tests'}
        </Button>
        
        <Button 
          onClick={() => window.location.href = '/auth/login'}
          variant="outline"
        >
          🔐 Go to Login
        </Button>
      </div>
      
      <div className="space-y-4">
        {testResults.map((result, index) => (
          <div 
            key={index} 
            className={`p-4 rounded-lg border ${
              result.status === 'PASS' 
                ? 'bg-green-900/20 border-green-700' 
                : 'bg-red-900/20 border-red-700'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-lg ${
                result.status === 'PASS' ? 'text-green-400' : 'text-red-400'
              }`}>
                {result.status === 'PASS' ? '✅' : '❌'}
              </span>
              <h3 className="font-semibold text-white">{result.test}</h3>
              <span className={`px-2 py-1 text-xs rounded ${
                result.status === 'PASS' 
                  ? 'bg-green-600 text-white' 
                  : 'bg-red-600 text-white'
              }`}>
                {result.status}
              </span>
            </div>
            <p className="text-gray-300 text-sm whitespace-pre-wrap">{result.details}</p>
          </div>
        ))}
      </div>
      
      {testResults.length === 0 && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto"></div>
          <p className="text-gray-400 mt-2">Running tests...</p>
        </div>
      )}
    </div>
  );
} 