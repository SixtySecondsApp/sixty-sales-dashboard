/**
 * SequenceBuilder Component
 *
 * Main editor for building agent sequences. Features:
 * - Drag-and-drop step reordering
 * - Add/remove steps
 * - Configure each step's input mapping and output key
 */

import { useCallback, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { SequenceStep } from './SequenceStep';
import type { SequenceStep as SequenceStepType } from '@/lib/hooks/useAgentSequences';

// =============================================================================
// Types
// =============================================================================

interface SequenceBuilderProps {
  steps: SequenceStepType[];
  onChange: (steps: SequenceStepType[]) => void;
  className?: string;
}

// =============================================================================
// Sortable Step Wrapper
// =============================================================================

interface SortableStepProps {
  step: SequenceStepType;
  index: number;
  availableOutputs: string[];
  onChange: (step: SequenceStepType) => void;
  onDelete: () => void;
}

function SortableStep({
  step,
  index,
  availableOutputs,
  onChange,
  onDelete,
}: SortableStepProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `step-${step.order}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <SequenceStep
        step={step}
        index={index}
        availableOutputs={availableOutputs}
        onChange={onChange}
        onDelete={onDelete}
        isDragging={isDragging}
        dragHandleProps={listeners}
      />
    </div>
  );
}

// =============================================================================
// Step Connector
// =============================================================================

function StepConnector() {
  return (
    <div className="flex justify-center py-1">
      <div className="flex flex-col items-center">
        <div className="w-px h-2 bg-border" />
        <ArrowDown className="h-4 w-4 text-muted-foreground" />
        <div className="w-px h-2 bg-border" />
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function SequenceBuilder({
  steps,
  onChange,
  className,
}: SequenceBuilderProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Get output keys from previous steps
  const getAvailableOutputs = useCallback(
    (stepIndex: number) => {
      return steps
        .slice(0, stepIndex)
        .map((s) => s.output_key)
        .filter(Boolean);
    },
    [steps]
  );

  // Handle step change
  const handleStepChange = useCallback(
    (index: number, updatedStep: SequenceStepType) => {
      const newSteps = [...steps];
      newSteps[index] = updatedStep;
      onChange(newSteps);
    },
    [steps, onChange]
  );

  // Handle step delete
  const handleStepDelete = useCallback(
    (index: number) => {
      const newSteps = steps.filter((_, i) => i !== index);
      // Re-order remaining steps
      newSteps.forEach((step, i) => {
        step.order = i + 1;
      });
      onChange(newSteps);
    },
    [steps, onChange]
  );

  // Handle add step
  const handleAddStep = useCallback(() => {
    const newStep: SequenceStepType = {
      order: steps.length + 1,
      skill_key: '',
      input_mapping: {},
      output_key: `step${steps.length + 1}_output`,
      on_failure: 'stop',
    };
    onChange([...steps, newStep]);
  }, [steps, onChange]);

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const oldIndex = steps.findIndex((s) => `step-${s.order}` === active.id);
      const newIndex = steps.findIndex((s) => `step-${s.order}` === over.id);

      const newSteps = arrayMove(steps, oldIndex, newIndex);
      // Update order values
      newSteps.forEach((step, i) => {
        step.order = i + 1;
      });
      onChange(newSteps);
    }
  };

  // Find active step for overlay
  const activeStep = activeId
    ? steps.find((s) => `step-${s.order}` === activeId)
    : null;
  const activeIndex = activeStep
    ? steps.findIndex((s) => s.order === activeStep.order)
    : -1;

  return (
    <div className={cn('space-y-2', className)}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={steps.map((s) => `step-${s.order}`)}
          strategy={verticalListSortingStrategy}
        >
          {steps.map((step, index) => (
            <div key={`step-${step.order}`}>
              {index > 0 && <StepConnector />}
              <SortableStep
                step={step}
                index={index}
                availableOutputs={getAvailableOutputs(index)}
                onChange={(updated) => handleStepChange(index, updated)}
                onDelete={() => handleStepDelete(index)}
              />
            </div>
          ))}
        </SortableContext>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeStep && activeIndex >= 0 && (
            <div className="opacity-80">
              <SequenceStep
                step={activeStep}
                index={activeIndex}
                availableOutputs={getAvailableOutputs(activeIndex)}
                onChange={() => {}}
                onDelete={() => {}}
                isDragging={true}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Add Step Button */}
      <div className="pt-4">
        {steps.length > 0 && <StepConnector />}
        <Button
          variant="outline"
          onClick={handleAddStep}
          className="w-full gap-2 border-dashed"
        >
          <Plus className="h-4 w-4" />
          Add Step
        </Button>
      </div>

      {/* Empty State */}
      {steps.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p className="mb-4">No steps in this sequence yet.</p>
          <p className="text-sm">
            Click "Add Step" to start building your skill chain.
          </p>
        </div>
      )}
    </div>
  );
}

export default SequenceBuilder;
