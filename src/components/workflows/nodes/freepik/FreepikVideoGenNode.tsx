import React, { memo, useState, useEffect } from 'react';
import { NodeProps, Position, useReactFlow } from 'reactflow';
import { Video, Loader2, Play, Download, Film, ChevronDown, Image as ImageIcon, Link2, Type } from 'lucide-react';
import { ModernNodeCard, DetachedHandle } from '../ModernNodeCard';
import { freepikService, VideoModel } from '@/lib/services/freepikService';

export interface FreepikVideoGenNodeData {
  input_image?: string;
  prompt?: string;
  model?: VideoModel;
  duration?: '5' | '10';
  generated_video?: string; // URL
  task_id?: string;
  start_frame?: string; // For transitions
  end_frame?: string; // For transitions
  input_image_source_label?: string;
  input_image_edge_id?: string;
  start_frame_source_label?: string;
  start_frame_edge_id?: string;
  end_frame_source_label?: string;
  end_frame_edge_id?: string;
  prompt_source_label?: string;
  prompt_edge_id?: string;
}

const VIDEO_MODELS: { value: VideoModel; label: string; description: string }[] = [
  { value: 'kling-v2-5-pro', label: 'Kling v2.5 Pro', description: 'Highest quality' },
  { value: 'kling-v2-1-pro', label: 'Kling v2.1 Pro', description: 'High quality' },
  { value: 'kling-v2-1-master', label: 'Kling v2.1 Master', description: 'Master quality' },
  { value: 'kling-v2-1-std', label: 'Kling v2.1 Std', description: 'Standard quality' },
  { value: 'kling-v2', label: 'Kling v2', description: 'Version 2' },
  { value: 'kling-pro', label: 'Kling Pro', description: 'Pro version' },
  { value: 'kling-std', label: 'Kling Std', description: 'Standard version' },
  { value: 'pixverse-v5', label: 'PixVerse v5', description: 'Latest PixVerse' },
  { value: 'pixverse-v5-transition', label: 'PixVerse v5 Transition', description: 'With transitions' },
  { value: 'minimax-hailuo-02-1080p', label: 'MiniMax Hailuo 1080p', description: 'Full HD' },
  { value: 'minimax-hailuo-02-768p', label: 'MiniMax Hailuo 768p', description: 'HD' },
  { value: 'seedance-lite-1080p', label: 'Seedance Lite 1080p', description: 'Lite 1080p' },
  { value: 'wan-v2-2-720p', label: 'WAN v2.2 720p', description: '720p quality' },
];

