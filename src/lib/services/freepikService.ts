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

export type FreepikTaskStatus =
  | 'CREATED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED'
  | 'ERROR'
  | 'CANCELED'
  | 'REJECTED'
  | string;

export interface FreepikTaskData {
  generated?: string[];
  task_id?: string;
  status?: FreepikTaskStatus;
  has_nsfw?: boolean[];
}

export interface FreepikTaskResponse {
  data?: FreepikTaskData;
  generated?: string[];
  task_id?: string;
  status?: FreepikTaskStatus;
  has_nsfw?: boolean[];
  [key: string]: any;
}

export interface FreepikImageGenerationResult extends FreepikTaskResponse {}

export const extractFreepikGeneratedImages = (response?: FreepikTaskResponse): string[] | undefined => {
  if (!response) return undefined;
  
  // Check nested data.generated first
  if (Array.isArray(response.data?.generated) && response.data.generated.length > 0) {
    // Validate URLs
    const validUrls = response.data.generated.filter(url => 
      typeof url === 'string' && (url.startsWith('http') || url.startsWith('data:'))
    );
    if (validUrls.length > 0) return validUrls;
  }
  
  // Fallback to root-level generated
  if (Array.isArray(response.generated) && response.generated.length > 0) {
    const validUrls = response.generated.filter(url => 
      typeof url === 'string' && (url.startsWith('http') || url.startsWith('data:'))
    );
    if (validUrls.length > 0) return validUrls;
  }
  
  return undefined;
};

export const extractFreepikTaskId = (response?: FreepikTaskResponse): string | undefined => {
  const taskId = response?.data?.task_id || response?.task_id;
  // Validate task ID format (should be a non-empty string)
  if (taskId && typeof taskId === 'string' && taskId.trim().length > 0) {
    return taskId.trim();
  }
  return undefined;
};

export const extractFreepikTaskStatus = (response?: FreepikTaskResponse): FreepikTaskStatus | undefined => {
  return response?.data?.status || response?.status || undefined;
};

const isTerminalFailureStatus = (status?: FreepikTaskStatus) => {
  if (!status) return false;
  return ['FAILED', 'ERROR', 'CANCELED', 'REJECTED'].includes(status.toUpperCase());
};

interface PollingOptions {
  intervalMs?: number;
  timeoutMs?: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
   * Get the POST endpoint for a given model
   */
  private getPostEndpoint(model: ImageModel): string {
    if (model === 'mystic') {
      return '/mystic';
    } else if (model === 'text-to-image') {
      return '/text-to-image';
    } else {
      return `/text-to-image/${model}`;
    }
  }

  /**
   * Get the GET endpoint pattern for polling a task status
   * This should match the POST endpoint pattern for each model
   */
  private getPollingEndpoint(model: ImageModel, taskId: string): string {
    const postEndpoint = this.getPostEndpoint(model);
    return `${postEndpoint}/${taskId}`;
  }

