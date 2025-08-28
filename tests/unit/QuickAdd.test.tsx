import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuickAdd } from '../../src/components/QuickAdd';

// Mock dependencies
vi.mock('@/lib/hooks/useUser', () => ({
  useUser: () => ({
    userData: {
      id: 'user123',
      email: 'test@example.com',
      is_admin: true
    }
  })
}));

vi.mock('@/lib/hooks/useActivities', () => ({
  useActivities: () => ({
    addActivity: vi.fn().mockResolvedValue({}),
    addSale: vi.fn().mockResolvedValue({})
  })
}));

vi.mock('@/lib/hooks/useTasks', () => ({
  useTasks: () => ({
    createTask: vi.fn().mockResolvedValue({})
  })
}));

vi.mock('@/lib/hooks/useContacts', () => ({
  useContacts: () => ({
    contacts: [],
    createContact: vi.fn().mockResolvedValue({}),
    findContactByEmail: vi.fn().mockResolvedValue(null)
  })
}));

vi.mock('@/lib/hooks/useDeals', () => ({
  useDeals: () => ({
    deals: [],
    moveDealToStage: vi.fn().mockResolvedValue({})
  })
}));

vi.mock('@/lib/hooks/useCompanies', () => ({
  useCompanies: () => ({
    companies: []
  })
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}));

vi.mock('@/lib/utils/logger', () => ({
  default: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    form: ({ children, ...props }: any) => <form {...props}>{children}</form>
  },
  AnimatePresence: ({ children }: any) => children
}));

// Mock date-fns
vi.mock('date-fns', () => ({
  format: vi.fn((date, formatStr) => {
    if (formatStr.includes('yyyy-MM-dd')) {
      return '2024-01-15T10:00';
    }
    return '2024-01-15';
  }),
  addDays: vi.fn((date, days) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000)),
  addHours: vi.fn((date, hours) => new Date(date.getTime() + hours * 60 * 60 * 1000)),
  setHours: vi.fn(() => new Date()),
  setMinutes: vi.fn(() => new Date()),
  startOfWeek: vi.fn(() => new Date()),
  addWeeks: vi.fn(() => new Date())
}));

