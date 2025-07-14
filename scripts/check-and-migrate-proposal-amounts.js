#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function checkAndMigrateProposalAmounts() {
  try {
    console.log('🔍 Checking proposal amounts and deal values...\n');

    // Step 1: Get all proposal activities
    console.log('📊 Step 1: Fetching all proposal activities');
    const { data: proposals, error: proposalError } = await supabase
      .from('activities')
      .select(`
        id,
        type,
        client_name,
        amount,
        deal_id,
        date,
        sales_rep,
        details,
        deals (
          id,
          name,
          value,
          one_off_revenue,
          monthly_mrr,
          annual_value
        )
      `)
      .eq('type', 'proposal')
      .order('date', { ascending: false });

    if (proposalError) throw proposalError;

    console.log(`Found ${proposals.length} proposal activities\n`);

    // Analyze the data
    let proposalsWithAmount = 0;
    let proposalsWithoutAmount = 0;
    let proposalsWithDeal = 0;
    let proposalsWithoutDeal = 0;
    let dealsNeedingMigration = 0;

    const migrationCandidates = [];

    proposals.forEach(proposal => {
      if (proposal.amount > 0) proposalsWithAmount++;
      else proposalsWithoutAmount++;

      if (proposal.deal_id) {
        proposalsWithDeal++;
        
        // Check if deal needs migration (has value but no revenue fields)
        if (proposal.deals) {
          const hasRevenueFields = proposal.deals.one_off_revenue || 
                                 proposal.deals.monthly_mrr || 
                                 proposal.deals.annual_value;
          
          if (!hasRevenueFields && (proposal.deals.value > 0 || proposal.amount > 0)) {
            dealsNeedingMigration++;
            migrationCandidates.push({
              proposalId: proposal.id,
              dealId: proposal.deal_id,
              proposalAmount: proposal.amount,
              dealValue: proposal.deals.value,
              clientName: proposal.client_name,
              date: proposal.date
            });
          }
        }
      } else {
        proposalsWithoutDeal++;
      }
    });

    console.log('📊 Analysis Summary:');
    console.log(`   Proposals with amount: ${proposalsWithAmount}`);
    console.log(`   Proposals without amount: ${proposalsWithoutAmount}`);
    console.log(`   Proposals linked to deals: ${proposalsWithDeal}`);
    console.log(`   Proposals without deals: ${proposalsWithoutDeal}`);
    console.log(`   Deals needing revenue field migration: ${dealsNeedingMigration}\n`);

    // Step 2: Show migration candidates
    if (migrationCandidates.length > 0) {
      console.log('🔄 Migration Candidates (Deals without revenue fields):');
      console.log('These deals have a value but no one_off_revenue/monthly_mrr/annual_value set:\n');
      
      migrationCandidates.slice(0, 10).forEach(candidate => {
        console.log(`   Client: ${candidate.clientName}`);
        console.log(`   Date: ${new Date(candidate.date).toLocaleDateString()}`);
        console.log(`   Proposal Amount: £${candidate.proposalAmount || 0}`);
        console.log(`   Deal Value: £${candidate.dealValue || 0}`);
        console.log(`   Deal ID: ${candidate.dealId}`);
        console.log('   ---');
      });

      if (migrationCandidates.length > 10) {
        console.log(`   ... and ${migrationCandidates.length - 10} more\n`);
      }
    }

    // Step 3: Get deals without activities to check their values
    console.log('\n📊 Step 2: Checking all deals for migration needs');
    const { data: allDeals, error: dealsError } = await supabase
      .from('deals')
      .select('id, name, value, one_off_revenue, monthly_mrr, annual_value, company')
      .order('created_at', { ascending: false });

    if (dealsError) throw dealsError;

    const dealsWithOldValues = allDeals.filter(deal => {
      const hasRevenueFields = deal.one_off_revenue || deal.monthly_mrr || deal.annual_value;
      return !hasRevenueFields && deal.value > 0;
    });

    console.log(`\nFound ${dealsWithOldValues.length} deals with old value field but no new revenue fields`);
    
    if (dealsWithOldValues.length > 0) {
      console.log('\nSample deals needing migration:');
      dealsWithOldValues.slice(0, 5).forEach(deal => {
        console.log(`   ${deal.name || deal.company} - Value: £${deal.value}`);
      });
    }

    // Step 4: Create migration SQL
    if (dealsWithOldValues.length > 0) {
      console.log('\n📝 Migration SQL to preserve old values:');
      console.log('-- Run this SQL to migrate old deal values to one_off_revenue field:\n');
      console.log(`UPDATE deals`);
      console.log(`SET one_off_revenue = value`);
      console.log(`WHERE value > 0`);
      console.log(`  AND one_off_revenue IS NULL`);
      console.log(`  AND monthly_mrr IS NULL`);
      console.log(`  AND annual_value IS NULL;`);
      console.log(`\n-- This will affect ${dealsWithOldValues.length} deals`);
    }

  } catch (error) {
    console.error('❌ Check failed:', error);
  }
}

// Run the check
checkAndMigrateProposalAmounts().catch(console.error);