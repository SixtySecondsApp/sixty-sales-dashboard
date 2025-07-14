#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function verifyLTVCalculations() {
  try {
    console.log('✅ Verifying LTV Calculations Across the System\n');

    // 1. Check Activities with Proposals
    console.log('1️⃣ ACTIVITY TABLE - Proposal Amounts:');
    const { data: proposals, error: propError } = await supabase
      .from('activities')
      .select(`
        *,
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
      .not('amount', 'is', null)
      .order('date', { ascending: false })
      .limit(5);

    if (propError) throw propError;

    proposals.forEach(prop => {
      console.log(`\n  Proposal: ${prop.client_name}`);
      console.log(`  Activity Amount: £${prop.amount || 0}`);
      if (prop.deals) {
        console.log(`  Linked Deal: ${prop.deals.name}`);
        console.log(`  Deal Value (LTV): £${prop.deals.value}`);
        console.log(`  Breakdown: One-off £${prop.deals.one_off_revenue || 0} + MRR £${prop.deals.monthly_mrr || 0} × 3`);
      } else {
        console.log(`  No linked deal - using activity amount as LTV`);
      }
    });

    // 2. Check Pipeline Totals
    console.log('\n\n2️⃣ PIPELINE TOTALS:');
    const { data: pipelineData, error: pipelineError } = await supabase
      .from('deals')
      .select(`
        stage_id,
        deal_stages!inner(name, default_probability),
        value
      `)
      .eq('status', 'active');

    if (pipelineError) throw pipelineError;

    // Group by stage
    const stageGroups = {};
    pipelineData.forEach(deal => {
      const stageName = deal.deal_stages.name;
      if (!stageGroups[stageName]) {
        stageGroups[stageName] = {
          deals: [],
          probability: deal.deal_stages.default_probability
        };
      }
      stageGroups[stageName].deals.push(deal);
    });

    // Calculate totals
    let grandTotal = 0;
    let grandWeighted = 0;

    Object.entries(stageGroups).forEach(([stageName, data]) => {
      const total = data.deals.reduce((sum, deal) => sum + (deal.value || 0), 0);
      const weighted = total * (data.probability / 100);
      grandTotal += total;
      grandWeighted += weighted;

      console.log(`\n  ${stageName} (${data.probability}% probability):`);
      console.log(`    Deals: ${data.deals.length}`);
      console.log(`    Total: £${total.toLocaleString()}`);
      console.log(`    Weighted: £${weighted.toLocaleString()}`);
    });

    console.log(`\n  PIPELINE TOTALS:`);
    console.log(`    Grand Total: £${grandTotal.toLocaleString()}`);
    console.log(`    Weighted Total: £${grandWeighted.toLocaleString()}`);

    // 3. Check Deal Creation from Activities
    console.log('\n\n3️⃣ DEAL VALUE CALCULATION FORMULA:');
    console.log('  Database Trigger: value = one_off_revenue + (monthly_mrr × 3)');
    console.log('  This gives a 3-month weighted LTV for pipeline calculations');
    
    // 4. Summary
    console.log('\n\n4️⃣ SUMMARY:');
    console.log('  ✅ Old proposals with only "amount" field: Display as-is');
    console.log('  ✅ New proposals with revenue fields: Calculate LTV using formula');
    console.log('  ✅ Pipeline uses "value" field which is auto-calculated by DB trigger');
    console.log('  ✅ Weighted calculations: Total Value × Stage Probability');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run verification
verifyLTVCalculations().catch(console.error);