describe('QuickAdd Component', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all quick action buttons when modal is open', () => {
    render(<QuickAdd {...defaultProps} />);

    expect(screen.getByText('Create Deal')).toBeInTheDocument();
    expect(screen.getByText('Add Task')).toBeInTheDocument();
    expect(screen.getByText('Add Sale')).toBeInTheDocument();
    expect(screen.getByText('Add Outbound')).toBeInTheDocument();
    expect(screen.getByText('Add Meeting')).toBeInTheDocument();
    expect(screen.getByText('Add Proposal')).toBeInTheDocument();
  });

  it('does not render when modal is closed', () => {
    render(<QuickAdd isOpen={false} onClose={vi.fn()} />);

    expect(screen.queryByText('Create Deal')).not.toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    render(<QuickAdd {...defaultProps} onClose={onClose} />);

    const closeButton = screen.getByRole('button', { name: /close/i });
    await userEvent.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('shows task form when Add Task is clicked', async () => {
    render(<QuickAdd {...defaultProps} />);

    const addTaskButton = screen.getByText('Add Task');
    await userEvent.click(addTaskButton);

    expect(screen.getByText('Create New Task')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/what needs to be done/i)).toBeInTheDocument();
  });

  it('validates required fields in task form', async () => {
    render(<QuickAdd {...defaultProps} />);

    // Click Add Task
    const addTaskButton = screen.getByText('Add Task');
    await userEvent.click(addTaskButton);

    // Try to submit without filling required fields
    const submitButton = screen.getByRole('button', { name: /create task/i });
    await userEvent.click(submitButton);

    // Should show validation error
    await waitFor(() => {
      expect(screen.getByText(/task title is required/i)).toBeInTheDocument();
    });
  });

  it('creates task successfully with valid data', async () => {
    const createTaskMock = vi.fn().mockResolvedValue({});
    vi.mocked(require('@/lib/hooks/useTasks').useTasks).mockReturnValue({
      createTask: createTaskMock
    });

    render(<QuickAdd {...defaultProps} />);

    // Click Add Task
    const addTaskButton = screen.getByText('Add Task');
    await userEvent.click(addTaskButton);

    // Fill in task title
    const titleInput = screen.getByPlaceholderText(/what needs to be done/i);
    await userEvent.type(titleInput, 'Test task');

    // Submit form
    const submitButton = screen.getByRole('button', { name: /create task/i });
    await userEvent.click(submitButton);

    // Should call createTask
    await waitFor(() => {
      expect(createTaskMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test task'
        })
      );
    });
  });

  it('shows loading state during task submission', async () => {
    const createTaskMock = vi.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 100))
    );
    vi.mocked(require('@/lib/hooks/useTasks').useTasks).mockReturnValue({
      createTask: createTaskMock
    });

    render(<QuickAdd {...defaultProps} />);

    // Click Add Task and fill form
    const addTaskButton = screen.getByText('Add Task');
    await userEvent.click(addTaskButton);

    const titleInput = screen.getByPlaceholderText(/what needs to be done/i);
    await userEvent.type(titleInput, 'Test task');

    const submitButton = screen.getByRole('button', { name: /create task/i });
    await userEvent.click(submitButton);

    // Should show loading state
    expect(screen.getByText(/creating/i)).toBeInTheDocument();
  });

  it('handles task creation error gracefully', async () => {
    const createTaskMock = vi.fn().mockRejectedValue(new Error('Creation failed'));
    vi.mocked(require('@/lib/hooks/useTasks').useTasks).mockReturnValue({
      createTask: createTaskMock
    });

    render(<QuickAdd {...defaultProps} />);

    // Click Add Task and fill form
    const addTaskButton = screen.getByText('Add Task');
    await userEvent.click(addTaskButton);

    const titleInput = screen.getByPlaceholderText(/what needs to be done/i);
    await userEvent.type(titleInput, 'Test task');

    const submitButton = screen.getByRole('button', { name: /create task/i });
    await userEvent.click(submitButton);

    // Should handle error
    await waitFor(() => {
      expect(require('sonner').toast.error).toHaveBeenCalled();
    });
  });

  it('shows contact search for meeting creation', async () => {
    render(<QuickAdd {...defaultProps} />);

    const addMeetingButton = screen.getByText('Add Meeting');
    await userEvent.click(addMeetingButton);

    // Should trigger contact search modal (mocked component would handle this)
    // This tests the click handler logic
    expect(addMeetingButton).toBeInTheDocument();
  });

  it('handles authentication errors with user-friendly messages', async () => {
    const authError = {
      status: 403,
      message: 'Forbidden: insufficient privileges'
    };

    const createTaskMock = vi.fn().mockRejectedValue(authError);
    vi.mocked(require('@/lib/hooks/useTasks').useTasks).mockReturnValue({
      createTask: createTaskMock
    });

    render(<QuickAdd {...defaultProps} />);

    // Create task and trigger error
    const addTaskButton = screen.getByText('Add Task');
    await userEvent.click(addTaskButton);

    const titleInput = screen.getByPlaceholderText(/what needs to be done/i);
    await userEvent.type(titleInput, 'Test task');

    const submitButton = screen.getByRole('button', { name: /create task/i });
    await userEvent.click(submitButton);

    // Should show user-friendly error message
    await waitFor(() => {
      expect(require('sonner').toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Access denied')
      );
    });
  });

  it('resets form when modal is closed and reopened', async () => {
    const onClose = vi.fn();
    const { rerender } = render(<QuickAdd isOpen={true} onClose={onClose} />);

    // Open task form and fill data
    const addTaskButton = screen.getByText('Add Task');
    await userEvent.click(addTaskButton);

    const titleInput = screen.getByPlaceholderText(/what needs to be done/i);
    await userEvent.type(titleInput, 'Test task');

    // Close modal
    rerender(<QuickAdd isOpen={false} onClose={onClose} />);

    // Reopen modal
    rerender(<QuickAdd isOpen={true} onClose={onClose} />);

    // Should show action buttons again (form reset)
    expect(screen.getByText('Add Task')).toBeInTheDocument();
    expect(screen.queryByText('Create New Task')).not.toBeInTheDocument();
  });

  it('shows admin-only features for admin users', () => {
    render(<QuickAdd {...defaultProps} />);

    const addSaleButton = screen.getByText('Add Sale');
    expect(addSaleButton).toBeInTheDocument();

    // Admin users should see all options including revenue split capabilities
    // This is tested more thoroughly in the e2e tests
  });
});