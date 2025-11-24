import React, { memo, useState, useEffect, useCallback } from 'react';
import { NodeProps, useReactFlow } from 'reactflow';
import { Image as ImageIcon, Upload, Link as LinkIcon, Sparkles, Loader2 } from 'lucide-react';
import { ModernNodeCard } from '../ModernNodeCard';
import { nanoBananaService } from '@/lib/services/nanoBananaService';

export interface ImageInputNodeData {
  src?: string; // Image URL or base64
  label?: string;
  // Nano Banana Pro generation options
  generatePrompt?: string;
  aspectRatio?: 'square' | 'portrait' | 'landscape';
}

const ImageInputNode = memo(({ id, data, selected }: NodeProps<ImageInputNodeData>) => {
  const [imageUrl, setImageUrl] = useState<string | null>(data.src || null);
  const [isEditing, setIsEditing] = useState(false);
  const [inputUrl, setInputUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [generatePrompt, setGeneratePrompt] = useState(data.generatePrompt || '');
  const [aspectRatio, setAspectRatio] = useState<'square' | 'portrait' | 'landscape'>(data.aspectRatio || 'square');
  const { setNodes } = useReactFlow();

  useEffect(() => {
    setImageUrl(data.src || null);
  }, [data.src]);

  const updateNodeImage = useCallback(
    (value: string | null) => {
      setImageUrl(value);
      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id !== id) return node;
          const updatedData = { ...node.data };
          if (value) {
            updatedData.src = value;
          } else {
            delete updatedData.src;
          }
          return { ...node, data: updatedData };
        })
      );
    },
    [id, setNodes]
  );

  const handleImageUrlSubmit = (e: React.FormEvent) => {
    e.stopPropagation();
    if (inputUrl.trim()) {
      updateNodeImage(inputUrl.trim());
      setIsEditing(false);
      setInputUrl('');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          updateNodeImage(result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!generatePrompt.trim()) {
      setGenerationError('Please enter a prompt');
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);

    try {
      const result = await nanoBananaService.generateImage({
        prompt: generatePrompt.trim(),
        aspect_ratio: aspectRatio,
        num_images: 1,
      });

      if (result.images && result.images.length > 0) {
        updateNodeImage(result.images[0]);
        // Update node data with generation settings
        setNodes((nodes) =>
          nodes.map((node) => {
            if (node.id !== id) return node;
            return {
              ...node,
              data: {
                ...node.data,
                generatePrompt: generatePrompt.trim(),
                aspectRatio: aspectRatio,
              }
            };
          })
        );
        setShowGenerate(false);
      } else {
        throw new Error('No images returned from Nano Banana Pro');
      }
    } catch (err: any) {
      setGenerationError(err.message || 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <ModernNodeCard
      selected={selected}
      icon={ImageIcon}
      title={data.label || "Input Image"}
      subtitle="Image Source"
      color="text-blue-600 dark:text-blue-400"
      handleLeft={false}
      handleRight={true}
      className="w-[280px]"
    >
      <div className="p-0">
        {/* Image Preview Area */}
        <div className="relative w-full aspect-square bg-gray-100 dark:bg-black/40 flex items-center justify-center overflow-hidden group">
          {imageUrl ? (
            <>
              <img src={imageUrl} alt="input" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
              <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[9px] px-2 py-1 rounded backdrop-blur-sm">
                Original
              </div>
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditing(true);
                  }}
                  className="p-2 bg-gray-800 dark:bg-zinc-800 rounded-full hover:bg-gray-700 dark:hover:bg-zinc-700 text-white dark:text-zinc-200 transition-colors"
                  title="Change Image"
                >
                  <LinkIcon size={16} />
                </button>
              </div>
            </>
          ) : (
            <div className="text-gray-500 dark:text-zinc-600 flex flex-col items-center gap-3 p-4 text-center">
              <ImageIcon size={32} className="opacity-50" />
              <span className="text-xs">No image selected</span>
              {!isEditing && !showGenerate && (
                <div className="flex flex-col gap-2 w-full px-4">
                  <label className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded cursor-pointer transition-colors text-center">
                    <Upload size={12} className="inline mr-1" />
                    Upload
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </label>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditing(true);
                    }}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded transition-colors flex items-center justify-center gap-1"
                  >
                    <LinkIcon size={12} />
                    URL
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowGenerate(true);
                    }}
                    className="px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white text-xs rounded transition-colors flex items-center justify-center gap-1"
                  >
                    <Sparkles size={12} />
                    Generate (Nano Banana Pro)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* URL Input Form */}
        {isEditing && (
          <div className="p-3 bg-white dark:bg-[#1e1e1e] border-t border-gray-200 dark:border-zinc-800">
            <form onSubmit={handleImageUrlSubmit} className="space-y-2" data-testid="image-url-form">
              <input
                type="url"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="Enter image URL..."
                className="w-full px-2 py-1.5 text-xs bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 rounded text-gray-700 dark:text-zinc-300 placeholder-gray-400 dark:placeholder-zinc-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 outline-none"
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 px-2 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  Load
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditing(false);
                    setInputUrl('');
                  }}
                  className="px-2 py-1.5 bg-gray-200 dark:bg-zinc-800 hover:bg-gray-300 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 text-xs rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Nano Banana Pro Generation Form */}
        {showGenerate && (
          <div className="p-3 bg-white dark:bg-[#1e1e1e] border-t border-gray-200 dark:border-zinc-800">
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-700 dark:text-zinc-300 flex items-center gap-1">
                  <Sparkles size={12} className="text-yellow-500" />
                  Nano Banana Pro
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowGenerate(false);
                    setGenerationError(null);
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-zinc-300"
                >
                  Cancel
                </button>
              </div>
              
              <textarea
                value={generatePrompt}
                onChange={(e) => setGeneratePrompt(e.target.value)}
                placeholder="Describe the image you want to generate..."
                className="w-full px-2 py-1.5 text-xs bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 rounded text-gray-700 dark:text-zinc-300 placeholder-gray-400 dark:placeholder-zinc-600 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/50 outline-none resize-none min-h-[60px]"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              />
              
              <div className="flex gap-1">
                {(['square', 'portrait', 'landscape'] as const).map((ratio) => (
                  <button
                    key={ratio}
                    onClick={(e) => {
                      e.stopPropagation();
                      setAspectRatio(ratio);
                    }}
                    className={`flex-1 px-2 py-1 text-[10px] rounded transition-colors ${
                      aspectRatio === ratio
                        ? 'bg-yellow-100 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-300 dark:border-yellow-500/20'
                        : 'bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-300 hover:border-yellow-400 dark:hover:border-yellow-500'
                    }`}
                  >
                    {ratio.charAt(0).toUpperCase() + ratio.slice(1)}
                  </button>
                ))}
              </div>

              {generationError && (
                <div className="text-[10px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-400/10 p-2 rounded border border-red-200 dark:border-red-400/20">
                  {generationError}
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={isGenerating || !generatePrompt.trim()}
                className="w-full px-2 py-1.5 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-xs rounded transition-colors flex items-center justify-center gap-1"
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles size={12} />
                    Generate Image
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Image Info */}
        {imageUrl && !isEditing && (
          <div className="p-3 bg-white dark:bg-[#1e1e1e] border-t border-gray-200 dark:border-zinc-800">
            <div className="text-[10px] text-gray-500 dark:text-zinc-500 truncate">
              {imageUrl.length > 50 ? `${imageUrl.substring(0, 50)}...` : imageUrl}
            </div>
          </div>
        )}
      </div>
    </ModernNodeCard>
  );
});

ImageInputNode.displayName = 'ImageInputNode';
export default ImageInputNode;

