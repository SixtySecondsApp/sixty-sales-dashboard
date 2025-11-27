import React, { memo, useState, useEffect, useCallback } from 'react';
import { NodeProps, Handle, Position, useReactFlow } from 'reactflow';
import { Video, Loader2, Play, Download, Film, Sparkles } from 'lucide-react';
import { ModernNodeCard, HANDLE_STYLES } from '../ModernNodeCard';
import { veo3Service, type Veo3VideoGenerationResult } from '@/lib/services/veo3Service';

export interface Veo3VideoGenNodeData {
  prompt?: string;
  model?: 'veo-3.0-fast-generate-preview' | 'veo-3.0-generate-preview';
  durationSeconds?: number;
  generateAudio?: boolean;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  generated_video?: string;
  task_id?: string;
}

const ASPECT_RATIOS: { value: '16:9' | '9:16' | '1:1'; label: string; icon: string }[] = [
  { value: '16:9', label: '16:9', icon: '🖥️' },
  { value: '9:16', label: '9:16', icon: '📱' },
  { value: '1:1', label: '1:1', icon: '⬜' },
];

const Veo3VideoGenNode = memo(({ id, data, selected }: NodeProps<Veo3VideoGenNodeData>) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(data.task_id || null);
  const [videoUrl, setVideoUrl] = useState<string | null>(data.generated_video || null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [promptValue, setPromptValue] = useState(data.prompt || '');
  const [selectedModel, setSelectedModel] = useState<'veo-3.0-fast-generate-preview' | 'veo-3.0-generate-preview'>(
    data.model || 'veo-3.0-fast-generate-preview'
  );
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<'16:9' | '9:16' | '1:1'>(
    data.aspectRatio || '16:9'
  );
  const [generateAudio, setGenerateAudio] = useState(data.generateAudio !== undefined ? data.generateAudio : true);
  const { setNodes } = useReactFlow();

  useEffect(() => {
    setPromptValue(data.prompt || '');
    setSelectedModel(data.model || 'veo-3.0-fast-generate-preview');
    setSelectedAspectRatio(data.aspectRatio || '16:9');
  }, [data.prompt, data.model, data.aspectRatio]);

  useEffect(() => {
    if (data.generated_video) {
      setVideoUrl(data.generated_video);
    }
  }, [data.generated_video]);

  const persistGeneratedVideo = useCallback(
    (result: Veo3VideoGenerationResult) => {
      setNodes((nodes) =>
        nodes.map((node) =>
          node.id === id
            ? {
                ...node,
                data: {
                  ...node.data,
                  generated_video: result.videoUrl || videoUrl,
                  task_id: result.taskId || taskId,
                }
              }
            : node
        )
      );
    },
    [id, setNodes, videoUrl, taskId]
  );

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

  // Poll for status if we have a task ID but no video
  useEffect(() => {
    if (!taskId || videoUrl) return;

    const pollInterval = setInterval(async () => {
      try {
        const status = await veo3Service.getTaskStatus(taskId);
        
        if (status.status === 'completed' && status.videoUrl) {
          setVideoUrl(status.videoUrl);
          setIsGenerating(false);
          setProgress(100);
          persistGeneratedVideo(status);
          clearInterval(pollInterval);
        } else if (status.status === 'failed') {
          setError(status.error || "Video generation failed");
          setIsGenerating(false);
          clearInterval(pollInterval);
        } else {
          // Still processing
          setProgress((prev) => (prev < 90 ? prev + 5 : prev));
        }
      } catch (e: any) {
        console.error("[Veo3] Polling error", e);
        setError(e.message || "Status check failed");
        setIsGenerating(false);
        clearInterval(pollInterval);
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(pollInterval);
  }, [taskId, videoUrl, persistGeneratedVideo]);

  const handleGenerate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!promptValue.trim()) {
      setError("Prompt is required");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setProgress(0);
    setVideoUrl(null);

    try {
      const result = await veo3Service.generateVideo({
        prompt: promptValue.trim(),
        model: selectedModel,
        durationSeconds: data.durationSeconds || 8,
        generateAudio: generateAudio,
        aspectRatio: selectedAspectRatio,
      });

      if (result.taskId) {
        setTaskId(result.taskId);
        setProgress(10);
        // Polling will handle the rest
      } else {
        throw new Error("No task ID received");
      }
    } catch (err: any) {
      const errorMessage = err.message || "Generation failed";
      setError(`${errorMessage} (Model: Veo 3)`);
      setIsGenerating(false);
    }
  };

  const GenerateButton = (
    <button
      onClick={handleGenerate}
      disabled={isGenerating || !promptValue.trim()}
      className={`p-1 rounded transition-colors ${isGenerating ? 'text-gray-400 dark:text-zinc-500' : 'text-gray-500 dark:text-zinc-400 hover:text-purple-500 dark:hover:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-500/10'}`}
      title="Generate Video"
    >
      {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Film size={14} />}
    </button>
  );

  const selectedAspectRatioInfo = ASPECT_RATIOS.find(r => r.value === selectedAspectRatio) || ASPECT_RATIOS[0];

  return (
    <ModernNodeCard
      selected={selected}
      icon={Video}
      title="Veo 3"
      subtitle="Google Veo 3 Video"
      color="text-purple-600 dark:text-purple-400"
      headerAction={GenerateButton}
      className="w-[320px]"
      handles={
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="video"
            className={HANDLE_STYLES}
            style={{ top: '50%' }}
          />
        </>
      }
      handleLeft={false}
      handleRight={false}
    >
      <div className="p-0">
        {/* Model and Aspect Ratio Selector */}
        <div className="px-3 pt-3 pb-2 bg-white dark:bg-[#1e1e1e] border-b border-gray-200 dark:border-zinc-800">
          <div className="space-y-2">
            {/* Model Selector */}
            <div className="flex gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedModel('veo-3.0-fast-generate-preview');
                }}
                className={`flex-1 px-2 py-1.5 text-[10px] rounded transition-colors ${
                  selectedModel === 'veo-3.0-fast-generate-preview'
                    ? 'bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-300 dark:border-purple-500/20'
                    : 'bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-300 hover:border-purple-400 dark:hover:border-purple-500'
                }`}
              >
                Fast
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedModel('veo-3.0-generate-preview');
                }}
                className={`flex-1 px-2 py-1.5 text-[10px] rounded transition-colors ${
                  selectedModel === 'veo-3.0-generate-preview'
                    ? 'bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-300 dark:border-purple-500/20'
                    : 'bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-300 hover:border-purple-400 dark:hover:border-purple-500'
                }`}
              >
                Quality
              </button>
            </div>
            
            {/* Aspect Ratio Selector */}
            <div className="flex gap-1">
              {ASPECT_RATIOS.map((ratio) => (
                <button
                  key={ratio.value}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedAspectRatio(ratio.value);
                  }}
                  className={`flex-1 px-2 py-1.5 text-[10px] rounded transition-colors ${
                    selectedAspectRatio === ratio.value
                      ? 'bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-300 dark:border-purple-500/20'
                      : 'bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-300 hover:border-purple-400 dark:hover:border-purple-500'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>{ratio.icon}</span>
                    <span className="font-medium">{ratio.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Video Preview Area */}
        <div className="relative w-full aspect-video bg-gray-100 dark:bg-black/40 flex items-center justify-center overflow-hidden group">
          {videoUrl ? (
            <>
              <video 
                src={videoUrl} 
                controls 
                className="w-full h-full object-contain"
                onError={() => setError('Failed to load video')}
              />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <a 
                  href={videoUrl} 
                  download="veo3-generation.mp4"
                  className="p-2 bg-gray-800 dark:bg-zinc-800 rounded-full hover:bg-gray-700 dark:hover:bg-zinc-700 text-white dark:text-zinc-200 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download size={16} />
                </a>
              </div>
            </>
          ) : (
            <div className="text-gray-500 dark:text-zinc-600 flex flex-col items-center gap-2 p-4 text-center">
              <Video size={24} className="opacity-50" />
              <span className="text-xs">Ready to generate</span>
            </div>
          )}
          
          {/* Loading Overlay */}
          {isGenerating && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10 flex-col gap-2">
              <Loader2 size={24} className="text-purple-500 dark:text-purple-400 animate-spin" />
              <span className="text-xs text-purple-600 dark:text-purple-300 animate-pulse">
                Creating video... {progress}%
              </span>
              {taskId && (
                <span className="text-[10px] text-gray-400">Task: {taskId.substring(0, 8)}...</span>
              )}
            </div>
          )}
        </div>

        {/* Inputs */}
        <div className="p-3 space-y-3 bg-white dark:bg-[#1e1e1e]">
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wider">Prompt</label>
            <textarea
              value={promptValue}
              onChange={(e) => updatePrompt(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="nodrag w-full text-xs text-gray-700 dark:text-zinc-300 bg-gray-50 dark:bg-zinc-900/50 p-2 rounded border border-gray-200 dark:border-zinc-800 min-h-[80px] break-words hover:border-purple-400 dark:hover:border-purple-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none resize-none font-mono"
              placeholder="Describe the video you want to generate..."
            />
          </div>

          {/* Duration and Audio Options */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wider block mb-1">Duration</label>
              <select
                value={data.durationSeconds || 8}
                onChange={(e) => {
                  e.stopPropagation();
                  setNodes((nodes) =>
                    nodes.map((node) =>
                      node.id === id
                        ? {
                            ...node,
                            data: {
                              ...node.data,
                              durationSeconds: parseInt(e.target.value)
                            }
                          }
                        : node
                    )
                  );
                }}
                className="nodrag w-full text-xs text-gray-700 dark:text-zinc-300 bg-gray-50 dark:bg-zinc-900/50 p-1.5 rounded border border-gray-200 dark:border-zinc-800 hover:border-purple-400 dark:hover:border-purple-500 focus:border-purple-500 outline-none"
                onClick={(e) => e.stopPropagation()}
              >
                <option value={5}>5 seconds</option>
                <option value={8}>8 seconds</option>
                <option value={10}>10 seconds</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-1.5 text-[10px] text-gray-700 dark:text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={generateAudio}
                  onChange={(e) => {
                    e.stopPropagation();
                    setGenerateAudio(e.target.checked);
                    setNodes((nodes) =>
                      nodes.map((node) =>
                        node.id === id
                          ? {
                              ...node,
                              data: {
                                ...node.data,
                                generateAudio: e.target.checked
                              }
                            }
                          : node
                      )
                    );
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="nodrag w-3 h-3 rounded border-gray-300 dark:border-zinc-600 text-purple-500 focus:ring-purple-500"
                />
                <span>Audio</span>
              </label>
            </div>
          </div>
          
          {error && (
            <div className="text-[10px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-400/10 p-2 rounded border border-red-200 dark:border-red-400/20">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-zinc-500 pt-2 border-t border-gray-200 dark:border-zinc-800">
            <span>{selectedAspectRatioInfo.label} • {data.durationSeconds || 8}s</span>
            <span className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20">
              VEO 3
            </span>
          </div>
        </div>
      </div>
    </ModernNodeCard>
  );
});

Veo3VideoGenNode.displayName = 'Veo3VideoGenNode';
export default Veo3VideoGenNode;











