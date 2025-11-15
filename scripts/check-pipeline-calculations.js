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
    // Get all stages
    const { data: stages, error: stagesError } = await supabase
      .from('deal_stages')
      .select('*')
      .order('order_position');

    if (stagesError) throw stagesError;
    stages.forEach(stage => {
    });

    // Get all deals with their revenue fields
    const { data: deals, error: dealsError } = await supabase
      .from('deals')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (dealsError) throw dealsError;
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
    // Calculate totals by stage
    for (const stage of stages) {
      const stageDeals = deals.filter(d => d.stage_id === stage.id);
      
      if (stageDeals.length > 0) {
        const totalValue = stageDeals.reduce((sum, deal) => sum + (deal.value || 0), 0);
        const weightedValue = totalValue * (stage.default_probability / 100);
        // Show sample deals
        const sampleDeals = stageDeals.slice(0, 3);
        if (sampleDeals.length > 0) {
          sampleDeals.forEach(deal => {
          });
        }
      }
    }

    // Check for calculation mismatches
    const mismatches = deals.filter(deal => {
      if (deal.one_off_revenue > 0 || deal.monthly_mrr > 0) {
        const expectedValue = (deal.one_off_revenue || 0) + ((deal.monthly_mrr || 0) * 3);
        return Math.abs(deal.value - expectedValue) > 0.01;
      }
      return false;
    });

    if (mismatches.length > 0) {
      mismatches.slice(0, 5).forEach(deal => {
        const expectedValue = (deal.one_off_revenue || 0) + ((deal.monthly_mrr || 0) * 3);
      });
    } else {
    }

  } catch (error) {
  }
}

// Run the check
checkPipelineCalculations().catch(console.error);