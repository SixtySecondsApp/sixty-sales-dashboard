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
    // Step 1: Get all proposal activities
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
    // Step 2: Show migration candidates
    if (migrationCandidates.length > 0) {
      migrationCandidates.slice(0, 10).forEach(candidate => {
      });

      if (migrationCandidates.length > 10) {
      }
    }

    // Step 3: Get deals without activities to check their values
    const { data: allDeals, error: dealsError } = await supabase
      .from('deals')
      .select('id, name, value, one_off_revenue, monthly_mrr, annual_value, company')
      .order('created_at', { ascending: false });

    if (dealsError) throw dealsError;

    const dealsWithOldValues = allDeals.filter(deal => {
      const hasRevenueFields = deal.one_off_revenue || deal.monthly_mrr || deal.annual_value;
      return !hasRevenueFields && deal.value > 0;
    });
    if (dealsWithOldValues.length > 0) {
      dealsWithOldValues.slice(0, 5).forEach(deal => {
      });
    }

    // Step 4: Create migration SQL
    if (dealsWithOldValues.length > 0) {
    }

  } catch (error) {
  }
}

// Run the check
checkAndMigrateProposalAmounts().catch(console.error);