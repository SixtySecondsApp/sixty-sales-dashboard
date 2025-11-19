/**
 * Direct test of fetch-company-logo edge function via HTTP
 */

import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  process.exit(1);
}

async function testDirect() {
  const functionUrl = `${SUPABASE_URL}/functions/v1/fetch-company-logo`;
  const testDomain = 'stripe.com';
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
    const responseText = await response.text();
    try {
      const json = JSON.parse(responseText);
    } catch {
    }

    if (response.ok) {
    } else {
    }
  } catch (error: any) {
  }
}

testDirect().catch((error) => {
  process.exit(1);
});











