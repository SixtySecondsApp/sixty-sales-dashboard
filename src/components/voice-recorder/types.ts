// Voice Recorder Types and Interfaces

export type RecordingScreen = 'home' | 'recording' | 'meeting';

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
}

export interface VoiceRecording {
  id: string;
  title: string;
  date: string;
  duration: string;
  speakers: Speaker[];
  actions: ActionItem[];
  summary: string;
  transcript: TranscriptSegment[];
  createdAt: Date;
  audioUrl?: string;
}

export interface RecentRecording {
  id: string;
  title: string;
  time: string;
  duration: string;
  actionsCount: number;
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
