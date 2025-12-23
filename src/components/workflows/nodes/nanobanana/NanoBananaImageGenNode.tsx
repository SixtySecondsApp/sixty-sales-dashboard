import React, { memo, useState, useEffect, useCallback } from 'react';
import { NodeProps, Handle, Position, useReactFlow } from 'reactflow';
import { Image as ImageIcon, Loader2, Sparkles, Download, RefreshCcw } from 'lucide-react';
import { ModernNodeCard, HANDLE_STYLES } from '../ModernNodeCard';
import { nanoBananaService, type NanoBananaImageGenerationResult } from '@/lib/services/nanoBananaService';

export interface NanoBananaImageGenNodeData {
  prompt?: string;
  aspect_ratio?: 'square' | 'portrait' | 'landscape';
  num_images?: number;
  generated_image?: string; // Base64 or URL
  generated_images?: string[];
}

const ASPECT_RATIOS: { value: 'square' | 'portrait' | 'landscape'; label: string; icon: string }[] = [
  { value: 'square', label: 'Square', icon: '⬜' },
  { value: 'portrait', label: 'Portrait', icon: '📱' },
  { value: 'landscape', label: 'Landscape', icon: '🖼️' },
];

const NanoBananaImageGenNode = memo(({ id, data, selected }: NodeProps<NanoBananaImageGenNodeData>) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(data.generated_image || null);
  const [promptValue, setPromptValue] = useState(data.prompt || '');
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<'square' | 'portrait' | 'landscape'>(
    data.aspect_ratio || 'square'
  );
  const { setNodes } = useReactFlow();

  useEffect(() => {
    setPromptValue(data.prompt || '');
    setSelectedAspectRatio(data.aspect_ratio || 'square');
  }, [data.prompt, data.aspect_ratio]);

  useEffect(() => {
    if (data.generated_image) {
      setImageUrl(data.generated_image);
    }
  }, [data.generated_image]);

  const persistGeneratedImage = useCallback(
    (result: NanoBananaImageGenerationResult, image: string, allImages?: string[]) => {
      setNodes((nodes) =>
        nodes.map((node) =>
          node.id === id
            ? {
                ...node,
                data: {
                  ...node.data,
                  generated_image: image,
                  generated_images: allImages || [image],
                }
              }
            : node
        )
      );
    },
    [id, setNodes]
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

  const updateAspectRatio = (ratio: 'square' | 'portrait' | 'landscape') => {
    setSelectedAspectRatio(ratio);
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id
          ? {
              ...node,
              data: {
                ...node.data,
                aspect_ratio: ratio
              }
            }
          : node
      )
    );
  };

  const handleGenerate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!data.prompt) {
      setError("Prompt is required");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const result = await nanoBananaService.generateImage({
        prompt: data.prompt,
        aspect_ratio: selectedAspectRatio,
        num_images: 1,
      });

      if (!result.images || result.images.length === 0) {
        throw new Error("Nano Banana Pro returned an empty response. Please try again.");
      }

      const primaryImage = result.images[0];
      setImageUrl(primaryImage);
      persistGeneratedImage(result, primaryImage, result.images);
    } catch (err: any) {
      const errorMessage = err.message || "Generation failed";
      setError(`${errorMessage} (Model: Nano Banana Pro)`);
    } finally {
      setIsGenerating(false);
    }
  };

  const GenerateButton = (
    <button
      onClick={handleGenerate}
      disabled={isGenerating}
      className={`p-1 rounded transition-colors ${isGenerating ? 'text-gray-400 dark:text-zinc-500' : 'text-gray-500 dark:text-zinc-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/10'}`}
      title="Generate Image"
    >
      {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
    </button>
  );

  const selectedAspectRatioInfo = ASPECT_RATIOS.find(r => r.value === selectedAspectRatio) || ASPECT_RATIOS[0];

  return (
    <ModernNodeCard
      selected={selected}
      icon={Sparkles}
      title="Nano Banana Pro"
      subtitle="Gemini 3 Pro Image"
      color="text-yellow-600 dark:text-yellow-400"
      headerAction={GenerateButton}
      className="w-[280px]"
      handles={
        <>
          <Handle
            type="target"
            position={Position.Left}
            id="reference_image"
            className={HANDLE_STYLES}
            style={{ top: '40%' }}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="image"
            className={HANDLE_STYLES}
            style={{ top: '50%' }}
          />
        </>
      }
      handleLeft={false}
      handleRight={false}
    >
      <div className="p-0">
        {/* Aspect Ratio Selector */}
        <div className="px-3 pt-3 pb-2 bg-white dark:bg-[#1e1e1e] border-b border-gray-200 dark:border-zinc-800">
          <div className="flex gap-1">
            {ASPECT_RATIOS.map((ratio) => (
              <button
                key={ratio.value}
                onClick={(e) => {
                  e.stopPropagation();
                  updateAspectRatio(ratio.value);
                }}
                className={`nodrag flex-1 px-2 py-1.5 text-[10px] rounded transition-colors ${
                  selectedAspectRatio === ratio.value
                    ? 'bg-yellow-100 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-300 dark:border-yellow-500/20'
                    : 'bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-300 hover:border-yellow-400 dark:hover:border-yellow-500'
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

        {/* Image Preview Area */}
        <div className="relative w-full aspect-square bg-gray-100 dark:bg-black/40 flex items-center justify-center overflow-hidden group">
          {imageUrl ? (
            <>
              <img src={imageUrl} alt="Generated" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <a 
                  href={imageUrl} 
                  download="nano-banana-generation.png"
                  className="p-2 bg-gray-800 dark:bg-zinc-800 rounded-full hover:bg-gray-700 dark:hover:bg-zinc-700 text-white dark:text-zinc-200 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download size={16} />
                </a>
              </div>
            </>
          ) : (
            <div className="text-gray-500 dark:text-zinc-600 flex flex-col items-center gap-2 p-4 text-center">
              <ImageIcon size={24} className="opacity-50" />
              <span className="text-xs">Ready to generate</span>
            </div>
          )}
          
          {/* Loading Overlay */}
          {isGenerating && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10 flex-col gap-2">
              <Loader2 size={24} className="text-yellow-500 dark:text-yellow-400 animate-spin" />
              <span className="text-xs text-yellow-600 dark:text-yellow-300 animate-pulse">Creating...</span>
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
              className="nodrag w-full text-xs text-gray-700 dark:text-zinc-300 bg-gray-50 dark:bg-zinc-900/50 p-2 rounded border border-gray-200 dark:border-zinc-800 min-h-[80px] break-words hover:border-yellow-400 dark:hover:border-yellow-500 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 outline-none resize-none font-mono"
              placeholder="Describe the image you want to generate..."
            />
          </div>
          
          {error && (
            <div className="text-[10px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-400/10 p-2 rounded border border-red-200 dark:border-red-400/20">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-zinc-500 pt-2 border-t border-gray-200 dark:border-zinc-800">
            <span>{selectedAspectRatioInfo.label}</span>
            <span className="px-1.5 py-0.5 rounded bg-yellow-100 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-500/20">
              NANO BANANA PRO
            </span>
          </div>
        </div>
      </div>
    </ModernNodeCard>
  );
});

NanoBananaImageGenNode.displayName = 'NanoBananaImageGenNode';
export default NanoBananaImageGenNode;




































