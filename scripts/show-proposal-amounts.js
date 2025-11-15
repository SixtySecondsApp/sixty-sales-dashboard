#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function showProposalAmounts() {
  try {
    // Get recent proposal activities with amounts
    const { data: proposals, error } = await supabase
      .from('activities')
      .select('*')
      .eq('type', 'proposal')
      .order('date', { ascending: false })
      .limit(20);

    if (error) throw error;
    proposals.forEach(proposal => {
      const date = new Date(proposal.date).toLocaleDateString('en-GB');
      const client = (proposal.client_name || 'Unknown').substring(0, 25).padEnd(25);
      const amount = proposal.amount 
        ? `£${proposal.amount.toLocaleString()}`.padEnd(9)
        : '-'.padEnd(9);
      const status = (proposal.status || 'unknown').padEnd(9);
      const details = (proposal.details || '').substring(0, 30);
    });

    // Get summary statistics
    const { data: stats, error: statsError } = await supabase
      .from('activities')
      .select('amount')
      .eq('type', 'proposal')
      .not('amount', 'is', null);

    if (!statsError && stats) {
      const total = stats.reduce((sum, p) => sum + (p.amount || 0), 0);
      const avg = total / stats.length;
      const max = Math.max(...stats.map(p => p.amount || 0));
      const min = Math.min(...stats.filter(p => p.amount > 0).map(p => p.amount));
    }

    // Check for any deals that might have been created from these proposals
    const { data: deals, error: dealsError } = await supabase
      .from('deals')
      .select('name, company, value, one_off_revenue, monthly_mrr, annual_value')
      .order('created_at', { ascending: false })
      .limit(10);

    if (!dealsError && deals && deals.length > 0) {
      deals.forEach(deal => {
        const company = (deal.company || deal.name || 'Unknown').substring(0, 24).padEnd(24);
        const oldValue = deal.value ? `£${deal.value.toLocaleString()}`.padEnd(9) : '-'.padEnd(9);
        const oneOff = deal.one_off_revenue ? `£${deal.one_off_revenue.toLocaleString()}`.padEnd(9) : '-'.padEnd(9);
        const monthly = deal.monthly_mrr ? `£${deal.monthly_mrr.toLocaleString()}`.padEnd(9) : '-'.padEnd(9);
        const annual = deal.annual_value ? `£${deal.annual_value.toLocaleString()}`.padEnd(9) : '-'.padEnd(9);
      });
    }

  } catch (error) {
  }
}

// Run the check
showProposalAmounts().catch(console.error);