  /**
   * Generate images from text using various models
   */
  async generateImage(params: FreepikImageGenerationParams): Promise<FreepikImageGenerationResult> {
    const model = params.model || 'mystic';
    const endpoint = this.getPostEndpoint(model);

    console.log(`[Freepik] Starting image generation`, {
      model,
      endpoint,
      prompt: params.prompt?.substring(0, 50) + '...'
    });

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

    try {
      const initialResponse = await this.request<FreepikImageGenerationResult>(endpoint, body);
      console.log(`[Freepik] POST response received`, {
        model,
        endpoint,
        hasData: !!initialResponse.data,
        hasGenerated: !!extractFreepikGeneratedImages(initialResponse)
      });

      // Check if images are immediately available
      const generated = extractFreepikGeneratedImages(initialResponse);
      if (generated && generated.length > 0) {
        console.log(`[Freepik] Images immediately available`, {
          model,
          count: generated.length
        });
        return initialResponse;
      }

      // Extract task ID for polling
      const taskId = extractFreepikTaskId(initialResponse);
      if (!taskId) {
        console.error(`[Freepik] No task ID in response`, {
          model,
          endpoint,
          response: JSON.stringify(initialResponse).substring(0, 200)
        });
        throw new Error(
          `Freepik did not return a task id for this generation request. ` +
          `Model: ${model}, Endpoint: ${endpoint}. ` +
          `Response: ${JSON.stringify(initialResponse).substring(0, 200)}`
        );
      }

      console.log(`[Freepik] Task ID extracted, starting polling`, {
        model,
        taskId,
        endpoint
      });

      return this.pollForImageResult(model, taskId);
    } catch (error: any) {
      console.error(`[Freepik] Generation failed`, {
        model,
        endpoint,
        error: error.message
      });
      throw error;
    }
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

  private async pollForImageResult(model: ImageModel, taskId: string, options: PollingOptions = {}) {
    const { intervalMs = 2000, timeoutMs = 60000 } = options;
    const statusEndpoint = this.getPollingEndpoint(model, taskId);
    const startedAt = Date.now();
    let attempt = 0;

    console.log(`[Freepik] Polling started`, {
      model,
      taskId,
      statusEndpoint,
      timeoutMs
    });

    // Add initial delay before first poll attempt (API might need time to process)
    await sleep(1000);

    while (Date.now() - startedAt < timeoutMs) {
      if (attempt > 0) {
        await sleep(intervalMs);
      }

      try {
        console.log(`[Freepik] Polling attempt ${attempt + 1}`, {
          model,
          taskId,
          statusEndpoint,
          elapsed: Date.now() - startedAt
        });

        const statusResponse = await this.getRequest<FreepikImageGenerationResult>(statusEndpoint);
        const status = extractFreepikTaskStatus(statusResponse);
        
        console.log(`[Freepik] Polling response`, {
          model,
          taskId,
          status,
          hasGenerated: !!extractFreepikGeneratedImages(statusResponse)
        });

        // Check if images are available
        const generated = extractFreepikGeneratedImages(statusResponse);
        if (generated && generated.length > 0) {
          console.log(`[Freepik] Polling completed successfully`, {
            model,
            taskId,
            imageCount: generated.length,
            attempts: attempt + 1,
            elapsed: Date.now() - startedAt
          });
          return statusResponse;
        }

        // Check for terminal failure statuses
        if (isTerminalFailureStatus(status)) {
          const errorMsg = `Freepik generation failed with status ${status}. Model: ${model}, Task ID: ${taskId}, Endpoint: ${statusEndpoint}`;
          console.error(`[Freepik] Terminal failure`, {
            model,
            taskId,
            status,
            response: JSON.stringify(statusResponse).substring(0, 300)
          });
          throw new Error(errorMsg);
        }

        // Log progress for non-terminal statuses
        if (status && ['CREATED', 'IN_PROGRESS'].includes(status.toUpperCase())) {
          console.log(`[Freepik] Task still processing`, {
            model,
            taskId,
            status,
            attempt: attempt + 1
          });
        }

        attempt += 1;
      } catch (error: any) {
        // If it's a terminal error, re-throw it
        if (error.message?.includes('failed with status')) {
          throw error;
        }
        
        // Log polling errors but continue trying
        console.warn(`[Freepik] Polling error (will retry)`, {
          model,
          taskId,
          attempt: attempt + 1,
          error: error.message
        });
        
        attempt += 1;
      }
    }

    const errorMsg = `Freepik generation timed out after ${timeoutMs}ms. Model: ${model}, Task ID: ${taskId}, Endpoint: ${statusEndpoint}, Attempts: ${attempt}`;
    console.error(`[Freepik] Polling timeout`, {
      model,
      taskId,
      statusEndpoint,
      attempts: attempt,
      timeoutMs
    });
    throw new Error(errorMsg);
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

