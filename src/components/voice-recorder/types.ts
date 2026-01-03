// Voice Recorder Types and Interfaces

export type RecordingScreen = 'home' | 'recording' | 'meeting';

export type RecordingType = 'meeting' | 'voice_note';

export interface RecordingTypeOption {
  type: RecordingType;
  label: string;
  description: string;
  icon: 'users' | 'mic';
}

export interface Speaker {
  id: number;
  name: string;
  initials: string;
  duration: string;
  color: string;
}

export type ActionItemPriority = 'high' | 'medium' | 'low';
export type ActionItemCategory = 'follow_up' | 'deliverable' | 'research' | 'meeting' | 'communication' | 'decision' | 'other';

export interface ActionItem {
  id: string;
  text: string;
  owner: string;
  deadline: string;
  done: boolean;
  priority?: ActionItemPriority;
  category?: ActionItemCategory;
  linkedTaskId?: string; // ID of synced task in tasks table
}

export interface TranscriptSegment {
  speaker: string;
  time: string;
  text: string;
  start_time?: number; // seconds, for audio sync
  end_time?: number;   // seconds, for audio sync
  speaker_id?: number;
  confidence?: number;
}

export interface VoiceRecording {
  id: string;
  title: string;
  date: string;
  duration: string;
  durationSeconds?: number;
  speakers: Speaker[];
  actions: ActionItem[];
  summary: string;
  transcript: TranscriptSegment[];
  createdAt: Date;
  audioUrl?: string;
  recordingType: RecordingType;
  meetingId?: string; // Link to meetings table if type is 'meeting'
  // Sharing fields
  isPublic?: boolean;
  shareToken?: string;
  shareViews?: number;
}

export interface RecentRecording {
  id: string;
  title: string;
  time: string;
  duration: string;
  actionsCount: number;
  recordingType: RecordingType;
}

export interface UseVoiceRecorderReturn {
  isRecording: boolean;
  duration: number;
  audioLevel: number;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  isPaused: boolean;
  error: string | null;
}

export interface WaveformBarData {
  height: number;
  animated: boolean;
}
