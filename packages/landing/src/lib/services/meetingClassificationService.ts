/**
 * Meeting Classification Service
 * 
 * Automatically classifies meetings into types based on transcript content
 */

import { supabase } from '@/lib/supabase/clientV2';
import logger from '../utils/logger';

export type MeetingType = 'discovery' | 'demo' | 'negotiation' | 'closing' | 'follow_up' | 'general';

export interface ClassificationResult {
  type: MeetingType;
  confidence: number;
}

/**
 * Type indicators for classification
 */
const TYPE_INDICATORS: Record<MeetingType, string[]> = {
  discovery: [
    'pain points',
    'challenges',
    'current process',
    'goals',
    'objectives',
    'what are you',
    'tell me about',
    'how do you',
    'what challenges',
    'what problems',
    'current situation',
    'understanding',
    'learn more',
    'background',
  ],
  demo: [
    'show you',
    'demonstration',
    'walkthrough',
    'feature',
    'demo',
    'showcase',
    'preview',
    'see how',
    'let me show',
    'here is how',
    'this is how',
    'example',
    'illustrate',
  ],
  negotiation: [
    'pricing',
    'contract',
    'terms',
    'discount',
    'price',
    'cost',
    'budget',
    'payment',
    'agreement',
    'deal',
    'offer',
    'proposal',
    'quote',
    'invoice',
    'billing',
  ],
  closing: [
    'sign',
    'agreement',
    'start date',
    'onboarding',
    'next steps',
    'move forward',
    'ready to',
    'commit',
    'decision',
    'approve',
    'finalize',
    'execute',
    'contract',
    'paperwork',
  ],
  follow_up: [
    'follow up',
    'check in',
    'touch base',
    'update',
    'status',
    'progress',
    'how are things',
    'how is it going',
    'any questions',
    'any concerns',
    'feedback',
  ],
  general: [], // Default fallback
};

/**
 * Classify a meeting based on transcript and summary
 */
export async function classifyMeeting(
  meetingId: string,
  transcript?: string | null,
  summary?: string | null
): Promise<ClassificationResult> {
  try {
    // Get meeting data if not provided
    if (!transcript && !summary) {
      const { data: meeting, error } = await supabase
        .from('meetings')
        .select('transcript_text, summary')
        .eq('id', meetingId)
        .single();

      if (error) {
        throw new Error('Meeting not found');
      }

      transcript = meeting?.transcript_text || null;
      summary = meeting?.summary || null;
    }

    // Combine transcript and summary for analysis
    const content = [transcript, summary].filter(Boolean).join('\n\n').toLowerCase();

    if (!content || content.trim().length < 50) {
      // Not enough content to classify
      return {
        type: 'general',
        confidence: 0.5,
      };
    }

    // Score each type based on indicator matches
    const scores: Record<MeetingType, number> = {
      discovery: 0,
      demo: 0,
      negotiation: 0,
      closing: 0,
      follow_up: 0,
      general: 0,
    };

    // Count matches for each type
    for (const [type, indicators] of Object.entries(TYPE_INDICATORS)) {
      if (type === 'general') continue;

      for (const indicator of indicators) {
        const regex = new RegExp(`\\b${indicator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        const matches = content.match(regex);
        if (matches) {
          scores[type as MeetingType] += matches.length;
        }
      }
    }

    // Find the type with the highest score
    let maxScore = 0;
    let classifiedType: MeetingType = 'general';
    
    for (const [type, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        classifiedType = type as MeetingType;
      }
    }

    // Calculate confidence (normalize score, max confidence is 0.95)
    const totalIndicators = Object.values(TYPE_INDICATORS).flat().length;
    const confidence = Math.min(0.5 + (maxScore / Math.max(totalIndicators, 10)) * 0.45, 0.95);

    // If no strong indicators found, default to general
    if (maxScore === 0) {
      return {
        type: 'general',
        confidence: 0.5,
      };
    }

    return {
      type: classifiedType,
      confidence: Math.round(confidence * 100) / 100, // Round to 2 decimal places
    };
  } catch (error) {
    logger.error('Exception classifying meeting:', error);
    return {
      type: 'general',
      confidence: 0.5,
    };
  }
}

/**
 * Classify and save meeting type to database
 */
export async function classifyAndSaveMeeting(meetingId: string): Promise<ClassificationResult> {
  try {
    const result = await classifyMeeting(meetingId);

    // Save to database
    const { error } = await supabase
      .from('meetings')
      .update({
        meeting_type: result.type,
        classification_confidence: result.confidence,
      })
      .eq('id', meetingId);

    if (error) {
      logger.error('Error saving meeting classification:', error);
    }

    return result;
  } catch (error) {
    logger.error('Exception classifying and saving meeting:', error);
    return {
      type: 'general',
      confidence: 0.5,
    };
  }
}

/**
 * Batch classify multiple meetings
 */
export async function classifyMeetings(meetingIds: string[]): Promise<Map<string, ClassificationResult>> {
  const results = new Map<string, ClassificationResult>();

  for (const meetingId of meetingIds) {
    try {
      const result = await classifyAndSaveMeeting(meetingId);
      results.set(meetingId, result);
    } catch (error) {
      logger.error(`Error classifying meeting ${meetingId}:`, error);
      results.set(meetingId, {
        type: 'general',
        confidence: 0.5,
      });
    }
  }

  return results;
}

