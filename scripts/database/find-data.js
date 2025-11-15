#!/usr/bin/env node

// Find the actual data - check different tables and RLS policies
import { config } from 'dotenv';
config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

async function queryWithKey(endpoint, params = '', useServiceKey = false) {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}${params}`;
  const key = useServiceKey ? SUPABASE_SERVICE_KEY : SUPABASE_ANON_KEY;
  const keyType = useServiceKey ? 'SERVICE' : 'ANON';
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
  // Check with anon key
  const dealsAnon = await queryWithKey('deals', '?select=count');
  // Check with service key  
  const dealsService = await queryWithKey('deals', '?select=count', true);
  const contactsAnon = await queryWithKey('contacts', '?select=count');
  const contactsService = await queryWithKey('contacts', '?select=count', true);
  const activitiesAnon = await queryWithKey('activities', '?select=count');
  const activitiesService = await queryWithKey('activities', '?select=count', true);
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
    } else if (result.status !== 404) {
    }
  }
  const profilesService = await queryWithKey('profiles', '?select=*', true);
  if (profilesService.success) {
    if (profilesService.data.length > 0) {
      const profile = profilesService.data[0];
    }
  }
  // Try a few different user IDs that might exist
  const testOwnerIds = [
    'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459', // From the error logs
    '00000000-0000-0000-0000-000000000000',
    'dev-user-123'
  ];
  
  for (const ownerId of testOwnerIds) {
    const dealsForOwner = await queryWithKey('deals', `?select=count&owner_id=eq.${ownerId}`, true);
    if (dealsForOwner.success && dealsForOwner.data?.[0]?.count > 0) {
    }
  }
  // Check actual sample data with service key
  const sampleDeals = await queryWithKey('deals', '?select=*&limit=3', true);
  if (sampleDeals.success && sampleDeals.data.length > 0) {
    const deal = sampleDeals.data[0];
  } else {
  }
  if (dealsService.success && dealsService.data?.[0]?.count > 0) {
    if (!dealsAnon.success || dealsAnon.data?.[0]?.count === 0) {
    }
  } else {
  }
}

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_KEY) {
  process.exit(1);
}

findData(); 