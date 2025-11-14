/**
 * Test script using fetch directly to get full error details
 */

import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/process-lead-prep`;

async function testLeadPrep() {
  console.log('🧪 Testing process-lead-prep edge function...\n');
  console.log(`   URL: ${FUNCTION_URL}\n`);

  try {
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    const responseText = await response.text();
    let responseData;
    
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    console.log(`HTTP Status: ${response.status}`);
    console.log('Response:', JSON.stringify(responseData, null, 2));

    if (response.ok) {
      console.log('\n✅ Function executed successfully!');
      const processed = responseData?.processed ?? 0;
      console.log(`   Processed: ${processed} lead(s)`);
    } else {
      console.log('\n❌ Function returned error status');
      if (responseData.error) {
        console.log(`   Error: ${responseData.error}`);
      }
      if (responseData.details) {
        console.log(`   Details: ${responseData.details}`);
      }
    }
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

testLeadPrep();






