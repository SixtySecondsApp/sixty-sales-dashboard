/**
 * Radix UI Select Fix Verification Test
 * 
 * This test specifically verifies that the Radix UI Select error
 * "A <Select.Item /> must have a value prop that is not an empty string"
 * has been resolved in the automation rule builder components.
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { TriggerConditions, ActionConfiguration } from '../../src/components/automation/RuleBuilderComponents';

// Mock stages data
const mockStages = [
  { id: 'stage-1', name: 'SQL' },
  { id: 'stage-2', name: 'Opportunity' },
  { id: 'stage-3', name: 'Verbal' },
  { id: 'stage-4', name: 'Signed' }
];

describe('Radix UI Select Fix Verification', () => {
  it('should not throw the specific Radix UI Select error for TriggerConditions', () => {
    // Capture console errors
    const originalConsoleError = console.error;
    const consoleErrors: string[] = [];
    console.error = (message: string) => {
      consoleErrors.push(message);
    };

    try {
      // Test all trigger condition types
      const triggerTypes = ['activity_created', 'stage_changed', 'deal_created', 'task_completed'];
      
      triggerTypes.forEach(triggerType => {
        const { unmount } = render(
          <TriggerConditions
            triggerType={triggerType}
            conditions={{}}
            updateConditions={vi.fn()}
            stages={mockStages}
          />
        );
        unmount();
      });

      // Check that the specific Radix UI error was not thrown
      const hasRadixSelectError = consoleErrors.some(error => 
        error.includes('A <Select.Item /> must have a value prop that is not an empty string')
      );

      expect(hasRadixSelectError).toBe(false);
      
    } finally {
      // Restore original console.error
      console.error = originalConsoleError;
    }
  });

  it('should not throw the specific Radix UI Select error for ActionConfiguration', () => {
    // Capture console errors
    const originalConsoleError = console.error;
    const consoleErrors: string[] = [];
    console.error = (message: string) => {
      consoleErrors.push(message);
    };

    try {
      // Test all action configuration types
      const actionTypes = ['create_deal', 'update_deal_stage', 'create_task', 'create_activity', 'send_notification'];
      
      actionTypes.forEach(actionType => {
        const { unmount } = render(
          <ActionConfiguration
            actionType={actionType}
            config={{}}
            updateConfig={vi.fn()}
            stages={mockStages}
          />
        );
        unmount();
      });

      // Check that the specific Radix UI error was not thrown
      const hasRadixSelectError = consoleErrors.some(error => 
        error.includes('A <Select.Item /> must have a value prop that is not an empty string')
      );

      expect(hasRadixSelectError).toBe(false);
      
    } finally {
      // Restore original console.error
      console.error = originalConsoleError;
    }
  });

  it('should use non-empty placeholder values in all Select components', () => {
    // This test ensures our fix implementation is correct
    
    // TriggerConditions with activity_created should use "any" for optional fields
    const { container: triggerContainer } = render(
      <TriggerConditions
        triggerType="activity_created"
        conditions={{}}
        updateConditions={vi.fn()}
        stages={mockStages}
      />
    );
    
    // Should have placeholder text indicating "any" selection
    expect(triggerContainer.textContent).toContain('Any activity type');
    
    // ActionConfiguration with create_task should use "none" for required fields
    const { container: actionContainer } = render(
      <ActionConfiguration
        actionType="create_task"
        config={{}}
        updateConfig={vi.fn()}
        stages={mockStages}
      />
    );
    
    // Should have proper placeholder selections
    expect(actionContainer.textContent).toContain('Select type');
    expect(actionContainer.textContent).toContain('Select priority');
  });

  it('should handle edge cases without errors', () => {
    const originalConsoleError = console.error;
    const consoleErrors: string[] = [];
    console.error = (message: string) => {
      consoleErrors.push(message);
    };

    try {
      // Test with empty stages array
      const { unmount: unmount1 } = render(
        <TriggerConditions
          triggerType="stage_changed"
          conditions={{}}
          updateConditions={vi.fn()}
          stages={[]}
        />
      );
      unmount1();

      // Test with null/undefined conditions
      const { unmount: unmount2 } = render(
        <ActionConfiguration
          actionType="create_deal"
          config={{}}
          updateConfig={vi.fn()}
          stages={mockStages}
        />
      );
      unmount2();

      // Should not have any Radix Select errors
      const hasRadixSelectError = consoleErrors.some(error => 
        error.includes('A <Select.Item /> must have a value prop that is not an empty string')
      );

      expect(hasRadixSelectError).toBe(false);
      
    } finally {
      console.error = originalConsoleError;
    }
  });
});