#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function checkPipelineCalculations() {
  try {
    console.log('🔍 Checking Pipeline Calculations...\n');

    // Get all stages
    const { data: stages, error: stagesError } = await supabase
      .from('deal_stages')
      .select('*')
      .order('order_position');

    if (stagesError) throw stagesError;

    console.log('📊 Deal Stages:');
    stages.forEach(stage => {
      console.log(`  ${stage.name} - ${stage.default_probability}% probability`);
    });

    // Get all deals with their revenue fields
    const { data: deals, error: dealsError } = await supabase
      .from('deals')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (dealsError) throw dealsError;

    console.log(`\n💰 Total Active Deals: ${deals.length}\n`);

    // Analyze revenue fields
    let dealsWithOldValue = 0;
    let dealsWithNewRevenue = 0;
    let dealsWithBoth = 0;
    let dealsWithNeither = 0;

    deals.forEach(deal => {
      const hasOldValue = deal.value > 0;
      const hasNewRevenue = (deal.one_off_revenue > 0) || (deal.monthly_mrr > 0);
      
      if (hasOldValue && !hasNewRevenue) dealsWithOldValue++;
      else if (!hasOldValue && hasNewRevenue) dealsWithNewRevenue++;
      else if (hasOldValue && hasNewRevenue) dealsWithBoth++;
      else dealsWithNeither++;
    });

    console.log('📈 Deal Revenue Analysis:');
    console.log(`  Deals with only old value field: ${dealsWithOldValue}`);
    console.log(`  Deals with new revenue fields: ${dealsWithNewRevenue}`);
    console.log(`  Deals with both: ${dealsWithBoth}`);
    console.log(`  Deals with neither: ${dealsWithNeither}`);

    // Calculate totals by stage
    console.log('\n💎 Pipeline Totals by Stage:');
    
    for (const stage of stages) {
      const stageDeals = deals.filter(d => d.stage_id === stage.id);
      
      if (stageDeals.length > 0) {
        const totalValue = stageDeals.reduce((sum, deal) => sum + (deal.value || 0), 0);
        const weightedValue = totalValue * (stage.default_probability / 100);
        
        console.log(`\n${stage.name}:`);
        console.log(`  Deals: ${stageDeals.length}`);
        console.log(`  Total Value: £${totalValue.toLocaleString()}`);
        console.log(`  Weighted Value (${stage.default_probability}%): £${weightedValue.toLocaleString()}`);
        
        // Show sample deals
        const sampleDeals = stageDeals.slice(0, 3);
        if (sampleDeals.length > 0) {
          console.log('  Sample deals:');
          sampleDeals.forEach(deal => {
            console.log(`    - ${deal.name}: £${deal.value} (One-off: £${deal.one_off_revenue || 0}, MRR: £${deal.monthly_mrr || 0})`);
          });
        }
      }
    }

    // Check for calculation mismatches
    console.log('\n⚠️  Checking for Calculation Mismatches:');
    const mismatches = deals.filter(deal => {
      if (deal.one_off_revenue > 0 || deal.monthly_mrr > 0) {
        const expectedValue = (deal.one_off_revenue || 0) + ((deal.monthly_mrr || 0) * 3);
        return Math.abs(deal.value - expectedValue) > 0.01;
      }
      return false;
    });

    if (mismatches.length > 0) {
      console.log(`Found ${mismatches.length} deals with incorrect value calculations:`);
      mismatches.slice(0, 5).forEach(deal => {
        const expectedValue = (deal.one_off_revenue || 0) + ((deal.monthly_mrr || 0) * 3);
        console.log(`  - ${deal.name}: Current £${deal.value}, Expected £${expectedValue}`);
      });
    } else {
      console.log('  ✅ All deal values are correctly calculated!');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the check
checkPipelineCalculations().catch(console.error);