import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';

export interface SalesActivity {
  id: string;
  user_id: string;
  team_id: string;
  activity_date: string;
  count: number;
  client_name: string;
  activity_type_id: string;
  created_at: string;
  updated_at: string;
  activity_type: {
    type_name: string;
    points: number;
  };
}

export interface SalesPerformance {
  id: string;
  user_id: string;
  team_id: string;
  sales_type_id: string;
  sales_date: string;
  amount: number;
  subscription_period: number | null;
  client_name: string;
  sale_type: string;
  sales_type: {
    type_name: string;
    points: number;
  };
}

export function useSalesData(userId: string | undefined, startDate: Date, endDate: Date) {
  // Mock data for development
  const mockData = {
    activities: [
      {
        id: '1',
        user_id: userId || '',
        team_id: 'team-1',
        activity_date: new Date().toISOString(),
        count: 5,
        client_name: 'Tech Corp',
        activity_type_id: 'type-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        activity_type: {
          type_name: 'Outbound',
          points: 1
        }
      },
      {
        id: '2',
        user_id: userId || '',
        team_id: 'team-1',
        activity_date: new Date().toISOString(),
        count: 2,
        client_name: 'Global Systems',
        activity_type_id: 'type-2',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        activity_type: {
          type_name: 'Meeting',
          points: 5
        }
      },
      {
        id: '3',
        user_id: userId || '',
        team_id: 'team-1',
        activity_date: new Date().toISOString(),
        count: 1,
        client_name: 'Innovate Inc',
        activity_type_id: 'type-3',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        activity_type: {
          type_name: 'Proposal',
          points: 10
        }
      }
    ],
    performance: [
      {
        id: '1',
        user_id: userId || '',
        team_id: 'team-1',
        sales_type_id: 'type-1',
        sales_date: new Date().toISOString(),
        amount: 12500,
        subscription_period: null,
        client_name: 'Tech Corp',
        sale_type: 'one-off',
        sales_type: {
          type_name: 'One Off',
          points: 20
        }
      },
      {
        id: '2',
        user_id: userId || '',
        team_id: 'team-1',
        sales_type_id: 'type-2',
        sales_date: new Date().toISOString(),
        amount: 45000,
        subscription_period: 12,
        client_name: 'Global Systems',
        sale_type: 'subscription',
        sales_type: {
          type_name: 'Subscription',
          points: 20
        }
      },
      {
        id: '3',
        user_id: userId || '',
        team_id: 'team-1',
        sales_type_id: 'type-3',
        sales_date: new Date().toISOString(),
        amount: 120000,
        subscription_period: null,
        client_name: 'Innovate Inc',
        sale_type: 'lifetime',
        sales_type: {
          type_name: 'Lifetime Deal',
          points: 20
        }
      }
    ]
  };

  return useQuery({
    queryKey: ['salesData', userId, startDate, endDate],
    queryFn: () => Promise.resolve(mockData),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  });
}