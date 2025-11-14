/**
 * Direct test of fetch-company-logo edge function via HTTP
 */

import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

async function testDirect() {
  console.log('🧪 Testing fetch-company-logo edge function directly...\n');

  const functionUrl = `${SUPABASE_URL}/functions/v1/fetch-company-logo`;
  const testDomain = 'stripe.com';

  console.log(`📋 Testing domain: ${testDomain}`);
  console.log(`🔗 Function URL: ${functionUrl}\n`);

  try {
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ domain: testDomain }),
    });

    console.log(`📊 Response status: ${response.status} ${response.statusText}`);
    console.log(`📋 Response headers:`, Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log(`\n📄 Response body:`);
    try {
      const json = JSON.parse(responseText);
      console.log(JSON.stringify(json, null, 2));
    } catch {
      console.log(responseText);
    }

    if (response.ok) {
      console.log(`\n✅ Success!`);
    } else {
      console.log(`\n❌ Failed with status ${response.status}`);
    }
  } catch (error: any) {
    console.error(`\n❌ Exception:`, error.message);
    console.error(error);
  }
}

testDirect().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});

