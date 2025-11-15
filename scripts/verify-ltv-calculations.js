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
    // 1. Check Activities with Proposals
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
      if (prop.deals) {
      } else {
      }
    });

    // 2. Check Pipeline Totals
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
    });
    // 3. Check Deal Creation from Activities
    // 4. Summary
  } catch (error) {
  }
}

// Run verification
verifyLTVCalculations().catch(console.error);