import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function diagnoseEdgeFunctions() {
  const baseUrl = process.env.VITE_SUPABASE_URL?.replace('/rest/v1', '') + '/functions/v1';
  const functions = ['health', 'deals', 'stages', 'contacts', 'companies'];
  
  for (const func of functions) {
    try {
      const response = await fetch(`${baseUrl}/${func}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.VITE_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}`
        }
      });
      if (!response.ok) {
        const text = await response.text();
      } else {
        const data = await response.text();
      }
    } catch (error) {
    }
  }
}

diagnoseEdgeFunctions(); 