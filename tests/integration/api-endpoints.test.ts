import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../../src/lib/database.types';

// Integration tests for API endpoints and database operations
describe('API Endpoints Integration', () => {
  let supabase: SupabaseClient<Database>;
  let authToken: string | undefined;

  beforeAll(async () => {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase environment variables not configured for testing');
    }

    supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

    // Authenticate for tests that require it
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;

    if (testEmail && testPassword) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword
      });

      if (!error && data.session) {
        authToken = data.session.access_token;
      }
    }
  });

  beforeEach(async () => {
    // Ensure we're authenticated for each test
    if (!authToken) {
      console.warn('No auth token available, some tests may be skipped');
    }
  });

  describe('Contacts API', () => {
    it('should fetch contacts without 403 errors', async () => {
      if (!authToken) {
        console.warn('Skipping authenticated test - no auth token');
        return;
      }

      const { data, error } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email, company')
        .limit(10);

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should create contact successfully', async () => {
      if (!authToken) {
        console.warn('Skipping authenticated test - no auth token');
        return;
      }

      const testEmail = `integration-test-${Date.now()}@example.com`;
      const { data, error } = await supabase
        .from('contacts')
        .insert({
          first_name: 'Integration',
          last_name: 'Test',
          email: testEmail,
          company: 'Test Company'
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(data.email).toBe(testEmail);

      // Cleanup
      if (data?.id) {
        await supabase
          .from('contacts')
          .delete()
          .eq('id', data.id);
      }
    });

    it('should enforce unique email constraint', async () => {
      if (!authToken) {
        console.warn('Skipping authenticated test - no auth token');
        return;
      }

      const testEmail = `duplicate-test-${Date.now()}@example.com`;

      // Create first contact
      const { data: firstContact, error: firstError } = await supabase
        .from('contacts')
        .insert({
          first_name: 'First',
          last_name: 'Contact',
          email: testEmail
        })
        .select()
        .single();

      expect(firstError).toBeNull();

      // Try to create duplicate
      const { data: duplicateContact, error: duplicateError } = await supabase
        .from('contacts')
        .insert({
          first_name: 'Duplicate',
          last_name: 'Contact',
          email: testEmail
        });

      expect(duplicateError).toBeTruthy();
      expect(duplicateError?.code).toBe('23505'); // Unique violation error code

      // Cleanup
      if (firstContact?.id) {
        await supabase
          .from('contacts')
          .delete()
          .eq('id', firstContact.id);
      }
    });

    it('should validate required fields', async () => {
      if (!authToken) {
        console.warn('Skipping authenticated test - no auth token');
        return;
      }

      // Try to create contact without required email
      const { data, error } = await supabase
        .from('contacts')
        .insert({
          first_name: 'No Email',
          last_name: 'Test'
          // email is missing
        });

      expect(error).toBeTruthy();
      expect(error?.code).toBe('23502'); // Not null violation
    });
  });

  describe('Activities API', () => {
    it('should create outbound activity successfully', async () => {
      if (!authToken) {
        console.warn('Skipping authenticated test - no auth token');
        return;
      }

      const { data, error } = await supabase
        .from('activities')
        .insert({
          type: 'outbound',
          client_name: 'Test Client',
          details: 'Test outbound call',
          quantity: 1,
          date: new Date().toISOString()
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(data.type).toBe('outbound');

      // Cleanup
      if (data?.id) {
        await supabase
          .from('activities')
          .delete()
          .eq('id', data.id);
      }
    });

    it('should create meeting activity with contact link', async () => {
      if (!authToken) {
        console.warn('Skipping authenticated test - no auth token');
        return;
      }

      // First create a test contact
      const testEmail = `meeting-contact-${Date.now()}@example.com`;
      const { data: contact } = await supabase
        .from('contacts')
        .insert({
          first_name: 'Meeting',
          last_name: 'Contact',
          email: testEmail
        })
        .select()
        .single();

      if (!contact) return;

      // Create meeting activity
      const { data: activity, error } = await supabase
        .from('activities')
        .insert({
          type: 'meeting',
          client_name: 'Meeting Company',
          details: 'Discovery meeting',
          date: new Date().toISOString(),
          contact_email: testEmail,
          contact_name: 'Meeting Contact'
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(activity).toBeTruthy();
      expect(activity.type).toBe('meeting');
      expect(activity.contact_email).toBe(testEmail);

      // Cleanup
      if (activity?.id) {
        await supabase
          .from('activities')
          .delete()
          .eq('id', activity.id);
      }
      
      if (contact?.id) {
        await supabase
          .from('contacts')
          .delete()
          .eq('id', contact.id);
      }
    });
  });

  describe('Deals API', () => {
    it('should create deal with proper stage assignment', async () => {
      if (!authToken) {
        console.warn('Skipping authenticated test - no auth token');
        return;
      }

      // Get a valid stage ID
      const { data: stages } = await supabase
        .from('deal_stages')
        .select('id')
        .limit(1)
        .single();

      if (!stages) {
        console.warn('No deal stages found, skipping deal creation test');
        return;
      }

      const { data, error } = await supabase
        .from('deals')
        .insert({
          name: 'Integration Test Deal',
          company: 'Test Company',
          value: 50000,
          stage_id: stages.id,
          probability: 25,
          status: 'active'
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(data.name).toBe('Integration Test Deal');

      // Cleanup
      if (data?.id) {
        await supabase
          .from('deals')
          .delete()
          .eq('id', data.id);
      }
    });

    it('should enforce foreign key constraints for deals', async () => {
      if (!authToken) {
        console.warn('Skipping authenticated test - no auth token');
        return;
      }

      // Try to create deal with invalid stage_id
      const { data, error } = await supabase
        .from('deals')
        .insert({
          name: 'Invalid Stage Deal',
          company: 'Test Company',
          value: 10000,
          stage_id: 'invalid-stage-id',
          status: 'active'
        });

      expect(error).toBeTruthy();
      expect(error?.code).toBe('23503'); // Foreign key violation
    });
  });

  describe('Tasks API', () => {
    it('should create task successfully', async () => {
      if (!authToken) {
        console.warn('Skipping authenticated test - no auth token');
        return;
      }

      const { data, error } = await supabase
        .from('tasks')
        .insert({
          title: 'Integration Test Task',
          description: 'This is a test task',
          task_type: 'call',
          priority: 'medium',
          status: 'pending',
          due_date: new Date(Date.now() + 86400000).toISOString() // Tomorrow
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(data.title).toBe('Integration Test Task');

      // Cleanup
      if (data?.id) {
        await supabase
          .from('tasks')
          .delete()
          .eq('id', data.id);
      }
    });

    it('should validate task priority enum', async () => {
      if (!authToken) {
        console.warn('Skipping authenticated test - no auth token');
        return;
      }

      const { data, error } = await supabase
        .from('tasks')
        .insert({
          title: 'Invalid Priority Task',
          task_type: 'call',
          priority: 'invalid_priority', // Invalid enum value
          status: 'pending'
        });

      expect(error).toBeTruthy();
      expect(error?.code).toBe('22P02'); // Invalid input syntax
    });
  });

  describe('Sales API', () => {
    it('should create sale with proper validation', async () => {
      if (!authToken) {
        console.warn('Skipping authenticated test - no auth token');
        return;
      }

      const { data, error } = await supabase
        .from('sales')
        .insert({
          client_name: 'Sale Test Client',
          amount: 25000,
          sale_type: 'one-off',
          date: new Date().toISOString(),
          details: 'Integration test sale'
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(data.amount).toBe(25000);

      // Cleanup
      if (data?.id) {
        await supabase
          .from('sales')
          .delete()
          .eq('id', data.id);
      }
    });
  });

  describe('Database Performance', () => {
    it('should complete queries within reasonable time', async () => {
      if (!authToken) {
        console.warn('Skipping authenticated test - no auth token');
        return;
      }

      const startTime = Date.now();
      
      const { data, error } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email')
        .limit(50);

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(error).toBeNull();
      expect(queryTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(Array.isArray(data)).toBe(true);
    });

    it('should handle concurrent requests', async () => {
      if (!authToken) {
        console.warn('Skipping authenticated test - no auth token');
        return;
      }

      const queries = [
        supabase.from('contacts').select('id').limit(10),
        supabase.from('activities').select('id').limit(10),
        supabase.from('deals').select('id').limit(10),
        supabase.from('tasks').select('id').limit(10)
      ];

      const results = await Promise.all(queries);

      results.forEach(({ error }) => {
        expect(error).toBeNull();
      });
    });
  });
});