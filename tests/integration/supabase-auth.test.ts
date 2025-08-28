import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../../src/lib/database.types';

// Integration tests for Supabase authentication and RLS policies
describe('Supabase Authentication Integration', () => {
  let supabase: SupabaseClient<Database>;
  let testUser: any;

  beforeAll(async () => {
    // Initialize Supabase client for testing
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase environment variables not configured for testing');
    }

    supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
  });

  beforeEach(async () => {
    // Sign out any existing user
    await supabase.auth.signOut();
  });

  afterAll(async () => {
    // Cleanup
    if (testUser) {
      await supabase.auth.signOut();
    }
  });

  it('should handle authentication flow correctly', async () => {
    // This test requires test user credentials to be set up
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;

    if (!testEmail || !testPassword) {
      console.warn('Test user credentials not configured, skipping auth test');
      return;
    }

    // Test sign in
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });

    expect(signInError).toBeNull();
    expect(signInData.user).toBeTruthy();
    expect(signInData.session).toBeTruthy();

    testUser = signInData.user;

    // Test session retrieval
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    expect(sessionError).toBeNull();
    expect(sessionData.session).toBeTruthy();
    expect(sessionData.session?.user.id).toBe(testUser.id);
  });

  it('should enforce RLS policies for contacts', async () => {
    // Test without authentication - should fail
    const { data: unauthorizedData, error: unauthorizedError } = await supabase
      .from('contacts')
      .select('*')
      .limit(1);

    // Should either return empty array or throw auth error
    expect(unauthorizedData).toEqual([]);

    // Test contact creation without auth - should fail
    const { data: createData, error: createError } = await supabase
      .from('contacts')
      .insert({
        first_name: 'Test',
        last_name: 'User',
        email: 'test@example.com'
      });

    expect(createError).toBeTruthy();
    expect(createError?.code).toBe('42501'); // Insufficient privilege error code
  });

  it('should allow contact operations when authenticated', async () => {
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;

    if (!testEmail || !testPassword) {
      console.warn('Test user credentials not configured, skipping authenticated contact test');
      return;
    }

    // Sign in first
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });

    if (signInError) {
      console.warn('Could not sign in test user, skipping authenticated test');
      return;
    }

    // Now test contact operations
    const { data: contactsData, error: contactsError } = await supabase
      .from('contacts')
      .select('*')
      .limit(5);

    expect(contactsError).toBeNull();
    expect(Array.isArray(contactsData)).toBe(true);

    // Test contact creation (with cleanup)
    const testContactEmail = `test-${Date.now()}@example.com`;
    const { data: createData, error: createError } = await supabase
      .from('contacts')
      .insert({
        first_name: 'Integration',
        last_name: 'Test',
        email: testContactEmail
      })
      .select()
      .single();

    expect(createError).toBeNull();
    expect(createData).toBeTruthy();
    expect(createData.email).toBe(testContactEmail);

    // Cleanup - delete test contact
    if (createData?.id) {
      await supabase
        .from('contacts')
        .delete()
        .eq('id', createData.id);
    }
  });

  it('should enforce RLS policies for deals', async () => {
    // Test without authentication
    const { data: unauthorizedDeals, error: unauthorizedError } = await supabase
      .from('deals')
      .select('*')
      .limit(1);

    expect(unauthorizedDeals).toEqual([]);

    // Test deal creation without auth
    const { data: createData, error: createError } = await supabase
      .from('deals')
      .insert({
        name: 'Test Deal',
        company: 'Test Company',
        value: 1000,
        stage_id: 'test-stage-id'
      });

    expect(createError).toBeTruthy();
    expect(createError?.code).toBe('42501');
  });

  it('should handle session refresh', async () => {
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;

    if (!testEmail || !testPassword) {
      console.warn('Test user credentials not configured, skipping refresh test');
      return;
    }

    // Sign in
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });

    if (signInError) {
      console.warn('Could not sign in for refresh test');
      return;
    }

    // Test refresh session
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

    expect(refreshError).toBeNull();
    expect(refreshData.session).toBeTruthy();
    expect(refreshData.user).toBeTruthy();
  });

  it('should handle sign out correctly', async () => {
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;

    if (!testEmail || !testPassword) {
      console.warn('Test user credentials not configured, skipping signout test');
      return;
    }

    // Sign in first
    await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });

    // Verify signed in
    let { data: sessionData } = await supabase.auth.getSession();
    expect(sessionData.session).toBeTruthy();

    // Sign out
    const { error: signOutError } = await supabase.auth.signOut();
    expect(signOutError).toBeNull();

    // Verify signed out
    ({ data: sessionData } = await supabase.auth.getSession());
    expect(sessionData.session).toBeNull();
  });

  it('should handle invalid credentials gracefully', async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'invalid@example.com',
      password: 'wrongpassword'
    });

    expect(error).toBeTruthy();
    expect(error?.message).toContain('Invalid login credentials');
    expect(data.user).toBeNull();
    expect(data.session).toBeNull();
  });

  it('should validate email format', async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'invalid-email',
      password: 'somepassword'
    });

    expect(error).toBeTruthy();
    expect(data.user).toBeNull();
  });
});