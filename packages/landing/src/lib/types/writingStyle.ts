/**
 * Writing Style Training Types
 *
 * Types for AI-powered writing style extraction from sent emails
 */

// ============================================================================
// Style Metadata - Extracted from email analysis
// ============================================================================

export interface WritingStyleMetadata {
  tone: {
    formality: number;      // 1-5 (1=casual, 5=formal)
    directness: number;     // 1-5 (1=diplomatic, 5=direct)
    warmth: number;         // 1-5 (1=cold, 5=warm)
  };
  structure: {
    avg_sentence_length: number;
    preferred_length: 'brief' | 'moderate' | 'detailed';
    uses_bullets: boolean;
  };
  vocabulary: {
    complexity: 'simple' | 'professional' | 'technical';
    common_phrases: string[];
    industry_terms: string[];
  };
  greetings_signoffs: {
    greetings: string[];
    signoffs: string[];
  };
  analysis_confidence: number;  // 0-1
  model_used: string;
}

// ============================================================================
// Email Types for Training
// ============================================================================

export interface EmailForTraining {
  id: string;
  subject: string;
  body: string;
  snippet: string;
  recipient: string;
  sent_at: string;
  word_count: number;
}

export interface EmailPreview {
  id: string;
  subject: string;
  snippet: string;
  recipient: string;
  sent_at: string;
  selected: boolean;
}

// ============================================================================
// AI Analysis Results
// ============================================================================

export interface ExtractedStyle {
  name: string;
  tone_description: string;
  tone: {
    formality: number;
    directness: number;
    warmth: number;
  };
  structure: {
    avg_sentence_length: number;
    preferred_length: 'brief' | 'moderate' | 'detailed';
    uses_bullets: boolean;
  };
  vocabulary: {
    complexity: 'simple' | 'professional' | 'technical';
    common_phrases: string[];
    industry_terms: string[];
  };
  greetings_signoffs: {
    greetings: string[];
    signoffs: string[];
  };
  example_excerpts: string[];
  analysis_confidence: number;
}

// ============================================================================
// Training State
// ============================================================================

export type TrainingStep =
  | 'idle'
  | 'fetching'
  | 'selecting'
  | 'analyzing'
  | 'preview'
  | 'saving'
  | 'complete'
  | 'error';

export interface TrainingState {
  step: TrainingStep;
  emails: EmailPreview[];
  selectedIds: string[];
  extractedStyle: ExtractedStyle | null;
  error: string | null;
  progress: number;  // 0-100
}

// ============================================================================
// Edge Function Request/Response Types
// ============================================================================

export interface FetchEmailsRequest {
  action: 'fetch-emails';
  count?: number;  // Default 20
}

export interface AnalyzeEmailsRequest {
  action: 'analyze';
  emails: Array<{
    subject: string;
    body: string;
  }>;
}

export interface SaveStyleRequest {
  action: 'save';
  name: string;
  tone_description: string;
  examples: string[];
  style_metadata: WritingStyleMetadata;
  is_default?: boolean;
}

export interface FetchEmailsResponse {
  success: boolean;
  emails?: EmailForTraining[];
  error?: string;
}

export interface AnalyzeEmailsResponse {
  success: boolean;
  style?: ExtractedStyle;
  error?: string;
}

export interface SaveStyleResponse {
  success: boolean;
  style_id?: string;
  error?: string;
}

// ============================================================================
// Extended User Writing Style (with new fields)
// ============================================================================

export interface UserWritingStyleExtended {
  id: string;
  user_id: string;
  name: string;
  tone_description: string;
  examples: string[];
  is_default: boolean;
  style_metadata: WritingStyleMetadata | null;
  source: 'manual' | 'email_training';
  source_email_count: number;
  trained_at: string | null;
  created_at: string;
  updated_at: string;
}
