/**
 * Navigation utilities for task management system
 * Provides reusable functions for navigating to related records
 */

import { NavigateFunction } from 'react-router-dom';

export type RelatedRecordType = 'company' | 'contact' | 'deal';

export interface RelatedRecord {
  id?: string;
  name?: string;
  type: RelatedRecordType;
}

/**
 * Navigate to a related record (company, contact, or deal)
 * If ID is provided, navigate directly to the record
 * If no ID but name is provided, navigate to the list with search
 * 
 * @param navigate - React Router navigate function
 * @param type - Type of record (company, contact, deal)
 * @param id - Optional record ID
 * @param name - Optional record name for search fallback
 * @param openInNewTab - Whether to open in a new tab (default: false)
 */
export const navigateToRelatedRecord = (
  navigate: NavigateFunction,
  type: RelatedRecordType,
  id?: string,
  name?: string,
  openInNewTab?: boolean
) => {
  let url: string;

  if (id) {
    // Navigate directly to the record
    url = `/crm/${type === 'company' ? 'companies' : type === 'contact' ? 'contacts' : 'deals'}/${id}`;
  } else if (name) {
    // Navigate to list with search
    url = `/crm/${type === 'company' ? 'companies' : type === 'contact' ? 'contacts' : 'deals'}?search=${encodeURIComponent(name)}`;
  } else {
    // No ID or name provided
    return;
  }

  if (openInNewTab) {
    window.open(url, '_blank', 'noopener,noreferrer');
  } else {
    navigate(url);
  }
};

/**
 * Handle click events for related record navigation
 * Supports Ctrl+click and right-click for new tab behavior
 * 
 * @param event - Mouse event
 * @param navigate - React Router navigate function
 * @param type - Type of record
 * @param id - Optional record ID
 * @param name - Optional record name
 * @param onNavigate - Optional callback to execute after navigation (e.g., close modal)
 */
export const handleRelatedRecordClick = (
  event: React.MouseEvent,
  navigate: NavigateFunction,
  type: RelatedRecordType,
  id?: string,
  name?: string,
  onNavigate?: () => void
) => {
  // Prevent event bubbling
  event.stopPropagation();

  // Check if Ctrl key is pressed or it's a middle click for new tab
  const openInNewTab = event.ctrlKey || event.metaKey || event.button === 1;

  navigateToRelatedRecord(navigate, type, id, name, openInNewTab);

  // Execute callback if provided (e.g., close modal)
  if (onNavigate && !openInNewTab) {
    onNavigate();
  }
};

/**
 * Handle keyboard navigation for related records
 * Supports Enter key for navigation
 * 
 * @param event - Keyboard event
 * @param navigate - React Router navigate function
 * @param type - Type of record
 * @param id - Optional record ID
 * @param name - Optional record name
 * @param onNavigate - Optional callback to execute after navigation
 */
export const handleRelatedRecordKeyDown = (
  event: React.KeyboardEvent,
  navigate: NavigateFunction,
  type: RelatedRecordType,
  id?: string,
  name?: string,
  onNavigate?: () => void
) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    event.stopPropagation();

    // Check if Ctrl key is pressed for new tab
    const openInNewTab = event.ctrlKey || event.metaKey;

    navigateToRelatedRecord(navigate, type, id, name, openInNewTab);

    // Execute callback if provided
    if (onNavigate && !openInNewTab) {
      onNavigate();
    }
  }
};

/**
 * Get the appropriate route path for a record type
 * 
 * @param type - Type of record
 * @returns The route path segment
 */
export const getRecordRoutePath = (type: RelatedRecordType): string => {
  switch (type) {
    case 'company':
      return 'companies';
    case 'contact':
      return 'contacts';
    case 'deal':
      return 'deals';
    default:
      return 'companies';
  }
};

/**
 * Check if a related record has enough information to be navigable
 * 
 * @param id - Optional record ID
 * @param name - Optional record name
 * @returns Whether the record can be navigated to
 */
export const isRelatedRecordNavigable = (id?: string, name?: string): boolean => {
  return Boolean(id || name);
};