import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase/clientV2';
import { Loader2, AlertCircle, Clock, List, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VoiceRecorderAudioPlayer, type AudioPlayerRef } from '@/components/voice-recorder/VoiceRecorderAudioPlayer';
import { TranscriptModal } from '@/components/voice-recorder/TranscriptModal';
import type { TranscriptSegment, Speaker } from '@/components/voice-recorder/types';

interface VoiceRecordingData {
  id: string;
  title: string;
  duration_seconds: number | null;
  transcript_segments: TranscriptSegment[] | null;
  speakers: Speaker[] | null;
  summary: string | null;
  share_token: string;
  share_views: number;
  recorded_at: string;
}

export function PublicVoiceRecording() {
  const { token } = useParams<{ token: string }>();
  const [recording, setRecording] = useState<VoiceRecordingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTranscriptModal, setShowTranscriptModal] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioPlayerRef = useRef<AudioPlayerRef>(null);

  useEffect(() => {
    if (token) {
      fetchRecording();
    }
  }, [token]);

  const fetchRecording = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch recording by share token
      const { data, error: fetchError } = await supabase
        .from('voice_recordings')
        .select('id, title, duration_seconds, transcript_segments, speakers, summary, share_token, share_views, recorded_at')
        .eq('share_token', token)
        .eq('is_public', true)
        .maybeSingle();

      if (fetchError) {
        console.error('Fetch error:', fetchError);
        setError('Failed to load recording.');
        setLoading(false);
        return;
      }

      if (!data) {
        setError('Recording not found or link has expired.');
        setLoading(false);
        return;
      }

      setRecording(data);

      // Increment view count
      incrementViews();
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const incrementViews = async () => {
    if (!token) return;
    try {
      await supabase.rpc('increment_voice_recording_views', { p_share_token: token });
    } catch (err) {
      console.error('Failed to increment views:', err);
    }
  };

  // Handle seeking from transcript modal
  const handleTranscriptSeek = useCallback((time: number) => {
    audioPlayerRef.current?.seek(time);
    audioPlayerRef.current?.play();
  }, []);

  // Format duration
  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format date
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mx-auto mb-4" />
          <p className="text-gray-400">Loading recording...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-white mb-2">Unable to Load Recording</h1>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!recording) return null;

  const transcript = recording.transcript_segments || [];
  const speakers = recording.speakers || [];

  return (
    <div className="min-h-screen bg-gray-950 py-8 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">{recording.title}</h1>
          <p className="text-gray-400 flex items-center justify-center gap-2">
            <Clock className="w-4 h-4" />
            {formatDate(recording.recorded_at)} • {formatDuration(recording.duration_seconds)}
          </p>
        </div>

        {/* Audio Player */}
        <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl p-6 border border-gray-800 mb-6">
          <VoiceRecorderAudioPlayer
            ref={audioPlayerRef}
            recordingId={recording.id}
            durationSeconds={recording.duration_seconds || 0}
            shareToken={recording.share_token}
            onTimeUpdate={setCurrentTime}
          />
        </div>

        {/* AI Summary */}
        {recording.summary && (
          <div className="bg-emerald-500/10 rounded-xl p-6 border border-emerald-500/20 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Wand2 className="w-5 h-5 text-emerald-400" />
              <span className="font-medium text-emerald-400">AI Summary</span>
            </div>
            <p className="text-gray-300 leading-relaxed">{recording.summary}</p>
          </div>
        )}

        {/* Transcript button */}
        {transcript.length > 0 && (
          <button
            onClick={() => setShowTranscriptModal(true)}
            className="w-full p-5 rounded-xl bg-gray-900/80 backdrop-blur-sm border border-gray-800 hover:bg-gray-800/80 transition-colors text-left"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <List className="w-6 h-6 text-gray-400" />
                <div>
                  <p className="font-medium text-white">Full Transcript</p>
                  <p className="text-sm text-gray-400">{transcript.length} segments</p>
                </div>
              </div>
              <svg className="w-5 h-5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </div>
          </button>
        )}

        {/* Speakers */}
        {speakers.length > 0 && (
          <div className="mt-6">
            <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
              Speakers
            </h2>
            <div className="flex flex-wrap gap-2">
              {speakers.map((speaker) => (
                <div
                  key={speaker.id}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-900/80 rounded-lg border border-gray-800"
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-white"
                    style={{ backgroundColor: speaker.color || '#6B7280' }}
                  >
                    {speaker.initials || speaker.name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-sm text-gray-300">{speaker.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-gray-600 text-xs mt-12">
          Powered by Sixty Seconds
        </p>
      </div>

      {/* Transcript Modal */}
      <TranscriptModal
        open={showTranscriptModal}
        onOpenChange={setShowTranscriptModal}
        transcript={transcript}
        speakers={speakers}
        currentTime={currentTime}
        onSeek={handleTranscriptSeek}
        title={`${recording.title} - Transcript`}
      />
    </div>
  );
}

export default PublicVoiceRecording;
