import { Activity } from '@/lib/hooks/useActivities';
import { DealWithRelationships, DealStage } from '@/lib/hooks/useDeals';
import { format } from 'date-fns';

export interface CSVExportOptions {
  filename?: string;
  includeColumns?: string[];
  excludeColumns?: string[];
}

/**
 * Properly escapes a value for CSV format
 * - Wraps in quotes if contains comma, quote, or newline
 * - Doubles any internal quotes
 * - Handles null/undefined values
 */
const escapeCSVValue = (value: any): string => {
  if (value === null || value === undefined) {
    return '';
  }
  
  const stringValue = String(value);
  
  // Check if the value needs to be quoted (contains comma, quote, newline, or starts/ends with whitespace)
  const needsQuoting = /[,"\n\r]/.test(stringValue) || 
                      stringValue.startsWith(' ') || 
                      stringValue.endsWith(' ');
  
  if (needsQuoting) {
    // Double any existing quotes and wrap in quotes
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  
  return stringValue;
};

/**
 * Converts activities data to CSV format and downloads it
 */
export const exportActivitiesToCSV = (
  activities: Activity[],
  options: CSVExportOptions = {}
) => {
  if (activities.length === 0) {
    throw new Error('No data to export');
  }

  const {
    filename = `sales-activities-${format(new Date(), 'yyyy-MM-dd')}.csv`,
    includeColumns,
    excludeColumns = []
  } = options;

  // Define all possible columns with their display names
  const allColumns = {
    date: 'Date',
    type: 'Activity Type',
    sales_rep: 'Sales Rep',
    client_name: 'Client Name',
    amount: 'Amount (£)',
    status: 'Status',
    priority: 'Priority',
    details: 'Details',
    quantity: 'Quantity'
  };

  // Determine which columns to include
  const validColumns = Object.keys(allColumns) as (keyof typeof allColumns)[];
  let columnsToInclude: (keyof typeof allColumns)[];
  
  if (includeColumns) {
    // Validate each column in includeColumns against valid column names
    columnsToInclude = includeColumns.filter((col): col is keyof typeof allColumns => 
      validColumns.includes(col as keyof typeof allColumns)
    ) as (keyof typeof allColumns)[];
    
    // Log warning if any invalid columns were filtered out
    const invalidColumns = includeColumns.filter(col => 
      !validColumns.includes(col as keyof typeof allColumns)
    );
    if (invalidColumns.length > 0) {
      console.warn(`Invalid column names filtered out from CSV export: ${invalidColumns.join(', ')}`);
    }
  } else {
    columnsToInclude = validColumns;
  }

  // Remove excluded columns
  columnsToInclude = columnsToInclude.filter(col => !excludeColumns.includes(col));

  // Create CSV headers
  const headers = columnsToInclude.map(col => allColumns[col]);
  
  // Convert activities to CSV rows
  const csvRows = activities.map(activity => {
    return columnsToInclude.map(column => {
      let value = activity[column as keyof Activity];
      
      // Format specific columns with proper CSV escaping
      switch (column) {
        case 'date':
          if (!value) return escapeCSVValue('');
          try {
            const dateObj = new Date(value as string);
            // Check if the date is valid
            if (isNaN(dateObj.getTime())) {
              console.warn(`Invalid date value in activity: ${value}`);
              return escapeCSVValue(''); // Return empty string for invalid dates
            }
            const formattedDate = format(dateObj, 'yyyy-MM-dd HH:mm');
            return escapeCSVValue(formattedDate);
          } catch (error) {
            console.warn(`Error parsing date for CSV export: ${value}`, error);
            return escapeCSVValue(''); // Return empty string on parsing error
          }
        case 'type':
          const formattedType = (value as string)?.charAt(0).toUpperCase() + (value as string)?.slice(1) || '';
          return escapeCSVValue(formattedType);
        case 'status':
          let formattedStatus = '';
          if (value === 'no_show') {
            formattedStatus = 'No Show';
          } else {
            formattedStatus = (value as string)?.charAt(0).toUpperCase() + (value as string)?.slice(1) || '';
          }
          return escapeCSVValue(formattedStatus);
        case 'priority':
          const formattedPriority = (value as string)?.charAt(0).toUpperCase() + (value as string)?.slice(1) || '';
          return escapeCSVValue(formattedPriority);
        case 'amount':
          if (!value) return escapeCSVValue('');
          try {
            const numericValue = Number(value);
            if (isNaN(numericValue)) {
              console.warn(`Invalid amount value in activity: ${value}`);
              return escapeCSVValue('');
            }
            const formattedAmount = `£${numericValue.toLocaleString()}`;
            return escapeCSVValue(formattedAmount);
          } catch (error) {
            console.warn(`Error parsing amount for CSV export: ${value}`, error);
            return escapeCSVValue('');
          }
        case 'quantity':
          if (!value) return escapeCSVValue('1');
          try {
            const quantityValue = value.toString();
            return escapeCSVValue(quantityValue);
          } catch (error) {
            console.warn(`Error formatting quantity for CSV export: ${value}`, error);
            return escapeCSVValue('1');
          }
        default:
          return escapeCSVValue(value);
      }
    });
  });

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...csvRows.map(row => row.join(','))
  ].join('\n');

  // Create and download the file
  try {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      throw new Error('File download not supported in this browser');
    }
  } catch (error) {
    console.error('Error downloading CSV file:', error);
    alert('Failed to download CSV file. Please try again or contact support if the problem persists.');
    throw error; // Re-throw to allow calling code to handle if needed
  }
};

