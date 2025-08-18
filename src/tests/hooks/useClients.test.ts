import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useClients, useAggregatedClients, useMRR } from '@/lib/hooks/useClients';
import { toast } from 'sonner';

// Mock dependencies
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/config', () => ({
  API_BASE_URL: 'http://localhost:3000/api',
  DISABLE_EDGE_FUNCTIONS: false,
}));

vi.mock('@/lib/utils/apiUtils', () => ({
  fetchWithRetry: vi.fn(),
  apiCall: vi.fn(),
}));

vi.mock('@/lib/supabase/clientV2', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            data: [],
            error: null,
          })),
        })),
        order: vi.fn(() => ({
          data: [],
          error: null,
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: { id: '1', company_name: 'Test Company' },
            error: null,
          })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({
              data: { id: '1', company_name: 'Updated Company' },
              error: null,
            })),
          })),
        })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          error: null,
        })),
      })),
    })),
  },
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            data: [],
            error: null,
          })),
        })),
        order: vi.fn(() => ({
          data: [],
          error: null,
        })),
      })),
    })),
  },
}));

const { supabase, supabaseAdmin } = await import('@/lib/supabase/clientV2');
const { apiCall } = await import('@/lib/utils/apiUtils');

describe('useClients Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('fetchClients', () => {
    it('should fetch clients successfully with session', async () => {
      const mockSession = { user: { id: '123' } };
      const mockClients = [
        {
          id: '1',
          company_name: 'Test Company',
          subscription_amount: '100.00',
          subscription_start_date: '2024-01-01',
          status: 'active',
        },
      ];

      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: mockSession },
      });

      (apiCall as any).mockResolvedValue(mockClients);

      const { result } = renderHook(() => useClients());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.clients).toHaveLength(1);
      expect(result.current.clients[0].company_name).toBe('Test Company');
      expect(result.current.clients[0].subscription_amount).toBe(100);
      expect(result.current.error).toBeNull();
    });

    it('should handle no session and fallback to admin client', async () => {
      const mockClients = [
        {
          id: '1',
          company_name: 'Test Company',
          subscription_amount: '50.00',
          subscription_start_date: null,
          status: 'active',
        },
      ];

      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: null },
      });

      const mockQuery = {
        eq: vi.fn(() => mockQuery),
        order: vi.fn(() => ({ data: mockClients, error: null })),
      };

      (supabaseAdmin.from as any).mockReturnValue({
        select: vi.fn(() => mockQuery),
      });

      const { result } = renderHook(() => useClients());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.clients).toHaveLength(1);
      expect(result.current.clients[0].subscription_days).toBe(0);
    });

    it('should filter by owner ID when provided', async () => {
      const ownerId = 'owner123';
      const mockSession = { user: { id: '123' } };

      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: mockSession },
      });

      (apiCall as any).mockResolvedValue([]);

      const { result } = renderHook(() => useClients(ownerId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(apiCall).toHaveBeenCalledWith(
        expect.stringContaining(`owner_id=${ownerId}`)
      );
    });

    it('should handle API errors gracefully', async () => {
      const mockSession = { user: { id: '123' } };
      const errorMessage = 'API Error';

      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: mockSession },
      });

      (apiCall as any).mockRejectedValue(new Error(errorMessage));

      // Mock fallback Supabase client to also fail
      const mockQuery = {
        eq: vi.fn(() => mockQuery),
        order: vi.fn(() => ({ data: null, error: new Error(errorMessage) })),
      };

      (supabase.from as any).mockReturnValue({
        select: vi.fn(() => mockQuery),
      });

      (supabaseAdmin.from as any).mockReturnValue({
        select: vi.fn(() => mockQuery),
      });

      const { result } = renderHook(() => useClients());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe(errorMessage);
      expect(toast.error).toHaveBeenCalledWith(errorMessage);
    });
  });

  describe('createClient', () => {
    it('should create client successfully', async () => {
      const mockClientData = {
        company_name: 'New Company',
        subscription_amount: 200,
        status: 'active' as const,
        owner_id: 'owner123',
      };

      (apiCall as any).mockResolvedValue({ id: '2', ...mockClientData });

      const { result } = renderHook(() => useClients());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const success = await result.current.createClient(mockClientData);

      expect(success).toBe(true);
      expect(toast.success).toHaveBeenCalledWith('Client created successfully');
    });

    it('should handle unique constraint errors', async () => {
      const mockClientData = {
        company_name: 'Duplicate Company',
        subscription_amount: 200,
        status: 'active' as const,
        owner_id: 'owner123',
      };

      const error = new Error('unique_deal_conversion constraint');
      (apiCall as any).mockRejectedValue(error);
      
      // Mock fallback Supabase client to also fail
      (supabase.from as any).mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({ data: null, error })),
          })),
        })),
      });

      const { result } = renderHook(() => useClients());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const success = await result.current.createClient(mockClientData);

      expect(success).toBe(false);
      expect(toast.error).toHaveBeenCalledWith('This deal has already been converted to a client');
    });
  });

  describe('updateClient', () => {
    it('should update client successfully', async () => {
      const clientId = '1';
      const updates = { company_name: 'Updated Company' };

      (apiCall as any).mockResolvedValue({ id: clientId, ...updates });

      const { result } = renderHook(() => useClients());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const success = await result.current.updateClient(clientId, updates);

      expect(success).toBe(true);
      expect(toast.success).toHaveBeenCalledWith('Client updated successfully');
    });
  });

  describe('deleteClient', () => {
    it('should delete client successfully', async () => {
      const clientId = '1';

      (apiCall as any).mockResolvedValue({});

      const { result } = renderHook(() => useClients());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const success = await result.current.deleteClient(clientId);

      expect(success).toBe(true);
      expect(toast.success).toHaveBeenCalledWith('Client deleted successfully');
    });
  });

  describe('convertDealToClient', () => {
    it('should convert deal to client successfully', async () => {
      const dealId = 'deal123';
      const params = { company_name: 'Converted Company' };

      (apiCall as any).mockResolvedValue({ id: 'client123', ...params });

      const { result } = renderHook(() => useClients());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const result_data = await result.current.convertDealToClient(dealId, params);

      expect(result_data).toBeTruthy();
      expect(toast.success).toHaveBeenCalledWith('Deal converted to subscription successfully');
    });

    it('should handle deal already converted error', async () => {
      const dealId = 'deal123';
      const error = new Error('already been converted');

      (apiCall as any).mockRejectedValue(error);

      const { result } = renderHook(() => useClients());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const result_data = await result.current.convertDealToClient(dealId);

      expect(result_data).toBeNull();
      expect(toast.error).toHaveBeenCalledWith('This deal has already been converted to a subscription');
    });
  });
});

