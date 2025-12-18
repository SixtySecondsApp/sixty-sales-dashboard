/**
 * Auth Code Management Service
 * Handles CRUD operations for authentication codes used in signup
 */

import { supabase } from '@/lib/supabase/clientV2';

export interface AuthCode {
  id: string;
  code: string;
  description: string | null;
  is_active: boolean;
  use_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateAuthCodeData {
  code: string;
  description?: string;
  is_active?: boolean;
}

/**
 * Fetch all auth codes
 */
export async function fetchAuthCodes(): Promise<AuthCode[]> {
  try {
    const { data, error } = await supabase
      .from('waitlist_invite_codes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  } catch (err: any) {
    console.error('Error fetching auth codes:', err);
    throw new Error(err.message || 'Failed to fetch auth codes');
  }
}

/**
 * Create a new auth code
 */
export async function createAuthCode(data: CreateAuthCodeData): Promise<AuthCode> {
  try {
    const normalizedCode = data.code.trim().toUpperCase();
    
    if (!normalizedCode) {
      throw new Error('Code is required');
    }

    const { data: newCode, error } = await supabase
      .from('waitlist_invite_codes')
      .insert({
        code: normalizedCode,
        description: data.description || null,
        is_active: data.is_active !== undefined ? data.is_active : true,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return newCode;
  } catch (err: any) {
    console.error('Error creating auth code:', err);
    throw new Error(err.message || 'Failed to create auth code');
  }
}

/**
 * Update an auth code
 */
export async function updateAuthCode(
  id: string,
  updates: Partial<Pick<AuthCode, 'description' | 'is_active'>>
): Promise<AuthCode> {
  try {
    const { data: updatedCode, error } = await supabase
      .from('waitlist_invite_codes')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return updatedCode;
  } catch (err: any) {
    console.error('Error updating auth code:', err);
    throw new Error(err.message || 'Failed to update auth code');
  }
}

/**
 * Delete an auth code
 */
export async function deleteAuthCode(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('waitlist_invite_codes')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }
  } catch (err: any) {
    console.error('Error deleting auth code:', err);
    throw new Error(err.message || 'Failed to delete auth code');
  }
}

/**
 * Generate a random auth code
 */
export function generateRandomCode(length: number = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars like 0, O, I, 1
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
