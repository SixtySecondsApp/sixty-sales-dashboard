#!/usr/bin/env node

/**
 * Test script for Copilot Edge Function with Claude Haiku 4.5
 * Tests MCP CRUD operations
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ewtuefzeogytgmsnkpmb.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

// Test cases
const testCases = [
  {
    name: 'Simple Chat Message',
    payload: {
      message: 'Hello, can you help me?',
      context: {}
    }
  },
  {
    name: 'Read Meetings (MCP Tool Test)',
    payload: {
      message: 'Show me my meetings from the last week',
      context: {}
    }
  },
  {
    name: 'Read Pipeline (MCP Tool Test)',
    payload: {
      message: 'What deals do I have in my pipeline?',
      context: {}
    }
  },
  {
    name: 'Create Task (MCP Tool Test)',
    payload: {
      message: 'Create a task to follow up with John Smith tomorrow',
      context: {}
    }
  }
];

async function testCopilot(testCase) {
  console.log(`\n🧪 Testing: ${testCase.name}`);
  console.log(`Message: "${testCase.payload.message}"`);
  console.log(`URL: ${SUPABASE_URL}/functions/v1/api-copilot/chat`);
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/api-copilot/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(testCase.payload)
    });

    console.log(`\n📊 Response Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ Error Response:', errorText);
      try {
        const errorJson = JSON.parse(errorText);
        console.log('Error Details:', JSON.stringify(errorJson, null, 2));
      } catch (e) {
        console.log('Raw Error:', errorText);
      }
      return false;
    }

    const data = await response.json();
    console.log('\n✅ Success!');
    console.log('\n📄 Response Data:');
    console.log(JSON.stringify(data, null, 2));
    
    // Check if response contains content
    if (data.content || data.data?.content) {
      const content = data.content || data.data?.content;
      console.log('\n💬 AI Response:');
      console.log(content.substring(0, 500) + (content.length > 500 ? '...' : ''));
    }
    
    return true;
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

async function runAllTests() {
  console.log('==========================================');
  console.log('🧪 Testing Copilot with Claude Haiku 4.5');
  console.log('==========================================');
  console.log(`\nSupabase URL: ${SUPABASE_URL}`);
  console.log(`API Key: ${SUPABASE_ANON_KEY ? SUPABASE_ANON_KEY.substring(0, 20) + '...' : 'NOT SET'}`);
  
  if (!SUPABASE_ANON_KEY) {
    console.error('\n❌ ERROR: VITE_SUPABASE_ANON_KEY not set!');
    console.log('Please set it in your environment or .env file');
    process.exit(1);
  }

  const results = [];
  for (const testCase of testCases) {
    const success = await testCopilot(testCase);
    results.push({ name: testCase.name, success });
    
    // Wait a bit between tests to avoid rate limiting
    if (testCase !== testCases[testCases.length - 1]) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('\n==========================================');
  console.log('📊 Test Results Summary');
  console.log('==========================================');
  results.forEach(result => {
    console.log(`${result.success ? '✅' : '❌'} ${result.name}`);
  });
  
  const successCount = results.filter(r => r.success).length;
  console.log(`\n${successCount}/${results.length} tests passed`);
  
  if (successCount === results.length) {
    console.log('\n🎉 All tests passed! Claude Haiku 4.5 is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the logs above for details.');
  }
}

// Run tests
runAllTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});







