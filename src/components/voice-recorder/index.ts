// Voice Recorder Feature
// use60 Voice - Record conversations, get action items automatically

// Main page component
export { VoiceRecorderPage, default } from './VoiceRecorderPage';

// Screen components
export { VoiceRecorderHome, SAMPLE_RECENT_RECORDINGS } from './VoiceRecorderHome';
export { VoiceRecorderRecording } from './VoiceRecorderRecording';
export {
  VoiceRecorderMeetingDetail,
  SAMPLE_MEETING,
} from './VoiceRecorderMeetingDetail';

// Visualization components
export { LiveWaveform, MiniWaveform } from './LiveWaveform';
export {
  SpeakerWaveform,
  SpeakerAvatar,
  SPEAKER_COLORS,
  getSpeakerColor,
  getInitials,
} from './SpeakerWaveform';

// Hooks
export { useVoiceRecorder, useRecordingTimer } from './useVoiceRecorder';

// Types
export type {
  RecordingScreen,
  Speaker,
  ActionItem,
  TranscriptSegment,
  VoiceRecording,
  RecentRecording,
  UseVoiceRecorderReturn,
  WaveformBarData,
} from './types';
