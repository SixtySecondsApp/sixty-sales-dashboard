/**
 * Test script using fetch directly to get full error details
 */

import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  process.exit(1);
}

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/process-lead-prep`;

async function testLeadPrep() {
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
    if (response.ok) {
      const processed = responseData?.processed ?? 0;
    } else {
      if (responseData.error) {
      }
      if (responseData.details) {
      }
    }
  } catch (error: any) {
    if (error.stack) {
    }
    process.exit(1);
  }
}

testLeadPrep();










