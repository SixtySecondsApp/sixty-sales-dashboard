#!/usr/bin/env node

import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_p29ezkLxYgqh@ep-divine-heart-abzonafv-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require'
});

async function checkDealRelationships() {
  try {
    await client.connect();

    // Check deals with CRM relationships
    const dealStats = await client.query(`
      SELECT 
        COUNT(*) as total_deals,
        COUNT(company_id) as deals_with_company_id,
        COUNT(primary_contact_id) as deals_with_primary_contact_id,
        COUNT(CASE WHEN company_id IS NOT NULL AND primary_contact_id IS NOT NULL THEN 1 END) as fully_normalized_deals
      FROM deals;
    `);
    // Sample of deals with and without relationships
    const sampleDeals = await client.query(`
      SELECT 
        d.id,
        d.name,
        d.company as legacy_company,
        c.name as normalized_company,
        d.contact_email as legacy_contact_email,
        ct.email as normalized_contact_email,
        CASE 
          WHEN d.company_id IS NOT NULL AND d.primary_contact_id IS NOT NULL THEN 'Fully Normalized'
          WHEN d.company_id IS NOT NULL THEN 'Company Only'
          WHEN d.primary_contact_id IS NOT NULL THEN 'Contact Only'
          ELSE 'Legacy Only'
        END as crm_status
      FROM deals d
      LEFT JOIN companies c ON d.company_id = c.id
      LEFT JOIN contacts ct ON d.primary_contact_id = ct.id
      ORDER BY d.updated_at DESC
      LIMIT 10;
    `);
    // Check if we need to run linking
    const needsLinking = dealStats.rows[0].deals_with_company_id === '0';
    
    if (needsLinking) {
    } else {
    }

  } catch (error) {
  } finally {
    await client.end();
  }
}

checkDealRelationships().catch(console.error); 