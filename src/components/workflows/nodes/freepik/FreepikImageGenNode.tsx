import React, { memo, useState, useEffect } from 'react';
import { NodeProps, Handle, Position, useReactFlow } from 'reactflow';
import { Image as ImageIcon, Loader2, Sparkles, Download, RefreshCcw, ChevronDown } from 'lucide-react';
import { ModernNodeCard, HANDLE_STYLES } from '../ModernNodeCard';
import { freepikService, ImageModel } from '@/lib/services/freepikService';

export interface FreepikImageGenNodeData {
  prompt?: string;
  negative_prompt?: string;
  model?: ImageModel;
  aspect_ratio?: 'square' | 'portrait' | 'landscape';
  num_images?: number;
  generated_image?: string; // Base64 or URL
  reference_image?: string; // For img2img
}

const IMAGE_MODELS: { value: ImageModel; label: string; description: string; supportsImg2Img: boolean }[] = [
  { value: 'mystic', label: 'Mystic', description: 'Default model', supportsImg2Img: false },
  { value: 'text-to-image', label: 'Text to Image', description: 'Standard generation', supportsImg2Img: false },
  { value: 'flux-pro-v1-1', label: 'Flux Pro v1.1', description: 'High quality', supportsImg2Img: false },
  { value: 'flux-dev', label: 'Flux Dev', description: 'Development version', supportsImg2Img: false },
  { value: 'hyperflux', label: 'Hyperflux', description: 'Ultra fast', supportsImg2Img: false },
  { value: 'seedream', label: 'Seedream', description: 'Dream-like', supportsImg2Img: false },
  { value: 'seedream-v4', label: 'Seedream v4', description: 'Version 4', supportsImg2Img: false },
  { value: 'seedream-v4-edit', label: 'Seedream v4 Edit', description: 'With editing', supportsImg2Img: true },
];

const FreepikImageGenNode = memo(({ id, data, selected }: NodeProps<FreepikImageGenNodeData>) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(data.generated_image || null);
  const [promptValue, setPromptValue] = useState(data.prompt || '');
  const [selectedModel, setSelectedModel] = useState<ImageModel>(data.model || 'mystic');
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const { setNodes } = useReactFlow();

  useEffect(() => {
    setPromptValue(data.prompt || '');
    setSelectedModel(data.model || 'mystic');
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

  const updateModel = (model: ImageModel) => {
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
        model: selectedModel,
        negative_prompt: data.negative_prompt,
        num_images: 1,
        image: {
          size: data.aspect_ratio || 'square'
        },
        reference_image: data.reference_image
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

  const selectedModelInfo = IMAGE_MODELS.find(m => m.value === selectedModel) || IMAGE_MODELS[0];

  return (
    <ModernNodeCard
      selected={selected}
      icon={Sparkles}
      title="Image Generator"
      subtitle={selectedModelInfo.label}
      color="text-purple-600 dark:text-purple-400"
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
        {/* Model Selector */}
        <div className="px-3 pt-3 pb-2 bg-white dark:bg-[#1e1e1e] border-b border-gray-200 dark:border-zinc-800">
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowModelDropdown(!showModelDropdown);
              }}
              className="nodrag w-full flex items-center justify-between text-[10px] px-2 py-1.5 bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 rounded hover:border-purple-400 dark:hover:border-purple-500 transition-colors"
            >
              <span className="text-gray-700 dark:text-zinc-300 font-medium">{selectedModelInfo.label}</span>
              <ChevronDown size={12} className="text-gray-500 dark:text-zinc-500" />
            </button>
            {showModelDropdown && (
              <div className="absolute z-50 mt-1 w-full bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-zinc-800 rounded shadow-lg max-h-[200px] overflow-y-auto">
                {IMAGE_MODELS.map((model) => (
                  <button
                    key={model.value}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateModel(model.value);
                    }}
                    className={`nodrag w-full text-left px-2 py-1.5 text-[10px] hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors ${
                      selectedModel === model.value ? 'bg-purple-50 dark:bg-purple-500/10' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-700 dark:text-zinc-300">{model.label}</div>
                        <div className="text-[9px] text-gray-500 dark:text-zinc-500">{model.description}</div>
                      </div>
                      {model.supportsImg2Img && (
                        <span className="text-[8px] px-1 py-0.5 bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded">
                          img2img
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
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
                  download="mystic-generation.png"
                  className="p-2 bg-gray-800 dark:bg-zinc-800 rounded-full hover:bg-gray-700 dark:hover:bg-zinc-700 text-white dark:text-zinc-200 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download size={16} />
                </a>
              </div>
            </>
          ) : data.reference_image ? (
            <div className="relative w-full h-full">
              <img src={data.reference_image} alt="Reference" className="w-full h-full object-cover opacity-50" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="bg-black/60 px-2 py-1 rounded text-[10px] text-white dark:text-zinc-300 flex items-center gap-1">
                  <ImageIcon size={10} /> Reference image
                </span>
              </div>
            </div>
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
            <textarea
              value={promptValue}
              onChange={(e) => updatePrompt(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="nodrag w-full text-xs text-gray-700 dark:text-zinc-300 bg-gray-50 dark:bg-zinc-900/50 p-2 rounded border border-gray-200 dark:border-zinc-800 min-h-[80px] break-words hover:border-purple-400 dark:hover:border-purple-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none resize-none font-mono"
              placeholder="Describe the image you want to generate..."
            />
          </div>
          
          {error && (
            <div className="text-[10px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-400/10 p-2 rounded border border-red-200 dark:border-red-400/20">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-zinc-500 pt-2 border-t border-gray-200 dark:border-zinc-800">
            <span>{data.aspect_ratio || 'square'}</span>
            <div className="flex items-center gap-1">
              {data.reference_image && (
                <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
                  img2img
                </span>
              )}
              <span className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20">
                {selectedModel.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </ModernNodeCard>
  );
});

FreepikImageGenNode.displayName = 'FreepikImageGenNode';
export default FreepikImageGenNode;
