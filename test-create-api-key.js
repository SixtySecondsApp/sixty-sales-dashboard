#!/usr/bin/env node

/**
 * Test script for the create-api-key Edge Function
 * This tests the improved implementation with proper error handling
 */

// Test configuration
const EDGE_FUNCTION_URL = 'http://127.0.0.1:54321/functions/v1/create-api-key';

// Mock JWT token for testing (you'll need to replace this with a real token)
const MOCK_JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI4NzY1NDMyMS1hYmNkLTEyMzQtZWY1Ni0xMjM0NTY3ODkwYWIiLCJlbWFpbCI6InRlc3RAdGVzdC5jb20iLCJpYXQiOjE2OTc3MDAwMDAsImV4cCI6MTY5NzcwMzYwMH0.test_signature';

// Test cases
const testCases = [
  {
    name: 'Valid API Key Creation',
    payload: {
      name: 'My Test API Key',
      permissions: ['deals:read', 'deals:write'],
      rate_limit: 1000,
      expires_in_days: 30
    },
    expectedStatus: 201
  },
  {
    name: 'Minimal Valid Request',
    payload: {
      name: 'Minimal Key',
      permissions: ['deals:read']
    },
    expectedStatus: 201
  },
  {
    name: 'Invalid Permissions',
    payload: {
      name: 'Invalid Permissions Key',
      permissions: ['invalid:permission']
    },
    expectedStatus: 400
  },
  {
    name: 'Missing Name',
    payload: {
      permissions: ['deals:read']
    },
    expectedStatus: 400
  },
  {
    name: 'Invalid Rate Limit',
    payload: {
      name: 'High Rate Limit',
      permissions: ['deals:read'],
      rate_limit: 50000
    },
    expectedStatus: 400
  },
  {
    name: 'Invalid Expiration',
    payload: {
      name: 'Long Expiry',
      permissions: ['deals:read'],
      expires_in_days: 5000
    },
    expectedStatus: 400
  }
];

async function runTest(testCase) {
  console.log(`\n🧪 Testing: ${testCase.name}`);
  console.log('📤 Payload:', JSON.stringify(testCase.payload, null, 2));
  
  try {
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MOCK_JWT_TOKEN}`
      },
      body: JSON.stringify(testCase.payload)
    });

    const responseData = await response.json();
    console.log(`📥 Status: ${response.status} (expected: ${testCase.expectedStatus})`);
    console.log('📄 Response:', JSON.stringify(responseData, null, 2));

    if (response.status === testCase.expectedStatus) {
      console.log('✅ Test PASSED');
      return { passed: true, testCase: testCase.name };
    } else {
      console.log('❌ Test FAILED - Wrong status code');
      return { passed: false, testCase: testCase.name, reason: 'Wrong status code' };
    }

  } catch (error) {
    console.log('❌ Test FAILED - Network error:', error.message);
    return { passed: false, testCase: testCase.name, reason: `Network error: ${error.message}` };
  }
}

async function testCORS() {
  console.log('\n🧪 Testing: CORS Preflight');
  
  try {
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'OPTIONS'
    });

    console.log(`📥 Status: ${response.status}`);
    console.log('📄 Headers:', Object.fromEntries(response.headers.entries()));

    if (response.status === 200) {
      console.log('✅ CORS Test PASSED');
      return { passed: true, testCase: 'CORS Preflight' };
    } else {
      console.log('❌ CORS Test FAILED');
      return { passed: false, testCase: 'CORS Preflight', reason: 'Wrong status code' };
    }

  } catch (error) {
    console.log('❌ CORS Test FAILED - Network error:', error.message);
    return { passed: false, testCase: 'CORS Preflight', reason: `Network error: ${error.message}` };
  }
}

async function testUnauthorized() {
  console.log('\n🧪 Testing: No Authorization Header');
  
  try {
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Test Key',
        permissions: ['deals:read']
      })
    });

    const responseData = await response.json();
    console.log(`📥 Status: ${response.status}`);
    console.log('📄 Response:', JSON.stringify(responseData, null, 2));

    if (response.status === 401) {
      console.log('✅ Unauthorized Test PASSED');
      return { passed: true, testCase: 'No Authorization' };
    } else {
      console.log('❌ Unauthorized Test FAILED');
      return { passed: false, testCase: 'No Authorization', reason: 'Wrong status code' };
    }

  } catch (error) {
    console.log('❌ Unauthorized Test FAILED - Network error:', error.message);
    return { passed: false, testCase: 'No Authorization', reason: `Network error: ${error.message}` };
  }
}

async function runAllTests() {
  console.log('🚀 Starting Edge Function Tests');
  console.log('🌐 Testing URL:', EDGE_FUNCTION_URL);
  console.log('⚠️  Note: Using mock JWT token - replace with real token for full testing');

  const results = [];

  // Test CORS
  results.push(await testCORS());

  // Test unauthorized access
  results.push(await testUnauthorized());

  // Run all test cases
  for (const testCase of testCases) {
    results.push(await runTest(testCase));
  }

  // Summary
  console.log('\n📊 Test Summary');
  console.log('================');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log(`✅ Passed: ${passed}/${total}`);
  console.log(`❌ Failed: ${failed}/${total}`);

  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.testCase}: ${r.reason || 'Unknown reason'}`);
    });
  }

  console.log(`\n🎯 Overall Result: ${failed === 0 ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
  
  return failed === 0;
}

// Usage instructions
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
📖 Edge Function Test Script Usage:

1. Start your Supabase local development environment:
   npx supabase start

2. Deploy the Edge Function:
   npx supabase functions deploy create-api-key

3. Run the tests:
   node test-create-api-key.js

⚠️  Important Notes:
- Replace MOCK_JWT_TOKEN with a real JWT token from your Supabase auth
- Ensure your local Supabase instance is running on port 54321
- The database migrations must be applied for the function to work

🔧 Customization:
- Edit EDGE_FUNCTION_URL for different environments
- Modify test cases to match your specific requirements
- Add additional test scenarios as needed
`);
  process.exit(0);
}

// Run tests if called directly
if (require.main === module) {
  runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Test runner failed:', error);
      process.exit(1);
    });
}

module.exports = { runAllTests, testCases };