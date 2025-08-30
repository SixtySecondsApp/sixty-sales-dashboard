#!/usr/bin/env node

// Database Schema Check - See what tables actually exist
import { config } from 'dotenv';
config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 Database Schema Check');
console.log(`📍 Database: ${SUPABASE_URL}`);
console.log('');

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
      console.log('📋 Available Tables:');
      tables.forEach((table, index) => {
        console.log(`   ${index + 1}. ${table.table_name}`);
      });
    } else {
      console.log('❌ Could not fetch table list via REST API');
      
      // Try direct queries for expected tables
      const expectedTables = ['deals', 'deal_stages', 'contacts', 'companies', 'activities', 'profiles'];
      
      console.log('\n🧪 Testing individual tables:');
      
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
            console.log(`   ✅ ${tableName} - exists`);
          } else {
            const error = await response.text();
            console.log(`   ❌ ${tableName} - ${response.status}: ${error}`);
          }
        } catch (error) {
          console.log(`   ❌ ${tableName} - Error: ${error.message}`);
        }
      }
    }

    // Check deal_stages specifically since that's what we need
    console.log('\n🎯 Checking deal_stages table structure:');
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
        console.log(`   ✅ deal_stages exists with ${stages.length} records`);
        
        if (stages.length > 0) {
          console.log('   📋 Columns:', Object.keys(stages[0]).join(', '));
          console.log('   📄 Sample record:', stages[0]);
        }
      } else {
        const error = await stagesResponse.text();
        console.log(`   ❌ deal_stages error: ${error}`);
      }
    } catch (error) {
      console.log(`   ❌ deal_stages error: ${error.message}`);
    }

    // Check deals table structure
    console.log('\n🎯 Checking deals table structure:');
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
        console.log(`   ✅ deals exists with ${deals.length} records shown`);
        
        if (deals.length > 0) {
          console.log('   📋 Columns:', Object.keys(deals[0]).join(', '));
        }
      } else {
        const error = await dealsResponse.text();
        console.log(`   ❌ deals error: ${error}`);
      }
    } catch (error) {
      console.log(`   ❌ deals error: ${error.message}`);
    }

  } catch (error) {
    console.log(`❌ Schema check failed: ${error.message}`);
  }
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.log('❌ Missing environment variables. Please check your .env file.');
  console.log('Required: VITE_SUPABASE_URL, VITE_SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

checkSchema(); 