// Vitest setup file
import { vi } from 'vitest';
import logger from '@/lib/utils/logger';
import '@testing-library/jest-dom/vitest';

// Mock window objects that might not exist in test environment
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

window.ResizeObserver = ResizeObserverMock;

// Mock IntersectionObserver
class IntersectionObserverMock {
  constructor(callback) {
    this.callback = callback;
  }
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

window.IntersectionObserver = IntersectionObserverMock;

// Mock requestAnimationFrame
window.requestAnimationFrame = vi.fn(callback => setTimeout(callback, 0));
window.cancelAnimationFrame = vi.fn(id => clearTimeout(id));

// Silence console errors during tests
logger.error = vi.fn(); 