describe('useAggregatedClients Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should aggregate client data correctly', async () => {
    const mockClients = [
      { id: '1', company_name: 'Company A', status: 'active', owner_id: 'owner1' },
    ];
    
    const mockDeals = [
      {
        id: 'deal1',
        company: 'Company A',
        one_off_revenue: 1000,
        monthly_mrr: 100,
        status: 'won',
        owner_id: 'owner1',
      },
      {
        id: 'deal2',
        company: 'Company A',
        one_off_revenue: 500,
        monthly_mrr: 50,
        status: 'won',
        owner_id: 'owner1',
      },
    ];

    const mockActivities = [
      {
        id: 'activity1',
        deal_id: 'deal1',
        sales_rep: 'John Doe',
        date: '2024-01-15',
        type: 'sale',
        status: 'completed',
      },
      {
        id: 'activity2',
        deal_id: 'deal2',
        sales_rep: 'John Doe',
        date: '2024-02-15',
        type: 'sale',
        status: 'completed',
      },
    ];

    (supabase.auth.getSession as any).mockResolvedValue({
      data: { session: { user: { id: '123' } } },
    });

    // Mock the chained query methods
    const createMockQuery = (data: any) => ({
      eq: vi.fn(() => createMockQuery(data)),
      data,
      error: null,
    });

    (supabase.from as any)
      .mockReturnValueOnce({
        select: vi.fn(() => createMockQuery(mockClients)),
      })
      .mockReturnValueOnce({
        select: vi.fn(() => createMockQuery(mockDeals)),
      })
      .mockReturnValueOnce({
        select: vi.fn(() => createMockQuery(mockActivities)),
      });

    const { result } = renderHook(() => useAggregatedClients());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.aggregatedClients).toHaveLength(1);
    const aggregatedClient = result.current.aggregatedClients[0];
    
    expect(aggregatedClient.client_name).toBe('Company A');
    expect(aggregatedClient.total_payments_count).toBe(2);
    expect(aggregatedClient.total_lifetime_value).toBe(1950); // ((100*3) + 1000) + ((50*3) + 500)
    expect(aggregatedClient.total_one_off).toBe(1500);
    expect(aggregatedClient.total_monthly_mrr).toBe(150);
    expect(aggregatedClient.active_subscriptions).toBe(2);
    expect(aggregatedClient.sales_rep).toBe('John Doe');
  });

  it('should handle no session with admin client', async () => {
    (supabase.auth.getSession as any).mockResolvedValue({
      data: { session: null },
    });

    const createMockQuery = (data: any) => ({
      eq: vi.fn(() => createMockQuery(data)),
      data,
      error: null,
    });

    (supabaseAdmin.from as any)
      .mockReturnValueOnce({
        select: vi.fn(() => createMockQuery([])),
      })
      .mockReturnValueOnce({
        select: vi.fn(() => createMockQuery([])),
      })
      .mockReturnValueOnce({
        select: vi.fn(() => createMockQuery([])),
      });

    const { result } = renderHook(() => useAggregatedClients());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.aggregatedClients).toHaveLength(0);
    expect(result.current.error).toBeNull();
  });
});

