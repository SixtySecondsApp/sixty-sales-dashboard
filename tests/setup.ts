import '@testing-library/jest-dom';
import { expect, vi, beforeAll, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Mock Framer Motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: 'div',
    button: 'button',
    tr: 'tr',
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
  Edit2: () => 'Edit2Icon',
  Trash2: () => 'Trash2Icon',
  ArrowUpRight: () => 'ArrowUpRightIcon',
  Users: () => 'UsersIcon',
  PoundSterling: () => 'PoundSterlingIcon',
  LinkIcon: () => 'LinkIcon',
  TrendingUp: () => 'TrendingUpIcon',
  BarChart: () => 'BarChartIcon',
  Phone: () => 'PhoneIcon',
  FileText: () => 'FileTextIcon',
  UploadCloud: () => 'UploadCloudIcon',
  Filter: () => 'FilterIcon',
  X: () => 'XIcon',
  Search: () => 'SearchIcon',
  Download: () => 'DownloadIcon',
  XCircle: () => 'XCircleIcon',
}));

// Mock toast notifications
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock window APIs that might not be available in test environment
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
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock performance API for performance tests
Object.defineProperty(global, 'performance', {
  writable: true,
  value: {
    now: vi.fn(() => Date.now()),
    mark: vi.fn(),
    measure: vi.fn(),
    getEntriesByName: vi.fn(() => []),
    getEntriesByType: vi.fn(() => []),
    clearMarks: vi.fn(),
    clearMeasures: vi.fn(),
    memory: {
      usedJSHeapSize: 1000000,
      totalJSHeapSize: 2000000,
      jsHeapSizeLimit: 4000000,
    },
  },
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Setup before all tests
beforeAll(() => {
  console.log('🧪 Test environment initialized');
});

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorageMock.clear();
});

export {};