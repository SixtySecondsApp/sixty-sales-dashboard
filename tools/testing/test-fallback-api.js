#!/usr/bin/env node

// Test the fallback mechanism directly via Supabase client
import { config } from 'dotenv';
config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

console.log('🧪 Testing Fallback API Mechanism');
console.log(`📍 Database: ${SUPABASE_URL}`);
console.log('');

async function testSupabaseRest(endpoint, params = '') {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}${params}`;
  
  console.log(`🔄 GET ${url}`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    return {
      success: response.ok,
      status: response.status,
      data,
      url
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      url
    };
  }
}

async function runFallbackTests() {
  console.log('1️⃣ Testing deal_stages (should work):');
  const stagesResult = await testSupabaseRest('deal_stages', '?select=*&order=order_position.asc&limit=10');
  
  if (stagesResult.success) {
    console.log(`   ✅ Found ${stagesResult.data.length} stages`);
    if (stagesResult.data.length > 0) {
      console.log(`   📄 Sample: ${stagesResult.data[0].name} (${stagesResult.data[0].color})`);
    }
  } else {
    console.log(`   ❌ Failed: ${stagesResult.status} - ${JSON.stringify(stagesResult.data)}`);
  }

  console.log('\n2️⃣ Testing deals (should work):');
  const dealsResult = await testSupabaseRest('deals', '?select=*&limit=5');
  
  if (dealsResult.success) {
    console.log(`   ✅ Found ${dealsResult.data.length} deals`);
    if (dealsResult.data.length > 0) {
      console.log(`   📄 Sample: ${dealsResult.data[0].name || 'Unnamed'}`);
    }
  } else {
    console.log(`   ❌ Failed: ${dealsResult.status} - ${JSON.stringify(dealsResult.data)}`);
  }

  console.log('\n3️⃣ Testing deals with deal_stages join:');
  const dealsWithStagesResult = await testSupabaseRest('deals', '?select=*,deal_stages(*)&limit=3');
  
  if (dealsWithStagesResult.success) {
    console.log(`   ✅ Found ${dealsWithStagesResult.data.length} deals with stages`);
    if (dealsWithStagesResult.data.length > 0) {
      const deal = dealsWithStagesResult.data[0];
      console.log(`   📄 Deal "${deal.name}" has stage: ${deal.deal_stages?.name || 'No stage'}`);
    }
  } else {
    console.log(`   ❌ Failed: ${dealsWithStagesResult.status} - ${JSON.stringify(dealsWithStagesResult.data)}`);
  }

  console.log('\n4️⃣ Testing contacts (should work):');
  const contactsResult = await testSupabaseRest('contacts', '?select=*&limit=5');
  
  if (contactsResult.success) {
    console.log(`   ✅ Found ${contactsResult.data.length} contacts`);
    if (contactsResult.data.length > 0) {
      const contact = contactsResult.data[0];
      console.log(`   📄 Sample: ${contact.full_name || contact.first_name || contact.email || 'Unnamed'}`);
      console.log(`   📋 Available columns: ${Object.keys(contact).join(', ')}`);
    }
  } else {
    console.log(`   ❌ Failed: ${contactsResult.status} - ${JSON.stringify(contactsResult.data)}`);
  }

  console.log('\n5️⃣ Testing companies (expected to fail):');
  const companiesResult = await testSupabaseRest('companies', '?select=*&limit=5');
  
  if (companiesResult.success) {
    console.log(`   ✅ Found ${companiesResult.data.length} companies`);
  } else {
    console.log(`   ❌ Expected failure: ${companiesResult.status} - companies table doesn't exist`);
  }

  // Summary
  const tests = [stagesResult, dealsResult, dealsWithStagesResult, contactsResult];
  const passed = tests.filter(t => t.success).length;
  
  console.log(`\n📊 Fallback API Summary:`);
  console.log(`   ✅ Passed: ${passed}/4 core tests`);
  console.log(`   ❌ Companies: Expected to fail (table missing)`);
  
  if (passed >= 3) {
    console.log(`   🎉 Fallback mechanism should work for core functionality!`);
  } else {
    console.log(`   ⚠️  Fallback mechanism has issues that need fixing.`);
  }
}

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.log('❌ Missing environment variables.');
  process.exit(1);
}

runFallbackTests(); 