import { useState, useCallback, useEffect, useRef } from 'react';
import { useOrgId } from '@/lib/contexts/OrgContext';
import { voiceRecordingService, VoiceRecording, RecordingType } from '@/lib/services/voiceRecordingService';
import { toast } from 'sonner';

// Set to true to use mock data (until S3/Gladia are configured)
const USE_MOCK_DATA = true;

interface UseVoiceRecordingsReturn {
  recordings: VoiceRecording[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  uploadAndTranscribe: (audioBlob: Blob, title?: string, recordingType?: RecordingType) => Promise<VoiceRecording | null>;
  deleteRecording: (id: string) => Promise<boolean>;
  toggleActionItem: (recordingId: string, actionItemId: string) => Promise<boolean>;
  getRecording: (id: string) => Promise<VoiceRecording | null>;
}

// Mock data generator
function generateMockRecording(durationSeconds: number, recordingType: RecordingType = 'meeting'): VoiceRecording {
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

  const voiceNoteTitles = [
    'Quick reminder about follow-up',
    'Meeting prep notes',
    'Client feedback summary',
    'Action items for next week',
    'Project update thoughts',
    'Ideas for presentation',
  ];

  const speakerNames = [
    'Sarah Chen',
    'David Kim',
    'Rachel Green',
    'Michael Scott',
    'Lisa Wang',
    'James Rodriguez',
  ];

  const titleOptions = recordingType === 'voice_note' ? voiceNoteTitles : meetingTitles;
  const title = titleOptions[Math.floor(Math.random() * titleOptions.length)];
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
    file_name: `recording-${id}.webm`,
    file_size_bytes: null,
    duration_seconds: durationSeconds,
    status: 'completed',
    recording_type: recordingType,
    error_message: null,
    transcript_text: transcriptSegments.map(s => `${s.speaker}: ${s.text}`).join('\n'),
    transcript_segments: transcriptSegments,
    speakers,
    language: 'en',
    summary: summaryOptions[Math.floor(Math.random() * summaryOptions.length)],
    action_items: actionItems,
    key_topics: null,
    sentiment_score: null,
    meeting_id: null,
    contact_id: null,
    company_id: null,
    deal_id: null,
    recorded_at: now.toISOString(),
    processed_at: now.toISOString(),
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
    file_name: 'recording-sample-1.webm',
    file_size_bytes: null,
    duration_seconds: 1934, // 32:14
    status: 'completed',
    recording_type: 'meeting',
    error_message: null,
    transcript_text: 'Sample transcript...',
    transcript_segments: [
      { speaker: 'You', speaker_id: 1, start_time: 12, end_time: 27, text: "Thanks for joining. Let's walk through the Q1 pipeline.", confidence: 0.95 },
      { speaker: 'Sarah Chen', speaker_id: 2, start_time: 28, end_time: 44, text: "I've reviewed the proposal. Questions about implementation.", confidence: 0.93 },
      { speaker: 'You', speaker_id: 1, start_time: 45, end_time: 61, text: "We're looking at 6 weeks with dedicated onboarding.", confidence: 0.96 },
      { speaker: 'Sarah Chen', speaker_id: 2, start_time: 62, end_time: 78, text: 'Can we loop in legal by Friday for the MSA?', confidence: 0.94 },
    ],
    speakers: [
      { id: 1, name: 'You', initials: 'ME' },
      { id: 2, name: 'Sarah Chen', initials: 'SC' },
    ],
    language: 'en',
    summary: 'Discussed Q1 enterprise deal with Meridian Technologies. Sarah confirmed budget approval and requested 6-week implementation timeline. Legal review needed before contract signing. Next step: Send MSA and schedule kickoff.',
    action_items: [
      { id: 'a1', text: 'Send MSA to legal team', owner: 'You', deadline: 'Today', done: false },
      { id: 'a2', text: 'Share implementation timeline', owner: 'You', deadline: 'Tomorrow', done: false },
      { id: 'a3', text: 'Connect with David Kim (Legal)', owner: 'Sarah', deadline: 'EOD', done: true },
    ],
    key_topics: null,
    sentiment_score: null,
    meeting_id: null,
    contact_id: null,
    company_id: null,
    deal_id: null,
    recorded_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    processed_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'sample-2',
    org_id: 'mock-org',
    user_id: 'mock-user',
    title: 'Team Standup',
    audio_url: null,
    file_name: 'recording-sample-2.webm',
    file_size_bytes: null,
    duration_seconds: 922, // 15:22
    status: 'completed',
    recording_type: 'meeting',
    error_message: null,
    transcript_text: 'Sample transcript...',
    transcript_segments: [
      { speaker: 'You', speaker_id: 1, start_time: 0, end_time: 14, text: "Good morning everyone. Let's go around.", confidence: 0.97 },
      { speaker: 'David Kim', speaker_id: 2, start_time: 15, end_time: 34, text: 'Working on the API integration, should be done by EOD.', confidence: 0.94 },
      { speaker: 'Rachel Green', speaker_id: 3, start_time: 35, end_time: 55, text: 'QA testing the new features, found a few edge cases.', confidence: 0.95 },
    ],
    speakers: [
      { id: 1, name: 'You', initials: 'ME' },
      { id: 2, name: 'David Kim', initials: 'DK' },
      { id: 3, name: 'Rachel Green', initials: 'RG' },
    ],
    language: 'en',
    summary: 'Daily standup covering sprint progress. API integration on track for completion today. QA identified edge cases in new feature set that need addressing. Team aligned on priorities.',
    action_items: [
      { id: 'b1', text: 'Complete API integration', owner: 'David', deadline: 'EOD', done: false },
      { id: 'b2', text: 'Document edge cases', owner: 'Rachel', deadline: 'Tomorrow', done: false },
      { id: 'b3', text: 'Review PR #423', owner: 'You', deadline: 'Today', done: false },
      { id: 'b4', text: 'Update sprint board', owner: 'You', deadline: 'Today', done: true },
      { id: 'b5', text: 'Send status update to stakeholders', owner: 'You', deadline: 'EOD', done: false },
    ],
    key_topics: null,
    sentiment_score: null,
    meeting_id: null,
    contact_id: null,
    company_id: null,
    deal_id: null,
    recorded_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    processed_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'sample-3',
    org_id: 'mock-org',
    user_id: 'mock-user',
    title: 'Discovery Call - Acme Corp',
    audio_url: null,
    file_name: 'recording-sample-3.webm',
    file_size_bytes: null,
    duration_seconds: 1725, // 28:45
    status: 'completed',
    recording_type: 'meeting',
    error_message: null,
    transcript_text: 'Sample transcript...',
    transcript_segments: [
      { speaker: 'You', speaker_id: 1, start_time: 0, end_time: 11, text: 'Thanks for taking the time to meet today.', confidence: 0.98 },
      { speaker: 'Lisa Wang', speaker_id: 2, start_time: 12, end_time: 29, text: "We're looking for a solution to streamline our sales process.", confidence: 0.95 },
      { speaker: 'You', speaker_id: 1, start_time: 30, end_time: 48, text: "That's exactly what we specialize in. Can you tell me more about your current workflow?", confidence: 0.96 },
    ],
    speakers: [
      { id: 1, name: 'You', initials: 'ME' },
      { id: 2, name: 'Lisa Wang', initials: 'LW' },
    ],
    language: 'en',
    summary: 'Initial discovery call with Acme Corp. Lisa expressed interest in sales automation and CRM integration. Current pain points: manual data entry and lack of meeting insights. Potential fit for enterprise tier. Next step: Product demo next week.',
    action_items: [
      { id: 'c1', text: 'Schedule product demo', owner: 'You', deadline: 'This week', done: false },
      { id: 'c2', text: 'Send case study from similar company', owner: 'You', deadline: 'Tomorrow', done: false },
      { id: 'c3', text: 'Prepare custom demo environment', owner: 'You', deadline: 'Before demo', done: false },
      { id: 'c4', text: 'Loop in solutions engineer', owner: 'You', deadline: 'Today', done: true },
    ],
    key_topics: null,
    sentiment_score: null,
    meeting_id: null,
    contact_id: null,
    company_id: null,
    deal_id: null,
    recorded_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    processed_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'sample-4',
    org_id: 'mock-org',
    user_id: 'mock-user',
    title: 'Quick thoughts on Q2 strategy',
    audio_url: null,
    file_name: 'recording-sample-4.webm',
    file_size_bytes: null,
    duration_seconds: 185, // 3:05
    status: 'completed',
    recording_type: 'voice_note',
    error_message: null,
    transcript_text: 'Need to remember to follow up with the enterprise team about Q2 targets...',
    transcript_segments: [
      { speaker: 'You', speaker_id: 1, start_time: 0, end_time: 45, text: 'Need to remember to follow up with the enterprise team about Q2 targets. The pipeline is looking good but we need to close at least 3 more deals by end of month.', confidence: 0.97 },
      { speaker: 'You', speaker_id: 1, start_time: 46, end_time: 95, text: 'Also thinking about restructuring the demo flow. Current version is too long and we lose people halfway through.', confidence: 0.96 },
      { speaker: 'You', speaker_id: 1, start_time: 96, end_time: 185, text: 'Action item: schedule sync with product team this week to discuss new feature rollout timeline.', confidence: 0.98 },
    ],
    speakers: [
      { id: 1, name: 'You', initials: 'ME' },
    ],
    language: 'en',
    summary: 'Personal voice note about Q2 planning. Key points: follow up on enterprise deals, restructure demo flow, and sync with product team on feature timeline.',
    action_items: [
      { id: 'd1', text: 'Follow up with enterprise team on Q2 targets', owner: 'You', deadline: 'This week', done: false },
      { id: 'd2', text: 'Schedule sync with product team', owner: 'You', deadline: 'This week', done: false },
    ],
    key_topics: null,
    sentiment_score: null,
    meeting_id: null,
    contact_id: null,
    company_id: null,
    deal_id: null,
    recorded_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    processed_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
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
        const newRecording = generateMockRecording(estimatedDuration, recordingType);

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
