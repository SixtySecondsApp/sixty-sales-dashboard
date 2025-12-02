import { renderHook, waitFor } from '@testing-library/react';
import { useSubtasks, useAllSubtasks } from '../useSubtasks';
import { SubtaskService } from '../../services/subtaskService';
import * as useUserHook from '../useUser';

// Mock dependencies
jest.mock('../useUser');
jest.mock('../../services/subtaskService');
jest.mock('../../utils/logger');

const mockSubtasks = [
  {
    id: 'subtask-1',
    title: 'Test Subtask 1',
    parent_task_id: 'parent-task-1',
    assigned_to: 'user-1',
    created_by: 'user-1',
    status: 'pending',
    priority: 'medium',
    completed: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    task_type: 'general'
  },
  {
    id: 'subtask-2',
    title: 'Test Subtask 2',
    parent_task_id: 'parent-task-1',
    assigned_to: 'user-1',
    created_by: 'user-1',
    status: 'completed',
    priority: 'high',
    completed: true,
    completed_at: '2024-01-02T00:00:00Z',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    task_type: 'general'
  }
];

const mockUseUser = useUserHook as jest.Mocked<typeof useUserHook>;

describe('useSubtasks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock useUser hook
    mockUseUser.useUser.mockReturnValue({
      userData: { id: 'user-1', email: 'test@example.com' },
      isLoading: false,
      user: null,
      session: null,
      signIn: jest.fn(),
      signOut: jest.fn(),
      signUp: jest.fn(),
      isAuthenticated: true,
      error: null
    });

    // Mock SubtaskService
    (SubtaskService.fetchSubtasks as jest.Mock).mockResolvedValue(mockSubtasks);
  });

  it('should fetch subtasks on mount', async () => {
    const { result } = renderHook(() => 
      useSubtasks({ parentTaskId: 'parent-task-1' })
    );

    // Initially loading
    expect(result.current.isLoading).toBe(true);
    expect(result.current.subtasks).toEqual([]);

    // Wait for data to load
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(SubtaskService.fetchSubtasks).toHaveBeenCalledWith('parent-task-1');
    expect(result.current.subtasks).toEqual(mockSubtasks);
    expect(result.current.error).toBeNull();
  });

  it('should calculate subtask statistics correctly', async () => {
    const { result } = renderHook(() => 
      useSubtasks({ parentTaskId: 'parent-task-1' })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const stats = result.current.subtaskStats;
    expect(stats).toEqual({
      total: 2,
      completed: 1,
      pending: 1,
      in_progress: 0,
      overdue: 0,
      due_today: 0,
      high_priority: 1,
      completion_percentage: 50
    });
  });

  it('should apply filters correctly', async () => {
    (SubtaskService.fetchSubtasks as jest.Mock).mockResolvedValue(mockSubtasks);

    const { result } = renderHook(() => 
      useSubtasks({ 
        parentTaskId: 'parent-task-1',
        filters: { completed: false }
      })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should only return the incomplete subtask
    expect(result.current.subtasks).toHaveLength(1);
    expect(result.current.subtasks[0].completed).toBe(false);
  });

  it('should create a subtask successfully', async () => {
    const newSubtask = {
      id: 'subtask-3',
      title: 'New Subtask',
      parent_task_id: 'parent-task-1',
      assigned_to: 'user-1',
      created_by: 'user-1',
      status: 'pending',
      priority: 'medium',
      completed: false,
      created_at: '2024-01-03T00:00:00Z',
      updated_at: '2024-01-03T00:00:00Z',
      task_type: 'general'
    };

    (SubtaskService.createSubtask as jest.Mock).mockResolvedValue(newSubtask);

    const { result } = renderHook(() => 
      useSubtasks({ parentTaskId: 'parent-task-1' })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Create a subtask
    await result.current.createSubtask({
      title: 'New Subtask',
      assigned_to: 'user-1'
    });

    expect(SubtaskService.createSubtask).toHaveBeenCalledWith({
      title: 'New Subtask',
      assigned_to: 'user-1',
      parent_task_id: 'parent-task-1'
    }, 'user-1');

    // Should add the new subtask to the list
    expect(result.current.subtasks).toHaveLength(3);
    expect(result.current.subtasks[2]).toEqual(newSubtask);
  });

  it('should handle no parent task ID gracefully', async () => {
    const { result } = renderHook(() => 
      useSubtasks({ parentTaskId: '' })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(SubtaskService.fetchSubtasks).not.toHaveBeenCalled();
    expect(result.current.subtasks).toEqual([]);
  });

  it('should handle service errors', async () => {
    const errorMessage = 'Failed to fetch subtasks';
    (SubtaskService.fetchSubtasks as jest.Mock).mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => 
      useSubtasks({ parentTaskId: 'parent-task-1' })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toEqual(new Error(errorMessage));
    expect(result.current.subtasks).toEqual([]);
  });
});

describe('useAllSubtasks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock useUser hook
    mockUseUser.useUser.mockReturnValue({
      userData: { id: 'user-1', email: 'test@example.com' },
      isLoading: false,
      user: null,
      session: null,
      signIn: jest.fn(),
      signOut: jest.fn(),
      signUp: jest.fn(),
      isAuthenticated: true,
      error: null
    });

    // Mock SubtaskService
    (SubtaskService.getSubtasksWithParent as jest.Mock).mockResolvedValue([
      { ...mockSubtasks[0], parent_task: { id: 'parent-task-1', title: 'Parent Task 1' } },
      { ...mockSubtasks[1], parent_task: { id: 'parent-task-1', title: 'Parent Task 1' } }
    ]);
  });

  it('should fetch all subtasks and group them by parent', async () => {
    const { result } = renderHook(() => useAllSubtasks('user-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(SubtaskService.getSubtasksWithParent).toHaveBeenCalledWith('user-1');
    expect(result.current.subtasks).toHaveLength(2);
    expect(result.current.subtasksByParent).toEqual({
      'parent-task-1': [
        { ...mockSubtasks[0], parent_task: { id: 'parent-task-1', title: 'Parent Task 1' } },
        { ...mockSubtasks[1], parent_task: { id: 'parent-task-1', title: 'Parent Task 1' } }
      ]
    });
  });
});