import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { format, subMonths } from 'date-fns';
import { useUser } from '@/lib/hooks/useUser';

export interface SalesActivity {
  id: string;
  user_id: string;
  team_id: string | null;
  type: 'outbound' | 'meeting' | 'proposal' | 'sale';
  status: 'pending' | 'completed' | 'cancelled' | 'no_show';
  priority: 'low' | 'medium' | 'high';
  client_name: string;
  details: string;
  amount: number | null;
  date: string;
}

async function fetchSalesData(startDate: Date, endDate: Date) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Get current month's activities
  const { data: currentActivities, error: currentError } = await supabase
    .from('activities')
    .select('*')
    .eq('user_id', user.id)
    .gte('date', format(startDate, 'yyyy-MM-dd'))
    .lte('date', format(endDate, 'yyyy-MM-dd'))
    .order('date', { ascending: false });

  if (currentError) throw currentError;

  // Get previous month's activities for trend calculation
  const previousMonthStart = subMonths(startDate, 1);
  const previousMonthEnd = subMonths(endDate, 1);

  const { data: previousActivities, error: previousError } = await supabase
    .from('activities')
    .select('*')
    .eq('user_id', user.id)
    .gte('date', format(previousMonthStart, 'yyyy-MM-dd'))
    .lte('date', format(previousMonthEnd, 'yyyy-MM-dd'));

  if (previousError) throw previousError;

  return {
    current: currentActivities,
    previous: previousActivities
  };
}

export function useSalesData(startDate: Date, endDate: Date) {
  const { userData } = useUser();
  
  return useQuery({
    queryKey: ['salesData', userData?.id, startDate, endDate],
    queryFn: () => fetchSalesData(startDate, endDate),
    enabled: !!userData?.id,
  });
}

export function calculateTrend(current: number, previous: number): number {
  if (previous === 0) return 0;
  return Math.round(((current - previous) / previous) * 100);
}