import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '@/lib/config';
import logger from '@/lib/utils/logger';

export interface ContactWithFilters {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string;
  phone: string | null;
  title: string | null;
  linkedin_url: string | null;
  is_primary: boolean;
  company_id: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
  // Company relationship
  company?: {
    id: string;
    name: string;
    domain: string;
    size: string;
    industry: string;
    website: string;
  } | null;
}

export function useContactsWithFilters(options?: {
  search?: string;
  companyId?: string;
  ownerId?: string;
  includeCompany?: boolean;
  limit?: number;
}) {
  const [contacts, setContacts] = useState<ContactWithFilters[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchContacts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      
      if (options?.search) params.append('search', options.search);
      if (options?.companyId) params.append('companyId', options.companyId);
      if (options?.ownerId) params.append('ownerId', options.ownerId);
      if (options?.includeCompany) params.append('includeCompany', 'true');
      if (options?.limit) params.append('limit', options.limit.toString());

      const response = await fetch(`${API_BASE_URL}/contacts?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      setContacts(result.data || []);
    } catch (err) {
      logger.error('Error fetching contacts:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch contacts'));
    } finally {
      setIsLoading(false);
    }
  }, [options?.search, options?.companyId, options?.ownerId, options?.includeCompany, options?.limit]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  return {
    contacts,
    isLoading,
    error,
    refetch: fetchContacts
  };
} 