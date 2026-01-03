import { useState, useCallback, useEffect, useRef } from 'react';
import { useOrgId } from '@/lib/contexts/OrgContext';
import { voiceRecordingService, VoiceRecording, RecordingType } from '@/lib/services/voiceRecordingService';
import { toast } from 'sonner';

// Set to true to use mock data for development without backend
const USE_MOCK_DATA = false;

interface UseVoiceRecordingsReturn {
  recordings: VoiceRecording[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  uploadAndTranscribe: (audioBlob: Blob, title?: string, recordingType?: RecordingType) => Promise<VoiceRecording | null>;
  deleteRecording: (id: string) => Promise<boolean>;
  toggleActionItem: (recordingId: string, actionItemId: string) => Promise<boolean>;
  getRecording: (id: string) => Promise<VoiceRecording | null>;
  retryTranscription: (recordingId: string) => Promise<boolean>;
}

// Mock data generator
function generateMockRecording(durationSeconds: number): VoiceRecording {
  const id = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const now = new Date();

  const meetingTitles = [
    'Pipeline Review',
    'Discovery Call',
    'Team Standup',
    'Client Check-in',
    'Product Demo',
    'Strategy Session',
    'Account Review',
    'Kickoff Meeting',
  ];

  const speakerNames = [
    'Sarah Chen',
    'David Kim',
    'Rachel Green',
    'Michael Scott',
    'Lisa Wang',
    'James Rodriguez',
  ];

  const title = meetingTitles[Math.floor(Math.random() * meetingTitles.length)];
  const numSpeakers = Math.min(2 + Math.floor(Math.random() * 2), speakerNames.length);
  const selectedSpeakers = ['You', ...speakerNames.slice(0, numSpeakers - 1)];

  const speakers = selectedSpeakers.map((name, idx) => ({
    id: idx + 1,
    name,
    initials: name === 'You' ? 'ME' : name.split(' ').map(n => n[0]).join(''),
  }));

  const actionItems = [
    {
      id: `action-${id}-1`,
      text: 'Send follow-up email with proposal details',
      owner: 'You',
      deadline: 'Today',
      done: false,
    },
    {
      id: `action-${id}-2`,
      text: 'Schedule technical deep-dive session',
      owner: selectedSpeakers[1] || 'Team',
      deadline: 'This week',
      done: false,
    },
    {
      id: `action-${id}-3`,
      text: 'Share implementation timeline document',
      owner: 'You',
      deadline: 'Tomorrow',
      done: false,
    },
  ];

  const transcriptSegments = [
    {
      speaker: 'You',
      start_time: 0,
      text: "Thanks for joining today. Let's go through the key items on our agenda.",
    },
    {
      speaker: selectedSpeakers[1] || 'Guest',
      start_time: 15,
      text: "Sounds good. I've reviewed the materials you sent over and have a few questions.",
    },
    {
      speaker: 'You',
      start_time: 35,
      text: "Great, let's address those. What would you like to start with?",
    },
    {
      speaker: selectedSpeakers[1] || 'Guest',
      start_time: 50,
      text: "First, I'd like to understand the implementation timeline better.",
    },
    {
      speaker: 'You',
      start_time: 70,
      text: "We're looking at a 6-week rollout with dedicated onboarding support.",
    },
  ];

  const summaryOptions = [
    `Discussed project timeline and deliverables with ${selectedSpeakers[1] || 'the team'}. Key decisions made around implementation approach. Action items assigned for follow-up documentation and next steps scheduling.`,
    `Productive session covering Q1 priorities and resource allocation. ${selectedSpeakers[1] || 'Stakeholders'} confirmed budget approval and requested detailed timeline. Next step: send proposal and schedule technical review.`,
    `Review of current progress and upcoming milestones. Addressed questions about integration requirements. Team aligned on approach, with follow-up items assigned to key participants.`,
  ];

  return {
    id,
    org_id: 'mock-org',
    user_id: 'mock-user',
    title,
    audio_url: null,
    duration_seconds: durationSeconds,
    status: 'completed',
    transcript_text: transcriptSegments.map(s => `${s.speaker}: ${s.text}`).join('\n'),
    transcript_segments: transcriptSegments,
    speakers,
    summary: summaryOptions[Math.floor(Math.random() * summaryOptions.length)],
    action_items: actionItems,
    recording_type: 'meeting' as const,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
}

// Sample recordings for initial state
const SAMPLE_RECORDINGS: VoiceRecording[] = [
  {
    id: 'sample-1',
    org_id: 'mock-org',
    user_id: 'mock-user',
    title: 'Pipeline Review with Sarah Chen',
    audio_url: null,
    duration_seconds: 1934, // 32:14
    status: 'completed',
    transcript_text: 'Sample transcript...',
    transcript_segments: [
      { speaker: 'You', start_time: 12, text: "Thanks for joining. Let's walk through the Q1 pipeline." },
      { speaker: 'Sarah Chen', start_time: 28, text: "I've reviewed the proposal. Questions about implementation." },
      { speaker: 'You', start_time: 45, text: "We're looking at 6 weeks with dedicated onboarding." },
      { speaker: 'Sarah Chen', start_time: 62, text: 'Can we loop in legal by Friday for the MSA?' },
    ],
    speakers: [
      { id: 1, name: 'You', initials: 'ME' },
      { id: 2, name: 'Sarah Chen', initials: 'SC' },
    ],
    summary: 'Discussed Q1 enterprise deal with Meridian Technologies. Sarah confirmed budget approval and requested 6-week implementation timeline. Legal review needed before contract signing. Next step: Send MSA and schedule kickoff.',
    action_items: [
      { id: 'a1', text: 'Send MSA to legal team', owner: 'You', deadline: 'Today', done: false },
      { id: 'a2', text: 'Share implementation timeline', owner: 'You', deadline: 'Tomorrow', done: false },
      { id: 'a3', text: 'Connect with David Kim (Legal)', owner: 'Sarah', deadline: 'EOD', done: true },
    ],
    recording_type: 'meeting',
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'sample-2',
    org_id: 'mock-org',
    user_id: 'mock-user',
    title: 'Team Standup',
    audio_url: null,
    duration_seconds: 922, // 15:22
    status: 'completed',
    transcript_text: 'Sample transcript...',
    transcript_segments: [
      { speaker: 'You', start_time: 0, text: "Good morning everyone. Let's go around." },
      { speaker: 'David Kim', start_time: 15, text: 'Working on the API integration, should be done by EOD.' },
      { speaker: 'Rachel Green', start_time: 35, text: 'QA testing the new features, found a few edge cases.' },
    ],
    speakers: [
      { id: 1, name: 'You', initials: 'ME' },
      { id: 2, name: 'David Kim', initials: 'DK' },
      { id: 3, name: 'Rachel Green', initials: 'RG' },
    ],
    summary: 'Daily standup covering sprint progress. API integration on track for completion today. QA identified edge cases in new feature set that need addressing. Team aligned on priorities.',
    action_items: [
      { id: 'b1', text: 'Complete API integration', owner: 'David', deadline: 'EOD', done: false },
      { id: 'b2', text: 'Document edge cases', owner: 'Rachel', deadline: 'Tomorrow', done: false },
      { id: 'b3', text: 'Review PR #423', owner: 'You', deadline: 'Today', done: false },
      { id: 'b4', text: 'Update sprint board', owner: 'You', deadline: 'Today', done: true },
      { id: 'b5', text: 'Send status update to stakeholders', owner: 'You', deadline: 'EOD', done: false },
    ],
    recording_type: 'voice_note',
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
    updated_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'sample-3',
    org_id: 'mock-org',
    user_id: 'mock-user',
    title: 'Discovery Call - Acme Corp',
    audio_url: null,
    duration_seconds: 1725, // 28:45
    status: 'completed',
    transcript_text: 'Sample transcript...',
    transcript_segments: [
      { speaker: 'You', start_time: 0, text: 'Thanks for taking the time to meet today.' },
      { speaker: 'Lisa Wang', start_time: 12, text: "We're looking for a solution to streamline our sales process." },
      { speaker: 'You', start_time: 30, text: "That's exactly what we specialize in. Can you tell me more about your current workflow?" },
    ],
    speakers: [
      { id: 1, name: 'You', initials: 'ME' },
      { id: 2, name: 'Lisa Wang', initials: 'LW' },
    ],
    summary: 'Initial discovery call with Acme Corp. Lisa expressed interest in sales automation and CRM integration. Current pain points: manual data entry and lack of meeting insights. Potential fit for enterprise tier. Next step: Product demo next week.',
    action_items: [
      { id: 'c1', text: 'Schedule product demo', owner: 'You', deadline: 'This week', done: false },
      { id: 'c2', text: 'Send case study from similar company', owner: 'You', deadline: 'Tomorrow', done: false },
      { id: 'c3', text: 'Prepare custom demo environment', owner: 'You', deadline: 'Before demo', done: false },
      { id: 'c4', text: 'Loop in solutions engineer', owner: 'You', deadline: 'Today', done: true },
    ],
    recording_type: 'meeting',
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    updated_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
];

/**
 * Hook for managing voice recordings
 * Uses mock data when USE_MOCK_DATA is true (for development/demo)
 */
export function useVoiceRecordings(): UseVoiceRecordingsReturn {
  const orgId = useOrgId();
  const [recordings, setRecordings] = useState<VoiceRecording[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mockRecordingsRef = useRef<VoiceRecording[]>(SAMPLE_RECORDINGS);

  // Fetch recordings
  const refetch = useCallback(async () => {
    if (USE_MOCK_DATA) {
      setIsLoading(true);
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 500));
      setRecordings([...mockRecordingsRef.current]);
      setIsLoading(false);
      return;
    }

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
    async (audioBlob: Blob, title?: string, recordingType: RecordingType = 'meeting'): Promise<VoiceRecording | null> => {
      if (USE_MOCK_DATA) {
        // Simulate upload
        toast.loading('Uploading recording...', { id: 'voice-upload' });
        await new Promise((resolve) => setTimeout(resolve, 1500));
        toast.success('Recording uploaded!', { id: 'voice-upload' });

        // Simulate transcription
        toast.loading('Transcribing with AI...', { id: 'voice-transcribe' });

        // Calculate duration from blob size (rough estimate: ~16KB per second for webm)
        const estimatedDuration = Math.max(30, Math.floor(audioBlob.size / 16000));
        const newRecording = generateMockRecording(estimatedDuration);

        if (title) {
          newRecording.title = title;
        }

        // Simulate transcription delay
        await new Promise((resolve) => setTimeout(resolve, 2000));
        toast.success('Transcription complete!', { id: 'voice-transcribe' });

        // Add to recordings
        mockRecordingsRef.current = [newRecording, ...mockRecordingsRef.current];
        setRecordings([...mockRecordingsRef.current]);

        return newRecording;
      }

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
          title,
          recordingType
        );

        if (!uploadResult.success || !uploadResult.recording_id) {
          toast.error(uploadResult.error || 'Upload failed', { id: 'voice-upload' });
          return null;
        }

        toast.success('Recording uploaded!', { id: 'voice-upload' });

        // Step 2: Start transcription
        toast.loading('Starting AI transcription...', { id: 'voice-transcribe' });
        const transcribeResult = await voiceRecordingService.transcribeRecording(
          uploadResult.recording_id
        );

        if (!transcribeResult.success) {
          toast.error(transcribeResult.error || 'Failed to start transcription', {
            id: 'voice-transcribe',
          });
          // Still return the recording even if transcription failed to start
          const recording = await voiceRecordingService.getRecording(
            uploadResult.recording_id
          );
          if (recording) {
            setRecordings((prev) => [recording, ...prev]);
          }
          return recording;
        }

        // Step 3: Poll for transcription results
        toast.loading('Transcribing with AI... This may take a minute.', {
          id: 'voice-transcribe',
        });

        const recordingId = uploadResult.recording_id;
        let pollAttempts = 0;
        const maxPollAttempts = 60; // 5 minutes max (5s * 60)
        let lastStatus = '';

        const pollForResults = async (): Promise<VoiceRecording | null> => {
          while (pollAttempts < maxPollAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5s
            pollAttempts++;

            const pollResult = await voiceRecordingService.pollTranscription(recordingId);

            if (pollResult.status === 'completed') {
              toast.success('Transcription complete!', { id: 'voice-transcribe' });
              await refetch();
              return await voiceRecordingService.getRecording(recordingId);
            }

            if (pollResult.status === 'failed') {
              toast.error(pollResult.error || 'Transcription failed', {
                id: 'voice-transcribe',
              });
              return await voiceRecordingService.getRecording(recordingId);
            }

            // Update status message
            if (pollResult.gladia_status && pollResult.gladia_status !== lastStatus) {
              lastStatus = pollResult.gladia_status;
              toast.loading(`Transcribing... (${lastStatus})`, {
                id: 'voice-transcribe',
              });
            }
          }

          toast.error('Transcription timed out. Try refreshing later.', {
            id: 'voice-transcribe',
          });
          return await voiceRecordingService.getRecording(recordingId);
        };

        // Start polling in the background, return recording immediately
        const recording = await voiceRecordingService.getRecording(recordingId);
        if (recording) {
          setRecordings((prev) => [recording, ...prev]);
        }

        // Continue polling in background
        pollForResults().then((updatedRecording) => {
          if (updatedRecording) {
            setRecordings((prev) =>
              prev.map((r) => (r.id === recordingId ? updatedRecording : r))
            );
          }
        });

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
      if (USE_MOCK_DATA) {
        mockRecordingsRef.current = mockRecordingsRef.current.filter((r) => r.id !== id);
        setRecordings([...mockRecordingsRef.current]);
        toast.success('Recording deleted');
        return true;
      }

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
      if (USE_MOCK_DATA) {
        mockRecordingsRef.current = mockRecordingsRef.current.map((r) => {
          if (r.id === recordingId && r.action_items) {
            return {
              ...r,
              action_items: r.action_items.map((item) =>
                item.id === actionItemId ? { ...item, done: !item.done } : item
              ),
            };
          }
          return r;
        });
        setRecordings([...mockRecordingsRef.current]);
        return true;
      }

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
      if (USE_MOCK_DATA) {
        const recording = mockRecordingsRef.current.find((r) => r.id === id);
        return recording || null;
      }

      return voiceRecordingService.getRecording(id);
    },
    []
  );

  // Retry transcription for a recording
  const retryTranscription = useCallback(
    async (recordingId: string): Promise<boolean> => {
      if (USE_MOCK_DATA) {
        toast.success('Mock transcription completed');
        return true;
      }

      try {
        toast.loading('Starting transcription...', { id: 'voice-transcribe' });

        // Start transcription
        const result = await voiceRecordingService.transcribeRecording(recordingId);

        if (!result.success) {
          toast.error(result.error || 'Failed to start transcription', {
            id: 'voice-transcribe',
          });
          return false;
        }

        // Poll for results
        toast.loading('Transcribing with AI... This may take a minute.', {
          id: 'voice-transcribe',
        });

        let pollAttempts = 0;
        const maxPollAttempts = 60; // 5 minutes max
        let lastStatus = '';

        while (pollAttempts < maxPollAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
          pollAttempts++;

          const pollResult = await voiceRecordingService.pollTranscription(recordingId);

          if (pollResult.status === 'completed') {
            toast.success('Transcription complete!', { id: 'voice-transcribe' });
            await refetch();
            return true;
          }

          if (pollResult.status === 'failed') {
            toast.error(pollResult.error || 'Transcription failed', {
              id: 'voice-transcribe',
            });
            return false;
          }

          if (pollResult.gladia_status && pollResult.gladia_status !== lastStatus) {
            lastStatus = pollResult.gladia_status;
            toast.loading(`Transcribing... (${lastStatus})`, {
              id: 'voice-transcribe',
            });
          }
        }

        toast.error('Transcription timed out', { id: 'voice-transcribe' });
        return false;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Transcription failed';
        toast.error(message, { id: 'voice-transcribe' });
        console.error('Retry transcription error:', err);
        return false;
      }
    },
    [refetch]
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
    retryTranscription,
  };
}

export default useVoiceRecordings;
