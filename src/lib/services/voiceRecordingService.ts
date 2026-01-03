import { supabase } from '@/lib/supabase/clientV2';

export type RecordingType = 'meeting' | 'voice_note';

export interface VoiceRecording {
  id: string;
  org_id: string;
  user_id: string;
  title: string;
  audio_url: string;
  file_name: string;
  file_size_bytes: number | null;
  duration_seconds: number | null;
  status: 'uploaded' | 'transcribing' | 'analyzing' | 'completed' | 'failed';
  error_message: string | null;
  transcript_text: string | null;
  transcript_segments: TranscriptSegment[] | null;
  speakers: Speaker[] | null;
  language: string | null;
  summary: string | null;
  action_items: ActionItem[] | null;
  key_topics: string[] | null;
  sentiment_score: number | null;
  meeting_id: string | null;
  contact_id: string | null;
  company_id: string | null;
  deal_id: string | null;
  recording_type: RecordingType;
  recorded_at: string;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TranscriptSegment {
  speaker: string;
  speaker_id: number;
  text: string;
  start_time: number;
  end_time: number;
  confidence: number;
}

export interface Speaker {
  id: number;
  name: string;
  initials: string;
  color?: string;
}

export interface ActionItem {
  id: string;
  text: string;
  owner: string;
  deadline: string;
  done: boolean;
  priority?: 'high' | 'medium' | 'low';
}

export interface UploadResult {
  success: boolean;
  recording_id?: string;
  audio_url?: string;
  error?: string;
}

export interface TranscribeResult {
  success: boolean;
  recording_id?: string;
  transcript?: string;
  speakers?: Speaker[];
  status?: string;
  message?: string;
  error?: string;
}

export interface PollResult {
  success: boolean;
  recording_id?: string;
  status?: string;
  transcript?: string;
  speakers?: Speaker[];
  summary?: string;
  gladia_status?: string;
  message?: string;
  error?: string;
}

/**
 * Voice Recording Service
 * Handles uploading, transcribing, and managing voice recordings
 */
export const voiceRecordingService = {
  /**
   * Upload a voice recording to S3 and create database record
   */
  async uploadRecording(
    audioBlob: Blob,
    orgId: string,
    title?: string,
    recordingType: RecordingType = 'meeting'
  ): Promise<UploadResult> {
    try {
      // Convert blob to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ''
        )
      );

      // Determine file extension from blob type
      const mimeType = audioBlob.type || 'audio/webm';
      const extension = mimeType.split('/')[1]?.split(';')[0] || 'webm';
      const fileName = `recording-${Date.now()}.${extension}`;

      // Get duration (approximate from file size if not available)
      const durationSeconds = Math.round(audioBlob.size / 16000); // Rough estimate for webm

      const { data, error } = await supabase.functions.invoke('voice-upload', {
        body: {
          audio_data: `data:${mimeType};base64,${base64}`,
          file_name: fileName,
          duration_seconds: durationSeconds,
          org_id: orgId,
          title: title || `Recording ${new Date().toLocaleString()}`,
          recording_type: recordingType,
        },
      });

      if (error) {
        console.error('Upload error:', error);
        // Try to extract detailed error from response context
        const errorMessage = error.context?.body?.error
          || error.message
          || 'Upload failed';
        return { success: false, error: errorMessage };
      }

      // Check if the response indicates failure (edge function returned error in body)
      if (data && data.error) {
        console.error('Upload error from edge function:', data.error);
        return { success: false, error: data.error };
      }

      return {
        success: true,
        recording_id: data.recording_id,
        audio_url: data.audio_url,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      console.error('Upload error:', err);
      return { success: false, error: message };
    }
  },

