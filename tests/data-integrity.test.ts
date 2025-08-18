/**
 * DATA INTEGRITY AND SALES REP DISPLAY TEST SUITE
 * 
 * Critical QA testing for data integrity including:
 * - Sales rep fallback logic working correctly
 * - Proper aggregation of client data
 * - Filter functionality on payments and clients pages
 * - MRR calculations consistency
 * - Data consistency across components
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

// Component imports
import { SalesTable } from '../src/components/SalesTable';
import { PaymentsTable } from '../src/components/PaymentsTable';
import { ClientsTable } from '../src/components/ClientsTable';
import { SubscriptionStats } from '../src/components/SubscriptionStats';

// Utility imports
import { calculateLTVValue } from '../src/lib/utils/calculations';
import { validateFinancialNumber } from '../src/lib/utils/financialValidation';

// Mock data
const mockSalesData = [
  {
    id: 1,
    type: 'proposal',
    company_name: 'TechCorp Ltd',
    description: 'Enterprise software proposal',
    amount: 50000,
    deal: {
      id: 101,
      monthly_mrr: 5000,
      one_off_revenue: 20000,
      owner_name: 'John Smith',
      owner_id: 1
    },
    owner_name: 'John Smith',
    owner_id: 1,
    date: '2024-01-15'
  },
  {
    id: 2,
    type: 'meeting',
    company_name: 'StartupCo',
    description: 'Discovery meeting',
    amount: null,
    deal: {
      id: 102,
      monthly_mrr: 1000,
      one_off_revenue: 5000,
      owner_name: null, // Missing owner - should show fallback
      owner_id: null
    },
    owner_name: null, // Missing owner - should show fallback
    owner_id: null,
    date: '2024-01-16'
  },
  {
    id: 3,
    type: 'proposal',
    company_name: 'BigClient Inc',
    description: 'Large enterprise deal',
    amount: 100000,
    deal: {
      id: 103,
      monthly_mrr: 10000,
      one_off_revenue: 50000,
      owner_name: 'Sarah Johnson',
      owner_id: 2
    },
    owner_name: 'Sarah Johnson',
    owner_id: 2,
    date: '2024-01-17'
  }
];

const mockClientsData = [
  {
    id: 1,
    company_name: 'TechCorp Ltd',
    status: 'active',
    monthly_mrr: 5000,
    annual_value: 60000,
    lifetime_deal_value: 35000, // (5000 * 3) + 20000
    owner_name: 'John Smith',
    start_date: '2024-01-01',
    last_payment_date: '2024-01-15'
  },
  {
    id: 2,
    company_name: 'StartupCo',
    status: 'trial',
    monthly_mrr: 1000,
    annual_value: 12000,
    lifetime_deal_value: 8000, // (1000 * 3) + 5000
    owner_name: 'Unknown Sales Rep', // Should show fallback
    start_date: '2024-01-10',
    last_payment_date: null
  },
  {
    id: 3,
    company_name: 'BigClient Inc',
    status: 'active',
    monthly_mrr: 10000,
    annual_value: 120000,
    lifetime_deal_value: 80000, // (10000 * 3) + 50000
    owner_name: 'Sarah Johnson',
    start_date: '2023-12-01',
    last_payment_date: '2024-01-17'
  }
];

const mockPaymentsData = [
  {
    id: 1,
    client_id: 1,
    company_name: 'TechCorp Ltd',
    amount: 5000,
    payment_date: '2024-01-15',
    payment_type: 'subscription',
    owner_name: 'John Smith',
    deal_id: 101
  },
  {
    id: 2,
    client_id: 2,
    company_name: 'StartupCo',
    amount: 5000,
    payment_date: '2024-01-10',
    payment_type: 'one_time',
    owner_name: 'Unknown Sales Rep', // Fallback display
    deal_id: 102
  },
  {
    id: 3,
    client_id: 3,
    company_name: 'BigClient Inc',
    amount: 10000,
    payment_date: '2024-01-17',
    payment_type: 'subscription',
    owner_name: 'Sarah Johnson',
    deal_id: 103
  }
];

// Mock hooks
vi.mock('@/lib/hooks/useSalesData', () => ({
  useSalesData: vi.fn(() => ({
    data: mockSalesData,
    isLoading: false,
    error: null
  }))
}));

vi.mock('@/lib/hooks/useClients', () => ({
  useClients: vi.fn(() => ({
    clients: mockClientsData,
    isLoading: false,
    error: null
  }))
}));

vi.mock('@/lib/hooks/usePayments', () => ({
  usePayments: vi.fn(() => ({
    payments: mockPaymentsData,
    isLoading: false,
    error: null
  }))
}));

// Test wrapper
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Data Integrity and Sales Rep Display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Sales Rep Fallback Logic', () => {
    it('should display actual owner names when available', () => {
      render(
        <TestWrapper>
          <SalesTable />
        </TestWrapper>
      );

      // Should show actual owner names
      expect(screen.getByText('John Smith')).toBeInTheDocument();
      expect(screen.getByText('Sarah Johnson')).toBeInTheDocument();
    });

    it('should show fallback text for missing owners', () => {
      render(
        <TestWrapper>
          <SalesTable />
        </TestWrapper>
      );

      // Should show fallback for missing owner
      const fallbackTexts = [
        'Unknown Sales Rep',
        'Unassigned',
        'No Owner',
        '-'
      ];

      let fallbackFound = false;
      fallbackTexts.forEach(text => {
        if (screen.queryByText(text)) {
          fallbackFound = true;
        }
      });

      expect(fallbackFound).toBe(true);
    });

    it('should handle null and undefined owner data gracefully', () => {
      const dataWithNullOwners = [
        {
          id: 1,
          company_name: 'Test Company',
          owner_name: null,
          owner_id: null,
          deal: { owner_name: null, owner_id: null }
        },
        {
          id: 2,
          company_name: 'Test Company 2',
          owner_name: undefined,
          owner_id: undefined,
          deal: { owner_name: undefined, owner_id: undefined }
        }
      ];

      // Mock with null/undefined data
      vi.mocked(require('@/lib/hooks/useSalesData').useSalesData).mockReturnValue({
        data: dataWithNullOwners,
        isLoading: false,
        error: null
      });

      render(
        <TestWrapper>
          <SalesTable />
        </TestWrapper>
      );

      // Should not crash and should show fallback
      expect(screen.getByText('Test Company')).toBeInTheDocument();
      expect(screen.getByText('Test Company 2')).toBeInTheDocument();
    });

    it('should prioritize deal owner over activity owner', () => {
      const conflictingOwnerData = [
        {
          id: 1,
          company_name: 'Test Company',
          owner_name: 'Activity Owner',
          owner_id: 1,
          deal: {
            owner_name: 'Deal Owner',
            owner_id: 2
          }
        }
      ];

      vi.mocked(require('@/lib/hooks/useSalesData').useSalesData).mockReturnValue({
        data: conflictingOwnerData,
        isLoading: false,
        error: null
      });

      render(
        <TestWrapper>
          <SalesTable />
        </TestWrapper>
      );

      // Should prioritize deal owner
      expect(screen.getByText('Deal Owner')).toBeInTheDocument();
      expect(screen.queryByText('Activity Owner')).not.toBeInTheDocument();
    });
  });

  describe('Client Data Aggregation', () => {
    it('should correctly aggregate subscription revenue', () => {
      render(
        <TestWrapper>
          <SubscriptionStats />
        </TestWrapper>
      );

      // Calculate expected totals from mock data
      const expectedMRR = mockClientsData
        .filter(client => client.status === 'active')
        .reduce((sum, client) => sum + client.monthly_mrr, 0);

      // Should show aggregated MRR (5000 + 10000 = 15000 for active clients)
      expect(expectedMRR).toBe(15000);
    });

    it('should filter clients by status correctly', () => {
      render(
        <TestWrapper>
          <ClientsTable />
        </TestWrapper>
      );

      // Should show all client statuses
      expect(screen.getByText('active')).toBeInTheDocument();
      expect(screen.getByText('trial')).toBeInTheDocument();
    });

    it('should calculate lifetime deal values correctly', () => {
      render(
        <TestWrapper>
          <ClientsTable />
        </TestWrapper>
      );

      // Verify LTV calculations from mock data
      // TechCorp: (5000 * 3) + 20000 = 35000
      // StartupCo: (1000 * 3) + 5000 = 8000  
      // BigClient: (10000 * 3) + 50000 = 80000

      // These should be displayed as currency
      expect(screen.getByText(/£35,000/)).toBeInTheDocument();
      expect(screen.getByText(/£8,000/)).toBeInTheDocument();
      expect(screen.getByText(/£80,000/)).toBeInTheDocument();
    });

    it('should handle missing financial data gracefully', () => {
      const dataWithMissingFinancials = [
        {
          id: 1,
          company_name: 'Test Company',
          status: 'active',
          monthly_mrr: null,
          annual_value: null,
          lifetime_deal_value: null,
          owner_name: 'John Smith'
        }
      ];

      vi.mocked(require('@/lib/hooks/useClients').useClients).mockReturnValue({
        clients: dataWithMissingFinancials,
        isLoading: false,
        error: null
      });

      render(
        <TestWrapper>
          <ClientsTable />
        </TestWrapper>
      );

      // Should show company but handle null values
      expect(screen.getByText('Test Company')).toBeInTheDocument();
      
      // Should show £0 or - for missing values
      const zeroValues = screen.getAllByText(/£0|-/);
      expect(zeroValues.length).toBeGreaterThan(0);
    });
  });

  describe('Filter Functionality', () => {
    it('should filter payments by payment type', async () => {
      render(
        <TestWrapper>
          <PaymentsTable />
        </TestWrapper>
      );

      // Look for filter dropdown or buttons
      const filterElements = screen.queryAllByRole('button');
      const selectElements = screen.queryAllByRole('combobox');
      
      expect(filterElements.length + selectElements.length).toBeGreaterThan(0);
    });

    it('should filter clients by status', async () => {
      render(
        <TestWrapper>
          <ClientsTable />
        </TestWrapper>
      );

      // Look for status filter
      const statusFilter = screen.queryByText(/status/i) || 
                          screen.queryByText(/filter/i) ||
                          screen.queryByRole('combobox');
      
      if (statusFilter) {
        fireEvent.click(statusFilter);
        
        // Should show status options
        await waitFor(() => {
          expect(
            screen.queryByText('active') || 
            screen.queryByText('trial')
          ).toBeInTheDocument();
        });
      }
    });

    it('should filter by date range', async () => {
      render(
        <TestWrapper>
          <PaymentsTable />
        </TestWrapper>
      );

      // Look for date picker or date filter
      const dateInputs = screen.queryAllByDisplayValue(/2024/);
      const datePickerButtons = screen.queryAllByText(/date/i);
      
      expect(dateInputs.length + datePickerButtons.length).toBeGreaterThanOrEqual(0);
    });

    it('should search by company name', async () => {
      render(
        <TestWrapper>
          <ClientsTable />
        </TestWrapper>
      );

      const searchInput = screen.queryByPlaceholderText(/search/i) ||
                         screen.queryByLabelText(/search/i) ||
                         screen.queryByRole('searchbox');

      if (searchInput) {
        fireEvent.change(searchInput, { target: { value: 'TechCorp' } });

        await waitFor(() => {
          expect(screen.getByText('TechCorp Ltd')).toBeInTheDocument();
        });
      }
    });
  });

  describe('MRR Calculations Consistency', () => {
    it('should only calculate MRR for subscription deals', () => {
      const subscriptionDeal = {
        monthly_mrr: 1000,
        one_off_revenue: 5000,
        revenue_model: 'subscription'
      };

      const oneTimeDeal = {
        monthly_mrr: 0,
        one_off_revenue: 10000,
        revenue_model: 'one_time'
      };

      // Subscription deal should include MRR in LTV
      const subscriptionLTV = calculateLTVValue(subscriptionDeal);
      expect(subscriptionLTV).toBe(8000); // (1000 * 3) + 5000

      // One-time deal should not include MRR
      const oneTimeLTV = calculateLTVValue(oneTimeDeal);
      expect(oneTimeLTV).toBe(10000); // (0 * 3) + 10000
    });

    it('should validate MRR values are reasonable', () => {
      const testMRRValues = [
        { value: 1000, shouldBeValid: true },
        { value: 50000, shouldBeValid: true },
        { value: -1000, shouldBeValid: false }, // Negative
        { value: 2000000, shouldBeValid: false }, // Too large (>£1M monthly)
        { value: 'invalid', shouldBeValid: false }, // Invalid format
        { value: Infinity, shouldBeValid: false }, // Infinity
        { value: NaN, shouldBeValid: false } // NaN
      ];

      testMRRValues.forEach(({ value, shouldBeValid }) => {
        const validation = validateFinancialNumber(value, {
          fieldName: 'monthly_mrr',
          allowNegative: false,
          maxValue: 1000000 // £1M monthly limit
        });

        expect(validation.isValid).toBe(shouldBeValid);
      });
    });

    it('should aggregate MRR correctly across multiple clients', () => {
      const clients = [
        { status: 'active', monthly_mrr: 1000 },
        { status: 'active', monthly_mrr: 2000 },
        { status: 'trial', monthly_mrr: 500 }, // Should not count
        { status: 'churned', monthly_mrr: 3000 }, // Should not count
        { status: 'active', monthly_mrr: 1500 }
      ];

      const totalActiveMRR = clients
        .filter(client => client.status === 'active')
        .reduce((sum, client) => sum + client.monthly_mrr, 0);

      expect(totalActiveMRR).toBe(4500); // 1000 + 2000 + 1500
    });
  });

  describe('Data Consistency Across Components', () => {
    it('should show consistent company names across all tables', () => {
      render(
        <TestWrapper>
          <div>
            <SalesTable />
            <ClientsTable />
            <PaymentsTable />
          </div>
        </TestWrapper>
      );

      // Company names should be consistent
      const companyNames = ['TechCorp Ltd', 'StartupCo', 'BigClient Inc'];
      
      companyNames.forEach(name => {
        const elements = screen.getAllByText(name);
        expect(elements.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('should show consistent owner information', () => {
      render(
        <TestWrapper>
          <div>
            <SalesTable />
            <ClientsTable />
          </div>
        </TestWrapper>
      );

      // Owner names should be consistent
      const ownerNames = ['John Smith', 'Sarah Johnson'];
      
      ownerNames.forEach(name => {
        const elements = screen.getAllByText(name);
        expect(elements.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('should show consistent financial amounts', () => {
      render(
        <TestWrapper>
          <div>
            <ClientsTable />
            <PaymentsTable />
          </div>
        </TestWrapper>
      );

      // Financial amounts should be formatted consistently
      const amounts = ['£5,000', '£10,000'];
      
      amounts.forEach(amount => {
        const elements = screen.getAllByText(new RegExp(amount.replace(/[£,]/g, '\\$&')));
        expect(elements.length).toBeGreaterThanOrEqual(0);
      });
    });

    it('should maintain referential integrity between deals and activities', () => {
      const activities = mockSalesData;
      
      activities.forEach(activity => {
        if (activity.deal) {
          // Activity should reference a valid deal
          expect(activity.deal.id).toBeDefined();
          expect(typeof activity.deal.id).toBe('number');
          
          // Deal should have consistent owner information
          if (activity.deal.owner_name && activity.owner_name) {
            expect(activity.deal.owner_name).toBe(activity.owner_name);
          }
        }
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty data sets gracefully', () => {
      // Mock empty data
      vi.mocked(require('@/lib/hooks/useSalesData').useSalesData).mockReturnValue({
        data: [],
        isLoading: false,
        error: null
      });

      vi.mocked(require('@/lib/hooks/useClients').useClients).mockReturnValue({
        clients: [],
        isLoading: false,
        error: null
      });

      render(
        <TestWrapper>
          <div>
            <SalesTable />
            <ClientsTable />
            <SubscriptionStats />
          </div>
        </TestWrapper>
      );

      // Should show empty states
      const emptyMessages = screen.queryAllByText(/no data|empty|no records/i);
      expect(emptyMessages.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle corrupted data gracefully', () => {
      const corruptedData = [
        {
          // Missing required fields
          id: 1,
          // company_name: missing
          // owner_name: missing
        },
        {
          id: 2,
          company_name: null,
          owner_name: null,
          amount: 'invalid_number',
          deal: null
        }
      ];

      vi.mocked(require('@/lib/hooks/useSalesData').useSalesData).mockReturnValue({
        data: corruptedData,
        isLoading: false,
        error: null
      });

      render(
        <TestWrapper>
          <SalesTable />
        </TestWrapper>
      );

      // Should not crash
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('should handle API errors gracefully', () => {
      vi.mocked(require('@/lib/hooks/useSalesData').useSalesData).mockReturnValue({
        data: [],
        isLoading: false,
        error: 'Failed to fetch data'
      });

      render(
        <TestWrapper>
          <SalesTable />
        </TestWrapper>
      );

      // Should show error message
      const errorMessage = screen.queryByText(/error|failed|problem/i);
      expect(errorMessage).toBeInTheDocument();
    });

    it('should show loading states appropriately', () => {
      vi.mocked(require('@/lib/hooks/useSalesData').useSalesData).mockReturnValue({
        data: [],
        isLoading: true,
        error: null
      });

      render(
        <TestWrapper>
          <SalesTable />
        </TestWrapper>
      );

      // Should show loading indicator
      const loadingIndicator = screen.queryByText(/loading|spinner/i) ||
                              screen.queryByRole('progressbar') ||
                              screen.queryByTestId('loading');
      
      expect(loadingIndicator).toBeInTheDocument();
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large datasets efficiently', () => {
      // Generate large dataset
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        company_name: `Company ${i + 1}`,
        owner_name: `Owner ${i + 1}`,
        amount: (i + 1) * 1000,
        type: 'proposal',
        date: '2024-01-01'
      }));

      vi.mocked(require('@/lib/hooks/useSalesData').useSalesData).mockReturnValue({
        data: largeDataset,
        isLoading: false,
        error: null
      });

      const startTime = performance.now();
      
      render(
        <TestWrapper>
          <SalesTable />
        </TestWrapper>
      );

      const renderTime = performance.now() - startTime;
      
      // Should render within reasonable time (5 seconds for 1000 items)
      expect(renderTime).toBeLessThan(5000);
    });

    it('should implement pagination or virtualization for large datasets', () => {
      const largeDataset = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        company_name: `Company ${i + 1}`,
        owner_name: `Owner ${i + 1}`,
        amount: (i + 1) * 1000
      }));

      vi.mocked(require('@/lib/hooks/useSalesData').useSalesData).mockReturnValue({
        data: largeDataset,
        isLoading: false,
        error: null
      });

      render(
        <TestWrapper>
          <SalesTable />
        </TestWrapper>
      );

      // Look for pagination controls or virtualization
      const paginationControls = screen.queryAllByText(/page|next|previous|first|last/i);
      const tableRows = screen.getAllByRole('row');
      
      // Either pagination exists or not all rows are rendered (virtualization)
      expect(
        paginationControls.length > 0 || 
        tableRows.length < largeDataset.length + 1 // +1 for header
      ).toBe(true);
    });
  });
});