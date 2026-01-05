/**
 * Deal Truth Service
 *
 * Manages the 6 core "Deal Truth" fields that answer "do we actually know this deal?":
 * - pain: What is the customer's pain point?
 * - success_metric: How will they measure success?
 * - champion: Who is the internal champion?
 * - economic_buyer: Who controls the budget?
 * - next_step: What's the next dated step?
 * - top_risks: What are the top risks?
 *
 * Includes clarity scoring (0-100) and integration with momentum scoring.
 */

import { supabase } from '@/lib/supabase/clientV2';

// =====================================================
// Types
// =====================================================

export type TruthFieldKey =
  | 'pain'
  | 'success_metric'
  | 'champion'
  | 'economic_buyer'
  | 'next_step'
  | 'top_risks';

export type TruthFieldSource =
  | 'meeting_transcript'
  | 'email'
  | 'crm_sync'
  | 'manual'
  | 'ai_inferred';

export type ChampionStrength = 'strong' | 'moderate' | 'weak' | 'unknown';

export interface DealTruthField {
  id: string;
  deal_id: string;
  org_id: string;
  field_key: TruthFieldKey;
  value: string | null;
  confidence: number; // 0.00-1.00
  source: TruthFieldSource | null;
  source_id: string | null;
  contact_id: string | null;
  champion_strength: ChampionStrength | null;
  next_step_date: string | null; // ISO date string
  last_updated_at: string;
  created_at: string;
}

export interface DealClarityScore {
  id: string;
  deal_id: string;
  org_id: string;
  clarity_score: number;
  next_step_score: number;
  economic_buyer_score: number;
  champion_score: number;
  success_metric_score: number;
  risks_score: number;
  close_plan_completed: number;
  close_plan_total: number;
  close_plan_overdue: number;
  momentum_score: number;
  last_calculated_at: string;
}

export interface TruthFieldUpsertInput {
  deal_id: string;
  org_id: string;
  field_key: TruthFieldKey;
  value: string;
  confidence?: number;
  source?: TruthFieldSource;
  source_id?: string;
  contact_id?: string;
  champion_strength?: ChampionStrength;
  next_step_date?: string;
}

export interface DealTruthSnapshot {
  field_key: TruthFieldKey;
  value: string | null;
  confidence: number;
  source: TruthFieldSource | null;
  contact_name: string | null;
  champion_strength: ChampionStrength | null;
  next_step_date: string | null;
}

export interface DealNeedingAttention {
  deal_id: string;
  deal_name: string;
  company_name: string | null;
  deal_value: number;
  deal_stage: string | null;
  clarity_score: number;
  momentum_score: number;
  health_status: string;
  risk_level: string;
  close_plan_progress: number;
  owner_user_id: string;
}

// =====================================================
// Field Metadata
// =====================================================

export const TRUTH_FIELD_METADATA: Record<TruthFieldKey, {
  label: string;
  description: string;
  maxPoints: number;
  priority: number;
}> = {
  next_step: {
    label: 'Next Step',
    description: 'What is the next concrete, dated action?',
    maxPoints: 30,
    priority: 1,
  },
  economic_buyer: {
    label: 'Economic Buyer',
    description: 'Who controls the budget and can approve the purchase?',
    maxPoints: 25,
    priority: 2,
  },
  champion: {
    label: 'Champion',
    description: 'Who is advocating for this solution internally?',
    maxPoints: 20,
    priority: 3,
  },
  success_metric: {
    label: 'Success Metric',
    description: 'How will the customer measure if the solution is working?',
    maxPoints: 15,
    priority: 4,
  },
  pain: {
    label: 'Pain Point',
    description: 'What problem is the customer trying to solve?',
    maxPoints: 0, // Not scored but important for context
    priority: 5,
  },
  top_risks: {
    label: 'Top Risks',
    description: 'What could prevent this deal from closing?',
    maxPoints: 10,
    priority: 6,
  },
};

// =====================================================
// CRUD Operations
// =====================================================

/**
 * Get all truth fields for a deal
 */
export async function getDealTruthFields(dealId: string): Promise<DealTruthField[]> {
  const { data, error } = await supabase
    .from('deal_truth_fields')
    .select('*')
    .eq('deal_id', dealId)
    .order('field_key');

  if (error) {
    console.error('Error fetching deal truth fields:', error);
    return [];
  }

  return data || [];
}

/**
 * Get a specific truth field for a deal
 */
