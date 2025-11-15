import { FullConfig } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { promises as fs } from 'fs';

/**
 * Global teardown for Foreign Key Constraint Fix E2E tests
 * Cleans up test environment and generates final reports
 */
async function globalTeardown(config: FullConfig) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
  
  try {
    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Clean up all test data
    // Delete test activities
    const { data: deletedActivities } = await supabase
      .from('activities')
      .delete()
      .or('details.like.%E2E Test%,details.like.%Rapid Test%,details.like.%Race Test%,details.like.%Network Test%,details.like.%Refresh Test%,details.like.%Integrity Test%')
      .select('id');
    // Delete test deals
    const { data: deletedDeals } = await supabase
      .from('deals')
      .delete()
      .or('name.like.%E2E Test%,name.like.%Rapid Test%,name.like.%Race Test%,name.like.%Network Test%,name.like.%Refresh Test%,name.like.%Integrity Test%,name.like.%Post Refresh%')
      .select('id');
    // Delete test contacts
    const { data: deletedContacts } = await supabase
      .from('contacts')
      .delete()
      .or('email.like.%@e2e-%,email.like.%test@%,email.like.%rapid%,email.like.%race%,email.like.%network%,email.like.%refresh%,email.like.%integrity%,email.like.%postrefresh%')
      .select('id');
    // Delete test companies (optional, might have foreign key dependencies)
    try {
      const { data: deletedCompanies } = await supabase
        .from('companies')
        .delete()
        .like('name', '%E2E Test%')
        .select('id');
    } catch (error) {
    }
    
    // Clean up authentication state file
    try {
      await fs.unlink('tests/e2e/auth-state.json');
    } catch (error) {
      // File may not exist, which is fine
    }
    
    // Generate cleanup report
    const cleanupReport = {
      timestamp: new Date().toISOString(),
      deletedRecords: {
        activities: deletedActivities?.length || 0,
        deals: deletedDeals?.length || 0,
        contacts: deletedContacts?.length || 0,
      },
      status: 'success'
    };
    
    await fs.writeFile(
      'test-cleanup-report.json',
      JSON.stringify(cleanupReport, null, 2)
    );
    // Verify database state
    const { data: remainingTestData } = await supabase
      .from('deals')
      .select('count')
      .or('name.like.%E2E Test%,name.like.%Test%')
      .limit(1);
    
    if (remainingTestData && remainingTestData.length > 0) {
    } else {
    }
    
    // Check for any foreign key constraint violations during cleanup
    // This query will help identify any orphaned activities
    const { data: orphanedActivities, error: orphanError } = await supabase
      .from('activities')
      .select('id, deal_id')
      .not('deal_id', 'is', null);
    
    if (orphanError) {
    } else if (orphanedActivities) {
      // Check if these activities have valid deal references
      for (const activity of orphanedActivities.slice(0, 5)) { // Check first 5
        const { data: dealExists } = await supabase
          .from('deals')
          .select('id')
          .eq('id', activity.deal_id)
          .single();
        
        if (!dealExists) {
        }
      }
    }
  } catch (error) {
    // Create error report
    const errorReport = {
      timestamp: new Date().toISOString(),
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      status: 'failed'
    };
    
    try {
      await fs.writeFile(
        'test-cleanup-error.json',
        JSON.stringify(errorReport, null, 2)
      );
    } catch (reportError) {
    }
    
    // Don't throw the error - we don't want to fail the entire test suite
    // just because cleanup had issues
  }
}

export default globalTeardown;