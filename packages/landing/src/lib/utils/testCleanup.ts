/**
 * Test Data Cleanup Utilities
 * Provides comprehensive cleanup of test data from the database
 */

import { supabase } from '@/lib/supabase/clientV2';
import logger from '@/lib/utils/logger';

export interface CleanupResult {
  success: boolean;
  deletedCounts: Record<string, number>;
  errors: Array<{ table: string; error: string }>;
}

/**
 * Clean up all test data from the database
 * Removes any data that appears to be from testing
 */
export async function cleanupAllTestData(): Promise<CleanupResult> {
  const result: CleanupResult = {
    success: true,
    deletedCounts: {},
    errors: []
  };

  try {
    // Define test data patterns
    const testPatterns = {
      names: ['%test%', '%func%', '%temp%', '%demo%'],
      emails: ['%test%@%', '%func%@%', '%temp%@%', '%demo%@%'],
      companies: ['%test%', '%func%', '%temp%', '%demo%'],
      websites: ['%test%', '%func%', '%temp%', '%demo%']
    };

    // Clean up contacts
    try {
      const { data: contactsToDelete } = await supabase
        .from('contacts')
        .select('id')
        .or(`
          first_name.ilike.${testPatterns.names.join(',first_name.ilike.')},
          last_name.ilike.${testPatterns.names.join(',last_name.ilike.')},
          email.ilike.${testPatterns.emails.join(',email.ilike.')},
          title.ilike.${testPatterns.names.join(',title.ilike.')},
          company.ilike.${testPatterns.companies.join(',company.ilike.')},
          company_website.ilike.${testPatterns.websites.join(',company_website.ilike.')}
        `);

      if (contactsToDelete && contactsToDelete.length > 0) {
        const contactIds = contactsToDelete.map(c => c.id);
        const { error: deleteError } = await supabase
          .from('contacts')
          .delete()
          .in('id', contactIds);

        if (deleteError) {
          result.errors.push({ table: 'contacts', error: deleteError.message });
          result.success = false;
        } else {
          result.deletedCounts.contacts = contactIds.length;
          logger.log(`🧹 Deleted ${contactIds.length} test contacts`);
        }
      } else {
        result.deletedCounts.contacts = 0;
      }
    } catch (error) {
      result.errors.push({ table: 'contacts', error: (error as Error).message });
      result.success = false;
    }

    // Clean up companies
    try {
      const { data: companiesToDelete } = await supabase
        .from('companies')
        .select('id')
        .or(`
          name.ilike.${testPatterns.companies.join(',name.ilike.')},
          website.ilike.${testPatterns.websites.join(',website.ilike.')},
          description.ilike.${testPatterns.names.join(',description.ilike.')},
          industry.ilike.${testPatterns.names.join(',industry.ilike.')}
        `);

      if (companiesToDelete && companiesToDelete.length > 0) {
        const companyIds = companiesToDelete.map(c => c.id);
        const { error: deleteError } = await supabase
          .from('companies')
          .delete()
          .in('id', companyIds);

        if (deleteError) {
          result.errors.push({ table: 'companies', error: deleteError.message });
          result.success = false;
        } else {
          result.deletedCounts.companies = companyIds.length;
          logger.log(`🧹 Deleted ${companyIds.length} test companies`);
        }
      } else {
        result.deletedCounts.companies = 0;
      }
    } catch (error) {
      result.errors.push({ table: 'companies', error: (error as Error).message });
      result.success = false;
    }

    // Clean up deals
    try {
      const { data: dealsToDelete } = await supabase
        .from('deals')
        .select('id')
        .or(`
          client_name.ilike.${testPatterns.names.join(',client_name.ilike.')},
          description.ilike.${testPatterns.names.join(',description.ilike.')},
          notes.ilike.${testPatterns.names.join(',notes.ilike.')}
        `);

      if (dealsToDelete && dealsToDelete.length > 0) {
        const dealIds = dealsToDelete.map(d => d.id);
        const { error: deleteError } = await supabase
          .from('deals')
          .delete()
          .in('id', dealIds);

        if (deleteError) {
          result.errors.push({ table: 'deals', error: deleteError.message });
          result.success = false;
        } else {
          result.deletedCounts.deals = dealIds.length;
          logger.log(`🧹 Deleted ${dealIds.length} test deals`);
        }
      } else {
        result.deletedCounts.deals = 0;
      }
    } catch (error) {
      result.errors.push({ table: 'deals', error: (error as Error).message });
      result.success = false;
    }

    // Clean up tasks
    try {
      const { data: tasksToDelete } = await supabase
        .from('tasks')
        .select('id')
        .or(`
          title.ilike.${testPatterns.names.join(',title.ilike.')},
          description.ilike.${testPatterns.names.join(',description.ilike.')},
          client_name.ilike.${testPatterns.names.join(',client_name.ilike.')}
        `);

      if (tasksToDelete && tasksToDelete.length > 0) {
        const taskIds = tasksToDelete.map(t => t.id);
        const { error: deleteError } = await supabase
          .from('tasks')
          .delete()
          .in('id', taskIds);

        if (deleteError) {
          result.errors.push({ table: 'tasks', error: deleteError.message });
          result.success = false;
        } else {
          result.deletedCounts.tasks = taskIds.length;
          logger.log(`🧹 Deleted ${taskIds.length} test tasks`);
        }
      } else {
        result.deletedCounts.tasks = 0;
      }
    } catch (error) {
      result.errors.push({ table: 'tasks', error: (error as Error).message });
      result.success = false;
    }

    // Clean up activities
    try {
      const { data: activitiesToDelete } = await supabase
        .from('activities')
        .select('id')
        .or(`
          type.ilike.${testPatterns.names.join(',type.ilike.')},
          client_name.ilike.${testPatterns.names.join(',client_name.ilike.')},
          notes.ilike.${testPatterns.names.join(',notes.ilike.')},
          outcome.ilike.${testPatterns.names.join(',outcome.ilike.')}
        `);

      if (activitiesToDelete && activitiesToDelete.length > 0) {
        const activityIds = activitiesToDelete.map(a => a.id);
        const { error: deleteError } = await supabase
          .from('activities')
          .delete()
          .in('id', activityIds);

        if (deleteError) {
          result.errors.push({ table: 'activities', error: deleteError.message });
          result.success = false;
        } else {
          result.deletedCounts.activities = activityIds.length;
          logger.log(`🧹 Deleted ${activityIds.length} test activities`);
        }
      } else {
        result.deletedCounts.activities = 0;
      }
    } catch (error) {
      result.errors.push({ table: 'activities', error: (error as Error).message });
      result.success = false;
    }

    // Log final results
    const totalDeleted = Object.values(result.deletedCounts).reduce((sum, count) => sum + count, 0);
    logger.log(`🧹 Test cleanup complete: ${totalDeleted} total items deleted`, result.deletedCounts);

    if (result.errors.length > 0) {
      logger.error('Test cleanup had errors:', result.errors);
      result.success = false;
    }

    return result;

  } catch (error) {
    logger.error('Critical error during test cleanup:', error);
    result.success = false;
    result.errors.push({ table: 'general', error: (error as Error).message });
    return result;
  }
}

