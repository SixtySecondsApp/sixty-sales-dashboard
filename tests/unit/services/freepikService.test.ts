import { describe, expect, it } from 'vitest';
import {
  extractFreepikGeneratedImages,
  extractFreepikTaskId,
  extractFreepikTaskStatus
} from '@/lib/services/freepikService';

describe('freepikService helpers', () => {
  it('extracts generated images from nested data payloads', () => {
    const response = {
      data: {
        generated: ['https://freepik.test/image.png'],
        task_id: 'task-123',
        status: 'COMPLETED'
      }
    };

    expect(extractFreepikGeneratedImages(response)).toEqual(['https://freepik.test/image.png']);
    expect(extractFreepikTaskId(response)).toBe('task-123');
    expect(extractFreepikTaskStatus(response)).toBe('COMPLETED');
  });

  it('falls back to root-level generation payloads', () => {
    const response = {
      generated: ['https://freepik.test/root.png'],
      task_id: 'task-root',
      status: 'CREATED'
    };

    expect(extractFreepikGeneratedImages(response)).toEqual(['https://freepik.test/root.png']);
    expect(extractFreepikTaskId(response)).toBe('task-root');
    expect(extractFreepikTaskStatus(response)).toBe('CREATED');
  });

  it('returns undefined when payload lacks generated assets', () => {
    expect(extractFreepikGeneratedImages(undefined)).toBeUndefined();
    expect(extractFreepikGeneratedImages({})).toBeUndefined();
  });
});

