const FreepikVideoGenNode = memo(({ id, data, selected }: NodeProps<FreepikVideoGenNodeData>) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(data.task_id || null);
  const [videoUrl, setVideoUrl] = useState<string | null>(data.generated_video || null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [promptValue, setPromptValue] = useState(data.prompt || '');
  const [selectedModel, setSelectedModel] = useState<VideoModel>(data.model || 'kling-v2-5-pro');
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const { setNodes } = useReactFlow();

  useEffect(() => {
    setPromptValue(data.prompt || '');
    setSelectedModel(data.model || 'kling-v2-5-pro');
  }, [data.prompt, data.model]);

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

  const updateModel = (model: VideoModel) => {
    setSelectedModel(model);
    setShowModelDropdown(false);
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id
          ? {
              ...node,
              data: {
                ...node.data,
                model
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
        const status = await freepikService.getTaskStatus(taskId, selectedModel);
        
        if (status.data?.status === 'COMPLETED') {
          setVideoUrl(status.data.result.video_url || status.data.result.url); // Adjust based on schema
          setIsGenerating(false);
          clearInterval(pollInterval);
        } else if (status.data?.status === 'FAILED') {
          setError("Video generation failed");
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
  }, [taskId, videoUrl, selectedModel]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (showModelDropdown) {
        setShowModelDropdown(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showModelDropdown]);

  // Update local state when data props change
  useEffect(() => {
    if (data.input_image) {
      // Input image already handled by data prop
    }
    if (data.start_frame) {
      // Start frame from connection
    }
    if (data.end_frame) {
      // End frame from connection
    }
  }, [data.input_image, data.start_frame, data.end_frame]);

  // Keep local prompt in sync when connection updates prompt data
  const handleGenerate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!data.input_image) {
      setError("Input image required");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setProgress(0);

    try {
      const result = await freepikService.generateVideo({
        image: data.input_image,
        model: selectedModel,
        prompt: data.prompt,
        duration: data.duration || '5',
        start_frame: data.start_frame,
        end_frame: data.end_frame
      });

      if (result.data && result.data.task_id) {
        setTaskId(result.data.task_id);
        // Now let the effect handle polling
      } else {
        throw new Error("No task ID received");
      }
    } catch (err: any) {
      setError(err.message || "Video generation start failed");
      setIsGenerating(false);
    }
  };

  const GenerateButton = (
    <button
      onClick={handleGenerate}
      disabled={isGenerating || !data.input_image}
      className={`p-1 rounded transition-colors ${isGenerating ? 'text-gray-400 dark:text-zinc-500' : 'text-gray-500 dark:text-zinc-400 hover:text-orange-500 dark:hover:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-500/10'}`}
      title="Generate Video"
    >
      {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Film size={14} />}
    </button>
  );

  const selectedModelInfo = VIDEO_MODELS.find(m => m.value === selectedModel) || VIDEO_MODELS[0];

  const renderFrameSlot = (
    label: string,
    image?: string,
    description?: string,
    sourceLabel?: string,
    accentColor: string = 'border-gray-200'
  ) => (
    <div className="relative group">
      <div className={`rounded-lg border ${accentColor} bg-white dark:bg-[#121212] p-2 shadow-sm`}>
        <div className="flex items-center justify-between text-[9px] font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-500 mb-1">
          <span>{label}</span>
          {sourceLabel && (
            <span className="flex items-center gap-1 text-[8px] text-blue-500 dark:text-blue-300">
              <Link2 size={10} />
              {sourceLabel}
            </span>
          )}
        </div>
        <div className="relative w-full aspect-video rounded-md overflow-hidden bg-gray-100 dark:bg-black/40 border border-dashed border-gray-200 dark:border-zinc-800 flex items-center justify-center">
          {image ? (
            <img src={image} alt={`${label} frame`} className="w-full h-full object-cover" />
          ) : (
            <div className="text-[10px] text-gray-500 dark:text-zinc-500 flex flex-col items-center gap-1 text-center px-2">
              <ImageIcon size={16} className="opacity-60" />
              <span>Connect an image node here</span>
            </div>
          )}
        </div>
        {description && (
          <p className="mt-1 text-[9px] text-gray-500 dark:text-zinc-500 leading-tight">{description}</p>
        )}
      </div>
    </div>
  );

  return (
    <ModernNodeCard
      selected={selected}
      icon={Video}
      title="Motion Generator"
      subtitle={selectedModelInfo.label}
      color="text-orange-600 dark:text-orange-400"
      headerAction={GenerateButton}
      className="w-[320px] relative"
      handleLeft={false}
      handleRight={false}
      handles={
        <>
          {/* Input handles on the left */}
          <DetachedHandle
            type="target"
            position={Position.Left}
            id="input_image"
            icon={ImageIcon}
            label="Base Frame"
            tooltip="Primary frame used for motion. Connect an image or screenshot node here."
            top="30%"
            color="text-blue-500 dark:text-blue-400"
          />
          <DetachedHandle
            type="target"
            position={Position.Left}
            id="start_frame"
            icon={ImageIcon}
            label="Start Frame"
            tooltip="Optional transition starting image. Connect a previous video's last frame or an image node."
            top="50%"
            color="text-purple-500 dark:text-purple-400"
          />
          <DetachedHandle
            type="target"
            position={Position.Left}
            id="end_frame"
            icon={ImageIcon}
            label="End Frame"
            tooltip="Optional ending image to blend into. Connect an image node to create a smooth transition."
            top="70%"
            color="text-emerald-500 dark:text-emerald-400"
          />
          <DetachedHandle
            type="target"
            position={Position.Left}
            id="prompt_context"
            icon={Type}
            label="Prompt"
            tooltip="Connect research or AI nodes here to auto-fill the motion prompt with context."
            top="90%"
            color="text-indigo-500 dark:text-indigo-400"
          />
          {/* Output handle on the right */}
          <DetachedHandle
            type="source"
            position={Position.Right}
            id="video"
            icon={Video}
            label="Video"
            tooltip="Generated video output. Connect to lip sync, upscale, or other video processing nodes."
            top="50%"
            color="text-orange-500 dark:text-orange-400"
          />
        </>
      }
    >
      <div className="p-0">
        {/* Model Selector */}
        <div className="px-3 pt-3 pb-2 bg-white dark:bg-[#1e1e1e] border-b border-gray-200 dark:border-zinc-800">
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowModelDropdown(!showModelDropdown);
              }}
              className="nodrag w-full flex items-center justify-between text-[10px] px-2 py-1.5 bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 rounded hover:border-orange-400 dark:hover:border-orange-500 transition-colors"
            >
              <span className="text-gray-700 dark:text-zinc-300 font-medium">{selectedModelInfo.label}</span>
              <ChevronDown size={12} className="text-gray-500 dark:text-zinc-500" />
            </button>
            {showModelDropdown && (
              <div className="absolute z-50 mt-1 w-full bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-zinc-800 rounded shadow-lg max-h-[200px] overflow-y-auto">
                {VIDEO_MODELS.map((model) => (
                  <button
                    key={model.value}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateModel(model.value);
                    }}
                    className={`nodrag w-full text-left px-2 py-1.5 text-[10px] hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors ${
                      selectedModel === model.value ? 'bg-orange-50 dark:bg-orange-500/10' : ''
                    }`}
                  >
                    <div className="font-medium text-gray-700 dark:text-zinc-300">{model.label}</div>
                    <div className="text-[9px] text-gray-500 dark:text-zinc-500">{model.description}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Video Preview Area */}
        <div className="relative w-full aspect-video bg-gray-100 dark:bg-black/40 flex items-center justify-center overflow-hidden group">
          {videoUrl ? (
            <>
              <video 
                src={videoUrl} 
                controls 
                className="w-full h-full object-cover"
                autoPlay 
                loop 
                muted 
              />
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <a 
                  href={videoUrl} 
                  download="generated-video.mp4"
                  className="p-1.5 bg-black/60 rounded hover:bg-black/80 text-white"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download size={14} />
                </a>
              </div>
            </>
          ) : data.input_image ? (
             <div className="relative w-full h-full">
                <img src={data.input_image} alt="Reference" className="w-full h-full object-cover opacity-50" />
                <div className="absolute inset-0 flex items-center justify-center">
                   <span className="bg-black/60 px-2 py-1 rounded text-[10px] text-white dark:text-zinc-300 flex items-center gap-1">
                     <Play size={10} /> Ready to animate
                   </span>
                </div>
             </div>
          ) : (
            <div className="text-gray-500 dark:text-zinc-600 flex flex-col items-center gap-2 p-4 text-center">
              <Film size={24} className="opacity-50" />
              <span className="text-xs">Connect an image</span>
            </div>
          )}
          
          {/* Processing Overlay */}
          {isGenerating && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10 flex-col gap-2 px-8">
              <Loader2 size={24} className="text-orange-400 animate-spin" />
              <span className="text-xs text-orange-600 dark:text-orange-300 animate-pulse">Animating frame by frame...</span>
              {/* Progress Bar */}
              <div className="w-full h-1 bg-gray-200 dark:bg-zinc-800 rounded overflow-hidden mt-2">
                <div 
                  className="h-full bg-orange-500 transition-all duration-500" 
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Inputs */}
        <div className="p-3 space-y-3 bg-white dark:bg-[#1e1e1e]">
          <div className="space-y-1 relative">
            <label className="text-[10px] font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wider flex items-center justify-between">
              <span>Motion Prompt</span>
              {data.prompt_source_label && (
                <span className="text-[9px] text-blue-500 dark:text-blue-300 flex items-center gap-1">
                  <Link2 size={10} />
                  {data.prompt_source_label}
                </span>
              )}
            </label>
            <textarea
              value={promptValue}
              onChange={(e) => updatePrompt(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="nodrag w-full text-xs text-gray-700 dark:text-zinc-300 bg-gray-50 dark:bg-zinc-900/50 p-2 rounded border border-gray-200 dark:border-zinc-800 min-h-[70px] hover:border-orange-400 dark:hover:border-orange-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none resize-none font-mono"
              placeholder="Describe the motion you want to create..."
            />
            <p className="text-[9px] text-gray-500 dark:text-zinc-500">
              Connect research or AI nodes via the prompt handle to auto-fill context.
            </p>
          </div>
          
          {error && (
            <div className="text-[10px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-400/10 p-2 rounded border border-red-200 dark:border-red-400/20">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-zinc-500 pt-2 border-t border-gray-200 dark:border-zinc-800">
            <span>{data.duration || '5'}s duration</span>
            <div className="flex items-center gap-1">
              {(data.start_frame || data.end_frame) && (
                <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
                  Transition
                </span>
              )}
              <span className="px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20">
                {selectedModelInfo.value.includes('pro') || selectedModelInfo.value.includes('master') ? 'PRO' : 'STD'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </ModernNodeCard>
  );
});

FreepikVideoGenNode.displayName = 'FreepikVideoGenNode';

export default FreepikVideoGenNode;

