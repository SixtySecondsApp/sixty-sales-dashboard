export interface ExportColumn {
  key: string;
  label: string;
  formatter?: (value: any) => string;
}

export interface ExportOptions {
  filename?: string;
  columns?: ExportColumn[];
  includeHeaders?: boolean;
  dateFormat?: string;
}

/**
 * Enhanced CSV export with proper headers and data formatting
 */
export const exportToCSV = (data: any[], options: ExportOptions = {}) => {
  try {
    if (!data || data.length === 0) {
      throw new Error('No data to export');
    }

    const {
      filename = 'export.csv',
      columns,
      includeHeaders = true,
      dateFormat = 'YYYY-MM-DD'
    } = options;

    // Generate columns from data if not provided
    const exportColumns: ExportColumn[] = columns || Object.keys(data[0]).map(key => ({
      key,
      label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')
    }));

    const csvContent = [];

    // Add headers if requested
    if (includeHeaders) {
      csvContent.push(exportColumns.map(col => col.label).join(','));
    }

    // Add data rows
    data.forEach(row => {
      const csvRow = exportColumns.map(col => {
        let value = row[col.key];
        
        // Apply custom formatter if provided
        if (col.formatter) {
          value = col.formatter(value);
        } else {
          // Default formatting
          if (value === null || value === undefined) {
            value = '';
          } else if (typeof value === 'object') {
            value = JSON.stringify(value);
          } else if (typeof value === 'string') {
            // Format dates
            if (isDateString(value)) {
              value = formatDate(value, dateFormat);
            }
          }
        }

        // Escape quotes and wrap in quotes if contains comma, newline, or quote
        const stringValue = String(value);
        const escapedValue = stringValue.replace(/"/g, '""');
        
        return (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) 
          ? `"${escapedValue}"` 
          : escapedValue;
      });
      
      csvContent.push(csvRow.join(','));
    });

    const csvString = csvContent.join('\n');

    // Create and trigger download
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    
    return true;
  } catch (error) {
    console.error('CSV export error:', error);
    throw error;
  }
};

/**
 * Export roadmap suggestions to CSV
 */
export const exportRoadmapToCSV = (suggestions: any[], filename = 'roadmap-suggestions.csv') => {
  const columns: ExportColumn[] = [
    { key: 'title', label: 'Title' },
    { key: 'type', label: 'Type' },
    { key: 'status', label: 'Status' },
    { key: 'priority', label: 'Priority' },
    { key: 'description', label: 'Description' },
    { key: 'votes_count', label: 'Votes' },
    { key: 'submitted_by_profile', label: 'Submitted By', formatter: (profile) => profile?.full_name || 'Unknown' },
    { key: 'assigned_to_profile', label: 'Assigned To', formatter: (profile) => profile?.full_name || 'Unassigned' },
    { key: 'estimated_effort', label: 'Estimated Effort' },
    { key: 'target_version', label: 'Target Version' },
    { key: 'created_at', label: 'Created Date' },
    { key: 'updated_at', label: 'Updated Date' }
  ];

  return exportToCSV(suggestions, { filename, columns });
};

/**
 * Export pipeline deals to CSV
 */
export const exportPipelineToCSV = (deals: any[], filename = 'pipeline-deals.csv') => {
  const columns: ExportColumn[] = [
    { key: 'title', label: 'Deal Title' },
    { key: 'value', label: 'Value', formatter: (value) => value ? `$${value.toLocaleString()}` : '' },
    { key: 'stage', label: 'Stage' },
    { key: 'probability', label: 'Probability', formatter: (prob) => prob ? `${prob}%` : '' },
    { key: 'expected_close_date', label: 'Expected Close Date' },
    { key: 'contact_name', label: 'Contact' },
    { key: 'company_name', label: 'Company' },
    { key: 'created_at', label: 'Created Date' },
    { key: 'updated_at', label: 'Updated Date' }
  ];

  return exportToCSV(deals, { filename, columns });
};

/**
 * Utility function to check if a string is a date
 */
function isDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}/.test(value) || !isNaN(Date.parse(value));
}

/**
 * Format date string
 */
function formatDate(dateString: string, format: string = 'YYYY-MM-DD'): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    // Simple date formatting
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch {
    return dateString;
  }
}