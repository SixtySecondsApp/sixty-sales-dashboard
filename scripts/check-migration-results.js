#!/usr/bin/env node

import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_p29ezkLxYgqh@ep-divine-heart-abzonafv-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require'
});

async function checkMigrationResults() {
  try {
    await client.connect();

    // Check migration summary
    try {
      const summary = await client.query('SELECT * FROM crm_migration_summary ORDER BY entity;');
    } catch (e) {
    }

    // Manual checks
    // Check companies
    const companies = await client.query('SELECT COUNT(*) as count, COUNT(CASE WHEN domain IS NOT NULL THEN 1 END) as with_domain FROM companies');
    // Check contacts
    const contacts = await client.query('SELECT COUNT(*) as total, COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END) as with_company, COUNT(CASE WHEN owner_id IS NOT NULL THEN 1 END) as with_owner FROM contacts');
    // Check deals
    const deals = await client.query('SELECT COUNT(*) as total, COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END) as with_company, COUNT(CASE WHEN primary_contact_id IS NOT NULL THEN 1 END) as with_contact FROM deals');
    // Check activities
    const activities = await client.query('SELECT COUNT(*) as total, COUNT(CASE WHEN contact_id IS NOT NULL THEN 1 END) as with_contact, COUNT(CASE WHEN deal_id IS NOT NULL THEN 1 END) as with_deal, COUNT(CASE WHEN auto_matched = true THEN 1 END) as auto_matched FROM activities');
    // Check new relationship tables
    const dealContacts = await client.query('SELECT COUNT(*) as count FROM deal_contacts');
    const syncRules = await client.query('SELECT COUNT(*) as count FROM activity_sync_rules');
    // Sample data to verify quality
    // Show some companies with domains
    const sampleCompanies = await client.query('SELECT name, domain FROM companies WHERE domain IS NOT NULL LIMIT 5');
    if (sampleCompanies.rows.length > 0) {
    }

    // Show some contacts with companies
    const sampleContacts = await client.query(`
      SELECT c.email, c.full_name, comp.name as company_name 
      FROM contacts c 
      LEFT JOIN companies comp ON c.company_id = comp.id 
      WHERE c.company_id IS NOT NULL 
      LIMIT 5
    `);
    if (sampleContacts.rows.length > 0) {
    }

    // Show some deals with relationships
    const sampleDeals = await client.query(`
      SELECT d.name, comp.name as company_name, c.email as contact_email 
      FROM deals d 
      LEFT JOIN companies comp ON d.company_id = comp.id 
      LEFT JOIN contacts c ON d.primary_contact_id = c.id 
      WHERE d.company_id IS NOT NULL OR d.primary_contact_id IS NOT NULL 
      LIMIT 5
    `);
    if (sampleDeals.rows.length > 0) {
    }
  } catch (error) {
  } finally {
    await client.end();
  }
}

checkMigrationResults().catch(console.error); 