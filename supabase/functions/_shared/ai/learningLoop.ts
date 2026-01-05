/**
 * AI Learning Loop - Phase 6: Smart AI & Engagement
 *
 * Tracks user feedback on AI suggestions to improve future recommendations:
 * - Tracks approve/edit/reject rates
 * - Extracts edit deltas (tone, brevity, CTA style)
 * - Stores per-user preferences
 * - Measures outcomes (reply received, meeting booked, etc.)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AIFeedback,
  FeedbackAction,
  EditDelta,
  ActionType,
  UserAIPreferences,
} from './types.ts';

interface RecordFeedbackParams {
  suggestion_id: string;
  user_id: string;
  org_id: string;
  action: FeedbackAction;
  action_type: ActionType;
  confidence_at_generation: number;
  context_quality_at_generation: number;
  original_content?: string;
  edited_content?: string;
  time_to_decision_seconds?: number;
}

/**
 * Record user feedback on an AI suggestion
 */
export async function recordFeedback(
  supabase: SupabaseClient,
  params: RecordFeedbackParams
): Promise<AIFeedback | null> {
  const {
    suggestion_id,
    user_id,
    org_id,
    action,
    action_type,
    confidence_at_generation,
    context_quality_at_generation,
    original_content,
    edited_content,
    time_to_decision_seconds,
  } = params;

  // Calculate edit delta if this was an edit
  let editDelta: EditDelta | null = null;
  if (action === 'edited' && original_content && edited_content) {
    editDelta = calculateEditDelta(original_content, edited_content);
  }

  // Record the feedback
  const { data: feedback, error } = await supabase
    .from('ai_feedback')
    .insert({
      suggestion_id,
      user_id,
      org_id,
      action,
      action_type,
      confidence_at_generation,
      context_quality_at_generation,
      original_content,
      edited_content,
      edit_delta: editDelta,
      time_to_decision_seconds,
      outcome_measured: false,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Error recording AI feedback:', error);
    return null;
  }

  // Update user preferences based on feedback
  await updateUserPreferences(supabase, user_id, action, action_type, editDelta);

  return feedback as AIFeedback;
}

/**
 * Calculate edit delta between original and edited content
 */
export function calculateEditDelta(original: string, edited: string): EditDelta {
  const originalLower = original.toLowerCase();
  const editedLower = edited.toLowerCase();

  // Length analysis
  const lengthDelta = (edited.length - original.length) / original.length;
  const lengthChange: EditDelta['length_change'] =
    lengthDelta < -0.1 ? 'shorter' : lengthDelta > 0.1 ? 'longer' : 'same';

  // Tone analysis (simplified - would use NLP in production)
  const toneShift = detectToneShift(original, edited);

  // CTA analysis
  const ctaPatterns = [
    'let me know',
    'would you',
    'can we',
    'schedule',
    'call',
    'meet',
    'next step',
    'follow up',
    'get back to me',
    'your thoughts',
  ];

  const originalHasCta = ctaPatterns.some((p) => originalLower.includes(p));
  const editedHasCta = ctaPatterns.some((p) => editedLower.includes(p));

  // Subject analysis (for emails)
  const changedSubject = detectSubjectChange(original, edited);

  // Personalization analysis
  const personalizationPatterns = [
    'you mentioned',
    'as we discussed',
    'following up on',
    'great speaking',
    'enjoyed our',
    'your team',
    'your company',
  ];

  const originalHasPersonalization = personalizationPatterns.some((p) =>
    originalLower.includes(p)
  );
  const editedHasPersonalization = personalizationPatterns.some((p) =>
    editedLower.includes(p)
  );

  // Bullet point analysis
  const originalBullets = (original.match(/^[\s]*[-•*]/gm) || []).length;
  const editedBullets = (edited.match(/^[\s]*[-•*]/gm) || []).length;

  // Language simplification
  const originalComplexity = calculateComplexity(original);
  const editedComplexity = calculateComplexity(edited);

  return {
    tone_shift: toneShift,
    length_change: lengthChange,
    length_delta_percent: Math.round(lengthDelta * 100),
    added_cta: !originalHasCta && editedHasCta,
    removed_cta: originalHasCta && !editedHasCta,
    changed_subject: changedSubject,
    added_personalization: !originalHasPersonalization && editedHasPersonalization,
    removed_personalization: originalHasPersonalization && !editedHasPersonalization,
    added_bullet_points: editedBullets > originalBullets,
    simplified_language: editedComplexity < originalComplexity * 0.9,
  };
}

/**
 * Detect tone shift between original and edited content
 */
function detectToneShift(original: string, edited: string): EditDelta['tone_shift'] {
  const formalIndicators = [
    'respectfully',
    'kindly',
    'please be advised',
    'I would like to',
    'at your earliest convenience',
    'sincerely',
    'regards',
  ];

  const casualIndicators = [
    'hey',
    'hi there',
    'just wanted',
    'quick',
    'btw',
    'fyi',
    'thanks!',
    'cheers',
    ':)',
    '!',
  ];

  const originalLower = original.toLowerCase();
  const editedLower = edited.toLowerCase();

  const originalFormalScore = formalIndicators.filter((i) =>
    originalLower.includes(i)
  ).length;
  const editedFormalScore = formalIndicators.filter((i) =>
    editedLower.includes(i)
  ).length;

  const originalCasualScore = casualIndicators.filter((i) =>
    originalLower.includes(i)
  ).length;
  const editedCasualScore = casualIndicators.filter((i) =>
    editedLower.includes(i)
  ).length;

  const originalNetFormality = originalFormalScore - originalCasualScore;
  const editedNetFormality = editedFormalScore - editedCasualScore;

  if (editedNetFormality > originalNetFormality + 1) {
    return 'more_formal';
  }
  if (editedNetFormality < originalNetFormality - 1) {
    return 'more_casual';
  }
  return 'same';
}

/**
 * Detect if subject line was changed
 */
function detectSubjectChange(original: string, edited: string): boolean {
  // Look for Subject: or RE: patterns
  const subjectPattern = /^(Subject:|RE:|Re:)(.*)$/m;
  const originalMatch = original.match(subjectPattern);
  const editedMatch = edited.match(subjectPattern);

  if (!originalMatch && !editedMatch) return false;
  if (!originalMatch || !editedMatch) return true;

  return originalMatch[2].trim() !== editedMatch[2].trim();
}

/**
 * Calculate text complexity score (simplified Flesch-Kincaid proxy)
 */
function calculateComplexity(text: string): number {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const syllables = words.reduce((sum, word) => sum + countSyllables(word), 0);

  if (sentences.length === 0 || words.length === 0) return 0;

  const avgWordsPerSentence = words.length / sentences.length;
  const avgSyllablesPerWord = syllables / words.length;

  return avgWordsPerSentence * 0.39 + avgSyllablesPerWord * 11.8 - 15.59;
}

/**
 * Count syllables in a word (approximate)
 */
function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;

  const vowels = 'aeiouy';
  let count = 0;
  let prevVowel = false;

  for (const char of word) {
    const isVowel = vowels.includes(char);
    if (isVowel && !prevVowel) {
      count++;
    }
    prevVowel = isVowel;
  }

  // Adjust for silent e
  if (word.endsWith('e')) count--;

  return Math.max(1, count);
}

