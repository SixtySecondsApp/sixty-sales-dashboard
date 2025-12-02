import { supabase } from '@/lib/supabase/clientV2';
import { AIProviderService } from './aiProvider';

const VEO3_API_BASE = 'https://api.veo3gen.co/api/veo';

export interface Veo3VideoGenerationParams {
  prompt: string;
  model?: 'veo-3.0-fast-generate-preview' | 'veo-3.0-generate-preview';
  durationSeconds?: number; // 5, 8, or 10 seconds
  generateAudio?: boolean;
  aspectRatio?: '16:9' | '9:16' | '1:1';
}

export interface Veo3VideoGenerationResult {
  taskId?: string;
  videoUrl?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

/**
 * Service for Veo 3 video generation via veo3gen.co API
 * Uses Google Veo 3 model for text-to-video generation
 */
class Veo3Service {
  private async getApiKey(): Promise<string> {
    // Get user once and reuse
    let user: any = null;
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      user = authUser;
    } catch (error) {
      console.warn('[Veo3] Could not get user:', error);
    }

    if (!user) {
      // No user, try environment variable directly
      const envKey = import.meta.env.VITE_VEO3_API_KEY;
      if (envKey) {
        console.log('[Veo3] Using environment Veo3 API key (no user)');
        return envKey;
      }
      throw new Error(
        'Veo3 API key not configured. ' +
        'Please add your Veo3 API key in Settings > AI Provider Settings or set VITE_VEO3_API_KEY.'
      );
    }

    // Try to get from user settings first
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('ai_provider_keys')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.warn('[Veo3] Error fetching user settings:', error.message);
      } else if (data?.ai_provider_keys?.veo3) {
        const apiKey = data.ai_provider_keys.veo3;
        if (apiKey && typeof apiKey === 'string' && apiKey.trim().length > 0) {
          console.log('[Veo3] Using user Veo3 API key');
          return apiKey.trim();
        }
      }
    } catch (error) {
      console.warn('[Veo3] Could not fetch user API key:', error);
    }

    // Fallback to environment variable
    const envKey = import.meta.env.VITE_VEO3_API_KEY;
    if (envKey) {
      console.log('[Veo3] Using environment Veo3 API key');
      return envKey;
    }

    throw new Error(
      'Veo3 API key not configured. ' +
      'Please add your Veo3 API key in Settings > AI Provider Settings or set VITE_VEO3_API_KEY.'
    );
  }

  /**
   * Generate video using Veo 3
   */
  async generateVideo(params: Veo3VideoGenerationParams): Promise<Veo3VideoGenerationResult> {
    const apiKey = await this.getApiKey();
    
    console.log('[Veo3] Starting video generation', {
      model: params.model || 'veo-3.0-fast-generate-preview',
      prompt: params.prompt?.substring(0, 50) + '...',
      durationSeconds: params.durationSeconds || 8
    });

    try {
      const response = await fetch(`${VEO3_API_BASE}/text-to-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({
          prompt: params.prompt,
          model: params.model || 'veo-3.0-fast-generate-preview',
          durationSeconds: params.durationSeconds || 8,
          generateAudio: params.generateAudio !== undefined ? params.generateAudio : true,
          ...(params.aspectRatio && { aspectRatio: params.aspectRatio }),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }));
        const errorMessage = errorData.error?.message || errorData.message || response.statusText;
        console.error('[Veo3] API error', {
          status: response.status,
          error: errorMessage
        });
        throw new Error(`Veo3 API error: ${errorMessage}`);
      }

      const data = await response.json();
      console.log('[Veo3] Generation started', {
        taskId: data.taskId
      });

      if (!data.taskId) {
        throw new Error('No task ID received from Veo3 API');
      }

      return {
        taskId: data.taskId,
        status: 'pending'
      };
    } catch (error: any) {
      console.error('[Veo3] Generation failed', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Check status of video generation task
   */
  async getTaskStatus(taskId: string): Promise<Veo3VideoGenerationResult> {
    const apiKey = await this.getApiKey();

    try {
      const response = await fetch(`${VEO3_API_BASE}/status/${taskId}`, {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }));
        const errorMessage = errorData.error?.message || errorData.message || response.statusText;
        throw new Error(`Veo3 API error: ${errorMessage}`);
      }

      const data = await response.json();
      
      return {
        taskId: data.taskId || taskId,
        videoUrl: data.videoUrl || data.video_url || data.url,
        status: data.status?.toLowerCase() || 'pending',
        error: data.error
      };
    } catch (error: any) {
      console.error('[Veo3] Status check failed', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Download video (if needed)
   */
  async downloadVideo(taskId: string): Promise<string> {
    const status = await this.getTaskStatus(taskId);
    
    if (status.status !== 'completed' || !status.videoUrl) {
      throw new Error('Video not ready or failed');
    }

    return status.videoUrl;
  }
}

export const veo3Service = new Veo3Service();

















