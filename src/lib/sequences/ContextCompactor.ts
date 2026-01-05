/**
 * Context Compactor
 *
 * Utilities for compacting skill outputs following the Context Engineering principle:
 * "Compaction: Pointers, Not Payloads"
 *
 * Key responsibilities:
 * - Store full data externally (S3, database, etc.)
 * - Return compact references and summaries
 * - Estimate and track token usage
 * - Generate summaries from large payloads
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Reference, SkillResult, SkillMeta } from './contextEngineering';
import {
  createSkillResult,
  createFailedSkillResult,
  estimateTokens,
  compactSummary,
  CONTEXT_ENGINEERING_RULES,
} from './contextEngineering';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Raw skill output before compaction
 */
export interface RawSkillOutput {
  /** Full data payload */
  fullData: Record<string, unknown>;

  /** Type of content for storage categorization */
  contentType: Reference['type'];

  /** Optional summary (if already generated) */
  summary?: string;

  /** Key data points to keep in context (not stored externally) */
  keyDataPoints?: Record<string, unknown>;

  /** Metadata about execution */
  meta: {
    skill_id: string;
    execution_time_ms: number;
    tokens_used?: number;
    model?: string;
    sources?: Array<{ title?: string; uri?: string }>;
  };
}

/**
 * Storage configuration
 */
export interface StorageConfig {
  /** Storage backend type */
  backend: 'supabase_storage' | 's3' | 'database';

  /** Bucket name (for S3/Supabase Storage) */
  bucket?: string;

  /** Table name (for database storage) */
  table?: string;

  /** Organization ID for path scoping */
  organizationId: string;
}

/**
 * Compaction result
 */
export interface CompactionResult {
  /** Reference to stored data */
  reference: Reference;

  /** Compact summary */
  summary: string;

  /** Key data points kept in context */
  keyData: Record<string, unknown>;

  /** Token estimate for the compact representation */
  tokenEstimate: number;
}

// =============================================================================
// CONTEXT COMPACTOR CLASS
// =============================================================================

/**
 * ContextCompactor - Compacts skill outputs for efficient context management
 *
 * Usage:
 * ```typescript
 * const compactor = new ContextCompactor(supabase, {
 *   backend: 'supabase_storage',
 *   bucket: 'skill-outputs',
 *   organizationId: 'org-123'
 * });
 *
 * // Compact a raw skill output
 * const result = await compactor.compact({
 *   fullData: transcriptData,
 *   contentType: 'transcript',
 *   keyDataPoints: { speakers, duration, key_quotes }
 * });
 *
 * // Create a SkillResult from compacted data
 * const skillResult = compactor.toSkillResult('transcription', result, {
 *   hints: { flags: ['competitor_mentioned'] }
 * });
 * ```
 */
export class ContextCompactor {
  private supabase: SupabaseClient;
  private config: StorageConfig;

  constructor(supabase: SupabaseClient, config: StorageConfig) {
    this.supabase = supabase;
    this.config = config;
  }

  // =============================================================================
  // MAIN COMPACTION
  // =============================================================================

  /**
   * Compact a raw skill output
   * Stores full data externally and returns compact reference + summary
   */
  async compact(output: RawSkillOutput): Promise<CompactionResult> {
    const startTime = Date.now();

    // Generate storage path
    const path = this.generateStoragePath(output.contentType, output.meta.skill_id);

    // Store full data
    const reference = await this.storeData(output.fullData, output.contentType, path);

    // Generate or use provided summary
    const summary = output.summary || this.generateSummary(output.fullData, output.contentType);

    // Extract key data points
    const keyData = output.keyDataPoints || this.extractKeyData(output.fullData, output.contentType);

    // Calculate token estimate
    const tokenEstimate = estimateTokens({ summary, keyData, reference: { type: reference.type, location: reference.location } });

    console.log(`[ContextCompactor.compact] Compacted ${output.contentType}`, {
      original_size: JSON.stringify(output.fullData).length,
      compact_size: tokenEstimate * 4, // Rough byte estimate
      compression_ratio: (JSON.stringify(output.fullData).length / (tokenEstimate * 4)).toFixed(2),
      duration_ms: Date.now() - startTime,
    });

    return {
      reference,
      summary: compactSummary(summary, CONTEXT_ENGINEERING_RULES.MAX_SUMMARY_WORDS),
      keyData,
      tokenEstimate,
    };
  }

