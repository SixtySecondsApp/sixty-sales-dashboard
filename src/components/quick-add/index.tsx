import React from 'react';
import { useUserPermissions } from '@/contexts/UserPermissionsContext';
import { useQuickAddVersionReadOnly } from '@/lib/hooks/useQuickAddVersion';
import { QuickAdd as QuickAddComponent } from './QuickAdd';

export function QuickAdd(props: { isOpen: boolean; onClose: () => void }) {
  // In app runtime, this is always wrapped by UserPermissionsProvider.
  // Some unit tests render QuickAdd standalone, so fail open to "internal".
  let effectiveUserType: 'internal' | 'external' = 'internal';
  try {
    effectiveUserType = useUserPermissions().effectiveUserType;
  } catch {
    // Provider not mounted (tests) - keep default
  }
  const { internalVersion, externalVersion } = useQuickAddVersionReadOnly();

  const version = effectiveUserType === 'external' ? externalVersion : internalVersion;
  const variant = version === 'v2' ? 'v2' : 'v1';

  return <QuickAddComponent {...props} variant={variant} />;
}

export { QuickAddComponent };
export { ActionGrid } from './ActionGrid';
export { TaskForm } from './TaskForm';
export { ActivityForms } from './ActivityForms';
export * from './types';
export * from './hooks/useFormState';
export * from './hooks/useQuickAddValidation';
export * from './hooks/useSmartDates';