/**
 * Update user preferences based on feedback
 */
async function updateUserPreferences(
  supabase: SupabaseClient,
  userId: string,
  action: FeedbackAction,
  actionType: ActionType,
  editDelta: EditDelta | null
): Promise<void> {
  // Get current preferences
  const { data: currentPrefs } = await supabase
    .from('user_ai_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  const prefs: Partial<UserAIPreferences> = currentPrefs || {
    total_suggestions: 0,
    approval_rate: 0,
    edit_rate: 0,
    rejection_rate: 0,
  };

  // Update counts
  const total = (prefs.total_suggestions || 0) + 1;
  const currentApprovals = Math.round((prefs.approval_rate || 0) * (prefs.total_suggestions || 0));
  const currentEdits = Math.round((prefs.edit_rate || 0) * (prefs.total_suggestions || 0));
  const currentRejections = Math.round((prefs.rejection_rate || 0) * (prefs.total_suggestions || 0));

  let approvals = currentApprovals;
  let edits = currentEdits;
  let rejections = currentRejections;

  switch (action) {
    case 'approved':
      approvals++;
      break;
    case 'edited':
      edits++;
      break;
    case 'rejected':
      rejections++;
      break;
  }

  // Calculate new rates
  const newPrefs = {
    total_suggestions: total,
    approval_rate: approvals / total,
    edit_rate: edits / total,
    rejection_rate: rejections / total,
    updated_at: new Date().toISOString(),
  };

  // Learn from edit deltas
  if (editDelta) {
    // Track tone preferences
    if (editDelta.tone_shift === 'more_formal') {
      newPrefs['preferred_tone'] = 'formal';
    } else if (editDelta.tone_shift === 'more_casual') {
      newPrefs['preferred_tone'] = 'casual';
    }

    // Track length preferences
    if (editDelta.length_change === 'shorter') {
      newPrefs['preferred_length'] = 'concise';
    } else if (editDelta.length_change === 'longer') {
      newPrefs['preferred_length'] = 'detailed';
    }

    // Track CTA preferences
    if (editDelta.added_cta) {
      newPrefs['prefers_ctas'] = true;
    } else if (editDelta.removed_cta) {
      newPrefs['prefers_ctas'] = false;
    }

    // Track bullet point preferences
    if (editDelta.added_bullet_points) {
      newPrefs['prefers_bullet_points'] = true;
    }
  }

  // Upsert preferences
  await supabase.from('user_ai_preferences').upsert(
    {
      user_id: userId,
      ...newPrefs,
    },
    { onConflict: 'user_id' }
  );
}

