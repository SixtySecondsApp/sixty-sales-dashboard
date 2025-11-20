import React, { memo, useState, useEffect } from 'react';
import { NodeProps, Handle, Position, useReactFlow } from 'reactflow';
import { Video, Loader2, Download, MessageSquare } from 'lucide-react';
import { ModernNodeCard, HANDLE_STYLES } from '../ModernNodeCard';
import { freepikService } from '@/lib/services/freepikService';

export interface FreepikLipSyncNodeData {
  input_video?: string; // Base64 or URL
  input_audio?: string; // Base64 or URL
  generated_video?: string; // URL
  task_id?: string;
}

const FreepikLipSyncNode = memo(({ id, data, selected }: NodeProps<FreepikLipSyncNodeData>) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(data.task_id || null);
  const [videoUrl, setVideoUrl] = useState<string | null>(data.generated_video || null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const { setNodes } = useReactFlow();

  // Poll for status if we have a task ID but no video
  useEffect(() => {
    if (!taskId || videoUrl) return;

    const pollInterval = setInterval(async () => {
      try {
        const status = await freepikService.getTaskStatus(taskId);
        
        if (status.data?.status === 'COMPLETED') {
          setVideoUrl(status.data.result.video_url || status.data.result.url);
          setIsGenerating(false);
          clearInterval(pollInterval);
        } else if (status.data?.status === 'FAILED') {
          setError("Lip sync generation failed");
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
    if (!data.input_video) {
      setError("Input video required");
      return;
    }
    if (!data.input_audio) {
      setError("Input audio required");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setProgress(0);

    try {
      const result = await freepikService.generateLipSync({
        video: data.input_video,
        audio: data.input_audio
      });

      if (result.data && result.data.task_id) {
        setTaskId(result.data.task_id);
      } else if (result.data && result.data.video_url) {
        // Synchronous response
        setVideoUrl(result.data.video_url);
        setIsGenerating(false);
      } else {
        throw new Error("No task ID or video URL received");
      }
    } catch (err: any) {
      setError(err.message || "Lip sync generation failed");
      setIsGenerating(false);
    }
  };

  const GenerateButton = (
    <button
      onClick={handleGenerate}
      disabled={isGenerating || !data.input_video || !data.input_audio}
      className={`p-1 rounded transition-colors ${isGenerating ? 'text-gray-400 dark:text-zinc-500' : 'text-gray-500 dark:text-zinc-400 hover:text-pink-500 dark:hover:text-pink-400 hover:bg-pink-100 dark:hover:bg-pink-500/10'}`}
      title="Generate Lip Sync"
    >
      {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} />}
    </button>
  );

  return (
    <ModernNodeCard
      selected={selected}
      icon={Video}
      title="Lip Sync"
      subtitle="Sync audio to video"
      color="text-pink-600 dark:text-pink-400"
      headerAction={GenerateButton}
      className="w-[320px]"
      handles={
        <>
          <Handle
            type="target"
            position={Position.Left}
            id="input_video"
            className={HANDLE_STYLES}
            style={{ top: '35%' }}
          />
          <Handle
            type="target"
            position={Position.Left}
            id="input_audio"
            className={HANDLE_STYLES}
            style={{ top: '65%' }}
          />
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
                  download="lip-synced-video.mp4"
                  className="p-1.5 bg-black/60 rounded hover:bg-black/80 text-white"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download size={14} />
                </a>
              </div>
            </>
          ) : data.input_video ? (
            <div className="relative w-full h-full">
              <video 
                src={data.input_video} 
                className="w-full h-full object-cover opacity-50"
                muted
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="bg-black/60 px-2 py-1 rounded text-[10px] text-white dark:text-zinc-300 flex items-center gap-1">
                  <MessageSquare size={10} /> Ready to sync
                </span>
              </div>
            </div>
          ) : (
            <div className="text-gray-500 dark:text-zinc-600 flex flex-col items-center gap-2 p-4 text-center">
              <Video size={24} className="opacity-50" />
              <span className="text-xs">Connect video & audio</span>
            </div>
          )}
          
          {/* Processing Overlay */}
          {isGenerating && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10 flex-col gap-2 px-8">
              <Loader2 size={24} className="text-pink-400 animate-spin" />
              <span className="text-xs text-pink-600 dark:text-pink-300 animate-pulse">Syncing lips...</span>
              {/* Progress Bar */}
              <div className="w-full h-1 bg-gray-200 dark:bg-zinc-800 rounded overflow-hidden mt-2">
                <div 
                  className="h-full bg-pink-500 transition-all duration-500" 
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Status Info */}
        <div className="p-3 space-y-2 bg-white dark:bg-[#1e1e1e]">
          {error && (
            <div className="text-[10px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-400/10 p-2 rounded border border-red-200 dark:border-red-400/20">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-zinc-500 pt-2 border-t border-gray-200 dark:border-zinc-800">
            <span className={data.input_video && data.input_audio ? 'text-green-600 dark:text-green-400' : ''}>
              {data.input_video && data.input_audio ? 'Ready' : 'Missing inputs'}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-pink-100 dark:bg-pink-500/10 text-pink-700 dark:text-pink-400 border border-pink-200 dark:border-pink-500/20">
              AI
            </span>
          </div>
        </div>
      </div>
    </ModernNodeCard>
  );
});

FreepikLipSyncNode.displayName = 'FreepikLipSyncNode';
export default FreepikLipSyncNode;