/**
 * Get a summary of the data being exported
 */
export const getExportSummary = (activities: Activity[]) => {
  const summary = {
    totalActivities: activities.length,
    activityTypes: {} as Record<string, number>,
    dateRange: {
      start: null as Date | null,
      end: null as Date | null
    },
    totalRevenue: 0,
    salesReps: new Set<string>(),
    clients: new Set<string>()
  };

  activities.forEach(activity => {
    // Count activity types
    summary.activityTypes[activity.type] = (summary.activityTypes[activity.type] || 0) + 1;
    
    // Track date range with error handling
    try {
      const activityDate = new Date(activity.date);
      // Check if the date is valid
      if (!isNaN(activityDate.getTime())) {
        if (!summary.dateRange.start || activityDate < summary.dateRange.start) {
          summary.dateRange.start = activityDate;
        }
        if (!summary.dateRange.end || activityDate > summary.dateRange.end) {
          summary.dateRange.end = activityDate;
        }
      } else {
        console.warn(`Invalid date value in activity for summary: ${activity.date} (Activity ID: ${activity.id || 'unknown'})`);
      }
    } catch (error) {
      console.warn(`Error parsing date for export summary: ${activity.date} (Activity ID: ${activity.id || 'unknown'})`, error);
      // Continue processing other activities even if this one has a bad date
    }
    
    // Sum revenue
    if (activity.type === 'sale' && activity.amount) {
      summary.totalRevenue += activity.amount;
    }
    
    // Track unique sales reps and clients
    if (activity.sales_rep) summary.salesReps.add(activity.sales_rep);
    if (activity.client_name) summary.clients.add(activity.client_name);
  });

  return {
    ...summary,
    salesReps: Array.from(summary.salesReps),
    clients: Array.from(summary.clients)
  };
};

/**
 * Converts pipeline deals data to CSV format and downloads it
 */