/**
 * Record outcome for a suggestion (called later when outcome is measured)
 */
export async function recordOutcome(
  supabase: SupabaseClient,
  feedbackId: string,
  outcome: {
    positive: boolean;
    type: string; // 'reply_received', 'meeting_booked', 'task_completed', etc.
  }
): Promise<void> {
  await supabase
    .from('ai_feedback')
    .update({
      outcome_measured: true,
      outcome_positive: outcome.positive,
      outcome_type: outcome.type,
    })
    .eq('id', feedbackId);
}

/**
 * Get user AI preferences (with defaults)
 */
export async function getUserPreferences(
  supabase: SupabaseClient,
  userId: string
): Promise<UserAIPreferences> {
  const { data } = await supabase
    .from('user_ai_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (data) {
    return data as UserAIPreferences;
  }

  // Return defaults
  return {
    preferred_tone: null,
    preferred_length: null,
    prefers_ctas: null,
    prefers_bullet_points: null,
    auto_approve_threshold: 90,
    always_hitl_actions: ['send_email', 'send_slack_message'],
    never_auto_send: false,
    notification_frequency: 'moderate',
    preferred_channels: ['slack_dm'],
    total_suggestions: 0,
    approval_rate: 0,
    edit_rate: 0,
    rejection_rate: 0,
    avg_time_to_decision_seconds: 0,
  };
}

/**
 * Get feedback analytics for a user
 */
export async function getFeedbackAnalytics(
  supabase: SupabaseClient,
  userId: string,
  days: number = 30
): Promise<{
  total: number;
  by_action: Record<FeedbackAction, number>;
  by_type: Record<string, { total: number; approved: number; edited: number; rejected: number }>;
  avg_confidence_approved: number;
  avg_confidence_rejected: number;
  common_edits: string[];
}> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data: feedback } = await supabase
    .from('ai_feedback')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', since.toISOString());

  if (!feedback || feedback.length === 0) {
    return {
      total: 0,
      by_action: { approved: 0, edited: 0, rejected: 0, ignored: 0 },
      by_type: {},
      avg_confidence_approved: 0,
      avg_confidence_rejected: 0,
      common_edits: [],
    };
  }

  // Count by action
  const byAction: Record<FeedbackAction, number> = {
    approved: 0,
    edited: 0,
    rejected: 0,
    ignored: 0,
  };

  // Count by action type
  const byType: Record<string, { total: number; approved: number; edited: number; rejected: number }> = {};

  // Track confidence
  let approvedConfidenceSum = 0;
  let approvedCount = 0;
  let rejectedConfidenceSum = 0;
  let rejectedCount = 0;

  // Track common edits
  const editPatterns: Record<string, number> = {};

  for (const fb of feedback) {
    const f = fb as AIFeedback;

    // Count by action
    byAction[f.action]++;

    // Count by type
    if (!byType[f.action_type]) {
      byType[f.action_type] = { total: 0, approved: 0, edited: 0, rejected: 0 };
    }
    byType[f.action_type].total++;
    if (f.action === 'approved') byType[f.action_type].approved++;
    if (f.action === 'edited') byType[f.action_type].edited++;
    if (f.action === 'rejected') byType[f.action_type].rejected++;

    // Track confidence
    if (f.action === 'approved') {
      approvedConfidenceSum += f.confidence_at_generation;
      approvedCount++;
    } else if (f.action === 'rejected') {
      rejectedConfidenceSum += f.confidence_at_generation;
      rejectedCount++;
    }

    // Track edit patterns
    if (f.edit_delta) {
      const delta = f.edit_delta as EditDelta;
      if (delta.tone_shift && delta.tone_shift !== 'same') {
        editPatterns[delta.tone_shift] = (editPatterns[delta.tone_shift] || 0) + 1;
      }
      if (delta.length_change !== 'same') {
        editPatterns[delta.length_change] = (editPatterns[delta.length_change] || 0) + 1;
      }
      if (delta.added_cta) editPatterns['added_cta'] = (editPatterns['added_cta'] || 0) + 1;
      if (delta.removed_cta) editPatterns['removed_cta'] = (editPatterns['removed_cta'] || 0) + 1;
    }
  }

  // Sort edit patterns by frequency
  const commonEdits = Object.entries(editPatterns)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([pattern]) => pattern);

  return {
    total: feedback.length,
    by_action: byAction,
    by_type: byType,
    avg_confidence_approved: approvedCount > 0 ? approvedConfidenceSum / approvedCount : 0,
    avg_confidence_rejected: rejectedCount > 0 ? rejectedConfidenceSum / rejectedCount : 0,
    common_edits: commonEdits,
  };
}