export async function getDealTruthField(
  dealId: string,
  fieldKey: TruthFieldKey
): Promise<DealTruthField | null> {
  const { data, error } = await supabase
    .from('deal_truth_fields')
    .select('*')
    .eq('deal_id', dealId)
    .eq('field_key', fieldKey)
    .maybeSingle();

  if (error) {
    console.error('Error fetching deal truth field:', error);
    return null;
  }

  return data;
}

/**
 * Upsert a truth field (create or update)
 */
export async function upsertDealTruthField(
  input: TruthFieldUpsertInput
): Promise<DealTruthField | null> {
  const { data, error } = await supabase
    .from('deal_truth_fields')
    .upsert(
      {
        deal_id: input.deal_id,
        org_id: input.org_id,
        field_key: input.field_key,
        value: input.value,
        confidence: input.confidence ?? 0.5,
        source: input.source ?? 'manual',
        source_id: input.source_id,
        contact_id: input.contact_id,
        champion_strength: input.champion_strength,
        next_step_date: input.next_step_date,
      },
      { onConflict: 'deal_id,field_key' }
    )
    .select()
    .single();

  if (error) {
    console.error('Error upserting deal truth field:', error);
    return null;
  }

  return data;
}

/**
 * Update confidence only (used when user confirms/denies via Slack)
 */
export async function updateTruthFieldConfidence(
  dealId: string,
  fieldKey: TruthFieldKey,
  confidence: number,
  source: TruthFieldSource = 'manual'
): Promise<boolean> {
  const { error } = await supabase
    .from('deal_truth_fields')
    .update({
      confidence: Math.max(0, Math.min(1, confidence)),
      source,
    })
    .eq('deal_id', dealId)
    .eq('field_key', fieldKey);

  if (error) {
    console.error('Error updating truth field confidence:', error);
    return false;
  }

  return true;
}

/**
 * Bulk upsert multiple fields at once (e.g., from meeting extraction)
 */
export async function bulkUpsertDealTruthFields(
  inputs: TruthFieldUpsertInput[]
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const input of inputs) {
    const result = await upsertDealTruthField(input);
    if (result) {
      success++;
    } else {
      failed++;
    }
  }

  return { success, failed };
}

/**
 * Delete a truth field
 */
export async function deleteDealTruthField(
  dealId: string,
  fieldKey: TruthFieldKey
): Promise<boolean> {
  const { error } = await supabase
    .from('deal_truth_fields')
    .delete()
    .eq('deal_id', dealId)
    .eq('field_key', fieldKey);

  if (error) {
    console.error('Error deleting deal truth field:', error);
    return false;
  }

  return true;
}

// =====================================================
// Clarity Score Operations
// =====================================================

/**
 * Get clarity score for a deal
 */
export async function getDealClarityScore(dealId: string): Promise<DealClarityScore | null> {
  const { data, error } = await supabase
    .from('deal_clarity_scores')
    .select('*')
    .eq('deal_id', dealId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching deal clarity score:', error);
    return null;
  }

  return data;
}

/**
 * Manually trigger clarity score recalculation
 * (Usually triggered automatically via database trigger)
 */
export async function recalculateDealClarityScore(
  dealId: string,
  orgId: string
): Promise<boolean> {
  const { error } = await supabase.rpc('upsert_deal_clarity_score', {
    p_deal_id: dealId,
    p_org_id: orgId,
  });

  if (error) {
    console.error('Error recalculating clarity score:', error);
    return false;
  }

  return true;
}

/**
 * Calculate clarity score client-side (for preview/validation)
 */
export function calculateClientSideClarityScore(fields: DealTruthField[]): {
  total: number;
  breakdown: Record<TruthFieldKey, number>;
} {
  const breakdown: Record<TruthFieldKey, number> = {
    pain: 0,
    success_metric: 0,
    champion: 0,
    economic_buyer: 0,
    next_step: 0,
    top_risks: 0,
  };

  for (const field of fields) {
    if (!field.value || field.value.trim() === '') continue;

    switch (field.field_key) {
      case 'next_step':
        if (field.next_step_date) {
          breakdown.next_step = 30;
        } else {
          breakdown.next_step = 15;
        }
        break;

      case 'economic_buyer':
        if (field.contact_id) {
          breakdown.economic_buyer = 25;
        } else if (field.confidence >= 0.8) {
          breakdown.economic_buyer = 20;
        } else if (field.confidence >= 0.5) {
          breakdown.economic_buyer = 12;
        } else {
          breakdown.economic_buyer = 5;
        }
        break;

      case 'champion':
        if (field.contact_id) {
          if (field.champion_strength === 'strong') {
            breakdown.champion = 20;
          } else if (field.champion_strength === 'moderate') {
            breakdown.champion = 15;
          } else if (field.champion_strength === 'weak') {
            breakdown.champion = 10;
          } else {
            breakdown.champion = 8;
          }
        } else {
          breakdown.champion = 5;
        }
        break;

      case 'success_metric':
        if (field.confidence >= 0.7) {
          breakdown.success_metric = 15;
        } else if (field.confidence >= 0.4) {
          breakdown.success_metric = 10;
        } else {
          breakdown.success_metric = 5;
        }
        break;

      case 'top_risks':
        breakdown.top_risks = 10;
        break;

      case 'pain':
        // Not scored but tracked
        breakdown.pain = 0;
        break;
    }
  }

  const total = Object.values(breakdown).reduce((sum, score) => sum + score, 0);

  return { total, breakdown };
}

