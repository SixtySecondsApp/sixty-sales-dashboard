/**
 * Email Filter Service
 *
 * Provides filtering and rule-based automation for email management
 */

export type FilterCondition =
  | 'from_contains'
  | 'from_is'
  | 'to_contains'
  | 'subject_contains'
  | 'subject_is'
  | 'body_contains'
  | 'has_attachment'
  | 'is_starred'
  | 'is_read'
  | 'is_important'
  | 'label_is'
  | 'older_than'
  | 'newer_than';

export type FilterAction =
  | 'archive'
  | 'delete'
  | 'star'
  | 'mark_read'
  | 'mark_unread'
  | 'add_label'
  | 'move_to_folder'
  | 'mark_important';

export interface EmailFilter {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  conditions: EmailFilterCondition[];
  actions: EmailFilterAction[];
  matchType: 'all' | 'any'; // all = AND, any = OR
  createdAt: string;
  updatedAt: string;
}

export interface EmailFilterCondition {
  field: FilterCondition;
  value: string | number | boolean;
}

export interface EmailFilterAction {
  type: FilterAction;
  value?: string; // For add_label, move_to_folder
}

export interface Email {
  id: string;
  from: string;
  fromName: string;
  to: string;
  subject: string;
  body?: string;
  preview: string;
  timestamp: Date;
  read: boolean;
  starred: boolean;
  important: boolean;
  labels: string[];
  attachments: number;
  folder?: string;
}

const FILTER_STORAGE_KEY = 'email_filters';

/**
 * Get all email filters from localStorage
 */
export function getAllFilters(): EmailFilter[] {
  try {
    const filtersJson = localStorage.getItem(FILTER_STORAGE_KEY);
    if (!filtersJson) return [];

    return JSON.parse(filtersJson);
  } catch (error) {
    console.error('[Email Filters] Error loading filters:', error);
    return [];
  }
}

/**
 * Save filter to localStorage
 */
export function saveFilter(filter: Omit<EmailFilter, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): EmailFilter {
  try {
    const filters = getAllFilters();
    const now = new Date().toISOString();

    let savedFilter: EmailFilter;

    if (filter.id) {
      // Update existing filter
      const index = filters.findIndex(f => f.id === filter.id);
      if (index !== -1) {
        savedFilter = {
          ...filters[index],
          ...filter,
          id: filter.id,
          updatedAt: now
        };
        filters[index] = savedFilter;
      } else {
        // Not found, create new
        savedFilter = {
          ...filter,
          id: generateFilterId(),
          createdAt: now,
          updatedAt: now
        };
        filters.push(savedFilter);
      }
    } else {
      // Create new filter
      savedFilter = {
        ...filter,
        id: generateFilterId(),
        createdAt: now,
        updatedAt: now
      };
      filters.push(savedFilter);
    }

    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
    return savedFilter;
  } catch (error) {
    console.error('[Email Filters] Error saving filter:', error);
    throw error;
  }
}

/**
 * Delete filter by ID
 */
export function deleteFilter(id: string): boolean {
  try {
    const filters = getAllFilters();
    const filteredFilters = filters.filter(f => f.id !== id);

    if (filteredFilters.length === filters.length) {
      return false; // Filter not found
    }

    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filteredFilters));
    return true;
  } catch (error) {
    console.error('[Email Filters] Error deleting filter:', error);
    return false;
  }
}

/**
 * Toggle filter enabled/disabled
 */
export function toggleFilterEnabled(id: string): boolean {
  try {
    const filters = getAllFilters();
    const filter = filters.find(f => f.id === id);

    if (!filter) return false;

    filter.enabled = !filter.enabled;
    filter.updatedAt = new Date().toISOString();

    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
    return true;
  } catch (error) {
    console.error('[Email Filters] Error toggling filter:', error);
    return false;
  }
}

/**
 * Check if email matches a condition
 */
