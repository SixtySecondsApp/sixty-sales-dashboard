import React, { memo, useState, useEffect } from 'react';
import { NodeProps, Handle, Position, useReactFlow } from 'reactflow';
import { Music, Loader2, Download, Play } from 'lucide-react';
import { ModernNodeCard, HANDLE_STYLES } from '../ModernNodeCard';
import { freepikService } from '@/lib/services/freepikService';

export interface FreepikMusicNodeData {
  prompt?: string;
  duration?: number; // seconds
  style?: string;
  generated_audio?: string; // URL
  task_id?: string;
}

const MUSIC_STYLES = [
  'ambient',
  'electronic',
  'cinematic',
  'corporate',
  'energetic',
  'calm',
  'upbeat',
  'dramatic',
  'background',
  'custom'
];

const FreepikMusicNode = memo(({ id, data, selected }: NodeProps<FreepikMusicNodeData>) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(data.task_id || null);
  const [audioUrl, setAudioUrl] = useState<string | null>(data.generated_audio || null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [promptValue, setPromptValue] = useState(data.prompt || '');
  const [selectedStyle, setSelectedStyle] = useState<string>(data.style || 'cinematic');
  const [duration, setDuration] = useState<number>(data.duration || 30);
  const { setNodes } = useReactFlow();

  useEffect(() => {
    setPromptValue(data.prompt || '');
    setSelectedStyle(data.style || 'cinematic');
    setDuration(data.duration || 30);
  }, [data.prompt, data.style, data.duration]);

  const updatePrompt = (value: string) => {
    setPromptValue(value);
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id
          ? {
              ...node,
              data: {
                ...node.data,
                prompt: value
              }
            }
          : node
      )
    );
  };

  const updateStyle = (style: string) => {
    setSelectedStyle(style);
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id
          ? {
              ...node,
              data: {
                ...node.data,
                style
              }
            }
          : node
      )
    );
  };

  const updateDuration = (dur: number) => {
    setDuration(dur);
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id
          ? {
              ...node,
              data: {
                ...node.data,
                duration: dur
              }
            }
          : node
      )
    );
  };

  // Poll for status if we have a task ID but no audio
  useEffect(() => {
    if (!taskId || audioUrl) return;

    const pollInterval = setInterval(async () => {
      try {
        const status = await freepikService.getTaskStatus(taskId);
        
        if (status.data?.status === 'COMPLETED') {
          setAudioUrl(status.data.result.audio_url || status.data.result.url);
          setIsGenerating(false);
          clearInterval(pollInterval);
        } else if (status.data?.status === 'FAILED') {
          setError("Music generation failed");
          setIsGenerating(false);
          clearInterval(pollInterval);
        } else {
          // Still processing
          setProgress((prev) => (prev < 90 ? prev + 5 : prev));
        }
      } catch (e) {
        console.error("Polling error", e);
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(pollInterval);
  }, [taskId, audioUrl]);

  const handleGenerate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!data.prompt) {
      setError("Prompt is required");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setProgress(0);

    try {
      const result = await freepikService.generateMusic({
        prompt: data.prompt,
        duration: duration,
        style: selectedStyle !== 'custom' ? selectedStyle : undefined
      });

      if (result.data && result.data.task_id) {
        setTaskId(result.data.task_id);
      } else if (result.data && result.data.audio_url) {
        // Synchronous response
        setAudioUrl(result.data.audio_url);
        setIsGenerating(false);
      } else {
        throw new Error("No task ID or audio URL received");
      }
    } catch (err: any) {
      setError(err.message || "Music generation failed");
      setIsGenerating(false);
    }
  };

  const GenerateButton = (
    <button
      onClick={handleGenerate}
      disabled={isGenerating || !data.prompt}
      className={`p-1 rounded transition-colors ${isGenerating ? 'text-gray-400 dark:text-zinc-500' : 'text-gray-500 dark:text-zinc-400 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/10'}`}
      title="Generate Music"
    >
      {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Music size={14} />}
    </button>
  );

  return (
    <ModernNodeCard
      selected={selected}
      icon={Music}
      title="Music Generator"
      subtitle="AI Music Creation"
      color="text-indigo-600 dark:text-indigo-400"
      headerAction={GenerateButton}
      className="w-[320px]"
      handles={
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="audio"
            className={HANDLE_STYLES}
            style={{ top: '50%' }}
          />
        </>
      }
      handleLeft={false}
      handleRight={false}
    >
      <div className="p-0">
        {/* Audio Preview Area */}
        <div className="relative w-full h-24 bg-gray-100 dark:bg-black/40 flex items-center justify-center overflow-hidden group">
          {audioUrl ? (
            <>
              <audio 
                src={audioUrl} 
                controls 
                className="w-full"
              />
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <a 
                  href={audioUrl} 
                  download="generated-music.mp3"
                  className="p-1.5 bg-black/60 rounded hover:bg-black/80 text-white"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download size={14} />
                </a>
              </div>
            </>
          ) : (
            <div className="text-gray-500 dark:text-zinc-600 flex flex-col items-center gap-2 p-4 text-center">
              <Music size={24} className="opacity-50" />
              <span className="text-xs">Ready to generate</span>
            </div>
          )}
          
          {/* Processing Overlay */}
          {isGenerating && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10 flex-col gap-2 px-8">
              <Loader2 size={24} className="text-indigo-400 animate-spin" />
              <span className="text-xs text-indigo-600 dark:text-indigo-300 animate-pulse">Composing...</span>
              {/* Progress Bar */}
              <div className="w-full h-1 bg-gray-200 dark:bg-zinc-800 rounded overflow-hidden mt-2">
                <div 
                  className="h-full bg-indigo-500 transition-all duration-500" 
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Inputs */}
        <div className="p-3 space-y-3 bg-white dark:bg-[#1e1e1e]">
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wider">Music Prompt</label>
            <textarea
              value={promptValue}
              onChange={(e) => updatePrompt(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="nodrag w-full text-xs text-gray-700 dark:text-zinc-300 bg-gray-50 dark:bg-zinc-900/50 p-2 rounded border border-gray-200 dark:border-zinc-800 min-h-[60px] hover:border-indigo-400 dark:hover:border-indigo-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none font-mono"
              placeholder="Describe the music you want..."
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wider">Style</label>
              <select
                value={selectedStyle}
                onChange={(e) => updateStyle(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="nodrag w-full text-xs text-gray-700 dark:text-zinc-300 bg-gray-50 dark:bg-zinc-900/50 p-1.5 rounded border border-gray-200 dark:border-zinc-800 hover:border-indigo-400 dark:hover:border-indigo-500 focus:border-indigo-500 outline-none"
              >
                {MUSIC_STYLES.map(style => (
                  <option key={style} value={style}>{style}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wider">Duration (s)</label>
              <input
                type="number"
                value={duration}
                onChange={(e) => updateDuration(parseInt(e.target.value) || 30)}
                onClick={(e) => e.stopPropagation()}
                min="5"
                max="120"
                className="nodrag w-full text-xs text-gray-700 dark:text-zinc-300 bg-gray-50 dark:bg-zinc-900/50 p-1.5 rounded border border-gray-200 dark:border-zinc-800 hover:border-indigo-400 dark:hover:border-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
          </div>
          
          {error && (
            <div className="text-[10px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-400/10 p-2 rounded border border-red-200 dark:border-red-400/20">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-zinc-500 pt-2 border-t border-gray-200 dark:border-zinc-800">
            <span>{duration}s • {selectedStyle}</span>
            <span className="px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">
              AI
            </span>
          </div>
        </div>
      </div>
    </ModernNodeCard>
  );
});

FreepikMusicNode.displayName = 'FreepikMusicNode';
export default FreepikMusicNode;

