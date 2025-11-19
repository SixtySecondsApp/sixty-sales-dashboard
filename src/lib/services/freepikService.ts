import { supabase } from '@/lib/supabase/clientV2';

const FREEPIK_API_BASE = 'https://api.freepik.com/v1/ai';

// Helper to get API key from environment or settings
const getApiKey = () => {
  const envKey = import.meta.env.VITE_FREEPIK_API_KEY;
  if (envKey) return envKey;
  // In a real app, you might fetch this from user settings in DB
  return null;
};

export interface FreepikImageGenerationParams {
  prompt: string;
  negative_prompt?: string;
  num_images?: number;
  image?: {
    size?: 'square' | 'portrait' | 'landscape';
  };
}

export interface FreepikUpscaleParams {
  image: string; // Base64 or URL
  scale_factor?: number;
  optimize_for?: 'speed' | 'quality';
}

export interface FreepikVideoGenerationParams {
  image: string; // Base64 or URL
  prompt?: string;
  negative_prompt?: string;
  duration?: '5' | '10';
  cfg_scale?: number;
}

class FreepikService {
  private async request(endpoint: string, method: string, body: any) {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error('Freepik API key not configured');
    }

    const response = await fetch(`${FREEPIK_API_BASE}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-freepik-api-key': apiKey,
        'Accept': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Freepik API error: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Generate images from text using Mystic model
   */
  async generateImage(params: FreepikImageGenerationParams) {
    // Mapping to correct endpoint structure for Mystic
    // Endpoint: /text-to-image/mystic-v1
    return this.request('/text-to-image/mystic', 'POST', {
      prompt: params.prompt,
      negative_prompt: params.negative_prompt,
      num_images: params.num_images || 1,
      image: {
        size: params.image?.size || 'square'
      }
    });
  }

  /**
   * Upscale an image
   */
  async upscaleImage(params: FreepikUpscaleParams) {
    // Endpoint: /upscale/v1
    return this.request('/upscale/v1', 'POST', {
      image: params.image,
      scale_factor: params.scale_factor || 2,
      optimize_for: params.optimize_for || 'quality'
    });
  }

  /**
   * Generate video from image using Kling v2.5
   */
  async generateVideo(params: FreepikVideoGenerationParams) {
    // Endpoint: /image-to-video/kling-v2-5-pro
    return this.request('/image-to-video/kling-v2-5-pro', 'POST', {
      image: params.image,
      prompt: params.prompt,
      negative_prompt: params.negative_prompt,
      duration: params.duration || '5',
      cfg_scale: params.cfg_scale || 0.5
    });
  }

  /**
   * Check task status for async operations (video generation)
   */
  async getTaskStatus(taskId: string) {
    // Generic task status endpoint or specific one depending on service
    // For Kling, it usually returns a task_id first
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('Freepik API key not configured');

    // Note: The actual endpoint might vary, assuming a standard pattern for now
    // Usually GET /image-to-video/kling-v2-5-pro/{task_id}
    const response = await fetch(`${FREEPIK_API_BASE}/image-to-video/kling-v2-5-pro/${taskId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-freepik-api-key': apiKey
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to check task status: ${response.statusText}`);
    }

    return response.json();
  }
}

export const freepikService = new FreepikService();

