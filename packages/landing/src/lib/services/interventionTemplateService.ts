/**
 * Intervention Template Service
 *
 * Manages "permission to close" templates and AI-powered personalization.
 * Handles template selection, personalization, A/B testing, and performance tracking.
 */

import { supabase } from '@/lib/supabase/clientV2';
import type { RelationshipHealthScore } from './relationshipHealthService';
import type { GhostRiskAssessment } from './ghostDetectionService';
import type { DealHealthScore } from './dealHealthService';

// =====================================================
// Types
// =====================================================

export interface InterventionTemplate {
  id: string;
  user_id: string | null;
  template_name: string;
  template_type: 'permission_to_close' | 'value_add' | 'pattern_interrupt' | 'soft_checkin' | 'channel_switch';
  context_trigger: string;
  subject_line: string | null;
  template_body: string;
  personalization_fields: any;
  is_control_variant: boolean;
  variant_name: string | null;
  parent_template_id: string | null;
  times_sent: number;
  times_opened: number;
  times_clicked: number;
  times_replied: number;
  times_recovered: number;
  avg_response_time_hours: number | null;
  response_rate_percent: number | null;
  recovery_rate_percent: number | null;
  best_performing_persona: string | null;
  best_performing_industry: string | null;
  best_performing_deal_stage: string | null;
  performance_by_segment: any;
  is_active: boolean;
  is_system_template: boolean;
  description: string | null;
  usage_notes: string | null;
  recommended_timing: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
}

export interface PersonalizationContext {
  contactId: string;
  contactName: string;
  companyName: string | null;
  relationshipHealth: RelationshipHealthScore;
  ghostRisk: GhostRiskAssessment;
  dealHealth?: DealHealthScore; // Optional deal health for deal-based interventions
  lastMeaningfulInteraction?: {
    type: string;
    date: string;
    topic: string;
    concerns?: string[];
    commitments?: string[];
  };
}

export interface PersonalizedTemplate {
  templateId: string;
  subject: string;
  body: string;
  personalizationData: {
    first_name: string;
    company_name: string;
    last_meaningful_interaction: string;
    personalized_assumption: string;
    reconnect_suggestion: string;
    sender_name?: string;
    [key: string]: any;
  };
  confidenceScore: number; // 0-1
}

export interface TemplateRecommendation {
  template: InterventionTemplate;
  confidenceScore: number;
  reasoning: string;
  alternatives: InterventionTemplate[];
}

// =====================================================
// Template Retrieval Functions
// =====================================================

/**
 * Get all active templates (system + user's custom)
 */
