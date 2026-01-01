/**
 * useTestEmails Hook
 *
 * Fetches emails categorized by quality tier for skill testing.
 * Uses email_categorizations table with sales signals.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/clientV2';
import { useAuth } from '@/lib/contexts/AuthContext';
import {
  calculateEmailQualityScore,
  EMAIL_QUALITY_THRESHOLDS,
  type EmailQualityScore,
  type EmailCategory,
  type EmailSignals,
} from '@/lib/utils/emailQualityScoring';
import { type QualityTier } from '@/lib/utils/entityTestTypes';

export interface TestEmail {
  id: string;
  external_id: string;
  thread_id: string | null;
  direction: 'inbound' | 'outbound';
  received_at: string | null;
  category: EmailCategory;
  category_confidence: number | null;
  signals: EmailSignals;
  source: string;
  // Optional enriched fields if we join with communication_events
  subject: string | null;
  from_email: string | null;
  qualityScore: EmailQualityScore;
}

interface UseTestEmailsOptions {
  mode: QualityTier;
  enabled?: boolean;
  limit?: number;
}

interface UseTestEmailsReturn {
  emails: TestEmail[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Fetch emails by quality tier
 */
async function fetchEmailsByTier(
  userId: string,
  tier: QualityTier,
  limit: number
): Promise<TestEmail[]> {
  // Build the query to get email categorizations
  let query = supabase
    .from('email_categorizations')
    .select(`
      id,
      external_id,
      thread_id,
      direction,
      received_at,
      category,
      category_confidence,
      signals,
      source,
      communication_events(
        id,
        subject,
        from_address
      )
    `)
    .eq('user_id', userId)
    .order('received_at', { ascending: false, nullsFirst: false });

  // Apply tier-specific category filters
  switch (tier) {
    case 'good':
      query = query.in('category', EMAIL_QUALITY_THRESHOLDS.good.categories);
      break;
    case 'average':
      query = query.in('category', EMAIL_QUALITY_THRESHOLDS.average.categories);
      break;
    case 'bad':
      query = query.in('category', EMAIL_QUALITY_THRESHOLDS.bad.categories);
      break;
  }

  const { data, error } = await query.limit(limit * 2); // Fetch more to allow scoring filter

  if (error) {
    console.error('Error fetching test emails:', error);
    throw error;
  }

  if (!data) return [];

  // Transform and filter by tier
  const emailsWithScores = data
    .map(email => {
      const commEvent = email.communication_events as { id: string; subject: string; from_address: string } | null;
      const signals = (email.signals || {}) as EmailSignals;

      const qualityScore = calculateEmailQualityScore({
        category: email.category as EmailCategory,
        category_confidence: email.category_confidence,
        signals,
        received_at: email.received_at,
        direction: email.direction as 'inbound' | 'outbound',
      });

      return {
        id: email.id,
        external_id: email.external_id,
        thread_id: email.thread_id,
        direction: email.direction as 'inbound' | 'outbound',
        received_at: email.received_at,
        category: email.category as EmailCategory,
        category_confidence: email.category_confidence,
        signals,
        source: email.source,
        subject: commEvent?.subject || null,
        from_email: commEvent?.from_address || null,
        qualityScore,
      };
    })
    .filter(email => email.qualityScore.tier === tier)
    .slice(0, limit);

  // Sort by score (descending for good, ascending for bad)
  if (tier === 'bad') {
    emailsWithScores.sort((a, b) => a.qualityScore.score - b.qualityScore.score);
  } else {
    emailsWithScores.sort((a, b) => b.qualityScore.score - a.qualityScore.score);
  }

  return emailsWithScores;
}

/**
 * Hook for fetching emails by quality tier
 */
export function useTestEmails(options: UseTestEmailsOptions): UseTestEmailsReturn {
  const { mode, enabled = true, limit = 10 } = options;
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['test-emails', mode, user?.id, limit],
    queryFn: () => fetchEmailsByTier(user!.id, mode, limit),
    enabled: enabled && !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    emails: query.data || [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

/**
 * Search emails for custom selection
 */
export async function searchTestEmails(
  userId: string,
  searchQuery: string,
  limit: number = 10
): Promise<TestEmail[]> {
  if (!searchQuery.trim()) return [];

  // Search by external_id or join on communication_events for subject/from
  // For now, we'll search by thread_id and external_id patterns
  const { data, error } = await supabase
    .from('email_categorizations')
    .select(`
      id,
      external_id,
      thread_id,
      direction,
      received_at,
      category,
      category_confidence,
      signals,
      source,
      communication_events(
        id,
        subject,
        from_address
      )
    `)
    .eq('user_id', userId)
    .order('received_at', { ascending: false, nullsFirst: false })
    .limit(limit * 3); // Fetch more for client-side filtering

  if (error) {
    console.error('Error searching emails:', error);
    throw error;
  }

  if (!data) return [];

  // Client-side search filtering since we can't easily search nested fields
  const searchLower = searchQuery.toLowerCase();
  const filtered = data.filter(email => {
    const commEvent = email.communication_events as { id: string; subject: string; from_address: string } | null;
    const subject = commEvent?.subject?.toLowerCase() || '';
    const from = commEvent?.from_address?.toLowerCase() || '';
    const externalId = email.external_id?.toLowerCase() || '';

    return subject.includes(searchLower) ||
           from.includes(searchLower) ||
           externalId.includes(searchLower);
  });

  return filtered.slice(0, limit).map(email => {
    const commEvent = email.communication_events as { id: string; subject: string; from_address: string } | null;
    const signals = (email.signals || {}) as EmailSignals;

    const qualityScore = calculateEmailQualityScore({
      category: email.category as EmailCategory,
      category_confidence: email.category_confidence,
      signals,
      received_at: email.received_at,
      direction: email.direction as 'inbound' | 'outbound',
    });

    return {
      id: email.id,
      external_id: email.external_id,
      thread_id: email.thread_id,
      direction: email.direction as 'inbound' | 'outbound',
      received_at: email.received_at,
      category: email.category as EmailCategory,
      category_confidence: email.category_confidence,
      signals,
      source: email.source,
      subject: commEvent?.subject || null,
      from_email: commEvent?.from_address || null,
      qualityScore,
    };
  });
}
