/**
 * Test script for fetch-company-logo edge function
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testLogoFetch() {
  console.log('🧪 Testing fetch-company-logo edge function...\n');

  const testDomains = [
    'stripe.com',
    'github.com',
    'openai.com',
    'www.testco.com', // Test www removal
    'https://www.example.com', // Test URL normalization
  ];

  for (const domain of testDomains) {
    console.log(`\n📋 Testing domain: ${domain}`);
    
    try {
      const { data, error } = await supabase.functions.invoke('fetch-company-logo', {
        method: 'POST',
        body: { domain },
      });

      if (error) {
        console.error(`   ❌ Error: ${error.message}`);
        if (error.context) {
          console.error(`   Context:`, JSON.stringify(error.context, null, 2));
        }
        // Try to get more details from the error
        const errorAny = error as any;
        if (errorAny.response) {
          try {
            const body = await errorAny.response.text();
            console.error(`   Response body:`, body);
          } catch {
            // Ignore
          }
        }
        if (errorAny.data) {
          console.error(`   Error data:`, JSON.stringify(errorAny.data, null, 2));
        }
        continue;
      }

      if (data?.logo_url) {
        console.log(`   ✅ Success! Logo URL: ${data.logo_url}`);
        console.log(`   📦 Cached: ${data.cached ? 'Yes (from S3)' : 'No (fetched from logo.dev)'}`);
      } else {
        console.log(`   ⚠️  No logo URL returned`);
        if (data?.error) {
          console.log(`   Error: ${data.error}`);
        }
      }
    } catch (err: any) {
      console.error(`   ❌ Exception: ${err.message}`);
    }
  }

  console.log('\n✅ Test completed!');
}

testLogoFetch().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});

