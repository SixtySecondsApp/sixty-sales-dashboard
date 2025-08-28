// Test the Edge Function authentication directly
// Run this in your browser console on any page

async function testEdgeFunctionAuth() {
  const SUPABASE_URL = 'https://ewtuefzeogytgmsnkpmb.supabase.co';
  const API_KEY = 'sk_test_api_key_for_suite_12345';
  
  console.log('🧪 Testing Edge Function Authentication');
  console.log('API Key:', API_KEY);
  console.log('Supabase URL:', SUPABASE_URL);
  
  // Test the contacts endpoint
  const url = `${SUPABASE_URL}/functions/v1/api-v1-contacts`;
  
  console.log('Making request to:', url);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const text = await response.text();
    console.log('Response body:', text);
    
    if (response.status === 401) {
      console.error('❌ Still getting 401 - authentication failed');
      console.log('This means the Edge Function cannot validate the API key');
    } else {
      console.log('✅ Authentication succeeded!');
    }
    
  } catch (error) {
    console.error('❌ Request failed:', error);
  }
}

// Run the test
testEdgeFunctionAuth();