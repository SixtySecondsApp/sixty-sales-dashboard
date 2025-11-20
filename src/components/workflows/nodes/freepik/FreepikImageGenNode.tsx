import React, { memo, useState } from 'react';
import { NodeProps, Handle, Position } from 'reactflow';
import { Image as ImageIcon, Loader2, Sparkles, Download, RefreshCcw } from 'lucide-react';
import { ModernNodeCard, HANDLE_STYLES } from '../ModernNodeCard';
import { freepikService } from '@/lib/services/freepikService';

export interface FreepikImageGenNodeData {
  prompt?: string;
  negative_prompt?: string;
  aspect_ratio?: 'square' | 'portrait' | 'landscape';
  num_images?: number;
  generated_image?: string; // Base64 or URL
}

const FreepikImageGenNode = memo(({ data, selected }: NodeProps<FreepikImageGenNodeData>) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(data.generated_image || null);

  const handleGenerate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!data.prompt) {
      setError("Prompt is required");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const result = await freepikService.generateImage({
        prompt: data.prompt,
        negative_prompt: data.negative_prompt,
        num_images: 1,
        image: {
          size: data.aspect_ratio || 'square'
        }
      });

      // Assuming result structure based on common API patterns
      // Adjust based on actual response schema
      if (result.data && result.data[0] && result.data[0].base64) {
        const base64Image = `data:image/png;base64,${result.data[0].base64}`;
        setImageUrl(base64Image);
        // Update node data if possible (requires callback in real app)
      } else if (result.data && result.data[0] && result.data[0].url) {
         setImageUrl(result.data[0].url);
      } else {
        throw new Error("No image data received");
      }
    } catch (err: any) {
      setError(err.message || "Generation failed");
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

  return (
    <ModernNodeCard
      selected={selected}
      icon={Sparkles}
      title="Mystic Generator"
      subtitle="Text to Image"
      color="text-purple-600 dark:text-purple-400"
      headerAction={GenerateButton}
      className="w-[280px]"
    >
      <div className="p-0">
        {/* Image Preview Area */}
        <div className="relative w-full aspect-square bg-gray-100 dark:bg-black/40 flex items-center justify-center overflow-hidden group">
          {imageUrl ? (
            <>
              <img src={imageUrl} alt="Generated" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <a 
                  href={imageUrl} 
                  download="mystic-generation.png"
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
              <Loader2 size={24} className="text-purple-500 dark:text-purple-400 animate-spin" />
              <span className="text-xs text-purple-600 dark:text-purple-300 animate-pulse">Dreaming...</span>
            </div>
          )}
        </div>

        {/* Inputs */}
        <div className="p-3 space-y-3 bg-white dark:bg-[#1e1e1e]">
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wider">Prompt</label>
            <div className="text-xs text-gray-700 dark:text-zinc-300 bg-gray-50 dark:bg-zinc-900/50 p-2 rounded border border-gray-200 dark:border-zinc-800 min-h-[60px] break-words">
              {data.prompt || <span className="text-gray-400 dark:text-zinc-600 italic">Click node to configure prompt...</span>}
            </div>
            <p className="text-[9px] text-gray-400 dark:text-zinc-600 mt-1">
              Click the node to open configuration panel
            </p>
          </div>
          
          {error && (
            <div className="text-[10px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-400/10 p-2 rounded border border-red-200 dark:border-red-400/20">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-zinc-500 pt-2 border-t border-gray-200 dark:border-zinc-800">
            <span>{data.aspect_ratio || 'square'}</span>
            <span className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20">
              MYSTIC V1
            </span>
          </div>
        </div>
      </div>
    </ModernNodeCard>
  );
});

FreepikImageGenNode.displayName = 'FreepikImageGenNode';
export default FreepikImageGenNode;