export const exportPipelineToCSV = (
  deals: DealWithRelationships[],
  stages: DealStage[],
  options: CSVExportOptions = {}
) => {
  if (deals.length === 0) {
    throw new Error('No pipeline data to export');
  }

  const {
    filename = `pipeline-export-${format(new Date(), 'yyyy-MM-dd')}.csv`,
    includeColumns,
    excludeColumns = []
  } = options;

  // Define all possible columns with their display names
  const allColumns = {
    name: 'Deal Name',
    company: 'Company',
    contact_name: 'Primary Contact',
    contact_email: 'Contact Email',
    contact_phone: 'Contact Phone',
    contact_title: 'Contact Title',
    stage_name: 'Stage',
    stage_probability: 'Stage Probability (%)',
    value: 'Deal Value (£)',
    weighted_value: 'Weighted Value (£)',
    probability: 'Deal Probability (%)',
    days_in_stage: 'Days in Stage',
    time_status: 'Time Status',
    owner: 'Owner',
    created_date: 'Created Date',
    close_date: 'Expected Close Date',
    stage_changed_date: 'Stage Changed Date',
    one_off_revenue: 'One-Off Revenue (£)',
    monthly_mrr: 'Monthly MRR (£)',
    annual_value: 'Annual Value (£)',
    company_size: 'Company Size',
    company_industry: 'Industry',
    notes: 'Notes',
    status: 'Status'
  };

  // Determine which columns to include
  const validColumns = Object.keys(allColumns) as (keyof typeof allColumns)[];
  let columnsToInclude: (keyof typeof allColumns)[];
  
  if (includeColumns) {
    // Validate each column in includeColumns against valid column names
    columnsToInclude = includeColumns.filter((col): col is keyof typeof allColumns => 
      validColumns.includes(col as keyof typeof allColumns)
    ) as (keyof typeof allColumns)[];
    
    // Log warning if any invalid columns were filtered out
    const invalidColumns = includeColumns.filter(col => 
      !validColumns.includes(col as keyof typeof allColumns)
    );
    if (invalidColumns.length > 0) {
      console.warn(`Invalid column names filtered out from pipeline export: ${invalidColumns.join(', ')}`);
    }
  } else {
    columnsToInclude = validColumns;
  }

  // Remove excluded columns
  columnsToInclude = columnsToInclude.filter(col => !excludeColumns.includes(col));

  // Create CSV headers
  const headers = columnsToInclude.map(col => allColumns[col]);
  
  // Convert deals to CSV rows
  const csvRows = deals.map(deal => {
    // Find the stage information
    const stage = stages.find(s => s.id === deal.stage_id);
    
    // Calculate weighted value
    const dealProbability = deal.probability || stage?.default_probability || 0;
    const weightedValue = Number(deal.value || 0) * (Number(dealProbability) / 100);
    
    return columnsToInclude.map(column => {
      let value: any;
      
      // Map deal data to column values with proper CSV escaping
      switch (column) {
        case 'name':
          value = deal.name || '';
          break;
        case 'company':
          value = deal.companies?.name || deal.company || '';
          break;
        case 'contact_name':
          value = deal.contacts?.full_name || deal.contact_name || '';
          break;
        case 'contact_email':
          value = deal.contacts?.email || '';
          break;
        case 'contact_phone':
          value = deal.contacts?.phone || '';
          break;
        case 'contact_title':
          value = deal.contacts?.title || '';
          break;
        case 'stage_name':
          value = stage?.name || 'Unknown Stage';
          break;
        case 'stage_probability':
          value = stage?.default_probability || 0;
          break;
        case 'value':
          if (!deal.value) return escapeCSVValue('');
          try {
            const numericValue = Number(deal.value);
            if (isNaN(numericValue)) {
              console.warn(`Invalid deal value: ${deal.value} for deal ${deal.id}`);
              return escapeCSVValue('');
            }
            return escapeCSVValue(`£${numericValue.toLocaleString()}`);
          } catch (error) {
            console.warn(`Error formatting deal value: ${deal.value} for deal ${deal.id}`, error);
            return escapeCSVValue('');
          }
        case 'weighted_value':
          try {
            const formattedWeighted = `£${weightedValue.toLocaleString()}`;
            return escapeCSVValue(formattedWeighted);
          } catch (error) {
            console.warn(`Error formatting weighted value for deal ${deal.id}`, error);
            return escapeCSVValue('');
          }
        case 'probability':
          value = dealProbability;
          break;
        case 'days_in_stage':
          value = deal.daysInStage || 0;
          break;
        case 'time_status':
          const timeStatus = deal.timeStatus || 'normal';
          value = timeStatus.charAt(0).toUpperCase() + timeStatus.slice(1);
          break;
        case 'owner':
          value = deal.owner_id || 'Unassigned';
          break;
        case 'created_date':
          if (!deal.created_at) return escapeCSVValue('');
          try {
            const dateObj = new Date(deal.created_at);
            if (isNaN(dateObj.getTime())) {
              console.warn(`Invalid created date for deal ${deal.id}: ${deal.created_at}`);
              return escapeCSVValue('');
            }
            return escapeCSVValue(format(dateObj, 'yyyy-MM-dd HH:mm'));
          } catch (error) {
            console.warn(`Error parsing created date for deal ${deal.id}:`, error);
            return escapeCSVValue('');
          }
        case 'close_date':
          if (!deal.close_date) return escapeCSVValue('');
          try {
            const dateObj = new Date(deal.close_date);
            if (isNaN(dateObj.getTime())) {
              console.warn(`Invalid close date for deal ${deal.id}: ${deal.close_date}`);
              return escapeCSVValue('');
            }
            return escapeCSVValue(format(dateObj, 'yyyy-MM-dd'));
          } catch (error) {
            console.warn(`Error parsing close date for deal ${deal.id}:`, error);
            return escapeCSVValue('');
          }
        case 'stage_changed_date':
          if (!deal.stage_changed_at) return escapeCSVValue('');
          try {
            const dateObj = new Date(deal.stage_changed_at);
            if (isNaN(dateObj.getTime())) {
              console.warn(`Invalid stage changed date for deal ${deal.id}: ${deal.stage_changed_at}`);
              return escapeCSVValue('');
            }
            return escapeCSVValue(format(dateObj, 'yyyy-MM-dd HH:mm'));
          } catch (error) {
            console.warn(`Error parsing stage changed date for deal ${deal.id}:`, error);
            return escapeCSVValue('');
          }
        case 'one_off_revenue':
          if (!deal.one_off_revenue) return escapeCSVValue('');
          try {
            const numericValue = Number(deal.one_off_revenue);
            if (isNaN(numericValue)) return escapeCSVValue('');
            return escapeCSVValue(`£${numericValue.toLocaleString()}`);
          } catch (error) {
            console.warn(`Error formatting one-off revenue for deal ${deal.id}`, error);
            return escapeCSVValue('');
          }
        case 'monthly_mrr':
          if (!deal.monthly_mrr) return escapeCSVValue('');
          try {
            const numericValue = Number(deal.monthly_mrr);
            if (isNaN(numericValue)) return escapeCSVValue('');
            return escapeCSVValue(`£${numericValue.toLocaleString()}`);
          } catch (error) {
            console.warn(`Error formatting monthly MRR for deal ${deal.id}`, error);
            return escapeCSVValue('');
          }
        case 'annual_value':
          if (!deal.annual_value) return escapeCSVValue('');
          try {
            const numericValue = Number(deal.annual_value);
            if (isNaN(numericValue)) return escapeCSVValue('');
            return escapeCSVValue(`£${numericValue.toLocaleString()}`);
          } catch (error) {
            console.warn(`Error formatting annual value for deal ${deal.id}`, error);
            return escapeCSVValue('');
          }
        case 'company_size':
          value = deal.companies?.size || '';
          break;
        case 'company_industry':
          value = deal.companies?.industry || '';
          break;
        case 'notes':
          value = deal.notes || '';
          break;
        case 'status':
          const status = deal.status || 'active';
          value = status.charAt(0).toUpperCase() + status.slice(1);
          break;
        default:
          value = '';
      }
      
      return escapeCSVValue(value);
    });
  });

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...csvRows.map(row => row.join(','))
  ].join('\n');

  // Create and download the file
  try {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      throw new Error('File download not supported in this browser');
    }
  } catch (error) {
    console.error('Error downloading pipeline CSV file:', error);
    alert('Failed to download pipeline CSV file. Please try again or contact support if the problem persists.');
    throw error; // Re-throw to allow calling code to handle if needed
  }
};

