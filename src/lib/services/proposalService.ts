/**
 * Proposal Service
 * 
 * Provides functionality to generate proposals, SOWs, and goals documents
 * using call transcripts and AI models via OpenRouter.
 */

import { supabase } from '@/lib/supabase/clientV2';
import logger from '../utils/logger';

export interface ProposalTemplate {
  id: string;
  name: string;
  type: 'goals' | 'sow' | 'proposal' | 'design_system';
  content: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface Proposal {
  id: string;
  meeting_id?: string;
  contact_id?: string;
  type: 'goals' | 'sow' | 'proposal';
  status: 'draft' | 'generated' | 'approved' | 'sent';
  content: string;
  title?: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export interface GenerateGoalsParams {
  transcripts: string[];
  contact_name?: string;
  company_name?: string;
}

export interface GenerateSOWParams {
  goals: string;
  contact_name?: string;
  company_name?: string;
  focus_areas?: string[];
  length_target?: 'short' | 'medium' | 'long';
  word_limit?: number;
  page_target?: number;
}

export interface GenerateProposalParams {
  goals: string;
  contact_name?: string;
  company_name?: string;
  focus_areas?: string[];
  length_target?: 'short' | 'medium' | 'long';
  word_limit?: number;
  page_target?: number;
}

export interface FocusArea {
  id: string;
  title: string;
  description: string;
  category: string;
}

export interface AnalyzeFocusAreasParams {
  transcripts: string[];
  contact_name?: string;
  company_name?: string;
}

export interface GenerateResponse {
  success: boolean;
  content?: string;
  error?: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
  job_id?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  warning?: string;
}

export interface JobStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  content?: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
  error?: string;
  created_at: string;
  completed_at?: string;
}

export interface ProposalModelSettings {
  sow_model: string;
  proposal_model: string;
  focus_model: string;
  goals_model: string;
}

/**
 * Analyze transcripts to extract focus areas
 */
export async function analyzeFocusAreas(
  params: AnalyzeFocusAreasParams
): Promise<{ success: boolean; focus_areas?: FocusArea[]; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('generate-proposal', {
      body: {
        action: 'analyze_focus_areas',
        ...params,
      },
    });

    if (error) {
      logger.error('Error analyzing focus areas:', error);
      return {
        success: false,
        error: error.message || 'Failed to analyze focus areas',
      };
    }

    if (!data || !data.success) {
      return {
        success: false,
        error: data?.error || 'Analysis failed',
      };
    }

    return {
      success: true,
      focus_areas: data.focus_areas || [],
    };
  } catch (error) {
    logger.error('Exception analyzing focus areas:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Generate Goals document from call transcripts (with streaming support)
 */
export async function generateGoals(
  params: GenerateGoalsParams & { focus_areas?: string[] },
  onChunk?: (chunk: string) => void
): Promise<GenerateResponse> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }

    // Get Supabase URL with validation
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('VITE_SUPABASE_URL is not configured. Please check your environment variables.');
    }

    // Construct functions URL - prefer dedicated functions domain if available
    const functionsUrlEnv = (import.meta.env as any).VITE_SUPABASE_FUNCTIONS_URL;
    let functionsUrl = functionsUrlEnv;
    if (!functionsUrl && supabaseUrl.includes('.supabase.co')) {
      const projectRef = supabaseUrl.split('//')[1]?.split('.')[0];
      if (projectRef) {
        functionsUrl = `https://${projectRef}.functions.supabase.co`;
      }
    }
    if (!functionsUrl) {
      functionsUrl = `${supabaseUrl}/functions/v1`;
    }

    // Use streaming for goals generation
    const response = await fetch(
      `${functionsUrl}/generate-proposal`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'generate_goals',
          ...params,
          async: true,
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to start streaming');
    }

    // Handle streaming response
    if (response.headers.get('content-type')?.includes('text/event-stream')) {
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';

      if (!reader) {
        throw new Error('No response body');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'chunk' && parsed.text) {
                accumulatedContent += parsed.text;
                if (onChunk) {
                  onChunk(parsed.text);
                }
              } else if (parsed.type === 'done' && parsed.content) {
                return {
                  success: true,
                  content: parsed.content,
                };
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }

      return {
        success: true,
        content: accumulatedContent,
      };
    }