/**
 * Clean up specific test data by IDs
 */
export async function cleanupTestDataByIds(dataMap: Record<string, string[]>): Promise<CleanupResult> {
  const result: CleanupResult = {
    success: true,
    deletedCounts: {},
    errors: []
  };

  // Map singular keys to correct plural table names
  const tableNameMap: Record<string, string> = {
    'contact': 'contacts',
    'company': 'companies',
    'deal': 'deals',
    'task': 'tasks',
    'activity': 'activities'
  };

  try {
    for (const [rawTableName, ids] of Object.entries(dataMap)) {
      if (ids.length === 0) continue;

      // Get the correct table name (handle both singular and plural forms)
      const tableName = tableNameMap[rawTableName] || rawTableName;

      try {
        const { error } = await supabase
          .from(tableName)
          .delete()
          .in('id', ids);

        if (error) {
          // Handle the case where records were already deleted (404 equivalent)
          if (error.message.includes('not found') || error.message.includes('0 rows')) {
            result.deletedCounts[rawTableName] = 0;
            logger.log(`🧹 No ${rawTableName} records to delete (already cleaned)`);
          } else {
            result.errors.push({ table: rawTableName, error: error.message });
            result.success = false;
          }
        } else {
          result.deletedCounts[rawTableName] = ids.length;
          logger.log(`🧹 Cleaned up ${ids.length} ${rawTableName} by IDs`);
        }
      } catch (error) {
        const errorMessage = (error as Error).message;
        // Handle network errors or 404s more gracefully
        if (errorMessage.includes('404') || errorMessage.includes('not found')) {
          result.deletedCounts[rawTableName] = 0;
          logger.log(`🧹 No ${rawTableName} records found (already cleaned)`);
        } else {
          result.errors.push({ table: rawTableName, error: errorMessage });
          result.success = false;
        }
      }
    }

    return result;
  } catch (error) {
    logger.error('Critical error during ID-based cleanup:', error);
    result.success = false;
    result.errors.push({ table: 'general', error: (error as Error).message });
    return result;
  }
}

/**
 * Get count of potential test data
 */
export async function getTestDataCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};

  try {
    const testPatterns = {
      names: ['%test%', '%func%', '%temp%', '%demo%'],
      emails: ['%test%@%', '%func%@%', '%temp%@%', '%demo%@%']
    };

    // Count test contacts
    const { count: contactCount } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .or(`
        first_name.ilike.${testPatterns.names.join(',first_name.ilike.')},
        last_name.ilike.${testPatterns.names.join(',last_name.ilike.')},
        email.ilike.${testPatterns.emails.join(',email.ilike.')}
      `);

    counts.contacts = contactCount || 0;

    // Count test companies  
    const { count: companyCount } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true })
      .or(`name.ilike.${testPatterns.names.join(',name.ilike.')}`);

    counts.companies = companyCount || 0;

    // Count test deals
    const { count: dealCount } = await supabase
      .from('deals')
      .select('*', { count: 'exact', head: true })
      .or(`client_name.ilike.${testPatterns.names.join(',client_name.ilike.')}`);

    counts.deals = dealCount || 0;

    // Count test tasks
    const { count: taskCount } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .or(`title.ilike.${testPatterns.names.join(',title.ilike.')}`);

    counts.tasks = taskCount || 0;

    // Count test activities
    const { count: activityCount } = await supabase
      .from('activities')
      .select('*', { count: 'exact', head: true })
      .or(`client_name.ilike.${testPatterns.names.join(',client_name.ilike.')}`);

    counts.activities = activityCount || 0;

  } catch (error) {
    logger.error('Error getting test data counts:', error);
  }

  return counts;
}