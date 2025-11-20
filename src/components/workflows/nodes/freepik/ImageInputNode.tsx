import React, { memo, useState } from 'react';
import { NodeProps } from 'reactflow';
import { Image as ImageIcon, Upload, Link as LinkIcon } from 'lucide-react';
import { ModernNodeCard } from '../ModernNodeCard';

export interface ImageInputNodeData {
  src?: string; // Image URL or base64
  label?: string;
}

const ImageInputNode = memo(({ data, selected }: NodeProps<ImageInputNodeData>) => {
  const [imageUrl, setImageUrl] = useState<string | null>(data.src || null);
  const [isEditing, setIsEditing] = useState(false);
  const [inputUrl, setInputUrl] = useState('');

  const handleImageUrlSubmit = (e: React.FormEvent) => {
    e.stopPropagation();
    if (inputUrl.trim()) {
      setImageUrl(inputUrl.trim());
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
        setImageUrl(result);
      };
      reader.readAsDataURL(file);
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
              {!isEditing && (
                <div className="flex gap-2">
                  <label className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded cursor-pointer transition-colors">
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
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded transition-colors flex items-center gap-1"
                  >
                    <LinkIcon size={12} />
                    URL
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* URL Input Form */}
        {isEditing && (
          <div className="p-3 bg-white dark:bg-[#1e1e1e] border-t border-gray-200 dark:border-zinc-800">
            <form onSubmit={handleImageUrlSubmit} className="space-y-2">
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