    // Fallback to non-streaming
    const data = await response.json();
    if (!data || !data.success) {
      return {
        success: false,
        error: data?.error || 'Generation failed',
      };
    }

    return {
      success: true,
      job_id: data.job_id,
      content: data.content,
      usage: data.usage,
      status: data.status,
    };
  } catch (error) {
    logger.error('Exception generating goals:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Generate SOW document from Goals (streaming)
 */
export async function generateSOW(
  params: GenerateSOWParams,
  onChunk?: (chunk: string) => void
): Promise<GenerateResponse> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }

    // Get Supabase URL with validation
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('VITE_SUPABASE_URL is not configured. Please check your environment variables.');
    }

    // Construct functions URL - prefer dedicated functions domain if available
    const functionsUrlEnv = (import.meta.env as any).VITE_SUPABASE_FUNCTIONS_URL;
    let functionsUrl = functionsUrlEnv;
    if (!functionsUrl && supabaseUrl.includes('.supabase.co')) {
      const projectRef = supabaseUrl.split('//')[1]?.split('.')[0];
      if (projectRef) {
        functionsUrl = `https://${projectRef}.functions.supabase.co`;
      }
    }
    if (!functionsUrl) {
      functionsUrl = `${supabaseUrl}/functions/v1`;
    }

    const response = await fetch(
      `${functionsUrl}/generate-proposal`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'generate_sow',
          ...params,
          async: true,
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to start streaming');
    }

    // Handle streaming response
    if (response.headers.get('content-type')?.includes('text/event-stream')) {
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';

      if (!reader) {
        throw new Error('No response body');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'chunk' && parsed.text) {
                accumulatedContent += parsed.text;
                if (onChunk) {
                  onChunk(parsed.text);
                }
              } else if (parsed.type === 'done' && parsed.content) {
                return {
                  success: true,
                  content: parsed.content,
                };
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }

      return {
        success: true,
        content: accumulatedContent,
      };
    }

    // Fallback to non-streaming
    const data = await response.json();
    if (!data || !data.success) {
      return {
        success: false,
        error: data?.error || 'Generation failed',
      };
    }

    return {
      success: true,
      content: data.content,
      usage: data.usage,
    };
  } catch (error) {
    logger.error('Exception generating SOW:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Generate HTML Proposal from Goals (streaming)
 */
export async function generateProposal(
  params: GenerateProposalParams,
  onChunk?: (chunk: string) => void
): Promise<GenerateResponse> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }

    // Get Supabase URL with validation
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('VITE_SUPABASE_URL is not configured. Please check your environment variables.');
    }

    // Construct functions URL - prefer dedicated functions domain if available
    const functionsUrlEnv = (import.meta.env as any).VITE_SUPABASE_FUNCTIONS_URL;
    let functionsUrl = functionsUrlEnv;
    if (!functionsUrl && supabaseUrl.includes('.supabase.co')) {
      const projectRef = supabaseUrl.split('//')[1]?.split('.')[0];
      if (projectRef) {
        functionsUrl = `https://${projectRef}.functions.supabase.co`;
      }
    }
    if (!functionsUrl) {
      functionsUrl = `${supabaseUrl}/functions/v1`;
    }

    const response = await fetch(
      `${functionsUrl}/generate-proposal`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'generate_proposal',
          ...params,
          async: true,
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to start streaming');
    }

    // Handle streaming response
    if (response.headers.get('content-type')?.includes('text/event-stream')) {
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';

      if (!reader) {
        throw new Error('No response body');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'chunk' && parsed.text) {
                accumulatedContent += parsed.text;
                if (onChunk) {
                  onChunk(parsed.text);
                }
              } else if (parsed.type === 'done' && parsed.content) {
                return {
                  success: true,
                  content: parsed.content,
                };
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }

      return {
        success: true,
        content: accumulatedContent,
      };
    }

    // Fallback to non-streaming
    const data = await response.json();
    if (!data || !data.success) {
      return {
        success: false,
        error: data?.error || 'Generation failed',
      };
    }

    return {
      success: true,
      content: data.content,
      usage: data.usage,
    };
  } catch (error) {
    logger.error('Exception generating proposal:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Get job status
 */
export async function getJobStatus(jobId: string): Promise<JobStatus | null> {
  try {
    const { data, error } = await supabase.functions.invoke('generate-proposal', {
      body: {
        action: 'get_job_status',
        job_id: jobId,
      },
    });

    if (error || !data || !data.success) {
      logger.error('Error getting job status:', error);
      return null;
    }

    return data.job;
  } catch (error) {
    logger.error('Exception getting job status:', error);
    return null;
  }
}

/**
 * Poll job status until completion
 */
export async function pollJobStatus(
  jobId: string,
  options: {
    interval?: number;
    maxAttempts?: number;
    onProgress?: (status: JobStatus) => void;
  } = {}
): Promise<JobStatus | null> {
  const { interval = 2000, maxAttempts = 150, onProgress } = options; // 2s interval, 5min max

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const status = await getJobStatus(jobId);
    
    if (!status) {
      return null;
    }

    if (onProgress) {
      onProgress(status);
    }

    if (status.status === 'completed' || status.status === 'failed') {
      return status;
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  // Timeout
  return null;
}

/**
 * Fetch all proposal templates
 */
export async function getProposalTemplates(): Promise<ProposalTemplate[]> {
  try {
    const { data, error } = await supabase
      .from('proposal_templates')
      .select('*')
      .order('type', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      logger.error('Error fetching templates:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    logger.error('Exception fetching templates:', error);
    return [];
  }
}

/**
 * Update a proposal template
 */
export async function updateProposalTemplate(
  id: string,
  updates: Partial<Pick<ProposalTemplate, 'name' | 'content' | 'is_default'>>
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('proposal_templates')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      logger.error('Error updating template:', error);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Exception updating template:', error);
    return false;
  }
}

/**
 * Create a new proposal template
 */
export async function createProposalTemplate(
  template: Omit<ProposalTemplate, 'id' | 'created_at' | 'updated_at' | 'user_id'>
): Promise<ProposalTemplate | null> {
  try {
    const { data, error } = await supabase
      .from('proposal_templates')
      .insert({
        ...template,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating template:', error);
      return null;
    }

    return data;
  } catch (error) {
    logger.error('Exception creating template:', error);
    return null;
  }
}

/**
 * Save a generated proposal
 */
export async function saveProposal(
  proposal: Omit<Proposal, 'id' | 'created_at' | 'updated_at' | 'user_id'>
): Promise<Proposal | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('proposals')
      .insert({
        ...proposal,
        user_id: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      logger.error('Error saving proposal:', error);
      return null;
    }

    return data;
  } catch (error) {
    logger.error('Exception saving proposal:', error);
    return null;
  }
}

/**
 * Get proposals for a contact or meeting
 */
export async function getProposals(
  contactId?: string,
  meetingId?: string
): Promise<Proposal[]> {
  try {
    let query = supabase
      .from('proposals')
      .select('*')
      .order('created_at', { ascending: false });

    if (contactId) {
      query = query.eq('contact_id', contactId);
    }
    if (meetingId) {
      query = query.eq('meeting_id', meetingId);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Error fetching proposals:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    logger.error('Exception fetching proposals:', error);
    return [];
  }
}

/**
 * Get transcripts from meetings for a contact
 */
export async function getMeetingTranscripts(contactId: string): Promise<string[]> {
  try {
    // Get contact's meetings
    const { data: meetings, error: meetingsError } = await supabase
      .from('meetings')
      .select('id, transcript_text')
      .or(`attendees.cs.{contact_id,${contactId}}`)
      .not('transcript_text', 'is', null);

    if (meetingsError) {
      // Try alternative query - meetings linked via meeting_contacts junction table
      const { data: meetingContacts } = await supabase
        .from('meeting_contacts')
        .select('meeting_id')
        .eq('contact_id', contactId);

      if (meetingContacts && meetingContacts.length > 0) {
        const meetingIds = meetingContacts.map(mc => mc.meeting_id);
        const { data: altMeetings } = await supabase
          .from('meetings')
          .select('transcript_text')
          .in('id', meetingIds)
          .not('transcript_text', 'is', null);

        return altMeetings?.map(m => m.transcript_text).filter(Boolean) || [];
      }
      return [];
    }

    return meetings?.map(m => m.transcript_text).filter(Boolean) || [];
  } catch (error) {
    logger.error('Exception fetching transcripts:', error);
    return [];
  }
}

/**
 * Get transcripts from specific meeting IDs
 */
export async function getTranscriptsFromMeetings(meetingIds: string[]): Promise<string[]> {
  try {
    const { data: meetings, error } = await supabase
      .from('meetings')
      .select('transcript_text')
      .in('id', meetingIds)
      .not('transcript_text', 'is', null);

    if (error) {
      logger.error('Error fetching transcripts:', error);
      return [];
    }

    return meetings?.map(m => m.transcript_text).filter(Boolean) || [];
  } catch (error) {
    logger.error('Exception fetching transcripts:', error);
    return [];
  }
}

/**
 * Get proposal model settings from system_config
 */
export async function getProposalModelSettings(): Promise<ProposalModelSettings> {
  try {
    const { data, error } = await supabase
      .from('system_config')
      .select('key, value')
      .in('key', [
        'proposal_sow_model',
        'proposal_proposal_model',
        'proposal_focus_model',
        'proposal_goals_model',
      ]);

    if (error) {
      logger.error('Error fetching model settings:', error);
      // Return defaults
            return {
              sow_model: 'anthropic/claude-3-5-sonnet-20241022',
              proposal_model: 'anthropic/claude-3-5-sonnet-20241022',
              focus_model: 'anthropic/claude-haiku-4.5', // Claude 4.5 Haiku
              goals_model: 'anthropic/claude-3-5-sonnet-20241022',
            };
    }

    const settings: Partial<ProposalModelSettings> = {};
    data?.forEach((item) => {
      const key = item.key.replace('proposal_', '').replace('_model', '');
      if (key === 'sow') {
        settings.sow_model = item.value;
      } else if (key === 'proposal') {
        settings.proposal_model = item.value;
      } else if (key === 'focus') {
        settings.focus_model = item.value;
      } else if (key === 'goals') {
        settings.goals_model = item.value;
      }
    });

    return {
      sow_model: settings.sow_model || 'anthropic/claude-3-5-sonnet-20241022',
      proposal_model: settings.proposal_model || 'anthropic/claude-3-5-sonnet-20241022',
      focus_model: settings.focus_model || 'anthropic/claude-3-5-haiku-20241022',
      goals_model: settings.goals_model || 'anthropic/claude-3-5-sonnet-20241022',
    };
  } catch (error) {
    logger.error('Exception fetching model settings:', error);
            return {
              sow_model: 'anthropic/claude-3-5-sonnet-20241022',
              proposal_model: 'anthropic/claude-3-5-sonnet-20241022',
              focus_model: 'anthropic/claude-haiku-4.5', // Claude 4.5 Haiku
              goals_model: 'anthropic/claude-3-5-sonnet-20241022',
            };
  }
}

/**
 * Save proposal model settings to system_config
 */
export async function saveProposalModelSettings(
  settings: Partial<ProposalModelSettings>
): Promise<boolean> {
  try {
    const updates = Object.entries(settings).map(([key, value]) => ({
      key: `proposal_${key}`,
      value,
      description: `OpenRouter model ID for ${key.replace('_model', '')} generation`,
    }));

    // Use upsert for each setting
    for (const update of updates) {
      const { error } = await supabase
        .from('system_config')
        .upsert(
          {
            key: update.key,
            value: update.value,
            description: update.description,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'key' }
        );

      if (error) {
        logger.error(`Error saving ${update.key}:`, error);
        return false;
      }
    }

    return true;
  } catch (error) {
    logger.error('Exception saving model settings:', error);
    return false;
  }
}