  /**
   * Start transcription for a recording (async - returns immediately)
   */
  async transcribeRecording(recordingId: string): Promise<TranscribeResult> {
    try {
      const { data, error } = await supabase.functions.invoke('voice-transcribe', {
        body: { recording_id: recordingId },
      });

      if (error) {
        console.error('Transcribe error:', error);
        const errorMessage = error.context?.body?.error
          || error.message
          || 'Transcription failed';
        return { success: false, error: errorMessage };
      }

      if (data && data.error) {
        console.error('Transcribe error from edge function:', data.error);
        return { success: false, error: data.error };
      }

      return {
        success: true,
        recording_id: data.recording_id,
        status: data.status,
        message: data.message,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Transcription failed';
      console.error('Transcribe error:', err);
      return { success: false, error: message };
    }
  },

  /**
   * Poll for transcription results
   */
  async pollTranscription(recordingId: string): Promise<PollResult> {
    try {
      const { data, error } = await supabase.functions.invoke('voice-transcribe-poll', {
        body: { recording_id: recordingId },
      });

      if (error) {
        console.error('Poll error:', error);
        const errorMessage = error.context?.body?.error
          || error.message
          || 'Poll failed';
        return { success: false, error: errorMessage };
      }

      if (data && data.error) {
        console.error('Poll error from edge function:', data.error);
        return { success: false, error: data.error, status: data.status };
      }

      return {
        success: data.success,
        recording_id: data.recording_id,
        status: data.status,
        transcript: data.transcript,
        speakers: data.speakers,
        summary: data.summary,
        gladia_status: data.gladia_status,
        message: data.message,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Poll failed';
      console.error('Poll error:', err);
      return { success: false, error: message };
    }
  },

  /**
   * Get all recordings for an organization
   */
  async getRecordings(orgId: string): Promise<VoiceRecording[]> {
    const { data, error } = await supabase
      .from('voice_recordings')
      .select('*')
      .eq('org_id', orgId)
      .order('recorded_at', { ascending: false });

    if (error) {
      console.error('Error fetching recordings:', error);
      return [];
    }

    return data || [];
  },

  /**
   * Get a single recording by ID
   */
  async getRecording(recordingId: string): Promise<VoiceRecording | null> {
    const { data, error } = await supabase
      .from('voice_recordings')
      .select('*')
      .eq('id', recordingId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching recording:', error);
      return null;
    }

    return data;
  },

  /**
   * Update recording title
   */
  async updateTitle(recordingId: string, title: string): Promise<boolean> {
    const { error } = await supabase
      .from('voice_recordings')
      .update({ title })
      .eq('id', recordingId);

    if (error) {
      console.error('Error updating title:', error);
      return false;
    }

    return true;
  },

  /**
   * Update action item status
   */
  async toggleActionItem(
    recordingId: string,
    actionItemId: string
  ): Promise<boolean> {
    // Get current recording
    const recording = await this.getRecording(recordingId);
    if (!recording || !recording.action_items) return false;

    // Toggle the action item
    const updatedItems = recording.action_items.map((item: ActionItem) =>
      item.id === actionItemId ? { ...item, done: !item.done } : item
    );

    const { error } = await supabase
      .from('voice_recordings')
      .update({ action_items: updatedItems })
      .eq('id', recordingId);

    if (error) {
      console.error('Error toggling action item:', error);
      return false;
    }

    return true;
  },

  /**
   * Delete a recording
   */
  async deleteRecording(recordingId: string): Promise<boolean> {
    const { error } = await supabase
      .from('voice_recordings')
      .delete()
      .eq('id', recordingId);

    if (error) {
      console.error('Error deleting recording:', error);
      return false;
    }

    return true;
  },

  /**
   * Link recording to a meeting
   */
  async linkToMeeting(recordingId: string, meetingId: string): Promise<boolean> {
    const { error } = await supabase
      .from('voice_recordings')
      .update({ meeting_id: meetingId })
      .eq('id', recordingId);

    if (error) {
      console.error('Error linking to meeting:', error);
      return false;
    }

    return true;
  },

  /**
   * Link recording to a contact
   */
  async linkToContact(recordingId: string, contactId: string): Promise<boolean> {
    const { error } = await supabase
      .from('voice_recordings')
      .update({ contact_id: contactId })
      .eq('id', recordingId);

    if (error) {
      console.error('Error linking to contact:', error);
      return false;
    }

    return true;
  },

  /**
   * Get a presigned URL for audio playback
   * Supports both authenticated access and public access via share_token
   */
  async getAudioPlaybackUrl(
    recordingId: string,
    shareToken?: string
  ): Promise<{ url: string; expires_in: number } | null> {
    try {
      const { data, error } = await supabase.functions.invoke('voice-audio-url', {
        body: { recording_id: recordingId, share_token: shareToken },
      });

      if (error) {
        console.error('Audio URL error:', error);
        return null;
      }

      if (data && data.error) {
        console.error('Audio URL error from edge function:', data.error);
        return null;
      }

      return {
        url: data.url,
        expires_in: data.expires_in,
      };
    } catch (err) {
      console.error('Audio URL error:', err);
      return null;
    }
  },

  /**
   * Enable public sharing for a recording
   */
  async enableSharing(recordingId: string): Promise<{ share_url: string } | null> {
    try {
      const { data, error } = await supabase.functions.invoke('voice-share', {
        body: { recording_id: recordingId, enable: true },
      });

      if (error) {
        console.error('Enable sharing error:', error);
        return null;
      }

      if (data && data.error) {
        console.error('Enable sharing error from edge function:', data.error);
        return null;
      }

      return { share_url: data.share_url };
    } catch (err) {
      console.error('Enable sharing error:', err);
      return null;
    }
  },

  /**
   * Disable public sharing for a recording
   */
  async disableSharing(recordingId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.functions.invoke('voice-share', {
        body: { recording_id: recordingId, enable: false },
      });

      if (error) {
        console.error('Disable sharing error:', error);
        return false;
      }

      return data?.success === true;
    } catch (err) {
      console.error('Disable sharing error:', err);
      return false;
    }
  },

  /**
   * Get a public recording by share token (no auth required)
   */
  async getPublicRecording(shareToken: string): Promise<VoiceRecording | null> {
    const { data, error } = await supabase
      .from('voice_recordings')
      .select('*')
      .eq('share_token', shareToken)
      .eq('is_public', true)
      .maybeSingle();

    if (error) {
      console.error('Error fetching public recording:', error);
      return null;
    }

    return data;
  },

  /**
   * Get sharing status for a recording
   */
  async getSharingStatus(recordingId: string): Promise<{
    is_public: boolean;
    share_token: string | null;
    share_views: number;
  } | null> {
    const { data, error } = await supabase
      .from('voice_recordings')
      .select('is_public, share_token, share_views')
      .eq('id', recordingId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching sharing status:', error);
      return null;
    }

    return data;
  },
};

export default voiceRecordingService;