  /**
   * Convert compaction result to a proper SkillResult
   */
  toSkillResult(
    skillId: string,
    compactionResult: CompactionResult,
    options?: {
      hints?: SkillResult['hints'];
      executionTimeMs?: number;
      tokensUsed?: number;
      model?: string;
      sources?: Array<{ title?: string; uri?: string }>;
    }
  ): SkillResult {
    return createSkillResult(skillId, compactionResult.summary, compactionResult.keyData, {
      references: [compactionResult.reference],
      hints: options?.hints,
      executionTimeMs: options?.executionTimeMs,
      tokensUsed: options?.tokensUsed,
      model: options?.model,
    });
  }

  // =============================================================================
  // STORAGE
  // =============================================================================

  /**
   * Store data and return a reference
   */
  private async storeData(
    data: Record<string, unknown>,
    contentType: Reference['type'],
    path: string
  ): Promise<Reference> {
    const jsonData = JSON.stringify(data, null, 2);
    const sizeBytes = new Blob([jsonData]).size;

    switch (this.config.backend) {
      case 'supabase_storage':
        return await this.storeToSupabaseStorage(jsonData, path, contentType, sizeBytes);

      case 's3':
        return await this.storeToS3(jsonData, path, contentType, sizeBytes);

      case 'database':
        return await this.storeToDatabase(data, path, contentType, sizeBytes);

      default:
        throw new Error(`Unknown storage backend: ${this.config.backend}`);
    }
  }

  /**
   * Store to Supabase Storage
   */
  private async storeToSupabaseStorage(
    data: string,
    path: string,
    contentType: Reference['type'],
    sizeBytes: number
  ): Promise<Reference> {
    const bucket = this.config.bucket || 'skill-outputs';

    const { error } = await this.supabase.storage
      .from(bucket)
      .upload(path, data, {
        contentType: 'application/json',
        upsert: true,
      });

    if (error) {
      console.error('[ContextCompactor.storeToSupabaseStorage] Error:', error);
      throw error;
    }

    return {
      type: contentType,
      location: `supabase://${bucket}/${path}`,
      size_bytes: sizeBytes,
      content_type: 'application/json',
    };
  }

  /**
   * Store to S3 (placeholder - would use AWS SDK)
   */
  private async storeToS3(
    data: string,
    path: string,
    contentType: Reference['type'],
    sizeBytes: number
  ): Promise<Reference> {
    // Placeholder for S3 implementation
    // In production, would use AWS SDK or presigned URLs
    console.warn('[ContextCompactor.storeToS3] S3 storage not implemented, using database fallback');

    return this.storeToDatabase(JSON.parse(data), path, contentType, sizeBytes);
  }

