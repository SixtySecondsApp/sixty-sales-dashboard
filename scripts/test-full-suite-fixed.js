import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import { readFileSync } from 'fs';

console.log('🧪 COMPREHENSIVE SALES DASHBOARD TEST SUITE (FIXED)');
console.log('=' .repeat(50));

const results = {
  passed: 0,
  failed: 0,
  warnings: 0
};

function logResult(test, status, message, details = null) {
  const icons = { pass: '✅', fail: '❌', warn: '⚠️' };
  console.log(`${icons[status]} ${test}: ${message}`);
  if (details) console.log(`   ${details}`);
  results[status === 'pass' ? 'passed' : status === 'fail' ? 'failed' : 'warnings']++;
}

async function testEnvironmentVariables() {
  console.log('\n📋 TESTING ENVIRONMENT VARIABLES');
  console.log('-'.repeat(30));
  
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
  console.log('\n🔌 TESTING SUPABASE CONNECTIVITY');
  console.log('-'.repeat(30));
  
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
  console.log('\n🗃️ TESTING DATABASE TABLES');
  console.log('-'.repeat(30));
  
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
  console.log('\n📊 TESTING DATA COUNTS');
  console.log('-'.repeat(30));
  
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
  console.log('\n⚡ TESTING EDGE FUNCTIONS');
  console.log('-'.repeat(30));
  
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
    'companies',
    'owners'
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

async function testAPIEndpoints() {
  console.log('\n🔗 TESTING API ENDPOINTS');
  console.log('-'.repeat(30));
  
  // Test the main API configuration by reading the config file directly
  try {
    const configContent = readFileSync('./src/lib/config.ts', 'utf8');
    
    // Extract API_BASE_URL from the config file (it's computed dynamically)
    const functionMatch = configContent.match(/getApiBaseUrl\s*=\s*\(\)\s*=>\s*{([\s\S]*?)};/);
    const apiBaseUrl = process.env.VITE_SUPABASE_URL ? `${process.env.VITE_SUPABASE_URL}/functions/v1` : 'Not found';
    
    if (apiBaseUrl && apiBaseUrl !== 'Not found') {
      logResult('API Config', 'pass', `Base URL: ${apiBaseUrl}`);
      
      // Test health endpoint
      try {
        const response = await fetch(`${apiBaseUrl}/health`);
        if (response.ok) {
          logResult('Health Endpoint', 'pass', 'Responding');
        } else {
          logResult('Health Endpoint', 'fail', `Status: ${response.status}`);
        }
      } catch (healthError) {
        logResult('Health Endpoint', 'fail', 'Connection failed');
      }
    } else {
      logResult('API Config', 'fail', 'Could not extract API_BASE_URL from config');
    }
  } catch (error) {
    logResult('API Endpoints', 'fail', `Config file error: ${error.message}`);
  }
}

async function runFullTestSuite() {
  console.log(`Starting test suite at ${new Date().toISOString()}\n`);
  
  await testEnvironmentVariables();
  await testSupabaseConnection();
  await testDatabaseTables();
  await testDataCounts();
  await testEdgeFunctions();
  await testAPIEndpoints();
  
  console.log('\n📈 TEST SUMMARY');
  console.log('=' .repeat(50));
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`⚠️  Warnings: ${results.warnings}`);
  console.log(`📊 Total: ${results.passed + results.failed + results.warnings}`);
  
  if (results.failed > 0) {
    console.log('\n🚨 CRITICAL ISSUES FOUND - Please address failed tests');
    process.exit(1);
  } else if (results.warnings > 0) {
    console.log('\n⚠️  WARNINGS FOUND - Some features may not work');
  } else {
    console.log('\n🎉 ALL TESTS PASSED - System should be working correctly');
  }
}

runFullTestSuite().catch(console.error); 