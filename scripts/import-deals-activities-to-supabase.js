#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pkg;

// Supabase client with service role (admin permissions)
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Neon client (where our data is)
const neonClient = new Client({
  connectionString: 'postgresql://neondb_owner:npg_p29ezkLxYgqh@ep-divine-heart-abzonafv-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require'
});

async function importDealsAndActivities() {
  try {
    // Connect to Neon
    await neonClient.connect();
    
    // Step 1: Import deal stages first
    await importDealStages();
    
    // Step 2: Import deals
    await importDeals();
    
    // Step 3: Import activities
    await importActivities();
  } catch (error) {
  } finally {
    await neonClient.end();
  }
}

async function importDealStages() {
  try {
    // Get stages from Neon (they might be called "stages" or "deal_stages")
    let stagesResult;
    try {
      stagesResult = await neonClient.query(`
        SELECT 
          id,
          name,
          color,
          position,
          is_closed,
          created_at,
          updated_at
        FROM stages
        ORDER BY position
      `);
    } catch (error) {
      // Try deal_stages table
      stagesResult = await neonClient.query(`
        SELECT 
          id,
          name,
          color,
          position,
          is_closed,
          created_at,
          updated_at
        FROM deal_stages
        ORDER BY position
      `);
    }
    // Import to Supabase
    let importedCount = 0;
    let errors = 0;
    
    for (const stage of stagesResult.rows) {
      const { data, error } = await supabase
        .from('deal_stages')
        .upsert(stage, { 
          onConflict: 'id',
          ignoreDuplicates: false 
        });
      
      if (error) {
        errors++;
      } else {
        importedCount++;
      }
    }
  } catch (error) {
  }
}

async function importDeals() {
  try {
    // Get deals from Neon
    const dealsResult = await neonClient.query(`
      SELECT 
        id,
        name,
        value,
        stage_id,
        owner_id,
        company_id,
        primary_contact_id,
        probability,
        expected_close_date,
        notes,
        deal_size,
        next_steps,
        lead_source,
        priority,
        company,
        contact_name,
        contact_email,
        contact_phone,
        status,
        created_at,
        updated_at,
        stage_changed_at
      FROM deals
      ORDER BY created_at
    `);
    // Import deals to Supabase in batches
    const batchSize = 50;
    let importedCount = 0;
    let errors = 0;
    
    for (let i = 0; i < dealsResult.rows.length; i += batchSize) {
      const batch = dealsResult.rows.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('deals')
        .upsert(batch, { 
          onConflict: 'id',
          ignoreDuplicates: false 
        });
      
      if (error) {
        errors++;
      } else {
        importedCount += batch.length;
      }
    }
  } catch (error) {
  }
}

async function importActivities() {
  try {
    // Get activities from Neon
    const activitiesResult = await neonClient.query(`
      SELECT 
        id,
        user_id,
        type,
        status,
        priority,
        client_name,
        sales_rep,
        details,
        amount,
        date,
        quantity,
        contact_identifier,
        contact_identifier_type,
        contact_id,
        company_id,
        deal_id,
        auto_matched,
        created_at,
        updated_at
      FROM activities
      ORDER BY created_at
    `);
    // Import activities to Supabase in batches
    const batchSize = 100;
    let importedCount = 0;
    let errors = 0;
    
    for (let i = 0; i < activitiesResult.rows.length; i += batchSize) {
      const batch = activitiesResult.rows.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('activities')
        .upsert(batch, { 
          onConflict: 'id',
          ignoreDuplicates: false 
        });
      
      if (error) {
        errors++;
      } else {
        importedCount += batch.length;
      }
    }
  } catch (error) {
  }
}

importDealsAndActivities(); 