  /**
   * Store to database
   */
  private async storeToDatabase(
    data: Record<string, unknown>,
    path: string,
    contentType: Reference['type'],
    sizeBytes: number
  ): Promise<Reference> {
    const table = this.config.table || 'skill_output_storage';

    const { error } = await this.supabase.from(table).insert({
      organization_id: this.config.organizationId,
      path,
      content_type: contentType,
      data,
      size_bytes: sizeBytes,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error('[ContextCompactor.storeToDatabase] Error:', error);
      throw error;
    }

    return {
      type: contentType,
      location: `db://${table}/${path}`,
      size_bytes: sizeBytes,
      content_type: 'application/json',
    };
  }

  /**
   * Generate a storage path
   */
  private generateStoragePath(contentType: Reference['type'], skillId: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const randomId = Math.random().toString(36).substring(2, 9);

    return `${this.config.organizationId}/${contentType}/${skillId}/${timestamp}-${randomId}.json`;
  }

  // =============================================================================
  // SUMMARY GENERATION
  // =============================================================================

  /**
   * Generate a summary from full data
   */
  private generateSummary(data: Record<string, unknown>, contentType: Reference['type']): string {
    switch (contentType) {
      case 'transcript':
        return this.summarizeTranscript(data);

      case 'enrichment':
        return this.summarizeEnrichment(data);

      case 'analysis':
        return this.summarizeAnalysis(data);

      case 'draft':
        return this.summarizeDraft(data);

      default:
        return this.genericSummary(data);
    }
  }

  /**
   * Summarize a transcript
   */
  private summarizeTranscript(data: Record<string, unknown>): string {
    const parts: string[] = [];

    if (data.duration_mins) {
      parts.push(`${data.duration_mins} min call`);
    }

    if (data.speakers && Array.isArray(data.speakers)) {
      const speakerNames = data.speakers
        .map((s: Record<string, unknown>) => {
          if (s.role && s.role !== 'internal') {
            return `${s.name} (${s.role})`;
          }
          return s.name;
        })
        .filter((n: unknown) => n)
        .slice(0, 3);

      if (speakerNames.length > 0) {
        parts.push(`with ${speakerNames.join(', ')}`);
      }
    }

    if (data.company_name || data.company) {
      const company = data.company_name || (data.company as Record<string, unknown>)?.name;
      if (company) {
        parts.push(`at ${company}`);
      }
    }

    if (data.topics_discussed && Array.isArray(data.topics_discussed)) {
      parts.push(`Discussed: ${data.topics_discussed.slice(0, 4).join(', ')}`);
    }

    if (data.sentiment) {
      parts.push(`Sentiment: ${data.sentiment}`);
    }

    return parts.join('. ') + '.';
  }

  /**
   * Summarize enrichment data
   */
  private summarizeEnrichment(data: Record<string, unknown>): string {
    const parts: string[] = [];

    const company = data.company as Record<string, unknown> | undefined;
    if (company) {
      parts.push(`${company.name}: ${company.industry || 'Unknown industry'}`);

      if (company.employee_count) {
        parts.push(`${company.employee_count} employees`);
      }

      if (company.funding_stage) {
        const funding = company.funding_amount
          ? ` ($${(company.funding_amount as number / 1000000).toFixed(1)}M)`
          : '';
        parts.push(`${company.funding_stage}${funding}`);
      }
    }

    if (data.tech_stack && Array.isArray(data.tech_stack)) {
      parts.push(`Tech: ${data.tech_stack.slice(0, 4).join(', ')}`);
    }

    if (data.signals && typeof data.signals === 'object') {
      const signals = data.signals as Record<string, unknown>;
      if (signals.hiring && Array.isArray(signals.hiring)) {
        parts.push(`Hiring ${signals.hiring.length} roles`);
      }
    }

    if (data.icp_score !== undefined) {
      parts.push(`ICP score: ${((data.icp_score as number) * 100).toFixed(0)}%`);
    }

    return parts.join('. ') + '.';
  }

  /**
   * Summarize analysis data
   */
  private summarizeAnalysis(data: Record<string, unknown>): string {
    const parts: string[] = [];

    if (data.meeting_type) {
      parts.push(`${data.meeting_type} meeting`);
    }

    if (data.overall_sentiment) {
      parts.push(`Overall: ${data.overall_sentiment}`);
    }

    if (data.objections && Array.isArray(data.objections)) {
      parts.push(`${data.objections.length} objection(s) identified`);
    }

    if (data.action_items && Array.isArray(data.action_items)) {
      parts.push(`${data.action_items.length} action item(s)`);
    }

    if (data.deal_stage_signal) {
      parts.push(`Stage signal: ${data.deal_stage_signal}`);
    }

    if (data.next_step_recommendation) {
      parts.push(`Recommended: ${data.next_step_recommendation}`);
    }

    return parts.join('. ') + '.';
  }

  /**
   * Summarize draft content
   */
  private summarizeDraft(data: Record<string, unknown>): string {
    const parts: string[] = [];

    if (data.draft_type) {
      parts.push(`${data.draft_type} drafted`);
    }

    if (data.subject) {
      parts.push(`Subject: "${data.subject}"`);
    }

    if (data.tone) {
      parts.push(`Tone: ${data.tone}`);
    }

    if (data.word_count) {
      parts.push(`${data.word_count} words`);
    }

    if (data.personalization_elements && Array.isArray(data.personalization_elements)) {
      parts.push(`Personalized with ${data.personalization_elements.length} elements`);
    }

    return parts.join('. ') + '.';
  }

  /**
   * Generic summary for unknown content types
   */
  private genericSummary(data: Record<string, unknown>): string {
    const keys = Object.keys(data).slice(0, 5);
    const preview = keys.map((k) => {
      const v = data[k];
      if (Array.isArray(v)) {
        return `${k}: ${v.length} items`;
      } else if (typeof v === 'object' && v !== null) {
        return `${k}: object`;
      } else {
        return `${k}: ${String(v).substring(0, 30)}`;
      }
    });

    return `Data contains: ${preview.join(', ')}`;
  }

  // =============================================================================
  // KEY DATA EXTRACTION
  // =============================================================================

  /**
   * Extract key data points to keep in context
   */
  private extractKeyData(
    data: Record<string, unknown>,
    contentType: Reference['type']
  ): Record<string, unknown> {
    switch (contentType) {
      case 'transcript':
        return this.extractTranscriptKeyData(data);

      case 'enrichment':
        return this.extractEnrichmentKeyData(data);

      case 'analysis':
        return this.extractAnalysisKeyData(data);

      case 'draft':
        return this.extractDraftKeyData(data);

      default:
        return this.extractGenericKeyData(data);
    }
  }

  /**
   * Extract key data from transcript
   */
  private extractTranscriptKeyData(data: Record<string, unknown>): Record<string, unknown> {
    return {
      duration_mins: data.duration_mins,
      speakers: (data.speakers as unknown[])?.slice(0, 5).map((s: Record<string, unknown>) => ({
        name: s.name,
        role: s.role,
        talk_time_pct: s.talk_time_pct,
      })),
      key_quotes: (data.key_quotes as unknown[])?.slice(0, 5),
      topics_discussed: (data.topics_discussed as string[])?.slice(0, 6),
      sentiment: data.sentiment,
    };
  }

  /**
   * Extract key data from enrichment
   */
  private extractEnrichmentKeyData(data: Record<string, unknown>): Record<string, unknown> {
    const company = data.company as Record<string, unknown> | undefined;

    return {
      company: company
        ? {
            name: company.name,
            industry: company.industry,
            employee_count: company.employee_count,
            funding_stage: company.funding_stage,
          }
        : undefined,
      tech_stack: (data.tech_stack as string[])?.slice(0, 6),
      icp_score: data.icp_score,
      icp_match_reasons: (data.icp_match_reasons as string[])?.slice(0, 4),
      signals: {
        hiring: ((data.signals as Record<string, unknown>)?.hiring as unknown[])?.slice(0, 3),
        growth_indicators: ((data.signals as Record<string, unknown>)?.growth_indicators as string[])?.slice(0, 3),
      },
    };
  }

  /**
   * Extract key data from analysis
   */
  private extractAnalysisKeyData(data: Record<string, unknown>): Record<string, unknown> {
    return {
      meeting_type: data.meeting_type,
      overall_sentiment: data.overall_sentiment,
      buying_signals: (data.buying_signals as unknown[])?.slice(0, 3),
      objections: (data.objections as unknown[])?.slice(0, 3),
      action_items: (data.action_items as unknown[])?.slice(0, 5),
      stakeholders: (data.stakeholders as unknown[])?.slice(0, 4),
      deal_stage_signal: data.deal_stage_signal,
      next_step_recommendation: data.next_step_recommendation,
      risk_flags: data.risk_flags,
    };
  }

  /**
   * Extract key data from draft
   */
  private extractDraftKeyData(data: Record<string, unknown>): Record<string, unknown> {
    return {
      draft_type: data.draft_type,
      subject: data.subject,
      preview: data.preview,
      tone: data.tone,
      cta: data.cta,
      personalization_elements: (data.personalization_elements as string[])?.slice(0, 5),
    };
  }

  /**
   * Extract generic key data
   */
  private extractGenericKeyData(data: Record<string, unknown>): Record<string, unknown> {
    const keyData: Record<string, unknown> = {};
    const keys = Object.keys(data).slice(0, 8);

    for (const key of keys) {
      const value = data[key];

      if (Array.isArray(value)) {
        keyData[key] = value.slice(0, 5);
      } else if (typeof value === 'object' && value !== null) {
        // Only include first-level properties of nested objects
        keyData[key] = Object.keys(value as object).slice(0, 3).reduce(
          (acc, k) => {
            acc[k] = (value as Record<string, unknown>)[k];
            return acc;
          },
          {} as Record<string, unknown>
        );
      } else {
        keyData[key] = value;
      }
    }

    return keyData;
  }

  // =============================================================================
  // RETRIEVAL
  // =============================================================================

  /**
   * Retrieve full data from a reference
   */
  async retrieve(reference: Reference): Promise<Record<string, unknown> | null> {
    const location = reference.location;

    if (location.startsWith('supabase://')) {
      return this.retrieveFromSupabaseStorage(location);
    } else if (location.startsWith('s3://')) {
      return this.retrieveFromS3(location);
    } else if (location.startsWith('db://')) {
      return this.retrieveFromDatabase(location);
    }

    console.warn(`[ContextCompactor.retrieve] Unknown location format: ${location}`);
    return null;
  }

  /**
   * Retrieve from Supabase Storage
   */
  private async retrieveFromSupabaseStorage(
    location: string
  ): Promise<Record<string, unknown> | null> {
    // Parse location: supabase://bucket/path
    const match = location.match(/^supabase:\/\/([^/]+)\/(.+)$/);
    if (!match) return null;

    const [, bucket, path] = match;

    const { data, error } = await this.supabase.storage.from(bucket).download(path);

    if (error) {
      console.error('[ContextCompactor.retrieveFromSupabaseStorage] Error:', error);
      return null;
    }

    const text = await data.text();
    return JSON.parse(text);
  }

  /**
   * Retrieve from S3 (placeholder)
   */
  private async retrieveFromS3(location: string): Promise<Record<string, unknown> | null> {
    console.warn('[ContextCompactor.retrieveFromS3] S3 retrieval not implemented');
    return null;
  }

  /**
   * Retrieve from database
   */
  private async retrieveFromDatabase(location: string): Promise<Record<string, unknown> | null> {
    // Parse location: db://table/path
    const match = location.match(/^db:\/\/([^/]+)\/(.+)$/);
    if (!match) return null;

    const [, table, path] = match;

    const { data, error } = await this.supabase
      .from(table)
      .select('data')
      .eq('path', path)
      .single();

    if (error) {
      console.error('[ContextCompactor.retrieveFromDatabase] Error:', error);
      return null;
    }

    return data?.data as Record<string, unknown>;
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a new ContextCompactor
 */
export function createContextCompactor(
  supabase: SupabaseClient,
  config: StorageConfig
): ContextCompactor {
  return new ContextCompactor(supabase, config);
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Quickly compact a skill output without storage
 * Useful for skills that don't need external storage
 */
export function quickCompact(
  skillId: string,
  data: Record<string, unknown>,
  summary: string,
  options?: {
    hints?: SkillResult['hints'];
    executionTimeMs?: number;
    tokensUsed?: number;
    model?: string;
  }
): SkillResult {
  return createSkillResult(skillId, compactSummary(summary), data, options);
}

/**
 * Check if data should be compacted based on size
 */
export function shouldCompactData(data: Record<string, unknown>): boolean {
  const tokens = estimateTokens(data);
  return tokens > CONTEXT_ENGINEERING_RULES.TOKEN_BUDGETS.skill_result * 2;
}
