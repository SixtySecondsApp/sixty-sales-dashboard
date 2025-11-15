#!/usr/bin/env node

// Final Comprehensive API Test - Document Complete Status
import { config } from 'dotenv';
config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const API_BASE_URL = `${SUPABASE_URL}/functions/v1`;
const results = {
  configuration: {},
  edgeFunctions: {},
  fallbackMechanism: {},
  dataAvailability: {},
  authentication: {}
};

async function testConfiguration() {
  // Test URL routing
  const testUrl = `${API_BASE_URL}/stages`;
  const isUsingSupabase = testUrl.includes('supabase.co');
  const isNotLocalhost = !testUrl.includes('localhost') && !testUrl.includes('127.0.0.1');
  
  results.configuration = {
    pointsToSupabase: isUsingSupabase,
    avoidsLocalhost: isNotLocalhost,
    properBaseUrl: API_BASE_URL
  };
}

async function testEdgeFunctions() {
  const endpoints = [
    { name: 'Stages', path: '/stages' },
    { name: 'Deals', path: '/deals?limit=1' },
    { name: 'Contacts', path: '/contacts?limit=1' },
    { name: 'Companies', path: '/companies?limit=1' }
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint.path}`, {
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      const success = response.ok;
      
      results.edgeFunctions[endpoint.name.toLowerCase()] = {
        status: response.status,
        success,
        error: data.error || null
      };
    } catch (error) {
      results.edgeFunctions[endpoint.name.toLowerCase()] = {
        status: 0,
        success: false,
        error: error.message
      };
    }
  }
}

async function testFallbackMechanism() {
  const fallbackTests = [
    { name: 'deal_stages', endpoint: 'deal_stages?select=count' },
    { name: 'deals', endpoint: 'deals?select=count' },
    { name: 'contacts', endpoint: 'contacts?select=count' },
    { name: 'activities', endpoint: 'activities?select=count' }
  ];
  
  for (const test of fallbackTests) {
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${test.endpoint}`, {
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      const success = response.ok;
      const count = success ? (data?.[0]?.count || 0) : 0;
      
      results.fallbackMechanism[test.name] = {
        success,
        count,
        accessible: success && count >= 0
      };
    } catch (error) {
      results.fallbackMechanism[test.name] = {
        success: false,
        error: error.message
      };
    }
  }
}

async function testDataAvailability() {
  const dataTests = [
    { name: 'deals', endpoint: 'deals?select=count' },
    { name: 'contacts', endpoint: 'contacts?select=count' },
    { name: 'activities', endpoint: 'activities?select=count' },
    { name: 'deal_stages', endpoint: 'deal_stages?select=count' },
    { name: 'profiles', endpoint: 'profiles?select=count' }
  ];
  
  for (const test of dataTests) {
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${test.endpoint}`, {
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'apikey': SUPABASE_SERVICE_KEY,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      const success = response.ok;
      const count = success ? (data?.[0]?.count || 0) : 0;
      
      results.dataAvailability[test.name] = {
        success,
        count,
        hasData: count > 0
      };
    } catch (error) {
      results.dataAvailability[test.name] = {
        success: false,
        error: error.message
      };
    }
  }
}

async function testAuthentication() {
  // Test invalid auth rejection
  try {
    const response = await fetch(`${API_BASE_URL}/stages`, {
      headers: {
        'Authorization': 'Bearer invalid-key',
        'apikey': 'invalid-key',
        'Content-Type': 'application/json'
      }
    });
    
    const authTestPassed = response.status === 401 || response.status === 403;
    results.authentication.rejectsInvalidAuth = authTestPassed;
  } catch (error) {
    results.authentication.rejectsInvalidAuth = false;
  }
  
  // Check if anon key is different from service key
  const keysDifferent = SUPABASE_ANON_KEY !== SUPABASE_SERVICE_KEY;
  results.authentication.separateKeys = keysDifferent;
}

function generateSummary() {
  // Overall Status
  const configGood = results.configuration.pointsToSupabase && results.configuration.avoidsLocalhost;
  const fallbackWorks = Object.values(results.fallbackMechanism).some(test => test.accessible);
  const dataExists = Object.values(results.dataAvailability).some(test => test.hasData);
  const authProper = results.authentication.rejectsInvalidAuth && results.authentication.separateKeys;
  // Data Summary
  const totalDeals = results.dataAvailability.deals?.count || 0;
  const totalContacts = results.dataAvailability.contacts?.count || 0;
  const totalActivities = results.dataAvailability.activities?.count || 0;
  // Issue Analysis
  const rlsBlocking = totalDeals > 0 && (results.fallbackMechanism.deals?.count || 0) === 0;
  if (rlsBlocking) {
  }
  
  const edgeFunctionsBroken = Object.values(results.edgeFunctions).every(test => !test.success);
  if (edgeFunctionsBroken) {
  }
  
  // Next Steps
  const overallScore = [configGood, fallbackWorks, dataExists, authProper].filter(Boolean).length;
  if (overallScore >= 3) {
  } else {
  }
}

async function main() {
  await testConfiguration();
  await testEdgeFunctions();
  await testFallbackMechanism();
  await testDataAvailability();
  await testAuthentication();
  generateSummary();
}

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_KEY) {
  process.exit(1);
}

main(); 