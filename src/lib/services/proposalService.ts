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
  // Sharing fields
  share_token?: string;
  password_hash?: string;
  is_public?: boolean;
  share_views?: number;
  last_viewed_at?: string;
}

export interface ShareSettings {
  is_public: boolean;
  password?: string; // Plain text password (will be hashed)
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
      console.error('[generateGoals] Response not OK:', response.status, errorText);
      throw new Error(errorText || 'Failed to start streaming');
    }

    // Handle streaming response
    const contentType = response.headers.get('content-type');
    console.log('[generateGoals] Response content-type:', contentType);

    if (contentType?.includes('text/event-stream')) {
      console.log('[generateGoals] Starting SSE streaming...');
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';
      let chunkCount = 0;
      let buffer = ''; // Buffer for incomplete lines

      if (!reader) {
        throw new Error('No response body');
      }

      while (true) {
        const { done, value } = await reader.read();

        // Process any remaining data in the buffer + current value before exiting
        const chunk = value ? decoder.decode(value, { stream: !done }) : '';
        buffer += chunk;

        // Split on double newlines (SSE event separator)
        const events = buffer.split('\n\n');
        // Keep the last incomplete event in the buffer
        buffer = events.pop() || '';

        for (const event of events) {
          const lines = event.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data === '[DONE]') {
                console.log('[generateGoals] Received [DONE] marker');
                continue;
              }

              try {
                const parsed = JSON.parse(data);
                if (parsed.type === 'chunk' && parsed.text) {
                  chunkCount++;
                  accumulatedContent += parsed.text;
                  if (chunkCount <= 3 || chunkCount % 50 === 0) {
                    console.log(`[generateGoals] Chunk #${chunkCount}:`, parsed.text.substring(0, 50) + '...');
                  }
                  if (onChunk) {
                    onChunk(parsed.text);
                  }
                } else if (parsed.type === 'done') {
                  console.log('[generateGoals] Received done event. Content length:', parsed.content?.length || accumulatedContent.length);
                  return {
                    success: true,
                    content: parsed.content || accumulatedContent,
                  };
                } else if (parsed.type === 'error') {
                  console.error('[generateGoals] Received error event:', parsed.error);
                  throw new Error(parsed.error || 'Server error during streaming');
                }
              } catch (e) {
                // Only log if it looks like it should be valid JSON
                if (data.startsWith('{')) {
                  console.log('[generateGoals] Invalid JSON in line:', data.substring(0, 100), e);
                }
              }
            }
          }
        }

        if (done) {
          console.log('[generateGoals] Stream done. Total chunks:', chunkCount, 'Total length:', accumulatedContent.length);
          break;
        }
      }

      // If we got here without a 'done' event, return accumulated content
      console.log('[generateGoals] Stream completed without done event. Returning accumulated content.');
      return {
        success: true,
        content: accumulatedContent,
      };
    } else {
      console.log('[generateGoals] Not SSE response, falling back to JSON parsing. Content-type:', contentType);
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
    console.error('[generateGoals] Exception:', error);
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

    // Handle streaming response with buffer for partial SSE events
    if (response.headers.get('content-type')?.includes('text/event-stream')) {
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';
      let buffer = ''; // Buffer for incomplete SSE events

      if (!reader) {
        throw new Error('No response body');
      }

      while (true) {
        const { done, value } = await reader.read();

        // Decode chunk and add to buffer
        const chunk = value ? decoder.decode(value, { stream: !done }) : '';
        buffer += chunk;

        // Split on SSE event boundaries (double newline)
        const events = buffer.split('\n\n');
        // Keep the last potentially incomplete event in buffer
        buffer = events.pop() || '';

        for (const event of events) {
          const lines = event.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
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
                // Skip invalid JSON - may be partial data
                logger.debug('Skipping invalid JSON in SOW SSE:', data.substring(0, 100));
              }
            }
          }
        }

        if (done) break;
      }

      // Process any remaining buffer content
      if (buffer.trim()) {
        const lines = buffer.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'done' && parsed.content) {
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

    // Handle streaming response with buffer for partial SSE events
    if (response.headers.get('content-type')?.includes('text/event-stream')) {
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';
      let buffer = ''; // Buffer for incomplete SSE events

      if (!reader) {
        throw new Error('No response body');
      }

      while (true) {
        const { done, value } = await reader.read();

        // Decode chunk and add to buffer
        const chunk = value ? decoder.decode(value, { stream: !done }) : '';
        buffer += chunk;

        // Split on SSE event boundaries (double newline)
        const events = buffer.split('\n\n');
        // Keep the last potentially incomplete event in buffer
        buffer = events.pop() || '';

        for (const event of events) {
          const lines = event.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
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
                // Skip invalid JSON - may be partial data
                logger.debug('Skipping invalid JSON in proposal SSE:', data.substring(0, 100));
              }
            }
          }
        }

        if (done) break;
      }

      // Process any remaining buffer content
      if (buffer.trim()) {
        const lines = buffer.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'done' && parsed.content) {
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
 * Extract goals, pain points, and proposed solutions from a meeting transcript
 * Used for Quick Mode proposal generation
 */
export async function extractGoalsFromMeeting(meetingId: string): Promise<{
  goals: string;
  painPoints: string[];
  proposedSolutions: string[];
}> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }

    // Get meeting transcript
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('transcript_text, summary, contact_id, company_id')
      .eq('id', meetingId)
      .single();

    if (meetingError || !meeting) {
      throw new Error('Meeting not found');
    }

    if (!meeting.transcript_text && !meeting.summary) {
      return {
        goals: '',
        painPoints: [],
        proposedSolutions: [],
      };
    }

    // Get contact and company info
    let contactName: string | undefined;
    let companyName: string | undefined;

    if (meeting.contact_id) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('first_name, last_name')
        .eq('id', meeting.contact_id)
        .single();
      
      if (contact) {
        contactName = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || undefined;
      }
    }

    if (meeting.company_id) {
      const { data: company } = await supabase
        .from('companies')
        .select('name')
        .eq('id', meeting.company_id)
        .single();
      
      if (company) {
        companyName = company.name;
      }
    }

    // Get Supabase URL
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('VITE_SUPABASE_URL is not configured');
    }

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

    // Call edge function to extract goals
    const response = await fetch(
      `${functionsUrl}/generate-proposal`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'extract_goals',
          transcript: meeting.transcript_text || meeting.summary,
          contact_name: contactName,
          company_name: companyName,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to extract goals');
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to extract goals');
    }

    return {
      goals: data.goals || '',
      painPoints: data.pain_points || [],
      proposedSolutions: data.proposed_solutions || [],
    };
  } catch (error) {
    logger.error('Exception extracting goals from meeting:', error);
    return {
      goals: '',
      painPoints: [],
      proposedSolutions: [],
    };
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

// ==========================================
// Proposal Sharing Functions
// ==========================================

/**
 * Hash a password using SHA-256 (same as edge function)
 */
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Update share settings for a proposal
 */
export async function updateProposalShareSettings(
  proposalId: string,
  settings: ShareSettings
): Promise<{ success: boolean; share_token?: string; error?: string }> {
  try {
    let password_hash: string | null = null;

    if (settings.password && settings.password.trim()) {
      password_hash = await hashPassword(settings.password);
    }

    const { data, error } = await supabase
      .from('proposals')
      .update({
        is_public: settings.is_public,
        password_hash: password_hash,
        updated_at: new Date().toISOString(),
      })
      .eq('id', proposalId)
      .select('share_token')
      .single();

    if (error) {
      logger.error('Error updating share settings:', error);
      return { success: false, error: error.message };
    }

    return { success: true, share_token: data?.share_token };
  } catch (error) {
    logger.error('Exception updating share settings:', error);
    return { success: false, error: 'Failed to update share settings' };
  }
}

/**
 * Get share settings for a proposal
 */
export async function getProposalShareSettings(
  proposalId: string
): Promise<{ is_public: boolean; has_password: boolean; share_token: string; share_views: number } | null> {
  try {
    const { data, error } = await supabase
      .from('proposals')
      .select('is_public, password_hash, share_token, share_views')
      .eq('id', proposalId)
      .single();

    if (error || !data) {
      logger.error('Error fetching share settings:', error);
      return null;
    }

    return {
      is_public: data.is_public || false,
      has_password: !!data.password_hash,
      share_token: data.share_token,
      share_views: data.share_views || 0,
    };
  } catch (error) {
    logger.error('Exception fetching share settings:', error);
    return null;
  }
}

/**
 * Generate a public share URL for a proposal
 */
export function getProposalShareUrl(shareToken: string): string {
  // Use the current origin for the share URL
  const baseUrl = typeof window !== 'undefined'
    ? window.location.origin
    : 'https://app.sixtyseconds.video';
  return `${baseUrl}/share/${shareToken}`;
}

/**
 * Disable sharing for a proposal
 */
export async function disableProposalSharing(proposalId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('proposals')
      .update({
        is_public: false,
        password_hash: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', proposalId);

    if (error) {
      logger.error('Error disabling sharing:', error);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Exception disabling sharing:', error);
    return false;
  }
}
