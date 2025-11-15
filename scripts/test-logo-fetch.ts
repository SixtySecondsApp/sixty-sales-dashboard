/**
 * Test script for fetch-company-logo edge function
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testLogoFetch() {
  const testDomains = [
    'stripe.com',
    'github.com',
    'openai.com',
    'www.testco.com', // Test www removal
    'https://www.example.com', // Test URL normalization
  ];

  for (const domain of testDomains) {
    try {
      const { data, error } = await supabase.functions.invoke('fetch-company-logo', {
        method: 'POST',
        body: { domain },
      });

      if (error) {
        if (error.context) {
        }
        // Try to get more details from the error
        const errorAny = error as any;
        if (errorAny.response) {
          try {
            const body = await errorAny.response.text();
          } catch {
            // Ignore
          }
        }
        if (errorAny.data) {
        }
        continue;
      }

      if (data?.logo_url) {
      } else {
        if (data?.error) {
        }
      }
    } catch (err: any) {
    }
  }
}

testLogoFetch().catch((error) => {
  process.exit(1);
});

