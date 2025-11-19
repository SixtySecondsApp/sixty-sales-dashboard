import React, { memo, useState } from 'react';
import { NodeProps, Handle, Position } from 'reactflow';
import { Image as ImageIcon, Loader2, Maximize, Download, RefreshCcw, ArrowUpRight } from 'lucide-react';
import { ModernNodeCard, HANDLE_STYLES } from '../ModernNodeCard';
import { freepikService } from '@/lib/services/freepikService';

export interface FreepikUpscaleNodeData {
  input_image?: string; // Base64 or URL
  scale_factor?: number;
  optimize_for?: 'speed' | 'quality';
  output_image?: string;
}

const FreepikUpscaleNode = memo(({ data, selected }: NodeProps<FreepikUpscaleNodeData>) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outputImage, setOutputImage] = useState<string | null>(data.output_image || null);

  // Use input image from data or fallback to a placeholder if connected
  const inputImage = data.input_image;

  const handleUpscale = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!inputImage) {
      setError("Input image required");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const result = await freepikService.upscaleImage({
        image: inputImage,
        scale_factor: data.scale_factor || 2,
        optimize_for: data.optimize_for || 'quality'
      });

      // Adjust based on actual response schema
      if (result.data && result.data.base64) {
        const base64Image = `data:image/png;base64,${result.data.base64}`;
        setOutputImage(base64Image);
      } else if (result.data && result.data.url) {
         setOutputImage(result.data.url);
      } else {
        throw new Error("No image data received");
      }
    } catch (err: any) {
      setError(err.message || "Upscaling failed");
    } finally {
      setIsProcessing(false);
    }
  };

  const ProcessButton = (
    <button
      onClick={handleUpscale}
      disabled={isProcessing || !inputImage}
      className={`p-1 rounded transition-colors ${isProcessing ? 'text-gray-400 dark:text-zinc-500' : 'text-gray-500 dark:text-zinc-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/10'}`}
      title="Upscale Image"
    >
      {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <ArrowUpRight size={14} />}
    </button>
  );

  return (
    <ModernNodeCard
      selected={selected}
      icon={Maximize}
      title="Upscaler"
      subtitle="Magnific Tech"
      color="text-blue-600 dark:text-blue-400"
      headerAction={ProcessButton}
      className="w-[280px]"
    >
      <div className="p-0">
        {/* Comparison View / Output */}
        <div className="relative w-full aspect-square bg-gray-100 dark:bg-black/40 flex items-center justify-center overflow-hidden group">
          {outputImage ? (
            <>
              <img src={outputImage} alt="Upscaled" className="w-full h-full object-cover" />
              <div className="absolute bottom-2 left-2 bg-blue-500/80 text-white text-[9px] px-1.5 py-0.5 rounded font-bold">
                {data.scale_factor || 2}x UPSCALED
              </div>
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <a 
                  href={outputImage} 
                  download="upscaled-image.png"
                  className="p-2 bg-gray-800 dark:bg-zinc-800 rounded-full hover:bg-gray-700 dark:hover:bg-zinc-700 text-white dark:text-zinc-200 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download size={16} />
                </a>
              </div>
            </>
          ) : inputImage ? (
             <div className="relative w-full h-full">
                <img src={inputImage} alt="Input" className="w-full h-full object-cover opacity-50 grayscale" />
                <div className="absolute inset-0 flex items-center justify-center">
                   <span className="bg-black/60 px-2 py-1 rounded text-[10px] text-white dark:text-zinc-300">Waiting to process</span>
                </div>
             </div>
          ) : (
            <div className="text-gray-500 dark:text-zinc-600 flex flex-col items-center gap-2 p-4 text-center">
              <ImageIcon size={24} className="opacity-50" />
              <span className="text-xs">Connect an image node</span>
            </div>
          )}
          
          {/* Loading Overlay */}
          {isProcessing && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10 flex-col gap-2">
              <Loader2 size={24} className="text-blue-400 animate-spin" />
              <span className="text-xs text-blue-300 animate-pulse">Enhancing details...</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-3 space-y-3 bg-white dark:bg-[#1e1e1e]">
          <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-500 dark:text-zinc-500">
             <div className="flex flex-col gap-1">
               <span className="uppercase tracking-wider">Scale</span>
               <span className="text-gray-700 dark:text-zinc-300">{data.scale_factor || 2}x</span>
             </div>
             <div className="flex flex-col gap-1">
               <span className="uppercase tracking-wider">Mode</span>
               <span className="text-gray-700 dark:text-zinc-300 capitalize">{data.optimize_for || 'Quality'}</span>
             </div>
          </div>
          
          {error && (
            <div className="text-[10px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-400/10 p-2 rounded border border-red-200 dark:border-red-400/20">
              {error}
            </div>
          )}
        </div>
      </div>
    </ModernNodeCard>
  );
});

FreepikUpscaleNode.displayName = 'FreepikUpscaleNode';
export default FreepikUpscaleNode;

