import '@testing-library/jest-dom';

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: 'div',
    button: 'button',
    span: 'span',
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Brain: () => <div data-testid="brain-icon">Brain</div>,
  TrendingUp: () => <div data-testid="trending-up-icon">TrendingUp</div>,
  Clock: () => <div data-testid="clock-icon">Clock</div>,
  Users: () => <div data-testid="users-icon">Users</div>,
  Mail: () => <div data-testid="mail-icon">Mail</div>,
  AlertTriangle: () => <div data-testid="alert-triangle-icon">AlertTriangle</div>,
  CheckCircle: () => <div data-testid="check-circle-icon">CheckCircle</div>,
  Calendar: () => <div data-testid="calendar-icon">Calendar</div>,
  MessageSquare: () => <div data-testid="message-square-icon">MessageSquare</div>,
  Sparkles: () => <div data-testid="sparkles-icon">Sparkles</div>,
  ChevronRight: () => <div data-testid="chevron-right-icon">ChevronRight</div>,
  Star: () => <div data-testid="star-icon">Star</div>,
  Filter: () => <div data-testid="filter-icon">Filter</div>,
  Zap: () => <div data-testid="zap-icon">Zap</div>,
  Target: () => <div data-testid="target-icon">Target</div>,
  Heart: () => <div data-testid="heart-icon">Heart</div>,
  Eye: () => <div data-testid="eye-icon">Eye</div>,
  Lightbulb: () => <div data-testid="lightbulb-icon">Lightbulb</div>,
}));

// Global test utilities
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
  log: jest.fn(),
};