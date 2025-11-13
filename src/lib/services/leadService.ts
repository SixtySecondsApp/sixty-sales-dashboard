import { supabase } from '@/lib/supabase/clientV2';
import type { Database } from '@/lib/database.types';

export type LeadRecord = Database['public']['Tables']['leads']['Row'];
export type LeadPrepNote = Database['public']['Tables']['lead_prep_notes']['Row'];

export type LeadWithPrep = LeadRecord & {
  lead_prep_notes: LeadPrepNote[];
};

export async function fetchLeads(): Promise<LeadWithPrep[]> {
  const { data, error } = await supabase
    .from('leads')
    .select(`
      *,
      lead_prep_notes(*)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((lead) => ({
    ...lead,
    lead_prep_notes: lead.lead_prep_notes ?? [],
  })) as LeadWithPrep[];
}

export async function triggerLeadPrep(): Promise<{ processed: number }> {
  const { data, error } = await supabase.functions.invoke('process-lead-prep', {
    method: 'POST',
    body: {},
  });

  if (error) {
    throw new Error(error.message || 'Failed to trigger lead prep');
  }

  return { processed: data?.processed ?? 0 };
}

export async function refreshLeads(): Promise<void> {
  await triggerLeadPrep();
}

export async function resetLeadPrep(leadId?: string): Promise<{ reset_count: number }> {
  const { data, error } = await supabase.functions.invoke('reset-lead-prep', {
    method: 'POST',
    body: leadId ? { lead_id: leadId } : {},
  });

  if (error) {
    throw new Error(error.message || 'Failed to reset lead prep');
  }

  return { reset_count: data?.reset_count ?? 0 };
}

export async function resetAndRerunLeadPrep(leadId?: string): Promise<{ reset_count: number; processed: number }> {
  const { reset_count } = await resetLeadPrep(leadId);
  const { processed } = await triggerLeadPrep();
  return { reset_count, processed };
}