/**
 * Get a summary of the pipeline data being exported
 */
export const getPipelineExportSummary = (deals: DealWithRelationships[], stages: DealStage[]) => {
  const summary = {
    totalDeals: deals.length,
    totalValue: 0,
    totalWeightedValue: 0,
    stageBreakdown: {} as Record<string, { count: number; value: number; weightedValue: number }>,
    averageDealSize: 0,
    averageTimeInStage: 0,
    owners: new Set<string>(),
    companies: new Set<string>(),
    dateRange: {
      start: null as Date | null,
      end: null as Date | null
    }
  };

  deals.forEach(deal => {
    const dealValue = Number(deal.value || 0);
    const stage = stages.find(s => s.id === deal.stage_id);
    const probability = deal.probability || stage?.default_probability || 0;
    const weightedValue = dealValue * (probability / 100);
    
    // Accumulate totals
    summary.totalValue += dealValue;
    summary.totalWeightedValue += weightedValue;
    
    // Track stage breakdown
    const stageName = stage?.name || 'Unknown Stage';
    if (!summary.stageBreakdown[stageName]) {
      summary.stageBreakdown[stageName] = { count: 0, value: 0, weightedValue: 0 };
    }
    summary.stageBreakdown[stageName].count++;
    summary.stageBreakdown[stageName].value += dealValue;
    summary.stageBreakdown[stageName].weightedValue += weightedValue;
    
    // Track unique owners and companies
    if (deal.owner_id) summary.owners.add(deal.owner_id);
    const companyName = deal.companies?.name || deal.company;
    if (companyName) summary.companies.add(companyName);
    
    // Track date range
    if (deal.created_at) {
      try {
        const createdDate = new Date(deal.created_at);
        if (!isNaN(createdDate.getTime())) {
          if (!summary.dateRange.start || createdDate < summary.dateRange.start) {
            summary.dateRange.start = createdDate;
          }
          if (!summary.dateRange.end || createdDate > summary.dateRange.end) {
            summary.dateRange.end = createdDate;
          }
        }
      } catch (error) {
        console.warn(`Error parsing date for pipeline summary: ${deal.created_at} (Deal ID: ${deal.id})`, error);
      }
    }
  });

  // Calculate averages
  if (deals.length > 0) {
    summary.averageDealSize = summary.totalValue / deals.length;
    const totalDaysInStage = deals.reduce((sum, deal) => sum + (deal.daysInStage || 0), 0);
    summary.averageTimeInStage = totalDaysInStage / deals.length;
  }

  return {
    ...summary,
    owners: Array.from(summary.owners),
    companies: Array.from(summary.companies)
  };
};