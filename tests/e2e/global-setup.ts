import { chromium, FullConfig } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

/**
 * Global setup for Foreign Key Constraint Fix E2E tests
 * Prepares test environment and database state
 */
async function globalSetup(config: FullConfig) {
  console.log('🚀 Setting up E2E test environment for Foreign Key Constraint Fix tests...');
  
  // Environment variables
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
  
  if (!supabaseKey) {
    console.warn('⚠️  Warning: VITE_SUPABASE_ANON_KEY not set. Database operations may fail.');
  }
  
  try {
    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Clean up any existing test data
    console.log('🧹 Cleaning up existing test data...');
    
    await supabase
      .from('activities')
      .delete()
      .like('details', '%E2E Test%');
    
    await supabase
      .from('deals')
      .delete()
      .like('name', '%E2E Test%');
    
    await supabase
      .from('contacts')
      .delete()
      .like('email', '%@e2e-%');
    
    // Verify database connectivity
    const { data, error } = await supabase.from('deals').select('count').limit(1);
    
    if (error) {
      console.error('❌ Database connectivity test failed:', error);
      throw new Error(`Database setup failed: ${error.message}`);
    }
    
    console.log('✅ Database connectivity verified');
    
    // Create test user session if needed
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Set up authentication state
    await page.goto(config.webServer?.url || 'http://localhost:5173');
    
    // Mock authentication for tests
    await page.evaluate(() => {
      const mockUser = {
        id: 'e2e-test-user-id',
        email: 'e2e-test@example.com',
        user_metadata: {
          full_name: 'E2E Test User'
        }
      };
      
      // Set up mock authentication
      localStorage.setItem('sb-localhost-auth-token', JSON.stringify({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        user: mockUser,
        expires_at: Date.now() + 3600000 // 1 hour
      }));
      
      // Set user session
      sessionStorage.setItem('e2e-test-user', JSON.stringify(mockUser));
    });
    
    // Save authentication state
    await context.storageState({ path: 'tests/e2e/auth-state.json' });
    
    await browser.close();
    
    console.log('✅ Test authentication state created');
    
    // Create test data fixtures
    console.log('📝 Creating test data fixtures...');
    
    // Create a test company
    const { data: testCompany, error: companyError } = await supabase
      .from('companies')
      .insert({
        name: 'E2E Test Company Global',
        industry: 'Technology',
        size: '1-10',
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (companyError && !companyError.message.includes('duplicate')) {
      console.warn('⚠️  Warning: Could not create test company:', companyError.message);
    } else if (testCompany) {
      console.log('✅ Test company created:', testCompany.id);
    }
    
    // Create deal stages if they don't exist
    const { data: existingStages } = await supabase
      .from('deal_stages')
      .select('*')
      .limit(1);
    
    if (!existingStages || existingStages.length === 0) {
      await supabase
        .from('deal_stages')
        .insert([
          {
            name: 'Prospecting',
            order_index: 1,
            default_probability: 10,
            color: '#3B82F6'
          },
          {
            name: 'Qualified',
            order_index: 2,
            default_probability: 25,
            color: '#10B981'
          },
          {
            name: 'Proposal',
            order_index: 3,
            default_probability: 50,
            color: '#F59E0B'
          },
          {
            name: 'Negotiation',
            order_index: 4,
            default_probability: 75,
            color: '#EF4444'
          },
          {
            name: 'Closed Won',
            order_index: 5,
            default_probability: 100,
            color: '#22C55E'
          }
        ]);
      
      console.log('✅ Deal stages created');
    }
    
    console.log('🎯 E2E test environment setup complete');
    
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  }
}

export default globalSetup;