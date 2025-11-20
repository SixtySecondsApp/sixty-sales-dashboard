import { supabase } from '@/lib/supabase/clientV2';

const FREEPIK_PROXY_FUNCTION = 'freepik-proxy';
type ProxyMethod = 'GET' | 'POST';
interface ProxyOptions {
  method?: ProxyMethod;
  payload?: Record<string, unknown> | undefined;
}

// Video model types
export type VideoModel = 
  | 'kling-v2-5-pro'
  | 'minimax-hailuo-02-768p'
  | 'minimax-hailuo-02-1080p'
  | 'kling-v2-1-master'
  | 'kling-v2-1-pro'
  | 'pixverse-v5'
  | 'pixverse-v5-transition'
  | 'kling-v2-1-std'
  | 'kling-v2'
  | 'kling-pro'
  | 'kling-std'
  | 'seedance-lite-1080p'
  | 'wan-v2-2-720p';

// Image model types
export type ImageModel = 
  | 'mystic'
  | 'text-to-image'
  | 'flux-dev'
  | 'flux-pro-v1-1'
  | 'hyperflux'
  | 'seedream'
  | 'seedream-v4'
  | 'seedream-v4-edit';

export interface FreepikImageGenerationParams {
  prompt: string;
  model?: ImageModel;
  negative_prompt?: string;
  num_images?: number;
  image?: {
    size?: 'square' | 'portrait' | 'landscape';
  };
  reference_image?: string; // Base64 or URL for img2img
}

export interface FreepikUpscaleParams {
  image: string; // Base64 or URL
  scale_factor?: number;
  optimize_for?: 'speed' | 'quality';
}

export interface FreepikVideoGenerationParams {
  image: string; // Base64 or URL
  model?: VideoModel;
  prompt?: string;
  negative_prompt?: string;
  duration?: '5' | '10';
  cfg_scale?: number;
  start_frame?: string; // Base64 or URL for transition start
  end_frame?: string; // Base64 or URL for transition end
}

export interface FreepikLipSyncParams {
  video: string; // Base64 or URL
  audio: string; // Base64 or URL
}

export interface FreepikMusicParams {
  prompt: string;
  duration?: number; // seconds
  style?: string;
}

class FreepikService {
  private async proxyRequest<T = any>(endpoint: string, options: ProxyOptions = {}): Promise<T> {
    // Route requests through the Supabase Edge Function so we avoid exposing
    // credentials in the browser and bypass Freepik's lack of CORS headers.
    const body: Record<string, unknown> = {
      endpoint,
      method: (options.method || 'POST').toUpperCase()
    };

    if (options.payload !== undefined) {
      body.payload = options.payload;
    }

    const { data, error } = await supabase.functions.invoke<T>(FREEPIK_PROXY_FUNCTION, {
      body
    });

    if (error) {
      const message =
        (error as any)?.context?.error ||
        (error as any)?.message ||
        'Freepik proxy request failed';
      throw new Error(message);
    }

    return data as T;
  }

  private async request<T = any>(endpoint: string, payload: Record<string, unknown>) {
    return this.proxyRequest<T>(endpoint, { method: 'POST', payload });
  }

  private async getRequest<T = any>(endpoint: string) {
    return this.proxyRequest<T>(endpoint, { method: 'GET' });
  }

  /**
   * Generate images from text using various models
   */
  async generateImage(params: FreepikImageGenerationParams) {
    const model = params.model || 'mystic';
    let endpoint = '';
    
    // Map model to endpoint
    if (model === 'mystic') {
      endpoint = '/mystic';
    } else if (model === 'text-to-image') {
      endpoint = '/text-to-image';
    } else {
      endpoint = `/text-to-image/${model}`;
    }

    const body: any = {
      prompt: params.prompt,
      negative_prompt: params.negative_prompt,
      num_images: params.num_images || 1,
    };

    if (params.image?.size) {
      body.image = {
        size: params.image.size
      };
    }

    // Add reference image for img2img models
    if (params.reference_image) {
      body.image = body.image || {};
      body.image.reference = params.reference_image;
    }

    return this.request(endpoint, body);
  }

  /**
   * Upscale an image
   */
  async upscaleImage(params: FreepikUpscaleParams) {
    // Endpoint: /upscale/v1 or /image-upscaler-creative
    return this.request('/image-upscaler-creative', {
      image: params.image,
      scale_factor: params.scale_factor || 2,
      optimize_for: params.optimize_for || 'quality'
    });
  }

  /**
   * Generate video from image using various models
   */
  async generateVideo(params: FreepikVideoGenerationParams) {
    const model = params.model || 'kling-v2-5-pro';
    const endpoint = `/image-to-video/${model}`;

    const body: any = {
      image: params.image,
      prompt: params.prompt,
      negative_prompt: params.negative_prompt,
      duration: params.duration || '5',
      cfg_scale: params.cfg_scale || 0.5
    };

    // Add start/end frames for transition models
    if (params.start_frame) {
      body.start_frame = params.start_frame;
    }
    if (params.end_frame) {
      body.end_frame = params.end_frame;
    }

    return this.request(endpoint, body);
  }

  /**
   * Generate lip-synced video
   */
  async generateLipSync(params: FreepikLipSyncParams) {
    // Endpoint: /lip-sync/latent-sync
    return this.request('/lip-sync/latent-sync', {
      video: params.video,
      audio: params.audio
    });
  }

  /**
   * Generate music/audio
   */
  async generateMusic(params: FreepikMusicParams) {
    // Endpoint: /audio-generation or similar (may need to verify exact endpoint)
    // Using a generic endpoint pattern - may need adjustment based on actual API
    return this.request('/audio-generation', {
      prompt: params.prompt,
      duration: params.duration || 30,
      style: params.style
    });
  }

  /**
   * Check task status for async operations (video generation, lip sync, etc.)
   */
  async getTaskStatus(taskId: string, model?: VideoModel) {
    // Try to determine endpoint from model, fallback to generic pattern
    const endpoint = model
      ? `/image-to-video/${model}/${taskId}`
      : `/tasks/${taskId}`;

    return this.getRequest(endpoint);
  }
}

export const freepikService = new FreepikService();

