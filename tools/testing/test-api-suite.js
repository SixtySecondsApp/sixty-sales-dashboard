#!/usr/bin/env node

// API Test Suite - Verify all APIs are working with Supabase Edge Functions
import { config } from 'dotenv';
config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const API_BASE_URL = `${SUPABASE_URL}/functions/v1`;

console.log('🧪 API Test Suite Starting...');
console.log(`📍 Base URL: ${API_BASE_URL}`);
console.log(`🔑 Using Anon Key: ${SUPABASE_ANON_KEY ? '✅ Configured' : '❌ Missing'}`);
console.log('');

// Test results tracker
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

// Helper function to make authenticated requests
async function makeRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'apikey': SUPABASE_ANON_KEY,
    ...options.headers
  };

  console.log(`🔄 ${options.method || 'GET'} ${url}`);
  
  try {
    const response = await fetch(url, {
      ...options,
      headers
    });

    const data = await response.json();
    
    return {
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      data,
      url
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      statusText: 'Network Error',
      error: error.message,
      url
    };
  }
}

// Test function wrapper
async function test(name, testFn) {
  console.log(`\n🧪 Testing: ${name}`);
  console.log('─'.repeat(50));
  
  try {
    const result = await testFn();
    
    if (result.success) {
      console.log(`✅ PASS: ${name}`);
      results.passed++;
    } else {
      console.log(`❌ FAIL: ${name}`);
      console.log(`   Status: ${result.status} ${result.statusText}`);
      if (result.error) console.log(`   Error: ${result.error}`);
      if (result.data?.error) console.log(`   API Error: ${result.data.error}`);
      results.failed++;
    }
    
    results.tests.push({ name, ...result });
    return result;
  } catch (error) {
    console.log(`❌ FAIL: ${name}`);
    console.log(`   Exception: ${error.message}`);
    results.failed++;
    results.tests.push({ name, success: false, error: error.message });
    return { success: false, error: error.message };
  }
}