function matchesCondition(email: Email, condition: EmailFilterCondition): boolean {
  const { field, value } = condition;

  switch (field) {
    case 'from_contains':
      return email.from.toLowerCase().includes(String(value).toLowerCase()) ||
             email.fromName.toLowerCase().includes(String(value).toLowerCase());

    case 'from_is':
      return email.from.toLowerCase() === String(value).toLowerCase();

    case 'to_contains':
      return email.to.toLowerCase().includes(String(value).toLowerCase());

    case 'subject_contains':
      return email.subject.toLowerCase().includes(String(value).toLowerCase());

    case 'subject_is':
      return email.subject.toLowerCase() === String(value).toLowerCase();

    case 'body_contains':
      return email.body?.toLowerCase().includes(String(value).toLowerCase()) ||
             email.preview.toLowerCase().includes(String(value).toLowerCase());

    case 'has_attachment':
      return value ? email.attachments > 0 : email.attachments === 0;

    case 'is_starred':
      return email.starred === value;

    case 'is_read':
      return email.read === value;

    case 'is_important':
      return email.important === value;

    case 'label_is':
      return email.labels.includes(String(value));

    case 'older_than':
      const daysOld = (Date.now() - email.timestamp.getTime()) / (1000 * 60 * 60 * 24);
      return daysOld > Number(value);

    case 'newer_than':
      const daysNew = (Date.now() - email.timestamp.getTime()) / (1000 * 60 * 60 * 24);
      return daysNew < Number(value);

    default:
      return false;
  }
}

/**
 * Check if email matches a filter
 */
export function emailMatchesFilter(email: Email, filter: EmailFilter): boolean {
  if (!filter.enabled) return false;
  if (filter.conditions.length === 0) return false;

  if (filter.matchType === 'all') {
    // ALL conditions must match (AND)
    return filter.conditions.every(condition => matchesCondition(email, condition));
  } else {
    // ANY condition must match (OR)
    return filter.conditions.some(condition => matchesCondition(email, condition));
  }
}

/**
 * Get actions to apply to an email based on matching filters
 */
export function getActionsForEmail(email: Email, filters?: EmailFilter[]): EmailFilterAction[] {
  const allFilters = filters || getAllFilters();
  const enabledFilters = allFilters.filter(f => f.enabled);

  const actions: EmailFilterAction[] = [];

  for (const filter of enabledFilters) {
    if (emailMatchesFilter(email, filter)) {
      actions.push(...filter.actions);
    }
  }

  // Remove duplicates
  return actions.filter((action, index, self) =>
    index === self.findIndex(a =>
      a.type === action.type && a.value === action.value
    )
  );
}

/**
 * Apply filter actions to an email (returns modified email properties)
 */
export function applyFilterActions(email: Email, actions: EmailFilterAction[]): Partial<Email> {
  const updates: Partial<Email> = {};

  for (const action of actions) {
    switch (action.type) {
      case 'archive':
        updates.folder = 'archive';
        break;

      case 'delete':
        updates.folder = 'trash';
        break;

      case 'star':
        updates.starred = true;
        break;

      case 'mark_read':
        updates.read = true;
        break;

      case 'mark_unread':
        updates.read = false;
        break;

      case 'mark_important':
        updates.important = true;
        break;

      case 'add_label':
        if (action.value) {
          updates.labels = [...(updates.labels || email.labels), action.value];
        }
        break;

      case 'move_to_folder':
        if (action.value) {
          updates.folder = action.value;
        }
        break;
    }
  }

  return updates;
}

/**
 * Filter emails based on active filters
 */
export function filterEmails(emails: Email[]): Email[] {
  const filters = getAllFilters().filter(f => f.enabled);

  return emails.map(email => {
    const actions = getActionsForEmail(email, filters);
    if (actions.length > 0) {
      const updates = applyFilterActions(email, actions);
      return { ...email, ...updates };
    }
    return email;
  });
}

/**
 * Get filter statistics
 */
export function getFilterStats(): {
  total: number;
  enabled: number;
  disabled: number;
} {
  const filters = getAllFilters();

  return {
    total: filters.length,
    enabled: filters.filter(f => f.enabled).length,
    disabled: filters.filter(f => !f.enabled).length
  };
}

// Helper functions
function generateFilterId(): string {
  return `filter_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
