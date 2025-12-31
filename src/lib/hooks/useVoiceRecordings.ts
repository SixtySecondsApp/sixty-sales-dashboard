import { useState, useCallback, useEffect } from 'react';
import { useOrgId } from '@/lib/contexts/OrgContext';
import { voiceRecordingService, VoiceRecording } from '@/lib/services/voiceRecordingService';
import { toast } from 'sonner';

interface UseVoiceRecordingsReturn {
  recordings: VoiceRecording[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  uploadAndTranscribe: (audioBlob: Blob, title?: string) => Promise<VoiceRecording | null>;
  deleteRecording: (id: string) => Promise<boolean>;
  toggleActionItem: (recordingId: string, actionItemId: string) => Promise<boolean>;
  getRecording: (id: string) => Promise<VoiceRecording | null>;
}

/**
 * Hook for managing voice recordings
 */
export function useVoiceRecordings(): UseVoiceRecordingsReturn {
  const orgId = useOrgId();
  const [recordings, setRecordings] = useState<VoiceRecording[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch recordings
  const refetch = useCallback(async () => {
    if (!orgId) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await voiceRecordingService.getRecordings(orgId);
      setRecordings(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch recordings';
      setError(message);
      console.error('Error fetching recordings:', err);
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  // Initial fetch
  useEffect(() => {
    refetch();
  }, [refetch]);

  // Upload and transcribe a recording
  const uploadAndTranscribe = useCallback(
    async (audioBlob: Blob, title?: string): Promise<VoiceRecording | null> => {
      if (!orgId) {
        toast.error('No organization selected');
        return null;
      }

      try {
        // Step 1: Upload
        toast.loading('Uploading recording...', { id: 'voice-upload' });
        const uploadResult = await voiceRecordingService.uploadRecording(
          audioBlob,
          orgId,
          title
        );

        if (!uploadResult.success || !uploadResult.recording_id) {
          toast.error(uploadResult.error || 'Upload failed', { id: 'voice-upload' });
          return null;
        }

        toast.success('Recording uploaded!', { id: 'voice-upload' });

        // Step 2: Start transcription (async, don't wait)
        toast.loading('Transcribing with AI...', { id: 'voice-transcribe' });
        voiceRecordingService
          .transcribeRecording(uploadResult.recording_id)
          .then((transcribeResult) => {
            if (transcribeResult.success) {
              toast.success('Transcription complete!', { id: 'voice-transcribe' });
              refetch(); // Refresh the list
            } else {
              toast.error(transcribeResult.error || 'Transcription failed', {
                id: 'voice-transcribe',
              });
            }
          })
          .catch((err) => {
            console.error('Transcription error:', err);
            toast.error('Transcription failed', { id: 'voice-transcribe' });
          });

        // Return the recording immediately (before transcription completes)
        const recording = await voiceRecordingService.getRecording(
          uploadResult.recording_id
        );

        if (recording) {
          setRecordings((prev) => [recording, ...prev]);
        }

        return recording;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        toast.error(message, { id: 'voice-upload' });
        console.error('Upload error:', err);
        return null;
      }
    },
    [orgId, refetch]
  );

  // Delete a recording
  const deleteRecording = useCallback(
    async (id: string): Promise<boolean> => {
      const success = await voiceRecordingService.deleteRecording(id);
      if (success) {
        setRecordings((prev) => prev.filter((r) => r.id !== id));
        toast.success('Recording deleted');
      } else {
        toast.error('Failed to delete recording');
      }
      return success;
    },
    []
  );

  // Toggle action item
  const toggleActionItem = useCallback(
    async (recordingId: string, actionItemId: string): Promise<boolean> => {
      const success = await voiceRecordingService.toggleActionItem(
        recordingId,
        actionItemId
      );
      if (success) {
        // Update local state
        setRecordings((prev) =>
          prev.map((r) => {
            if (r.id === recordingId && r.action_items) {
              return {
                ...r,
                action_items: r.action_items.map((item) =>
                  item.id === actionItemId ? { ...item, done: !item.done } : item
                ),
              };
            }
            return r;
          })
        );
      }
      return success;
    },
    []
  );

  // Get single recording
  const getRecording = useCallback(
    async (id: string): Promise<VoiceRecording | null> => {
      return voiceRecordingService.getRecording(id);
    },
    []
  );

  return {
    recordings,
    isLoading,
    error,
    refetch,
    uploadAndTranscribe,
    deleteRecording,
    toggleActionItem,
    getRecording,
  };
}

export default useVoiceRecordings;
