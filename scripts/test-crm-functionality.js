#!/usr/bin/env node

import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_p29ezkLxYgqh@ep-divine-heart-abzonafv-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require'
});

async function testCRMFunctionality() {
  try {
    await client.connect();

    // Test 1: Check deals with company relationships
    const dealsWithCompanies = await client.query(`
      SELECT 
        d.id,
        d.name as deal_name,
        d.company as legacy_company,
        c.name as normalized_company,
        c.domain as company_domain,
        d.value
      FROM deals d
      LEFT JOIN companies c ON d.company_id = c.id
      WHERE d.company_id IS NOT NULL
      LIMIT 5;
    `);
    // Test 2: Check deals with contact relationships
    const dealsWithContacts = await client.query(`
      SELECT 
        d.id,
        d.name as deal_name,
        d.contact_email as legacy_contact_email,
        ct.full_name as normalized_contact_name,
        ct.email as normalized_contact_email,
        ct.title as contact_title,
        ct.is_primary
      FROM deals d
      LEFT JOIN contacts ct ON d.primary_contact_id = ct.id
      WHERE d.primary_contact_id IS NOT NULL
      LIMIT 5;
    `);
    // Test 3: Check deal-contact many-to-many relationships
    const dealContactRelationships = await client.query(`
      SELECT 
        d.name as deal_name,
        ct.full_name as contact_name,
        ct.email as contact_email,
        dc.role as contact_role,
        comp.name as company_name
      FROM deal_contacts dc
      JOIN deals d ON dc.deal_id = d.id
      JOIN contacts ct ON dc.contact_id = ct.id
      LEFT JOIN companies comp ON ct.company_id = comp.id
      LIMIT 10;
    `);
    // Test 4: Check activities with CRM relationships
    const activitiesWithCRM = await client.query(`
      SELECT 
        a.id,
        a.type,
        a.client_name,
        ct.full_name as matched_contact,
        comp.name as matched_company,
        d.name as linked_deal,
        a.auto_matched
      FROM activities a
      LEFT JOIN contacts ct ON a.contact_id = ct.id
      LEFT JOIN companies comp ON a.company_id = comp.id
      LEFT JOIN deals d ON a.deal_id = d.id
      WHERE a.auto_matched = true
      LIMIT 5;
    `);
    // Test 5: Test the smart_process_activity function
    try {
      // Get a user ID for testing
      const user = await client.query('SELECT id FROM profiles LIMIT 1');
      if (user.rows.length > 0) {
        const userId = user.rows[0].id;
        
        // Test the function with a dummy activity
        const functionTest = await client.query(`
          SELECT smart_process_activity(
            gen_random_uuid(),
            'test@example.com',
            'meeting',
            $1,
            'Test Company',
            1000
          ) as result;
        `, [userId]);
      }
    } catch (funcError) {
    }

    // Test 6: Performance test - Complex join query similar to frontend
    const start = Date.now();
    
    const complexQuery = await client.query(`
      SELECT 
        d.*,
        ds.name as stage_name,
        ds.color as stage_color,
        ds.default_probability,
        c.name as company_name,
        c.domain as company_domain,
        c.size as company_size,
        ct.full_name as primary_contact_name,
        ct.email as primary_contact_email,
        ct.title as primary_contact_title,
        (
          SELECT COUNT(*)
          FROM deal_contacts dc 
          WHERE dc.deal_id = d.id
        ) as total_contacts
      FROM deals d
      LEFT JOIN deal_stages ds ON d.stage_id = ds.id
      LEFT JOIN companies c ON d.company_id = c.id
      LEFT JOIN contacts ct ON d.primary_contact_id = ct.id
      WHERE d.status = 'active'
      ORDER BY d.updated_at DESC
      LIMIT 10;
    `);
    
    const end = Date.now();
    // Summary
  } catch (error) {
  } finally {
    await client.end();
  }
}

testCRMFunctionality().catch(console.error); 