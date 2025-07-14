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
    console.log('💰 Showing Proposal Amounts in Activity Table\n');

    // Get recent proposal activities with amounts
    const { data: proposals, error } = await supabase
      .from('activities')
      .select('*')
      .eq('type', 'proposal')
      .order('date', { ascending: false })
      .limit(20);

    if (error) throw error;

    console.log('Recent Proposal Activities:\n');
    console.log('Date         | Client                    | Amount    | Status    | Details');
    console.log('-------------|---------------------------|-----------|-----------|----------------------------------');

    proposals.forEach(proposal => {
      const date = new Date(proposal.date).toLocaleDateString('en-GB');
      const client = (proposal.client_name || 'Unknown').substring(0, 25).padEnd(25);
      const amount = proposal.amount 
        ? `£${proposal.amount.toLocaleString()}`.padEnd(9)
        : '-'.padEnd(9);
      const status = (proposal.status || 'unknown').padEnd(9);
      const details = (proposal.details || '').substring(0, 30);

      console.log(`${date} | ${client} | ${amount} | ${status} | ${details}...`);
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

      console.log('\n📊 Proposal Amount Statistics:');
      console.log(`   Total proposals with amounts: ${stats.length}`);
      console.log(`   Total value: £${total.toLocaleString()}`);
      console.log(`   Average value: £${Math.round(avg).toLocaleString()}`);
      console.log(`   Highest value: £${max.toLocaleString()}`);
      console.log(`   Lowest value: £${min.toLocaleString()}`);
    }

    // Check for any deals that might have been created from these proposals
    console.log('\n🔗 Checking for Related Deals...');
    const { data: deals, error: dealsError } = await supabase
      .from('deals')
      .select('name, company, value, one_off_revenue, monthly_mrr, annual_value')
      .order('created_at', { ascending: false })
      .limit(10);

    if (!dealsError && deals && deals.length > 0) {
      console.log('\nRecent Deals (for comparison):');
      console.log('Company                   | Old Value | One-off   | Monthly   | Annual');
      console.log('--------------------------|-----------|-----------|-----------|----------');
      
      deals.forEach(deal => {
        const company = (deal.company || deal.name || 'Unknown').substring(0, 24).padEnd(24);
        const oldValue = deal.value ? `£${deal.value.toLocaleString()}`.padEnd(9) : '-'.padEnd(9);
        const oneOff = deal.one_off_revenue ? `£${deal.one_off_revenue.toLocaleString()}`.padEnd(9) : '-'.padEnd(9);
        const monthly = deal.monthly_mrr ? `£${deal.monthly_mrr.toLocaleString()}`.padEnd(9) : '-'.padEnd(9);
        const annual = deal.annual_value ? `£${deal.annual_value.toLocaleString()}`.padEnd(9) : '-'.padEnd(9);
        
        console.log(`${company} | ${oldValue} | ${oneOff} | ${monthly} | ${annual}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the check
showProposalAmounts().catch(console.error);