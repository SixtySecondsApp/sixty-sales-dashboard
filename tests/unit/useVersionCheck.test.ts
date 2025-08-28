import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useVersionCheck } from '@/lib/hooks/useVersionCheck';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock logger
vi.mock('@/lib/utils/logger', () => ({
  default: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}));

// Mock window.location.reload
Object.defineProperty(window, 'location', {
  value: {
    reload: vi.fn(),
  },
  writable: true,
});

// Mock caches API
Object.defineProperty(window, 'caches', {
  value: {
    keys: vi.fn().mockResolvedValue(['cache1', 'cache2']),
    delete: vi.fn().mockResolvedValue(true)
  },
  writable: true,
});

describe('useVersionCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Clear localStorage and sessionStorage
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mockVersionResponse = {
    buildId: 'build-2025-08-28T20-00-00-v1.0.3',
    builtAt: '2025-08-28T20:00:00.000Z'
  };

  const mockReleasesResponse = [
    {
      buildId: 'build-2025-08-28T20-00-00-v1.0.3',
      date: '2025-08-28T20:00:00.000Z',
      notes: '🚀 New version with updated features'
    },
    {
      buildId: 'build-2025-08-28T19-32-36-v1.0.2',
      date: '2025-08-28T19:32:36.859Z',
      notes: '🎉 Previous release notes'
    }
  ];

  it('should initialize with correct default values', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockVersionResponse)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockReleasesResponse)
      });

    const { result } = renderHook(() => useVersionCheck());

    // Initial state
    expect(result.current.clientBuildId).toBe('build-2025-08-28T19-32-36-v1.0.2');
    expect(result.current.updateAvailable).toBe(false);
    expect(result.current.newBuildId).toBe(null);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBe(null);

    // Wait for initial fetch to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.updateAvailable).toBe(true);
    expect(result.current.newBuildId).toBe('build-2025-08-28T20-00-00-v1.0.3');
    expect(result.current.releases).toEqual(mockReleasesResponse);
  });

  it('should detect when update is available', async () => {
    const newerVersion = {
      buildId: 'build-2025-08-28T21-00-00-v1.0.4',
      builtAt: '2025-08-28T21:00:00.000Z'
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(newerVersion)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockReleasesResponse)
      });

    const { result } = renderHook(() => useVersionCheck());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.updateAvailable).toBe(true);
    expect(result.current.newBuildId).toBe('build-2025-08-28T21-00-00-v1.0.4');
  });

  it('should not show update when versions are the same', async () => {
    const currentVersion = {
      buildId: 'build-2025-08-28T19-32-36-v1.0.2',
      builtAt: '2025-08-28T19:32:36.859Z'
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(currentVersion)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockReleasesResponse)
      });

    const { result } = renderHook(() => useVersionCheck());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.updateAvailable).toBe(false);
    expect(result.current.newBuildId).toBe(null);
  });

  it('should handle fetch errors gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useVersionCheck());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toContain('Network error');
    expect(result.current.updateAvailable).toBe(false);
  });

  it('should clear caches and reload on update', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockVersionResponse)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockReleasesResponse)
      });

    const { result } = renderHook(() => useVersionCheck());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Set some localStorage and sessionStorage data
    localStorage.setItem('test', 'value');
    sessionStorage.setItem('test', 'value');

    // Call clearCachesAndReload
    await result.current.clearCachesAndReload();

    // Verify caches were cleared
    expect(localStorage.getItem('test')).toBe(null);
    expect(sessionStorage.getItem('test')).toBe(null);
    expect(window.caches.keys).toHaveBeenCalled();
    expect(window.caches.delete).toHaveBeenCalledWith('cache1');
    expect(window.caches.delete).toHaveBeenCalledWith('cache2');
    expect(window.location.reload).toHaveBeenCalled();
  });

  it('should handle polling interval correctly', async () => {
    mockFetch
      .mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockVersionResponse)
      });

    const { result } = renderHook(() => useVersionCheck());

    // Initial call
    expect(mockFetch).toHaveBeenCalledTimes(2); // version.json and releases.json

    // Fast-forward 30 seconds
    vi.advanceTimersByTime(30000);

    // Should have made another call for version.json only (releases are cached)
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    expect(mockFetch).toHaveBeenLastCalledWith('/version.json', expect.objectContaining({
      method: 'GET',
      headers: expect.objectContaining({
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      })
    }));
  });

  it('should validate response structure', async () => {
    // Mock invalid version response
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ invalid: 'structure' })
      });

    const { result } = renderHook(() => useVersionCheck());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toContain('Invalid version data structure');
  });

  // Enhanced test coverage for MVP requirements
  describe('Enhanced Version Detection', () => {
    it('should properly compare build IDs for version detection', async () => {
      const serverVersion = {
        buildId: 'build-2025-08-28T21-00-00-v1.0.4',
        builtAt: '2025-08-28T21:00:00.000Z'
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(serverVersion)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockReleasesResponse)
        });

      const { result } = renderHook(() => useVersionCheck());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.updateAvailable).toBe(true);
      expect(result.current.newBuildId).toBe('build-2025-08-28T21-00-00-v1.0.4');
      expect(result.current.clientBuildId).toBe('build-2025-08-28T19-32-36-v1.0.2');
    });

    it('should handle identical build IDs correctly', async () => {
      const sameVersion = {
        buildId: 'build-2025-08-28T19-32-36-v1.0.2',
        builtAt: '2025-08-28T19:32:36.859Z'
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(sameVersion)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockReleasesResponse)
        });

      const { result } = renderHook(() => useVersionCheck());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.updateAvailable).toBe(false);
      expect(result.current.newBuildId).toBe(null);
    });

    it('should handle empty or null build IDs', async () => {
      const invalidVersion = {
        buildId: null,
        builtAt: '2025-08-28T21:00:00.000Z'
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(invalidVersion)
        });

      const { result } = renderHook(() => useVersionCheck());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toContain('Invalid version data structure');
    });
  });

  describe('Error Handling Scenarios', () => {
    it('should handle network timeouts', async () => {
      mockFetch.mockImplementationOnce(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Network timeout')), 6000); // Longer than API_TIMEOUT
        });
      });

      const { result } = renderHook(() => useVersionCheck());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
    });

    it('should handle HTTP error responses', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          json: () => Promise.resolve({})
        });

      const { result } = renderHook(() => useVersionCheck());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toContain('Failed to fetch version: 404 Not Found');
    });

    it('should handle JSON parsing errors', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.reject(new Error('Invalid JSON'))
        });

      const { result } = renderHook(() => useVersionCheck());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toContain('Invalid JSON');
    });

    it('should continue polling after errors', async () => {
      // First call fails, second call succeeds
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockVersionResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockReleasesResponse)
        });

      const { result } = renderHook(() => useVersionCheck());

      // Wait for first error
      await waitFor(() => {
        expect(result.current.error).toContain('Network error');
      });

      // Advance time to trigger next poll
      vi.advanceTimersByTime(30000);

      // Wait for successful call
      await waitFor(() => {
        expect(result.current.error).toBe(null);
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('Release Data Management', () => {
    it('should validate releases array structure', async () => {
      const invalidReleases = [
        { buildId: 'valid-build', date: '2025-08-28', notes: 'Valid release' },
        { invalidField: 'missing required fields' },
        { buildId: 'another-valid', date: '2025-08-27', notes: 'Another valid' }
      ];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockVersionResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(invalidReleases)
        });

      const { result } = renderHook(() => useVersionCheck());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should filter out invalid releases
      expect(result.current.releases).toHaveLength(2);
      expect(result.current.releases[0]).toEqual({
        buildId: 'valid-build',
        date: '2025-08-28',
        notes: 'Valid release'
      });
    });

    it('should handle empty releases array', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockVersionResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([])
        });

      const { result } = renderHook(() => useVersionCheck());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.releases).toEqual([]);
    });

    it('should handle non-array releases response', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockVersionResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ invalid: 'not an array' })
        });

      const { result } = renderHook(() => useVersionCheck());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toContain('Invalid releases data structure');
    });
  });

  describe('Cache Clearing Functionality', () => {
    it('should clear all storage types and caches', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockVersionResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockReleasesResponse)
        });

      const { result } = renderHook(() => useVersionCheck());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Set test data in storage
      localStorage.setItem('test-key', 'test-value');
      sessionStorage.setItem('session-key', 'session-value');

      // Call clearCachesAndReload
      await result.current.clearCachesAndReload();

      // Verify all storage was cleared
      expect(localStorage.getItem('test-key')).toBe(null);
      expect(sessionStorage.getItem('session-key')).toBe(null);
      expect(window.caches.keys).toHaveBeenCalled();
      expect(window.caches.delete).toHaveBeenCalledWith('cache1');
      expect(window.caches.delete).toHaveBeenCalledWith('cache2');
      expect(window.location.reload).toHaveBeenCalled();
    });

    it('should handle cache clearing errors gracefully', async () => {
      // Mock caches to fail
      window.caches.keys = vi.fn().mockRejectedValue(new Error('Cache error'));
      
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockVersionResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockReleasesResponse)
        });

      const { result } = renderHook(() => useVersionCheck());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should still attempt to clear caches and reload
      await expect(result.current.clearCachesAndReload()).rejects.toThrow('Failed to clear caches');
    });
  });

  describe('Performance and Resource Management', () => {
    it('should prevent concurrent API calls', async () => {
      mockFetch
        .mockResolvedValue({
          ok: true,
          json: () => new Promise(resolve => setTimeout(() => resolve(mockVersionResponse), 1000))
        });

      const { result } = renderHook(() => useVersionCheck());

      // Trigger multiple concurrent calls by advancing timer
      vi.advanceTimersByTime(30000); // First poll
      vi.advanceTimersByTime(30000); // Second poll (should be ignored)

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should only make one version call plus one releases call
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should cache releases data to reduce API calls', async () => {
      mockFetch
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockVersionResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockReleasesResponse)
        });

      const { result } = renderHook(() => useVersionCheck());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Trigger another poll
      vi.advanceTimersByTime(30000);

      await waitFor(() => {
        // Should have made version calls but releases should be cached
        const versionCalls = mockFetch.mock.calls.filter(call => call[0] === '/version.json');
        const releasesCalls = mockFetch.mock.calls.filter(call => call[0] === '/releases.json');
        
        expect(versionCalls.length).toBeGreaterThan(1);
        expect(releasesCalls.length).toBe(1); // Cached after first call
      });
    });

    it('should handle visibility change correctly', async () => {
      mockFetch
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockVersionResponse)
        });

      const { result } = renderHook(() => useVersionCheck());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialCallCount = mockFetch.mock.calls.length;

      // Simulate page becoming hidden
      Object.defineProperty(document, 'visibilityState', {
        writable: true,
        value: 'hidden'
      });
      document.dispatchEvent(new Event('visibilitychange'));

      // Advance time while page is hidden
      vi.advanceTimersByTime(60000);

      // Should not make additional calls while hidden
      expect(mockFetch.mock.calls.length).toBe(initialCallCount);

      // Simulate page becoming visible again
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible'
      });
      document.dispatchEvent(new Event('visibilitychange'));

      await waitFor(() => {
        // Should resume polling
        expect(mockFetch.mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });
  });

  describe('API Request Headers and Caching', () => {
    it('should include proper cache-busting headers', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockVersionResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockReleasesResponse)
        });

      renderHook(() => useVersionCheck());

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/version.json', expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          })
        }));
      });
    });

    it('should use AbortController for timeout management', async () => {
      let abortController: AbortController;
      
      mockFetch.mockImplementationOnce((url, options) => {
        abortController = options?.signal?.constructor === AbortController ? new AbortController() : null;
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: () => Promise.resolve(mockVersionResponse)
            });
          }, 1000);
        });
      });

      renderHook(() => useVersionCheck());

      await waitFor(() => {
        expect(abortController).toBeDefined();
      });
    });
  });

  describe('Component Lifecycle Management', () => {
    it('should cleanup timers on unmount', async () => {
      const { unmount } = renderHook(() => useVersionCheck());

      // Let initial calls complete
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      const spy = vi.spyOn(window, 'clearInterval');
      
      unmount();

      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should stop polling before reload', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockVersionResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockReleasesResponse)
        });

      const { result } = renderHook(() => useVersionCheck());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const spy = vi.spyOn(window, 'clearInterval');
      
      await result.current.clearCachesAndReload();

      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});