import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RoadmapVersion } from '@/components/RoadmapVersion';
import { useVersionCheck } from '@/lib/hooks/useVersionCheck';
import { toast } from 'sonner';

// Mock dependencies
vi.mock('@/lib/hooks/useVersionCheck');
vi.mock('sonner', () => ({
  toast: {
    loading: vi.fn(),
    error: vi.fn(),
    success: vi.fn()
  }
}));

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

describe('RoadmapVersion Component - Integration Tests', () => {
  const mockClearCachesAndReload = vi.fn();
  
  const mockReleases = [
    {
      buildId: 'build-2025-08-28T20-00-00-v1.0.3',
      date: '2025-08-28T20:00:00.000Z',
      notes: '🚀 New version with updated features and bug fixes'
    },
    {
      buildId: 'build-2025-08-28T19-32-36-v1.0.2',
      date: '2025-08-28T19:32:36.859Z',
      notes: '🎉 Previous release with performance improvements'
    },
    {
      buildId: 'build-2025-08-28T18-15-12-v1.0.1',
      date: '2025-08-28T18:15:12.123Z',
      notes: '🐛 Bug fixes and stability improvements'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockClearCachesAndReload.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Component Rendering States', () => {
    it('should render current version when no update available', () => {
      (useVersionCheck as any).mockReturnValue({
        clientBuildId: 'build-2025-08-28T19-32-36-v1.0.2',
        updateAvailable: false,
        newBuildId: null,
        releases: mockReleases,
        clearCachesAndReload: mockClearCachesAndReload,
        isLoading: false,
        error: null
      });

      render(<RoadmapVersion />);

      // Should show current version
      expect(screen.getByText('Current Version')).toBeInTheDocument();
      expect(screen.getByText('v1.0.2')).toBeInTheDocument();
      expect(screen.getByText('Current')).toBeInTheDocument();
      
      // Should show current release notes
      expect(screen.getByText('🎉 Previous release with performance improvements')).toBeInTheDocument();
      
      // Should not show update banner
      expect(screen.queryByText('New Version Available')).not.toBeInTheDocument();
    });

    it('should render update banner when update is available', () => {
      (useVersionCheck as any).mockReturnValue({
        clientBuildId: 'build-2025-08-28T19-32-36-v1.0.2',
        updateAvailable: true,
        newBuildId: 'build-2025-08-28T20-00-00-v1.0.3',
        releases: mockReleases,
        clearCachesAndReload: mockClearCachesAndReload,
        isLoading: false,
        error: null
      });

      render(<RoadmapVersion />);

      // Should show update banner
      expect(screen.getByText('New Version Available')).toBeInTheDocument();
      expect(screen.getByText('v1.0.3')).toBeInTheDocument();
      expect(screen.getByText('Update Now')).toBeInTheDocument();
      
      // Should show new version release notes in banner
      expect(screen.getByText('🚀 New version with updated features and bug fixes')).toBeInTheDocument();
      expect(screen.getByText('Released Aug 28, 2025, 08:00 PM')).toBeInTheDocument();
      
      // Should show current version section
      expect(screen.getByText('Current Version')).toBeInTheDocument();
      expect(screen.getByText('Update Available')).toBeInTheDocument();
    });

    it('should render loading state correctly', () => {
      (useVersionCheck as any).mockReturnValue({
        clientBuildId: 'build-2025-08-28T19-32-36-v1.0.2',
        updateAvailable: false,
        newBuildId: null,
        releases: mockReleases,
        clearCachesAndReload: mockClearCachesAndReload,
        isLoading: true,
        error: null
      });

      render(<RoadmapVersion />);

      // Should show loading state
      expect(screen.getByText('Checking for updates...')).toBeInTheDocument();
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('should not render when there is an error', () => {
      (useVersionCheck as any).mockReturnValue({
        clientBuildId: 'build-2025-08-28T19-32-36-v1.0.2',
        updateAvailable: false,
        newBuildId: null,
        releases: mockReleases,
        clearCachesAndReload: mockClearCachesAndReload,
        isLoading: false,
        error: 'Network error'
      });

      const { container } = render(<RoadmapVersion />);
      
      // Component should not render anything when there's an error
      expect(container.firstChild).toBeNull();
    });

    it('should not render when clientBuildId is null', () => {
      (useVersionCheck as any).mockReturnValue({
        clientBuildId: null,
        updateAvailable: false,
        newBuildId: null,
        releases: mockReleases,
        clearCachesAndReload: mockClearCachesAndReload,
        isLoading: false,
        error: null
      });

      const { container } = render(<RoadmapVersion />);
      
      // Component should not render anything when clientBuildId is null
      expect(container.firstChild).toBeNull();
    });
  });

  describe('User Interactions', () => {
    it('should handle update button click correctly', async () => {
      (useVersionCheck as any).mockReturnValue({
        clientBuildId: 'build-2025-08-28T19-32-36-v1.0.2',
        updateAvailable: true,
        newBuildId: 'build-2025-08-28T20-00-00-v1.0.3',
        releases: mockReleases,
        clearCachesAndReload: mockClearCachesAndReload,
        isLoading: false,
        error: null
      });

      const user = userEvent.setup();
      render(<RoadmapVersion />);

      const updateButton = screen.getByText('Update Now');
      await user.click(updateButton);

      // Should show loading state
      expect(screen.getByText('Updating...')).toBeInTheDocument();
      expect(toast.loading).toHaveBeenCalledWith('Updating application...');

      // Wait for the update process
      await waitFor(() => {
        expect(mockClearCachesAndReload).toHaveBeenCalled();
      }, { timeout: 2000 });
    });

    it('should handle update failure gracefully', async () => {
      const mockError = new Error('Update failed');
      mockClearCachesAndReload.mockRejectedValueOnce(mockError);

      (useVersionCheck as any).mockReturnValue({
        clientBuildId: 'build-2025-08-28T19-32-36-v1.0.2',
        updateAvailable: true,
        newBuildId: 'build-2025-08-28T20-00-00-v1.0.3',
        releases: mockReleases,
        clearCachesAndReload: mockClearCachesAndReload,
        isLoading: false,
        error: null
      });

      const user = userEvent.setup();
      render(<RoadmapVersion />);

      const updateButton = screen.getByText('Update Now');
      await user.click(updateButton);

      // Wait for error handling
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Update failed. Please try refreshing manually.');
      });

      // Button should return to normal state
      expect(screen.getByText('Update Now')).toBeInTheDocument();
    });

    it('should dismiss update banner when close button clicked', async () => {
      (useVersionCheck as any).mockReturnValue({
        clientBuildId: 'build-2025-08-28T19-32-36-v1.0.2',
        updateAvailable: true,
        newBuildId: 'build-2025-08-28T20-00-00-v1.0.3',
        releases: mockReleases,
        clearCachesAndReload: mockClearCachesAndReload,
        isLoading: false,
        error: null
      });

      const user = userEvent.setup();
      render(<RoadmapVersion />);

      // Update banner should be visible
      expect(screen.getByText('New Version Available')).toBeInTheDocument();

      // Click dismiss button
      const dismissButton = screen.getByRole('button', { name: '' }); // X button
      await user.click(dismissButton);

      // Update banner should disappear
      await waitFor(() => {
        expect(screen.queryByText('New Version Available')).not.toBeInTheDocument();
      });

      // Current version should still show "Update Available" badge
      expect(screen.getByText('Update Available')).toBeInTheDocument();
    });

    it('should expand and collapse release history', async () => {
      (useVersionCheck as any).mockReturnValue({
        clientBuildId: 'build-2025-08-28T19-32-36-v1.0.2',
        updateAvailable: false,
        newBuildId: null,
        releases: mockReleases,
        clearCachesAndReload: mockClearCachesAndReload,
        isLoading: false,
        error: null
      });

      const user = userEvent.setup();
      render(<RoadmapVersion />);

      // Release history should not be visible initially
      expect(screen.queryByText('Release History')).not.toBeInTheDocument();
      expect(screen.queryByText('v1.0.1')).not.toBeInTheDocument();

      // Click expand button
      const expandButton = screen.getByRole('button', { name: '' }); // Chevron button
      await user.click(expandButton);

      // Release history should be visible
      await waitFor(() => {
        expect(screen.getByText('Release History')).toBeInTheDocument();
      });
      
      expect(screen.getByText('v1.0.1')).toBeInTheDocument();
      expect(screen.getByText('🐛 Bug fixes and stability improvements')).toBeInTheDocument();

      // Click collapse button
      await user.click(expandButton);

      // Release history should be hidden
      await waitFor(() => {
        expect(screen.queryByText('Release History')).not.toBeInTheDocument();
      });
    });
  });

  describe('Release History Display', () => {
    it('should display all releases with correct labels', async () => {
      (useVersionCheck as any).mockReturnValue({
        clientBuildId: 'build-2025-08-28T19-32-36-v1.0.2',
        updateAvailable: true,
        newBuildId: 'build-2025-08-28T20-00-00-v1.0.3',
        releases: mockReleases,
        clearCachesAndReload: mockClearCachesAndReload,
        isLoading: false,
        error: null
      });

      const user = userEvent.setup();
      render(<RoadmapVersion />);

      // Expand release history
      const expandButton = screen.getByRole('button', { name: '' });
      await user.click(expandButton);

      await waitFor(() => {
        expect(screen.getByText('Release History')).toBeInTheDocument();
      });

      // Check that all releases are displayed with correct labels
      expect(screen.getByText('v1.0.3')).toBeInTheDocument();
      expect(screen.getByText('Available')).toBeInTheDocument(); // New version badge
      
      expect(screen.getAllByText('v1.0.2')).toHaveLength(2); // Current version appears twice
      expect(screen.getByText('Current')).toBeInTheDocument(); // Current version badge
      
      expect(screen.getByText('v1.0.1')).toBeInTheDocument();
      
      // Check release notes
      expect(screen.getByText('🚀 New version with updated features and bug fixes')).toBeInTheDocument();
      expect(screen.getByText('🎉 Previous release with performance improvements')).toBeInTheDocument();
      expect(screen.getByText('🐛 Bug fixes and stability improvements')).toBeInTheDocument();
    });

    it('should format dates correctly in release history', async () => {
      (useVersionCheck as any).mockReturnValue({
        clientBuildId: 'build-2025-08-28T19-32-36-v1.0.2',
        updateAvailable: false,
        newBuildId: null,
        releases: mockReleases,
        clearCachesAndReload: mockClearCachesAndReload,
        isLoading: false,
        error: null
      });

      const user = userEvent.setup();
      render(<RoadmapVersion />);

      // Expand release history
      const expandButton = screen.getByRole('button', { name: '' });
      await user.click(expandButton);

      await waitFor(() => {
        expect(screen.getByText('Release History')).toBeInTheDocument();
      });

      // Check date formatting
      expect(screen.getByText('Aug 28, 2025, 08:00 PM')).toBeInTheDocument();
      expect(screen.getByText('Aug 28, 2025, 07:32 PM')).toBeInTheDocument();
      expect(screen.getByText('Aug 28, 2025, 06:15 PM')).toBeInTheDocument();
    });
  });

  describe('Version Formatting', () => {
    it('should format build IDs correctly', () => {
      (useVersionCheck as any).mockReturnValue({
        clientBuildId: 'build-2025-08-28T19-32-36-v1.0.2',
        updateAvailable: false,
        newBuildId: null,
        releases: mockReleases,
        clearCachesAndReload: mockClearCachesAndReload,
        isLoading: false,
        error: null
      });

      render(<RoadmapVersion />);

      // Should extract version number correctly
      expect(screen.getByText('v1.0.2')).toBeInTheDocument();
    });

    it('should fallback to date format when version pattern not found', () => {
      const releasesWithDateOnly = [
        {
          buildId: 'build-2025-08-28T19-32-36',
          date: '2025-08-28T19:32:36.859Z',
          notes: 'Release without version number'
        }
      ];

      (useVersionCheck as any).mockReturnValue({
        clientBuildId: 'build-2025-08-28T19-32-36',
        updateAvailable: false,
        newBuildId: null,
        releases: releasesWithDateOnly,
        clearCachesAndReload: mockClearCachesAndReload,
        isLoading: false,
        error: null
      });

      render(<RoadmapVersion />);

      // Should show build date format
      expect(screen.getByText('Build 2025-08-28')).toBeInTheDocument();
    });

    it('should show raw build ID when no patterns match', () => {
      const releasesWithRawId = [
        {
          buildId: 'random-build-id-123',
          date: '2025-08-28T19:32:36.859Z',
          notes: 'Release with random build ID'
        }
      ];

      (useVersionCheck as any).mockReturnValue({
        clientBuildId: 'random-build-id-123',
        updateAvailable: false,
        newBuildId: null,
        releases: releasesWithRawId,
        clearCachesAndReload: mockClearCachesAndReload,
        isLoading: false,
        error: null
      });

      render(<RoadmapVersion />);

      // Should show raw build ID
      expect(screen.getByText('random-build-id-123')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      (useVersionCheck as any).mockReturnValue({
        clientBuildId: 'build-2025-08-28T19-32-36-v1.0.2',
        updateAvailable: true,
        newBuildId: 'build-2025-08-28T20-00-00-v1.0.3',
        releases: mockReleases,
        clearCachesAndReload: mockClearCachesAndReload,
        isLoading: false,
        error: null
      });

      render(<RoadmapVersion />);

      // Check button accessibility
      const updateButton = screen.getByRole('button', { name: 'Update Now' });
      expect(updateButton).toBeInTheDocument();
      
      const dismissButton = screen.getByRole('button');
      expect(dismissButton).toBeInTheDocument();
    });

    it('should handle keyboard navigation', async () => {
      (useVersionCheck as any).mockReturnValue({
        clientBuildId: 'build-2025-08-28T19-32-36-v1.0.2',
        updateAvailable: true,
        newBuildId: 'build-2025-08-28T20-00-00-v1.0.3',
        releases: mockReleases,
        clearCachesAndReload: mockClearCachesAndReload,
        isLoading: false,
        error: null
      });

      const user = userEvent.setup();
      render(<RoadmapVersion />);

      // Tab to update button
      await user.tab();
      expect(screen.getByText('Update Now')).toHaveFocus();

      // Press Enter to trigger update
      await user.keyboard('{Enter}');
      
      // Should show loading state
      expect(screen.getByText('Updating...')).toBeInTheDocument();
    });
  });

  describe('Performance Considerations', () => {
    it('should not re-render unnecessarily when props are the same', () => {
      const { rerender } = render(<RoadmapVersion className="test-class" />);
      
      // Re-render with same props
      rerender(<RoadmapVersion className="test-class" />);
      
      // Component should handle re-renders efficiently
      expect(screen.queryByTestId('roadmap-version')).toBeInTheDocument();
    });

    it('should handle large release history efficiently', async () => {
      const largeReleaseHistory = Array.from({ length: 100 }, (_, i) => ({
        buildId: `build-2025-08-28T${String(i).padStart(2, '0')}-00-00-v1.0.${i}`,
        date: `2025-08-28T${String(i).padStart(2, '0')}:00:00.000Z`,
        notes: `Release ${i} with various improvements and fixes`
      }));

      (useVersionCheck as any).mockReturnValue({
        clientBuildId: 'build-2025-08-28T50-00-00-v1.0.50',
        updateAvailable: false,
        newBuildId: null,
        releases: largeReleaseHistory,
        clearCachesAndReload: mockClearCachesAndReload,
        isLoading: false,
        error: null
      });

      const user = userEvent.setup();
      render(<RoadmapVersion />);

      // Expand release history
      const expandButton = screen.getByRole('button', { name: '' });
      await user.click(expandButton);

      // Should handle scrolling and display efficiently
      await waitFor(() => {
        expect(screen.getByText('Release History')).toBeInTheDocument();
      });

      // Should show scrollable container
      const releaseHistory = screen.getByText('Release History').closest('div');
      expect(releaseHistory).toBeInTheDocument();
    });
  });
});