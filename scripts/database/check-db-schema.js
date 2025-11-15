#!/usr/bin/env node

// Database Schema Check - See what tables actually exist
import { config } from 'dotenv';
config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

async function checkSchema() {
  try {
    // Check what tables exist
    const tablesResponse = await fetch(`${SUPABASE_URL}/rest/v1/information_schema.tables?select=table_name&table_schema=eq.public`, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey': SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (tablesResponse.ok) {
      const tables = await tablesResponse.json();
      tables.forEach((table, index) => {
      });
    } else {
      // Try direct queries for expected tables
      const expectedTables = ['deals', 'deal_stages', 'contacts', 'companies', 'activities', 'profiles'];
      for (const tableName of expectedTables) {
        try {
          const response = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}?select=*&limit=1`, {
            headers: {
              'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
              'apikey': SUPABASE_SERVICE_KEY,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
          } else {
            const error = await response.text();
          }
        } catch (error) {
        }
      }
    }

    // Check deal_stages specifically since that's what we need
    try {
      const stagesResponse = await fetch(`${SUPABASE_URL}/rest/v1/deal_stages?select=*&limit=5`, {
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'apikey': SUPABASE_SERVICE_KEY,
          'Content-Type': 'application/json'
        }
      });

      if (stagesResponse.ok) {
        const stages = await stagesResponse.json();
        if (stages.length > 0) {
        }
      } else {
        const error = await stagesResponse.text();
      }
    } catch (error) {
    }

    // Check deals table structure
    try {
      const dealsResponse = await fetch(`${SUPABASE_URL}/rest/v1/deals?select=*&limit=2`, {
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'apikey': SUPABASE_SERVICE_KEY,
          'Content-Type': 'application/json'
        }
      });

      if (dealsResponse.ok) {
        const deals = await dealsResponse.json();
        if (deals.length > 0) {
        }
      } else {
        const error = await dealsResponse.text();
      }
    } catch (error) {
    }

  } catch (error) {
  }
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  process.exit(1);
}

checkSchema(); 