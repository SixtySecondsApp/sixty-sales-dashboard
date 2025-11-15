import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

// Load environment variables from .env file
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function resetAndRegenerate() {
  try {
    // Get all leads with completed prep
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, contact_name, contact_email, domain, prep_status, enrichment_status')
      .in('prep_status', ['completed', 'in_progress'])
      .order('created_at', { ascending: false });

    if (leadsError) {
      throw leadsError;
    }

    if (!leads || leads.length === 0) {
      return;
    }
    leads.forEach((lead) => {
    });
    const leadIds = leads.map(l => l.id);

    // Delete existing prep notes
    const { error: deleteError } = await supabase
      .from('lead_prep_notes')
      .delete()
      .in('lead_id', leadIds)
      .eq('is_auto_generated', true);

    if (deleteError) {
    } else {
    }

    // Reset leads to pending
    for (const leadId of leadIds) {
      const { data: currentLead } = await supabase
        .from('leads')
        .select('metadata')
        .eq('id', leadId)
        .single();

      const metadata = (currentLead?.metadata as Record<string, unknown>) || {};
      delete metadata.prep_generated_at;
      delete metadata.prep_model;
      delete metadata.prep_ai;

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
        .eq('id', leadId);

      if (updateError) {
      }
    }
    // Wait a moment
    await new Promise(r => setTimeout(r, 1000));

    // Trigger the process-lead-prep function
    const functionUrl = `${SUPABASE_URL}/functions/v1/process-lead-prep`;
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Function call failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
  } catch (error: any) {
    if (error.details) {
    }
    process.exit(1);
  }
}

resetAndRegenerate();

