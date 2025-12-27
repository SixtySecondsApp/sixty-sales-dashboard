/**
 * Extraction Rules Service
 * Manages custom task extraction rules and meeting type templates
 */

import { supabase } from '@/lib/supabase/clientV2';

export interface TaskExtractionRule {
  id: string;
  user_id: string;
  name: string;
  trigger_phrases: string[];
  task_category: string;
  default_priority: 'low' | 'medium' | 'high' | 'urgent';
  default_deadline_days: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MeetingTypeTemplate {
  id: string;
  user_id: string;
  meeting_type: 'discovery' | 'demo' | 'negotiation' | 'closing' | 'follow_up' | 'general';
  extraction_template: Record<string, any>;
  content_templates: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export class ExtractionRulesService {
  /**
   * Get all extraction rules for a user
   */
  static async getExtractionRules(userId: string): Promise<TaskExtractionRule[]> {
    try {
      const { data, error } = await supabase
        .from('task_extraction_rules')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as TaskExtractionRule[];
    } catch (error) {
      console.error('Error fetching extraction rules:', error);
      throw error;
    }
  }

  /**
   * Get active extraction rules for a user
   */
  static async getActiveExtractionRules(userId: string): Promise<TaskExtractionRule[]> {
    try {
      const { data, error } = await supabase
        .from('task_extraction_rules')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as TaskExtractionRule[];
    } catch (error) {
      console.error('Error fetching active extraction rules:', error);
      throw error;
    }
  }

  /**
   * Create a new extraction rule
   */
  static async createExtractionRule(
    userId: string,
    rule: Omit<TaskExtractionRule, 'id' | 'user_id' | 'created_at' | 'updated_at'>
  ): Promise<TaskExtractionRule> {
    try {
      const { data, error } = await supabase
        .from('task_extraction_rules')
        .insert({
          user_id: userId,
          ...rule,
        })
        .select()
        .single();

      if (error) throw error;
      return data as TaskExtractionRule;
    } catch (error) {
      console.error('Error creating extraction rule:', error);
      throw error;
    }
  }

  /**
   * Update an extraction rule
   */
  static async updateExtractionRule(
    userId: string,
    ruleId: string,
    updates: Partial<Omit<TaskExtractionRule, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
  ): Promise<TaskExtractionRule> {
    try {
      const { data, error } = await supabase
        .from('task_extraction_rules')
        .update(updates)
        .eq('id', ruleId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return data as TaskExtractionRule;
    } catch (error) {
      console.error('Error updating extraction rule:', error);
      throw error;
    }
  }

  /**
   * Delete an extraction rule
   */
  static async deleteExtractionRule(userId: string, ruleId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('task_extraction_rules')
        .delete()
        .eq('id', ruleId)
        .eq('user_id', userId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting extraction rule:', error);
      throw error;
    }
  }

  /**
   * Check if transcript matches any extraction rules
   */
  static async matchExtractionRules(
    userId: string,
    transcript: string
  ): Promise<TaskExtractionRule[]> {
    try {
      const rules = await this.getActiveExtractionRules(userId);
      const lowerTranscript = transcript.toLowerCase();

      return rules.filter(rule =>
        rule.trigger_phrases.some(phrase =>
          lowerTranscript.includes(phrase.toLowerCase())
        )
      );
    } catch (error) {
      console.error('Error matching extraction rules:', error);
      return [];
    }
  }

  /**
   * Get meeting type templates for a user
   */
  static async getMeetingTypeTemplates(userId: string): Promise<MeetingTypeTemplate[]> {
    try {
      const { data, error } = await supabase
        .from('meeting_type_templates')
        .select('*')
        .eq('user_id', userId)
        .order('meeting_type', { ascending: true });

      if (error) throw error;
      return (data || []) as MeetingTypeTemplate[];
    } catch (error) {
      console.error('Error fetching meeting type templates:', error);
      throw error;
    }
  }

  /**
   * Get a specific meeting type template
   */
  static async getMeetingTypeTemplate(
    userId: string,
    meetingType: string
  ): Promise<MeetingTypeTemplate | null> {
    try {
      const { data, error } = await supabase
        .from('meeting_type_templates')
        .select('*')
        .eq('user_id', userId)
        .eq('meeting_type', meetingType)
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }
      return data as MeetingTypeTemplate;
    } catch (error) {
      console.error('Error fetching meeting type template:', error);
      throw error;
    }
  }

  /**
   * Create or update a meeting type template
   */
  static async upsertMeetingTypeTemplate(
    userId: string,
    template: Omit<MeetingTypeTemplate, 'id' | 'user_id' | 'created_at' | 'updated_at'>
  ): Promise<MeetingTypeTemplate> {
    try {
      const { data, error } = await supabase
        .from('meeting_type_templates')
        .upsert({
          user_id: userId,
          ...template,
        }, {
          onConflict: 'user_id,meeting_type'
        })
        .select()
        .single();

      if (error) throw error;
      return data as MeetingTypeTemplate;
    } catch (error) {
      console.error('Error upserting meeting type template:', error);
      throw error;
    }
  }

  /**
   * Delete a meeting type template
   */
  static async deleteMeetingTypeTemplate(
    userId: string,
    meetingType: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('meeting_type_templates')
        .delete()
        .eq('user_id', userId)
        .eq('meeting_type', meetingType);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting meeting type template:', error);
      throw error;
    }
  }
}






























