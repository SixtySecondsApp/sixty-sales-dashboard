import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LeadAnalyticsCard } from '@/components/leads/LeadAnalyticsCard';

vi.mock('@/lib/hooks/useLeadAnalytics', () => ({
  useLeadAnalytics: () => ({
    data: [
      {
        source_id: '123',
        source_key: 'website',
        source_name: 'Marketing Website',
        channel: 'website',
        medium: 'organic',
        campaign: 'home-page',
        owner_id: null,
        total_leads: 10,
        converted_leads: 4,
        ready_leads: 6,
        prepping_leads: 0,
        first_lead_at: '2025-11-01T10:00:00Z',
        last_lead_at: '2025-11-12T10:00:00Z',
      },
    ],
    isLoading: false,
    isFetching: false,
  }),
}));

describe('LeadAnalyticsCard', () => {
  it('renders lead analytics rows with conversion percentage', () => {
    render(<LeadAnalyticsCard />);

    expect(screen.getByText('Marketing Website')).toBeInTheDocument();
    expect(screen.getByText('website')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('40.0%')).toBeInTheDocument();
  });
});