export async function getAllTemplates(userId: string): Promise<InterventionTemplate[]> {
  try {
    const { data, error } = await supabase
      .from('intervention_templates')
      .select('*')
      .eq('is_active', true)
      .or(`is_system_template.eq.true,user_id.eq.${userId}`)
      .order('is_system_template', { ascending: false })
      .order('recovery_rate_percent', { ascending: false, nullsFirst: false });

    if (error) {
      console.error('Error fetching templates:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getAllTemplates:', error);
    return [];
  }
}

/**
 * Get templates by context trigger
 */
export async function getTemplatesByContext(
  context: string,
  userId: string
): Promise<InterventionTemplate[]> {
  try {
    const { data, error } = await supabase
      .from('intervention_templates')
      .select('*')
      .eq('context_trigger', context)
      .eq('is_active', true)
      .or(`is_system_template.eq.true,user_id.eq.${userId}`)
      .order('recovery_rate_percent', { ascending: false, nullsFirst: false });

    if (error) return [];
    return data || [];
  } catch (error) {
    return [];
  }
}

/**
 * Get template by ID
 */
export async function getTemplateById(templateId: string): Promise<InterventionTemplate | null> {
  try {
    const { data, error } = await supabase
      .from('intervention_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error) return null;
    return data;
  } catch (error) {
    return null;
  }
}

// =====================================================
// Template Selection Logic
// =====================================================

/**
 * Select best template for intervention
 * Uses AI-like logic to choose optimal template based on context
 */
export async function selectBestTemplate(
  context: PersonalizationContext,
  userId: string
): Promise<TemplateRecommendation | null> {
  try {
    // Get context trigger from ghost risk assessment or deal health
    let contextTrigger = context.ghostRisk.contextTrigger;
    
    // If no context trigger from ghost risk, check deal health
    if (!contextTrigger && context.dealHealth) {
      if (context.dealHealth.health_status === 'stalled') {
        contextTrigger = 'multiple_followups_ignored';
      } else if (context.dealHealth.health_status === 'critical') {
        // Check for proposal or meeting context
        if (context.dealHealth.risk_factors?.some((f) => f.includes('proposal'))) {
          contextTrigger = 'after_proposal';
        } else if (context.dealHealth.risk_factors?.some((f) => f.includes('meeting'))) {
          contextTrigger = 'after_meeting_noshow';
        } else {
          contextTrigger = 'general_ghosting';
        }
      }
    }
    
    contextTrigger = contextTrigger || 'general_ghosting';

    // Get templates for this context
    const templates = await getTemplatesByContext(contextTrigger, userId);

    if (templates.length === 0) {
      // Fallback to general ghosting templates
      const fallbackTemplates = await getTemplatesByContext('general_ghosting', userId);
      if (fallbackTemplates.length === 0) return null;

      return {
        template: fallbackTemplates[0],
        confidenceScore: 0.5,
        reasoning: 'No templates found for specific context, using general ghosting template',
        alternatives: fallbackTemplates.slice(1, 3),
      };
    }

    // Score each template
    const scoredTemplates = templates.map((template) => {
      let score = 0;

      // Performance-based scoring (40%)
      if (template.recovery_rate_percent !== null) {
        score += (template.recovery_rate_percent / 100) * 0.4;
      } else {
        score += 0.2; // Default score for untested templates
      }

      // Ghost severity match (30%)
      if (context.ghostRisk.highestSeverity === 'critical' && template.variant_name === 'control') {
        score += 0.3; // Control works best for critical cases
      } else if (context.ghostRisk.highestSeverity === 'high' && template.variant_name === 'more_specific') {
        score += 0.25; // More specific for high severity
      } else if (context.ghostRisk.highestSeverity === 'medium') {
        score += 0.2; // Any template works for medium
      }

      // Health score match (20%)
      if (context.relationshipHealth.overall_health_score < 30 && template.is_control_variant) {
        score += 0.2; // Control for worst cases
      } else if (context.relationshipHealth.overall_health_score < 50) {
        score += 0.15;
      }

      // Recency (10%) - prefer templates not used recently
      if (template.last_used_at) {
        const daysSinceUsed = Math.floor(
          (Date.now() - new Date(template.last_used_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceUsed > 30) score += 0.1;
        else if (daysSinceUsed > 14) score += 0.05;
      } else {
        score += 0.1; // Never used
      }

      return { template, score };
    });

    // Sort by score
    scoredTemplates.sort((a, b) => b.score - a.score);

    const best = scoredTemplates[0];
    const alternatives = scoredTemplates.slice(1, 4).map((s) => s.template);

    // Generate reasoning
    let reasoning = `Selected "${best.template.template_name}" because: `;
    const reasons: string[] = [];

    if (best.template.recovery_rate_percent && best.template.recovery_rate_percent > 60) {
      reasons.push(`${best.template.recovery_rate_percent}% recovery rate`);
    }
    if (best.template.is_control_variant) {
      reasons.push('proven control variant');
    }
    if (contextTrigger !== 'general_ghosting') {
      reasons.push(`matches context (${contextTrigger})`);
    }

    reasoning += reasons.join(', ') || 'best match for current situation';

    return {
      template: best.template,
      confidenceScore: best.score,
      reasoning,
      alternatives,
    };
  } catch (error) {
    console.error('Error selecting best template:', error);
    return null;
  }
}

// =====================================================
// AI Personalization
// =====================================================

/**
 * Personalize template with AI
 * In production, this would call an edge function with Anthropic API
 * For now, we'll use rule-based personalization
 */
export async function personalizeTemplate(
  template: InterventionTemplate,
  context: PersonalizationContext,
  senderName: string
): Promise<PersonalizedTemplate | null> {
  try {
    // Extract personalization fields
    const fields = template.personalization_fields?.fields || [];

    // Build personalization data
    const personalizationData: any = {
      sender_name: senderName,
      first_name: context.contactName.split(' ')[0],
      company_name: context.companyName || 'your company',
    };

    // Generate last_meaningful_interaction
    if (context.lastMeaningfulInteraction) {
      const interaction = context.lastMeaningfulInteraction;
      if (interaction.type === 'proposal') {
        personalizationData.last_meaningful_interaction = 'you got the proposal';
      } else if (interaction.type === 'demo') {
        personalizationData.last_meaningful_interaction = `our call about ${interaction.topic || 'the demo'}`;
      } else if (interaction.type === 'meeting') {
        personalizationData.last_meaningful_interaction = `our meeting about ${interaction.topic || 'next steps'}`;
      } else {
        personalizationData.last_meaningful_interaction = `I sent over ${interaction.topic || 'the information you requested'}`;
      }
    } else {
      // Fallback: use ghost signals
      const signals = context.ghostRisk.signals;
      if (signals.some((s) => s.signal_type === 'meeting_rescheduled_repeatedly')) {
        personalizationData.last_meaningful_interaction = 'we had to reschedule our meeting';
      } else if (signals.some((s) => s.signal_type === 'email_no_response')) {
        personalizationData.last_meaningful_interaction = 'I sent my last email';
      } else {
        personalizationData.last_meaningful_interaction = 'our last conversation';
      }
    }

    // Generate personalized_assumption
    const riskFactors = context.relationshipHealth.risk_factors;
    const concerns = context.lastMeaningfulInteraction?.concerns || [];

    if (concerns.length > 0) {
      // Use specific concerns from meeting/conversation
      personalizationData.personalized_assumption = `the ${concerns[0]} we discussed is still a concern or this isn't the right timing`;
    } else if (riskFactors.includes('sentiment_declining')) {
      personalizationData.personalized_assumption = "the direction we discussed didn't align with your priorities or timing isn't right";
    } else if (riskFactors.includes('no_response_14_days')) {
      personalizationData.personalized_assumption = "this fell off your radar or priorities shifted";
    } else if (riskFactors.includes('email_opens_stopped')) {
      personalizationData.personalized_assumption = "you decided to go in a different direction or this isn't a fit";
    } else {
      // Generic assumption
      personalizationData.personalized_assumption = "it wasn't a fit or doesn't fit into your current list of priorities";
    }

    // Generate reconnect_suggestion
    if (context.relationshipHealth.sentiment_trend === 'declining') {
      personalizationData.reconnect_suggestion = 'connect again if circumstances change';
    } else if (riskFactors.includes('majority_deals_at_risk')) {
      personalizationData.reconnect_suggestion = 'reconnect when timing is better';
    } else {
      personalizationData.reconnect_suggestion = "connect again when the time's right";
    }

    // Replace placeholders in template
    let personalizedBody = template.template_body;
    let personalizedSubject = template.subject_line || '';

    // Replace all {{field}} placeholders
    Object.entries(personalizationData).forEach(([key, value]) => {
      const placeholder = new RegExp(`{{${key}}}`, 'g');
      personalizedBody = personalizedBody.replace(placeholder, value as string);
      personalizedSubject = personalizedSubject.replace(placeholder, value as string);
    });

    // Calculate confidence score
    let confidenceScore = 0.7; // Base confidence

    if (context.lastMeaningfulInteraction) confidenceScore += 0.1;
    if (concerns.length > 0) confidenceScore += 0.1;
    if (template.recovery_rate_percent && template.recovery_rate_percent > 60) confidenceScore += 0.1;

    confidenceScore = Math.min(1.0, confidenceScore);

    return {
      templateId: template.id,
      subject: personalizedSubject,
      body: personalizedBody,
      personalizationData,
      confidenceScore,
    };
  } catch (error) {
    console.error('Error personalizing template:', error);
    return null;
  }
}

/**
 * Personalize template using AI edge function (future implementation)
 * This will call the Anthropic API for more sophisticated personalization
 */
export async function personalizeTemplateWithAI(
  template: InterventionTemplate,
  context: PersonalizationContext,
  senderName: string
): Promise<PersonalizedTemplate | null> {
  try {
    // TODO: Call edge function 'ai-intervention-personalizer'
    // For now, fallback to rule-based personalization
    return await personalizeTemplate(template, context, senderName);

    /* Future implementation:
    const { data, error } = await supabase.functions.invoke('ai-intervention-personalizer', {
      body: {
        template_id: template.id,
        contact_id: context.contactId,
        relationship_health: context.relationshipHealth,
        ghost_signals: context.ghostRisk.signals,
        last_meaningful_interaction: context.lastMeaningfulInteraction,
        sender_name: senderName,
      },
    });

    if (error) throw error;

    return {
      templateId: template.id,
      subject: data.subject,
      body: data.personalized_template,
      personalizationData: data.personalization_data,
      confidenceScore: data.confidence_score,
    };
    */
  } catch (error) {
    console.error('Error with AI personalization:', error);
    // Fallback to rule-based
    return await personalizeTemplate(template, context, senderName);
  }
}

// =====================================================
// Template Management
// =====================================================

/**
 * Create custom template
 */
export async function createTemplate(
  userId: string,
  templateData: Partial<InterventionTemplate>
): Promise<InterventionTemplate | null> {
  try {
    const { data, error } = await supabase
      .from('intervention_templates')
      .insert({
        user_id: userId,
        is_system_template: false,
        is_active: true,
        ...templateData,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating template:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in createTemplate:', error);
    return null;
  }
}

/**
 * Update template
 */
export async function updateTemplate(
  templateId: string,
  updates: Partial<InterventionTemplate>
): Promise<InterventionTemplate | null> {
  try {
    const { data, error } = await supabase
      .from('intervention_templates')
      .update(updates)
      .eq('id', templateId)
      .eq('is_system_template', false) // Can't update system templates
      .select()
      .single();

    if (error) {
      console.error('Error updating template:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in updateTemplate:', error);
    return null;
  }
}

/**
 * Delete template
 */
export async function deleteTemplate(templateId: string, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('intervention_templates')
      .delete()
      .eq('id', templateId)
      .eq('user_id', userId)
      .eq('is_system_template', false); // Can't delete system templates

    return !error;
  } catch (error) {
    console.error('Error deleting template:', error);
    return false;
  }
}

// =====================================================
// Performance Tracking
// =====================================================

/**
 * Get template performance analytics
 */
export async function getTemplatePerformance(templateId: string): Promise<{
  template: InterventionTemplate;
  performance: {
    sent: number;
    opened: number;
    replied: number;
    recovered: number;
    openRate: number;
    responseRate: number;
    recoveryRate: number;
    avgResponseTime: number | null;
  };
} | null> {
  try {
    const template = await getTemplateById(templateId);
    if (!template) return null;

    return {
      template,
      performance: {
        sent: template.times_sent,
        opened: template.times_opened,
        replied: template.times_replied,
        recovered: template.times_recovered,
        openRate: template.times_sent > 0 ? Math.round((template.times_opened / template.times_sent) * 100) : 0,
        responseRate: template.response_rate_percent || 0,
        recoveryRate: template.recovery_rate_percent || 0,
        avgResponseTime: template.avg_response_time_hours,
      },
    };
  } catch (error) {
    console.error('Error getting template performance:', error);
    return null;
  }
}

/**
 * Get all templates with performance comparison
 */
export async function compareTemplatePerformance(userId: string): Promise<Array<{
  template: InterventionTemplate;
  performance: {
    sent: number;
    responseRate: number;
    recoveryRate: number;
  };
}>> {
  try {
    const templates = await getAllTemplates(userId);

    return templates.map((template) => ({
      template,
      performance: {
        sent: template.times_sent,
        responseRate: template.response_rate_percent || 0,
        recoveryRate: template.recovery_rate_percent || 0,
      },
    }));
  } catch (error) {
    console.error('Error comparing template performance:', error);
    return [];
  }
}
