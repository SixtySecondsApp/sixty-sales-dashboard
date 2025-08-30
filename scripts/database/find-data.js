#!/usr/bin/env node

// Find the actual data - check different tables and RLS policies
import { config } from 'dotenv';
config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 Finding Data - Where is it hiding?');
console.log(`📍 Database: ${SUPABASE_URL}`);
console.log('');

async function queryWithKey(endpoint, params = '', useServiceKey = false) {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}${params}`;
  const key = useServiceKey ? SUPABASE_SERVICE_KEY : SUPABASE_ANON_KEY;
  const keyType = useServiceKey ? 'SERVICE' : 'ANON';
  
  console.log(`🔄 ${keyType} GET ${url}`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${key}`,
        'apikey': key,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    return {
      success: response.ok,
      status: response.status,
      data,
      url,
      keyType
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      url,
      keyType
    };
  }
}

async function findData() {
  
  console.log('1️⃣ Checking deals table with both keys:\n');
  
  // Check with anon key
  const dealsAnon = await queryWithKey('deals', '?select=count');
  console.log(`   ANON key result: ${dealsAnon.success ? `${dealsAnon.data?.[0]?.count || 0} records` : `FAILED - ${dealsAnon.status}`}`);
  
  // Check with service key  
  const dealsService = await queryWithKey('deals', '?select=count', true);
  console.log(`   SERVICE key result: ${dealsService.success ? `${dealsService.data?.[0]?.count || 0} records` : `FAILED - ${dealsService.status}`}`);

  console.log('\n2️⃣ Checking contacts table with both keys:\n');
  
  const contactsAnon = await queryWithKey('contacts', '?select=count');
  console.log(`   ANON key result: ${contactsAnon.success ? `${contactsAnon.data?.[0]?.count || 0} records` : `FAILED - ${contactsAnon.status}`}`);
  
  const contactsService = await queryWithKey('contacts', '?select=count', true);
  console.log(`   SERVICE key result: ${contactsService.success ? `${contactsService.data?.[0]?.count || 0} records` : `FAILED - ${contactsService.status}`}`);

  console.log('\n3️⃣ Checking activities table:\n');
  
  const activitiesAnon = await queryWithKey('activities', '?select=count');
  console.log(`   ANON key result: ${activitiesAnon.success ? `${activitiesAnon.data?.[0]?.count || 0} records` : `FAILED - ${activitiesAnon.status}`}`);
  
  const activitiesService = await queryWithKey('activities', '?select=count', true);
  console.log(`   SERVICE key result: ${activitiesService.success ? `${activitiesService.data?.[0]?.count || 0} records` : `FAILED - ${activitiesService.status}`}`);

  console.log('\n4️⃣ Looking for other possible table names:\n');
  
  const possibleTables = [
    'deal_activities',
    'sales_activities', 
    'crm_deals',
    'pipeline_deals',
    'neon_deals',
    'legacy_deals'
  ];
  
  for (const tableName of possibleTables) {
    const result = await queryWithKey(tableName, '?select=count', true);
    if (result.success) {
      console.log(`   ✅ Found table: ${tableName} with ${result.data?.[0]?.count || 0} records`);
    } else if (result.status !== 404) {
      console.log(`   ⚠️  ${tableName}: ${result.status} error`);
    }
  }

  console.log('\n5️⃣ Checking profiles table (user data):\n');
  
  const profilesService = await queryWithKey('profiles', '?select=*', true);
  if (profilesService.success) {
    console.log(`   ✅ Found ${profilesService.data.length} profiles/users`);
    if (profilesService.data.length > 0) {
      const profile = profilesService.data[0];
      console.log(`   👤 Sample user: ${profile.full_name || profile.username || profile.id}`);
      console.log(`   📋 Profile columns: ${Object.keys(profile).join(', ')}`);
    }
  }

  console.log('\n6️⃣ Looking for deals with specific owner_id:\n');
  
  // Try a few different user IDs that might exist
  const testOwnerIds = [
    'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459', // From the error logs
    '00000000-0000-0000-0000-000000000000',
    'dev-user-123'
  ];
  
  for (const ownerId of testOwnerIds) {
    const dealsForOwner = await queryWithKey('deals', `?select=count&owner_id=eq.${ownerId}`, true);
    if (dealsForOwner.success && dealsForOwner.data?.[0]?.count > 0) {
      console.log(`   ✅ Found ${dealsForOwner.data[0].count} deals for owner: ${ownerId}`);
    }
  }

  console.log('\n7️⃣ Checking for RLS policies:\n');
  
  // Check actual sample data with service key
  const sampleDeals = await queryWithKey('deals', '?select=*&limit=3', true);
  if (sampleDeals.success && sampleDeals.data.length > 0) {
    console.log(`   ✅ Found ${sampleDeals.data.length} sample deals with SERVICE key`);
    const deal = sampleDeals.data[0];
    console.log(`   📄 Sample deal: "${deal.name}" (owner: ${deal.owner_id})`);
    console.log(`   📋 Deal columns: ${Object.keys(deal).join(', ')}`);
  } else {
    console.log(`   ❌ No deals found even with SERVICE key: ${sampleDeals.status}`);
  }

  console.log('\n8️⃣ Summary & Diagnosis:\n');
  
  if (dealsService.success && dealsService.data?.[0]?.count > 0) {
    console.log(`   🎯 DATA FOUND: ${dealsService.data[0].count} deals exist in the database`);
    if (!dealsAnon.success || dealsAnon.data?.[0]?.count === 0) {
      console.log(`   🔒 RLS ISSUE: Service key sees data, anon key doesn't`);
      console.log(`   💡 SOLUTION: Check RLS policies or user authentication`);
    }
  } else {
    console.log(`   ❌ NO DATA: Deals table is actually empty`);
    console.log(`   💡 SOLUTION: Data might be in a different table or needs to be imported`);
  }
}

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_KEY) {
  console.log('❌ Missing environment variables.');
  process.exit(1);
}

findData(); 