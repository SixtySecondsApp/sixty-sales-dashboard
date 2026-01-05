// Voice Recorder Types and Interfaces

export type RecordingScreen = 'home' | 'recording' | 'meeting' | 'voice-note';

// Recording type: external meetings vs internal voice notes
export type RecordingType = 'meeting' | 'voice_note';

export interface Speaker {
  id: number;
  name: string;
  initials: string;
  duration: string;
  color: string;
}

export interface ActionItem {
  id: string;
  text: string;
  owner: string;
  deadline: string;
  done: boolean;
}

export interface TranscriptSegment {
  speaker: string;
  time: string;
  text: string;
  start_time?: number;
  end_time?: number;
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
