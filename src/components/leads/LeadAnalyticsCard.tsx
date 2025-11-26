import { useMemo } from 'react';
import { BarChart3, TrendingUp, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLeadAnalytics } from '@/lib/hooks/useLeadAnalytics';
import { cn } from '@/lib/utils';

export function LeadAnalyticsCard() {
  const { data = [], isLoading, isFetching } = useLeadAnalytics();
  const navigate = useNavigate();

  // Group and aggregate data by source name to consolidate duplicates
  const aggregatedData = useMemo(() => {
    const grouped = new Map<
      string,
      {
        source_name: string;
        source_key: string | null;
        channel: string | null;
        total_leads: number;
        new_leads: number;
        prepping_leads: number;
        ready_leads: number;
        converted_leads: number;
        cancelled_leads: number;
        sql_stage: number;
        opportunity_stage: number;
        verbal_stage: number;
        signed_stage: number;
        lost_stage: number;
        total_one_off_revenue: number;
        total_monthly_revenue: number;
        total_ltv: number;
        conversion_rate: number;
        win_rate: number;
      }
    >();

    for (const row of data) {
      // Normalize source name for grouping (case-insensitive, trim whitespace)
      const normalizedName = (row.source_name ?? 'Unknown')
        .trim()
        .toLowerCase();

      const existing = grouped.get(normalizedName);

      if (existing) {
        // Aggregate metrics
        existing.total_leads += row.total_leads ?? 0;
        existing.new_leads += row.new_leads ?? 0;
        existing.prepping_leads += row.prepping_leads ?? 0;
        existing.ready_leads += row.ready_leads ?? 0;
        existing.converted_leads += row.converted_leads ?? 0;
        existing.cancelled_leads += row.cancelled_leads ?? 0;
        existing.sql_stage += row.sql_stage ?? 0;
        existing.opportunity_stage += row.opportunity_stage ?? 0;
        existing.verbal_stage += row.verbal_stage ?? 0;
        existing.signed_stage += row.signed_stage ?? 0;
        existing.lost_stage += row.lost_stage ?? 0;
        existing.total_one_off_revenue += row.total_one_off_revenue ?? 0;
        existing.total_monthly_revenue += row.total_monthly_revenue ?? 0;
        existing.total_ltv += row.total_ltv ?? 0;
      } else {
        // Create new entry with original source name (preserve casing)
        grouped.set(normalizedName, {
          source_name: row.source_name ?? 'Unknown',
          source_key: null,
          channel: row.channel ?? null,
          total_leads: row.total_leads ?? 0,
          new_leads: row.new_leads ?? 0,
          prepping_leads: row.prepping_leads ?? 0,
          ready_leads: row.ready_leads ?? 0,
          converted_leads: row.converted_leads ?? 0,
          cancelled_leads: row.cancelled_leads ?? 0,
          sql_stage: row.sql_stage ?? 0,
          opportunity_stage: row.opportunity_stage ?? 0,
          verbal_stage: row.verbal_stage ?? 0,
          signed_stage: row.signed_stage ?? 0,
          lost_stage: row.lost_stage ?? 0,
          total_one_off_revenue: row.total_one_off_revenue ?? 0,
          total_monthly_revenue: row.total_monthly_revenue ?? 0,
          total_ltv: row.total_ltv ?? 0,
          conversion_rate: row.conversion_rate ?? 0,
          win_rate: row.win_rate ?? 0,
        });
      }
    }

    // Convert map to array and sort by total_leads descending
    return Array.from(grouped.values()).sort(
      (a, b) => b.total_leads - a.total_leads
    );
  }, [data]);

  const handleCellClick = (sourceName: string, stage?: string) => {
    const params = new URLSearchParams();
    params.set('source', sourceName);
    if (stage) {
      params.set('stage', stage);
    }
    navigate(`/crm/leads?${params.toString()}`);
  };

  const formatCurrency = (value: number) => {
    if (value === 0) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 sm:p-6 shadow-sm dark:border-gray-800/60 dark:bg-gray-950/40">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
            <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500" />
            Lead Source Performance
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            Track volume and conversion per SavvyCal booking source.
          </p>
        </div>
        {isFetching && (
          <span className="text-xs text-gray-500 dark:text-gray-400">Refreshing…</span>
        )}
      </header>

      <div className="mt-4 sm:mt-6 overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800/60">
        <table className="min-w-full divide-y divide-gray-100 text-xs sm:text-sm dark:divide-gray-800/60">
          <thead className="bg-gray-50/80 text-gray-600 dark:bg-gray-900/60 dark:text-gray-300">
            <tr>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-left font-medium whitespace-nowrap sticky left-0 bg-gray-50/80 dark:bg-gray-900/60">
                Source
              </th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-left font-medium whitespace-nowrap">Channel</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-right font-medium whitespace-nowrap">Total</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-right font-medium whitespace-nowrap">SQL</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-right font-medium whitespace-nowrap">Oppty</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-right font-medium whitespace-nowrap">Verbal</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-right font-medium whitespace-nowrap">Signed</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-right font-medium whitespace-nowrap">Lost</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-right font-medium whitespace-nowrap">
                <span className="inline-flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  LTV
                </span>
              </th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-right font-medium whitespace-nowrap">
                <span className="inline-flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Conv %
                </span>
              </th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-right font-medium whitespace-nowrap">Win %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800/60 dark:bg-gray-950/30">
            {isLoading ? (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-gray-500 dark:text-gray-400">
                  Loading lead analytics…
                </td>
              </tr>
            ) : aggregatedData.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-gray-500 dark:text-gray-400">
                  No lead data yet. Ingest SavvyCal events to populate analytics.
                </td>
              </tr>
            ) : (
              aggregatedData.map((row) => {
                return (
                  <tr key={row.source_name} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/20">
                    <td className="px-2 sm:px-4 py-2 sm:py-3 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap sticky left-0 bg-white dark:bg-gray-950/30">
                      {row.source_name}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {row.channel ?? '—'}
                    </td>
                    <td
                      className={cn(
                        "px-2 sm:px-4 py-2 sm:py-3 text-right font-semibold text-gray-900 dark:text-gray-100",
                        row.total_leads > 0 && "cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                      )}
                      onClick={() => row.total_leads > 0 && handleCellClick(row.source_name)}
                    >
                      {row.total_leads}
                    </td>
                    <td
                      className={cn(
                        "px-2 sm:px-4 py-2 sm:py-3 text-right text-gray-600 dark:text-gray-300",
                        row.sql_stage > 0 && "cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                      )}
                      onClick={() => row.sql_stage > 0 && handleCellClick(row.source_name, 'SQL')}
                    >
                      {row.sql_stage || '—'}
                    </td>
                    <td
                      className={cn(
                        "px-2 sm:px-4 py-2 sm:py-3 text-right text-gray-600 dark:text-gray-300",
                        row.opportunity_stage > 0 && "cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                      )}
                      onClick={() => row.opportunity_stage > 0 && handleCellClick(row.source_name, 'Opportunity')}
                    >
                      {row.opportunity_stage || '—'}
                    </td>
                    <td
                      className={cn(
                        "px-2 sm:px-4 py-2 sm:py-3 text-right text-gray-600 dark:text-gray-300",
                        row.verbal_stage > 0 && "cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                      )}
                      onClick={() => row.verbal_stage > 0 && handleCellClick(row.source_name, 'Verbal')}
                    >
                      {row.verbal_stage || '—'}
                    </td>
                    <td
                      className={cn(
                        "px-2 sm:px-4 py-2 sm:py-3 text-right text-green-600 dark:text-green-400 font-semibold",
                        row.signed_stage > 0 && "cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                      )}
                      onClick={() => row.signed_stage > 0 && handleCellClick(row.source_name, 'Signed')}
                    >
                      {row.signed_stage || '—'}
                    </td>
                    <td
                      className={cn(
                        "px-2 sm:px-4 py-2 sm:py-3 text-right text-red-600 dark:text-red-400",
                        row.lost_stage > 0 && "cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                      )}
                      onClick={() => row.lost_stage > 0 && handleCellClick(row.source_name, 'Lost')}
                    >
                      {row.lost_stage || '—'}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      {formatCurrency(row.total_ltv)}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right font-semibold text-blue-600 dark:text-blue-300">
                      {row.conversion_rate.toFixed(1)}%
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-gray-600 dark:text-gray-300">
                      {row.win_rate.toFixed(1)}%
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}








