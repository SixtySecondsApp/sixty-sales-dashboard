/**
 * Clear all lead and company enrichments and re-run them
 * This script removes all enrichment data and triggers fresh enrichment
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function clearAndRerunEnrichments() {
  try {
    // Step 1: Get all leads
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, contact_name, contact_email, domain, prep_status, enrichment_status, company_id')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (leadsError) {
      throw leadsError;
    }

    if (!leads || leads.length === 0) {
    } else {
    }

    // Step 2: Delete all auto-generated prep notes
    if (leads && leads.length > 0) {
      const leadIds = leads.map(l => l.id);
      
      const { error: deleteNotesError } = await supabase
        .from('lead_prep_notes')
        .delete()
        .in('lead_id', leadIds)
        .eq('is_auto_generated', true);

      if (deleteNotesError) {
      } else {
      }
    }

    // Step 3: Reset all leads to pending status
    if (leads && leads.length > 0) {
      for (const lead of leads) {
        // Get current metadata
        const { data: currentLead } = await supabase
          .from('leads')
          .select('metadata')
          .eq('id', lead.id)
          .single();

        const metadata = (currentLead?.metadata as Record<string, unknown>) || {};
        // Remove all enrichment-related metadata fields
        delete metadata.prep_generated_at;
        delete metadata.prep_model;
        delete metadata.prep_ai;
        delete metadata.prep_failed_at;
        delete metadata.prep_last_error;

        const { error: updateError } = await supabase
          .from('leads')
          .update({
            prep_status: 'pending',
            enrichment_status: 'pending',
            prep_summary: null,
            enrichment_provider: null,
            metadata,
            updated_at: new Date().toISOString(),
          })
          .eq('id', lead.id);

        if (updateError) {
        }
      }
    }

    // Step 4: Get all companies with domains
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('id, name, domain')
      .not('domain', 'is', null)
      .neq('domain', '')
      .order('name', { ascending: true });

    if (companiesError) {
      throw companiesError;
    }

    if (!companies || companies.length === 0) {
    } else {
    }

    // Step 5: Clear company enrichment data
    if (companies && companies.length > 0) {
      const { error: clearCompaniesError } = await supabase
        .from('companies')
        .update({
          description: null,
          industry: null,
          size: null,
          phone: null,
          address: null,
          linkedin_url: null,
          updated_at: new Date().toISOString(),
        })
        .not('domain', 'is', null)
        .neq('domain', '');

      if (clearCompaniesError) {
      } else {
      }
    }

    // Step 6: Wait a moment before triggering re-enrichment
    await new Promise(r => setTimeout(r, 2000));

    // Step 7: Trigger company enrichment for all companies
    if (companies && companies.length > 0) {
      const enrichUrl = `${SUPABASE_URL}/functions/v1/enrich-company`;
      
      let enrichedCount = 0;
      let failedCount = 0;

      // Process companies in batches to avoid rate limiting
      const batchSize = 5;
      for (let i = 0; i < companies.length; i += batchSize) {
        const batch = companies.slice(i, i + batchSize);
        
        await Promise.all(
          batch.map(async (company) => {
            try {
              const response = await fetch(enrichUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                },
                body: JSON.stringify({ company_id: company.id }),
              });

              if (response.ok) {
                enrichedCount++;
              } else {
                failedCount++;
                const errorText = await response.text();
              }
            } catch (error: any) {
              failedCount++;
            }
          })
        );

        // Wait between batches to avoid rate limiting
        if (i + batchSize < companies.length) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }

    // Step 8: Trigger lead prep processing
    if (leads && leads.length > 0) {
      const prepUrl = `${SUPABASE_URL}/functions/v1/process-lead-prep`;
      
      const response = await fetch(prepUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Lead prep function call failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
    }
  } catch (error: any) {
    if (error.details) {
    }
    if (error.stack) {
    }
    process.exit(1);
  }
}

clearAndRerunEnrichments();