// =====================================================
// Snapshot Operations (for Slack cards)
// =====================================================

/**
 * Get deal truth snapshot using the database function
 */
export async function getDealTruthSnapshot(dealId: string): Promise<DealTruthSnapshot[]> {
  const { data, error } = await supabase.rpc('get_deal_truth_snapshot', {
    p_deal_id: dealId,
  });

  if (error) {
    console.error('Error fetching deal truth snapshot:', error);
    return [];
  }

  return data || [];
}

/**
 * Get deals needing attention (low clarity or at risk)
 */
export async function getDealsNeedingAttention(
  orgId: string,
  options?: {
    userId?: string;
    minClarityScore?: number;
    limit?: number;
  }
): Promise<DealNeedingAttention[]> {
  const { data, error } = await supabase.rpc('get_deals_needing_attention', {
    p_org_id: orgId,
    p_user_id: options?.userId ?? null,
    p_min_clarity_score: options?.minClarityScore ?? 50,
    p_limit: options?.limit ?? 10,
  });

  if (error) {
    console.error('Error fetching deals needing attention:', error);
    return [];
  }

  return data || [];
}

// =====================================================
// Low Confidence Field Detection
// =====================================================

/**
 * Get fields with low confidence that need clarification
 */
export async function getLowConfidenceFields(
  dealId: string,
  threshold: number = 0.6
): Promise<DealTruthField[]> {
  const { data, error } = await supabase
    .from('deal_truth_fields')
    .select('*')
    .eq('deal_id', dealId)
    .lt('confidence', threshold)
    .not('value', 'is', null)
    .order('confidence');

  if (error) {
    console.error('Error fetching low confidence fields:', error);
    return [];
  }

  return data || [];
}

/**
 * Get missing critical fields for a deal
 */
export async function getMissingCriticalFields(
  dealId: string
): Promise<TruthFieldKey[]> {
  const criticalFields: TruthFieldKey[] = [
    'next_step',
    'economic_buyer',
    'champion',
    'success_metric',
  ];

  const { data: existingFields, error } = await supabase
    .from('deal_truth_fields')
    .select('field_key')
    .eq('deal_id', dealId)
    .not('value', 'is', null);

  if (error) {
    console.error('Error fetching existing fields:', error);
    return criticalFields;
  }

  const existingKeys = new Set((existingFields || []).map((f) => f.field_key));

  return criticalFields.filter((key) => !existingKeys.has(key));
}

// =====================================================
// Clarification Question Generation
// =====================================================

export interface ClarificationQuestion {
  fieldKey: TruthFieldKey;
  question: string;
  currentValue: string | null;
  confidence: number;
  suggestedOptions?: string[];
}

/**
 * Generate clarification questions for low-confidence or missing fields
 */
export async function generateClarificationQuestions(
  dealId: string,
  dealName: string,
  contacts?: { id: string; name: string }[]
): Promise<ClarificationQuestion[]> {
  const questions: ClarificationQuestion[] = [];

  // Get existing fields
  const fields = await getDealTruthFields(dealId);
  const fieldsMap = new Map(fields.map((f) => [f.field_key, f]));

  // Check economic buyer
  const ebField = fieldsMap.get('economic_buyer');
  if (!ebField || (ebField.value && ebField.confidence < 0.6)) {
    questions.push({
      fieldKey: 'economic_buyer',
      question: contacts?.length
        ? `Who is the economic buyer for ${dealName}?`
        : `Is ${ebField?.value || 'this person'} the economic buyer for ${dealName}?`,
      currentValue: ebField?.value || null,
      confidence: ebField?.confidence ?? 0,
      suggestedOptions: contacts?.map((c) => c.name),
    });
  }

  // Check champion
  const champField = fieldsMap.get('champion');
  if (!champField || (champField.value && champField.confidence < 0.6)) {
    questions.push({
      fieldKey: 'champion',
      question: `Who is the champion for ${dealName}?`,
      currentValue: champField?.value || null,
      confidence: champField?.confidence ?? 0,
      suggestedOptions: contacts?.map((c) => c.name),
    });
  }

  // Check next step
  const nextStepField = fieldsMap.get('next_step');
  if (!nextStepField || !nextStepField.value || !nextStepField.next_step_date) {
    questions.push({
      fieldKey: 'next_step',
      question: nextStepField?.value && !nextStepField.next_step_date
        ? `What date is the next step for ${dealName}?`
        : `What's the next step for ${dealName}?`,
      currentValue: nextStepField?.value || null,
      confidence: nextStepField?.confidence ?? 0,
    });
  }

  return questions;
}