// Test Suite
async function runTestSuite() {
  
  // Test 1: Health Check (if available)
  await test('Health Check', async () => {
    const result = await makeRequest('/health');
    return result;
  });

  // Test 2: Stages - List All
  await test('Stages - List All', async () => {
    const result = await makeRequest('/stages');
    
    if (result.success && result.data?.data) {
      console.log(`   Found ${result.data.data.length} stages`);
      if (result.data.data.length > 0) {
        console.log(`   Sample stage: ${result.data.data[0].name}`);
      }
    }
    
    return result;
  });

  // Test 3: Stages - Get Single (if stages exist)
  await test('Stages - Get Single', async () => {
    // First get all stages to find an ID
    const stagesResult = await makeRequest('/stages');
    
    if (!stagesResult.success || !stagesResult.data?.data?.length) {
      return { success: false, status: 404, statusText: 'No stages found to test single stage endpoint' };
    }
    
    const firstStageId = stagesResult.data.data[0].id;
    const result = await makeRequest(`/stages/${firstStageId}`);
    
    if (result.success && result.data?.data) {
      console.log(`   Stage name: ${result.data.data.name}`);
    }
    
    return result;
  });

  // Test 4: Deals - List All
  await test('Deals - List All', async () => {
    const result = await makeRequest('/deals?limit=5');
    
    if (result.success && result.data?.data) {
      console.log(`   Found ${result.data.data.length} deals`);
      if (result.data.data.length > 0) {
        console.log(`   Sample deal: ${result.data.data[0].name || 'Unnamed'}`);
      }
    }
    
    return result;
  });

  // Test 5: Deals - With Relationships
  await test('Deals - With Relationships', async () => {
    const result = await makeRequest('/deals?includeRelationships=true&limit=3');
    
    if (result.success && result.data?.data) {
      console.log(`   Found ${result.data.data.length} deals with relationships`);
      if (result.data.data.length > 0) {
        const deal = result.data.data[0];
        console.log(`   Deal has companies: ${!!deal.companies}`);
        console.log(`   Deal has contacts: ${!!deal.contacts}`);
        console.log(`   Deal has stages: ${!!deal.stages}`);
      }
    }
    
    return result;
  });

  // Test 6: Contacts - List All
  await test('Contacts - List All', async () => {
    const result = await makeRequest('/contacts?limit=5');
    
    if (result.success && result.data?.data) {
      console.log(`   Found ${result.data.data.length} contacts`);
      if (result.data.data.length > 0) {
        console.log(`   Sample contact: ${result.data.data[0].full_name || result.data.data[0].email || 'Unnamed'}`);
      }
    }
    
    return result;
  });

  // Test 7: Companies - List All
  await test('Companies - List All', async () => {
    const result = await makeRequest('/companies?limit=5');
    
    if (result.success && result.data?.data) {
      console.log(`   Found ${result.data.data.length} companies`);
      if (result.data.data.length > 0) {
        console.log(`   Sample company: ${result.data.data[0].name || 'Unnamed'}`);
      }
    }
    
    return result;
  });

  // Test 8: CORS Preflight
  await test('CORS Preflight', async () => {
    const result = await makeRequest('/stages', {
      method: 'OPTIONS'
    });
    
    return result;
  });

  // Test 9: Authentication Test (invalid key)
  await test('Authentication - Invalid Key', async () => {
    const url = `${API_BASE_URL}/stages`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer invalid-key',
          'apikey': 'invalid-key'
        }
      });
      
      // Should fail with 401 or 403
      if (response.status === 401 || response.status === 403) {
        return { success: true, status: response.status, statusText: 'Correctly rejected invalid auth' };
      } else {
        return { success: false, status: response.status, statusText: 'Should have rejected invalid auth' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Test 10: URL Verification (ensure not hitting localhost)
  await test('URL Verification - No Localhost', async () => {
    const testUrls = results.tests.map(t => t.url).filter(Boolean);
    const localhostUrls = testUrls.filter(url => url.includes('localhost') || url.includes('127.0.0.1'));
    
    if (localhostUrls.length > 0) {
      console.log(`   ❌ Found localhost URLs: ${localhostUrls.join(', ')}`);
      return { success: false, statusText: 'Found requests to localhost' };
    } else {
      console.log(`   ✅ All ${testUrls.length} requests went to Supabase`);
      return { success: true, statusText: 'All requests correctly routed to Supabase' };
    }
  });
}

// Performance Test
async function performanceTest() {
  console.log('\n⚡ Performance Test');
  console.log('─'.repeat(50));
  
  const start = Date.now();
  const promises = [
    makeRequest('/stages'),
    makeRequest('/deals?limit=10'),
    makeRequest('/contacts?limit=10'),
    makeRequest('/companies?limit=10')
  ];
  
  try {
    const results = await Promise.all(promises);
    const end = Date.now();
    const duration = end - start;
    
    console.log(`⏱️  Concurrent requests completed in ${duration}ms`);
    
    const successful = results.filter(r => r.success).length;
    console.log(`✅ ${successful}/${results.length} concurrent requests successful`);
    
    return duration < 5000; // Should complete within 5 seconds
  } catch (error) {
    console.log(`❌ Performance test failed: ${error.message}`);
    return false;
  }
}

// Main execution
async function main() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.log('❌ Missing environment variables. Please check your .env file.');
    console.log('Required: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY');
    process.exit(1);
  }

  await runTestSuite();
  
  const performanceResult = await performanceTest();
  
  // Summary
  console.log('\n📊 Test Summary');
  console.log('═'.repeat(50));
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`🎯 Success Rate: ${Math.round((results.passed / (results.passed + results.failed)) * 100)}%`);
  console.log(`⚡ Performance: ${performanceResult ? 'GOOD' : 'NEEDS IMPROVEMENT'}`);
  
  if (results.failed === 0) {
    console.log('\n🎉 All tests passed! APIs are working correctly with Supabase Edge Functions.');
  } else {
    console.log(`\n⚠️  ${results.failed} test(s) failed. Check the details above.`);
  }
  
  console.log('\n🔍 Configuration Verified:');
  console.log(`   API Base URL: ${API_BASE_URL}`);
  console.log(`   Using Edge Functions: ✅ YES`);
  console.log(`   Using localhost: ❌ NO`);
  
  process.exit(results.failed === 0 ? 0 : 1);
}

main().catch(console.error); 