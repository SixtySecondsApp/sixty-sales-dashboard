import { BarChart3, TrendingUp } from 'lucide-react';
import { useLeadAnalytics } from '@/lib/hooks/useLeadAnalytics';

export function LeadAnalyticsCard() {
  const { data = [], isLoading, isFetching } = useLeadAnalytics();

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
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-left font-medium whitespace-nowrap">Source</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-left font-medium whitespace-nowrap">Channel</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-right font-medium whitespace-nowrap">Leads</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-right font-medium whitespace-nowrap">Ready</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-right font-medium whitespace-nowrap">Converted</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-right font-medium whitespace-nowrap">
                <span className="inline-flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  <span className="hidden sm:inline">Conversion %</span>
                  <span className="sm:hidden">Conv %</span>
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800/60 dark:bg-gray-950/30">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-500 dark:text-gray-400">
                  Loading lead analytics…
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-500 dark:text-gray-400">
                  No lead data yet. Ingest SavvyCal events to populate analytics.
                </td>
              </tr>
            ) : (
              data.map((row) => {
                const conversionRate =
                  row.total_leads && row.total_leads > 0
                    ? ((row.converted_leads ?? 0) / row.total_leads) * 100
                    : 0;

                return (
                  <tr key={`${row.source_id ?? 'null'}-${row.owner_id ?? 'all'}`}>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                      {row.source_name ?? row.source_key ?? 'Unknown'}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {row.channel ?? '—'}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right font-semibold text-gray-900 dark:text-gray-100">
                      {row.total_leads ?? 0}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-gray-600 dark:text-gray-300">
                      {row.ready_leads ?? 0}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-gray-600 dark:text-gray-300">
                      {row.converted_leads ?? 0}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right font-semibold text-emerald-600 dark:text-emerald-300">
                      {conversionRate.toFixed(1)}%
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