// =====================================================
// Extraction Helpers (for meeting/email processing)
// =====================================================

export interface ExtractedTruthFields {
  pain?: { value: string; confidence: number };
  success_metric?: { value: string; confidence: number };
  champion?: { value: string; confidence: number; contact_name?: string };
  economic_buyer?: { value: string; confidence: number; contact_name?: string };
  next_step?: { value: string; confidence: number; date?: string };
  top_risks?: { value: string; confidence: number };
}

/**
 * Save extracted fields from meeting/email processing
 * Only updates if new confidence is higher than existing
 */
export async function saveExtractedTruthFields(
  dealId: string,
  orgId: string,
  extracted: ExtractedTruthFields,
  source: TruthFieldSource,
  sourceId?: string
): Promise<{ updated: TruthFieldKey[]; skipped: TruthFieldKey[] }> {
  const updated: TruthFieldKey[] = [];
  const skipped: TruthFieldKey[] = [];

  const existingFields = await getDealTruthFields(dealId);
  const existingMap = new Map(existingFields.map((f) => [f.field_key, f]));

  for (const [key, extraction] of Object.entries(extracted)) {
    if (!extraction) continue;

    const fieldKey = key as TruthFieldKey;
    const existing = existingMap.get(fieldKey);

    // Skip if existing has higher or equal confidence (unless it's manual)
    if (
      existing &&
      existing.confidence >= extraction.confidence &&
      existing.source !== 'ai_inferred'
    ) {
      skipped.push(fieldKey);
      continue;
    }

    const input: TruthFieldUpsertInput = {
      deal_id: dealId,
      org_id: orgId,
      field_key: fieldKey,
      value: extraction.value,
      confidence: extraction.confidence,
      source,
      source_id: sourceId,
    };

    // Handle special fields
    if (fieldKey === 'next_step' && 'date' in extraction && extraction.date) {
      input.next_step_date = extraction.date;
    }

    const result = await upsertDealTruthField(input);
    if (result) {
      updated.push(fieldKey);
    } else {
      skipped.push(fieldKey);
    }
  }

  return { updated, skipped };
}

// =====================================================
// Momentum Score Access
// =====================================================

/**
 * Get momentum score for a deal
 */
export async function getDealMomentumScore(dealId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from('deal_clarity_scores')
    .select('momentum_score')
    .eq('deal_id', dealId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data.momentum_score;
}

/**
 * Get full momentum data for a deal
 */
export async function getDealMomentumData(dealId: string): Promise<{
  momentum_score: number;
  clarity_score: number;
  health_score: number | null;
  risk_score: number | null;
  close_plan_completed: number;
  close_plan_total: number;
  close_plan_overdue: number;
} | null> {
  // Get clarity score
  const { data: clarityData } = await supabase
    .from('deal_clarity_scores')
    .select('*')
    .eq('deal_id', dealId)
    .maybeSingle();

  // Get health score
  const { data: healthData } = await supabase
    .from('deal_health_scores')
    .select('overall_health_score')
    .eq('deal_id', dealId)
    .maybeSingle();

  // Get risk score
  const { data: riskData } = await supabase
    .from('deal_risk_aggregates')
    .select('risk_score')
    .eq('deal_id', dealId)
    .maybeSingle();

  if (!clarityData) {
    return null;
  }

  return {
    momentum_score: clarityData.momentum_score ?? 50,
    clarity_score: clarityData.clarity_score ?? 0,
    health_score: healthData?.overall_health_score ?? null,
    risk_score: riskData?.risk_score ?? null,
    close_plan_completed: clarityData.close_plan_completed ?? 0,
    close_plan_total: clarityData.close_plan_total ?? 6,
    close_plan_overdue: clarityData.close_plan_overdue ?? 0,
  };
}
