import React, { memo, useState, useEffect } from 'react';
import { NodeProps, Handle, Position } from 'reactflow';
import { Video, Loader2, Play, Download, Film } from 'lucide-react';
import { ModernNodeCard, HANDLE_STYLES } from '../ModernNodeCard';
import { freepikService } from '@/lib/services/freepikService';

export interface FreepikVideoGenNodeData {
  input_image?: string;
  prompt?: string;
  duration?: '5' | '10';
  generated_video?: string; // URL
  task_id?: string;
}

const FreepikVideoGenNode = memo(({ data, selected }: NodeProps<FreepikVideoGenNodeData>) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(data.task_id || null);
  const [videoUrl, setVideoUrl] = useState<string | null>(data.generated_video || null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);

  // Poll for status if we have a task ID but no video
  useEffect(() => {
    if (!taskId || videoUrl) return;

    const pollInterval = setInterval(async () => {
      try {
        const status = await freepikService.getTaskStatus(taskId);
        
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
  }, [taskId, videoUrl]);

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
        prompt: data.prompt,
        duration: data.duration || '5'
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
      className={`p-1 rounded transition-colors ${isGenerating ? 'text-zinc-500' : 'text-zinc-400 hover:text-orange-400 hover:bg-orange-500/10'}`}
      title="Generate Video"
    >
      {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Film size={14} />}
    </button>
  );

  return (
    <ModernNodeCard
      selected={selected}
      icon={Video}
      title="Motion Generator"
      subtitle="Kling v2.5"
      color="text-orange-400"
      headerAction={GenerateButton}
      className="w-[320px]"
    >
      <div className="p-0">
        {/* Video Preview Area */}
        <div className="relative w-full aspect-video bg-black/40 flex items-center justify-center overflow-hidden group">
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
                   <span className="bg-black/60 px-2 py-1 rounded text-[10px] text-zinc-300 flex items-center gap-1">
                     <Play size={10} /> Ready to animate
                   </span>
                </div>
             </div>
          ) : (
            <div className="text-zinc-600 flex flex-col items-center gap-2 p-4 text-center">
              <Film size={24} className="opacity-50" />
              <span className="text-xs">Connect an image</span>
            </div>
          )}
          
          {/* Processing Overlay */}
          {isGenerating && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10 flex-col gap-2 px-8">
              <Loader2 size={24} className="text-orange-400 animate-spin" />
              <span className="text-xs text-orange-300 animate-pulse">Animating frame by frame...</span>
              {/* Progress Bar */}
              <div className="w-full h-1 bg-zinc-800 rounded overflow-hidden mt-2">
                <div 
                  className="h-full bg-orange-500 transition-all duration-500" 
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Inputs */}
        <div className="p-3 space-y-3 bg-[#1e1e1e]">
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Motion Prompt</label>
            <div className="text-xs text-zinc-300 bg-zinc-900/50 p-2 rounded border border-zinc-800 min-h-[40px]">
              {data.prompt || <span className="text-zinc-600 italic">Describe the movement...</span>}
            </div>
          </div>
          
          {error && (
            <div className="text-[10px] text-red-400 bg-red-400/10 p-2 rounded border border-red-400/20">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-2 border-t border-zinc-800">
            <span>{data.duration || '5'}s duration</span>
            <span className="px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">
              PRO
            </span>
          </div>
        </div>
      </div>
    </ModernNodeCard>
  );
});

FreepikVideoGenNode.displayName = 'FreepikVideoGenNode';
export default FreepikVideoGenNode;

