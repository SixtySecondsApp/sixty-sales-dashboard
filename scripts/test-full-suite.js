import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
const results = {
  passed: 0,
  failed: 0,
  warnings: 0
};

function logResult(test, status, message, details = null) {
  const icons = { pass: '✅', fail: '❌', warn: '⚠️' };
  if (details) {}
  results[status === 'pass' ? 'passed' : status === 'fail' ? 'failed' : 'warnings']++;
}

async function testEnvironmentVariables() {
  const vars = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY', 
    'VITE_SUPABASE_SERVICE_ROLE_KEY'
  ];
  
  for (const varName of vars) {
    const value = process.env[varName];
    if (value) {
      logResult(`${varName}`, 'pass', 'Present', `${value.substring(0, 20)}...`);
    } else {
      logResult(`${varName}`, 'fail', 'Missing');
    }
  }
}

async function testSupabaseConnection() {
  try {
    // Test with anon key
    const supabaseAnon = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY
    );
    
    const { data, error } = await supabaseAnon.from('profiles').select('id').limit(1);
    
    if (error) {
      logResult('Anon Connection', 'fail', error.message);
    } else {
      logResult('Anon Connection', 'pass', 'Connected successfully');
    }
    
    // Test with service role key
    const supabaseService = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
    );
    
    const { data: serviceData, error: serviceError } = await supabaseService
      .from('profiles').select('id').limit(1);
    
    if (serviceError) {
      logResult('Service Role Connection', 'fail', serviceError.message);
    } else {
      logResult('Service Role Connection', 'pass', 'Connected successfully');
    }
    
  } catch (error) {
    logResult('Supabase Connection', 'fail', error.message);
  }
}

async function testDatabaseTables() {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  );
  
  const tables = [
    'profiles',
    'deals', 
    'deal_stages',
    'contacts',
    'activities',
    'companies'
  ];
  
  for (const tableName of tables) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);
        
      if (error) {
        if (error.message.includes('does not exist')) {
          logResult(`Table: ${tableName}`, 'warn', 'Does not exist');
        } else {
          logResult(`Table: ${tableName}`, 'fail', error.message);
        }
      } else {
        logResult(`Table: ${tableName}`, 'pass', `Exists (${data?.length || 0} sample records)`);
      }
    } catch (error) {
      logResult(`Table: ${tableName}`, 'fail', error.message);
    }
  }
}

async function testDataCounts() {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  );
  
  const tables = ['deals', 'deal_stages', 'contacts', 'activities', 'profiles'];
  
  for (const tableName of tables) {
    try {
      const { count, error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });
        
      if (error) {
        logResult(`Count: ${tableName}`, 'fail', error.message);
      } else {
        logResult(`Count: ${tableName}`, 'pass', `${count} records`);
      }
    } catch (error) {
      logResult(`Count: ${tableName}`, 'fail', error.message);
    }
  }
}

async function testEdgeFunctions() {
  const baseUrl = process.env.VITE_SUPABASE_URL?.replace('/rest/v1', '') + '/functions/v1';
  const headers = {
    'Content-Type': 'application/json',
    'apikey': process.env.VITE_SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}`
  };
  
  const functions = [
    'health',
    'deals', 
    'stages',
    'contacts',
    'companies'
  ];
  
  for (const functionName of functions) {
    try {
      const response = await fetch(`${baseUrl}/${functionName}`, {
        method: 'GET',
        headers
      });
      
      if (response.ok) {
        logResult(`Edge Function: ${functionName}`, 'pass', `Status: ${response.status}`);
      } else {
        logResult(`Edge Function: ${functionName}`, 'fail', `Status: ${response.status}`);
      }
    } catch (error) {
      logResult(`Edge Function: ${functionName}`, 'fail', error.message);
    }
  }
}

async function testCORS() {
  const baseUrl = process.env.VITE_SUPABASE_URL?.replace('/rest/v1', '') + '/functions/v1';
  
  try {
    const response = await fetch(`${baseUrl}/health`, {
      method: 'OPTIONS'
    });
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
      'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
      'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers')
    };
    
    if (corsHeaders['Access-Control-Allow-Origin']) {
      logResult('CORS Headers', 'pass', 'Present and configured');
    } else {
      logResult('CORS Headers', 'fail', 'Missing or misconfigured');
    }
  } catch (error) {
    logResult('CORS Test', 'fail', error.message);
  }
}

async function testAuthFlow() {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
  );
  
  try {
    // Check if there's an active session
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      logResult('Auth Session Check', 'fail', error.message);
    } else if (session) {
      logResult('Auth Session', 'pass', `User authenticated: ${session.user.email}`);
      
      // Test RLS with authenticated user
      const { data: userDeals, error: dealsError } = await supabase
        .from('deals')
        .select('id')
        .limit(1);
        
      if (dealsError) {
        logResult('Authenticated Data Access', 'fail', dealsError.message);
      } else {
        logResult('Authenticated Data Access', 'pass', 'Can access user data');
      }
    } else {
      logResult('Auth Session', 'warn', 'No active session (user not logged in)');
    }
  } catch (error) {
    logResult('Auth Flow Test', 'fail', error.message);
  }
}

async function testAPIEndpoints() {
  // Test the main API configuration
  try {
    const { API_BASE_URL } = await import('../src/lib/config.ts');
    logResult('API Config', 'pass', `Base URL: ${API_BASE_URL}`);
    
    // Test health endpoint
    const response = await fetch(`${API_BASE_URL}/health`);
    if (response.ok) {
      logResult('Health Endpoint', 'pass', 'Responding');
    } else {
      logResult('Health Endpoint', 'fail', `Status: ${response.status}`);
    }
  } catch (error) {
    logResult('API Endpoints', 'fail', error.message);
  }
}

async function runFullTestSuite() {
  await testEnvironmentVariables();
  await testSupabaseConnection();
  await testDatabaseTables();
  await testDataCounts();
  await testEdgeFunctions();
  await testCORS();
  await testAuthFlow();
  await testAPIEndpoints();
  if (results.failed > 0) {
    process.exit(1);
  } else if (results.warnings > 0) {
  } else {
  }
}

runFullTestSuite().catch(console.error); 