describe('useMRR Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchMRRSummary', () => {
    it('should fetch MRR summary via Edge Function', async () => {
      const mockSummary = {
        total_clients: 10,
        active_clients: 8,
        churned_clients: 2,
        paused_clients: 0,
        total_mrr: 5000,
        avg_mrr: 625,
        min_mrr: 100,
        max_mrr: 1000,
        churn_rate: 20,
        active_rate: 80,
      };

      (apiCall as any).mockResolvedValue(mockSummary);

      const { result } = renderHook(() => useMRR());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      result.current.fetchMRRSummary();

      await waitFor(() => {
        expect(result.current.mrrSummary).toEqual(mockSummary);
      });
    });

    it('should calculate MRR summary directly when Edge Functions disabled', async () => {
      // Mock DISABLE_EDGE_FUNCTIONS
      vi.doMock('@/lib/config', () => ({
        API_BASE_URL: 'http://localhost:3000/api',
        DISABLE_EDGE_FUNCTIONS: true,
      }));

      const mockClientsWithDeals = [
        {
          id: '1',
          company_name: 'Company A',
          subscription_amount: 500,
          status: 'active',
          deals: { monthly_mrr: 500 },
        },
        {
          id: '2',
          company_name: 'Company B',
          subscription_amount: 300,
          status: 'active',
          deals: { monthly_mrr: 300 },
        },
        {
          id: '3',
          company_name: 'Company C',
          subscription_amount: 200,
          status: 'churned',
          deals: { monthly_mrr: 200 },
        },
      ];

      const mockQuery = {
        eq: vi.fn(() => mockQuery),
        data: mockClientsWithDeals,
        error: null,
      };

      (supabaseAdmin.from as any).mockReturnValue({
        select: vi.fn(() => mockQuery),
      });

      const { result } = renderHook(() => useMRR());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      result.current.fetchMRRSummary();

      await waitFor(() => {
        expect(result.current.mrrSummary).toBeTruthy();
        expect(result.current.mrrSummary?.total_clients).toBe(3);
        expect(result.current.mrrSummary?.active_clients).toBe(2);
        expect(result.current.mrrSummary?.churned_clients).toBe(1);
        expect(result.current.mrrSummary?.total_mrr).toBe(800);
      });
    });

    it('should handle clients table not existing', async () => {
      vi.doMock('@/lib/config', () => ({
        API_BASE_URL: 'http://localhost:3000/api',
        DISABLE_EDGE_FUNCTIONS: true,
      }));

      const tableNotExistsError = new Error('relation "clients" does not exist');

      const mockQuery = {
        eq: vi.fn(() => mockQuery),
        data: null,
        error: tableNotExistsError,
      };

      (supabaseAdmin.from as any).mockReturnValue({
        select: vi.fn(() => mockQuery),
      });

      const { result } = renderHook(() => useMRR());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      result.current.fetchMRRSummary();

      await waitFor(() => {
        expect(result.current.mrrSummary).toEqual({
          total_clients: 0,
          active_clients: 0,
          churned_clients: 0,
          paused_clients: 0,
          total_mrr: 0,
          avg_mrr: 0,
          min_mrr: 0,
          max_mrr: 0,
          churn_rate: 0,
          active_rate: 0,
        });
      });
    });
  });

  describe('fetchMRRByOwner', () => {
    it('should fetch MRR by owner via Edge Function', async () => {
      const mockMRRByOwner = [
        {
          owner_id: 'owner1',
          owner_name: 'John Doe',
          total_clients: 5,
          active_clients: 4,
          churned_clients: 1,
          paused_clients: 0,
          total_mrr: 2000,
          avg_mrr: 500,
          churn_rate: 20,
        },
      ];

      (apiCall as any).mockResolvedValue(mockMRRByOwner);

      const { result } = renderHook(() => useMRR());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      result.current.fetchMRRByOwner();

      await waitFor(() => {
        expect(result.current.mrrByOwner).toEqual(mockMRRByOwner);
      });
    });
  });
});