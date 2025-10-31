import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Calendar as CalendarIcon, Clock, MapPin, RefreshCw, ChevronDown, ChevronRight, Bookmark } from 'lucide-react';
import { useCalendarEventsFromDB, useSyncCalendar } from '@/lib/hooks/useCalendarEvents';

function formatTimeRange(start?: Date, end?: Date) {
  if (!start) return '';
  const startStr = start.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  if (!end) return startStr;
  const sameDay = start.toDateString() === end.toDateString();
  const endStr = sameDay
    ? end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : end.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  return `${startStr} – ${endStr}`;
}

export default function Events() {
  // Minimal header (no ITC Vegas banner) with search and actions only
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Debounce search
  useEffect(() => {
    const id = setTimeout(() => {
      setPage(1);
      setSearchQuery(searchInput.trim());
    }, 250);
    return () => clearTimeout(id);
  }, [searchInput]);

  // Date window: show recent past and near future
  const startDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  }, []);
  const endDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 180);
    return d;
  }, []);

  const { data: events = [], isLoading } = useCalendarEventsFromDB(startDate, endDate, true);
  const syncCalendar = useSyncCalendar();

  const filtered = useMemo(() => {
    if (!searchQuery) return events;
    const q = searchQuery.toLowerCase();
    return events.filter((ev: any) => {
      const title = (ev?.title || '').toLowerCase();
      const location = (ev?.location || '').toLowerCase();
      const createdBy = (ev?.createdBy || '').toLowerCase();
      return title.includes(q) || location.includes(q) || createdBy.includes(q);
    });
  }, [events, searchQuery]);

  const total = filtered.length;
  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filtered.slice(start, end);
  }, [filtered, page, pageSize]);

  // Group within current page for clearer category sections
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const groups = useMemo(() => {
    const result: Record<string, any[]> = {};
    for (const ev of paged) {
      const key = (ev.category || 'Other') as string;
      if (!result[key]) result[key] = [];
      result[key].push(ev);
    }
    return result;
  }, [paged]);
  const categoryOrder = useMemo(() => Object.keys(groups).sort((a, b) => a.localeCompare(b)), [groups]);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      {/* Controls Row */}
      <div className="bg-white/95 dark:bg-gray-900/50 backdrop-blur-xl rounded-2xl p-4 border border-gray-200 dark:border-gray-800/50 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="relative w-72 max-w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search events by title, location, or owner..."
                className="w-full h-9 pl-10 pr-3 rounded-md text-sm bg-gray-100 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => syncCalendar.mutate({ action: 'sync-incremental' })}
              className="inline-flex items-center gap-2 px-3 h-9 rounded-md border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800/50 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700/70 text-sm"
            >
              <RefreshCw className="w-4 h-4" /> Sync
            </button>
          </div>
        </div>
      </div>

      {/* Events List - grouped by category with collapsible sections */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800/50 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-6 pb-20">
          {total === 0 && (
            <div className="text-center py-16 bg-white/80 dark:bg-gray-900/40 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
              <CalendarIcon className="w-10 h-10 mx-auto mb-3 text-gray-400" />
              <p className="text-gray-600 dark:text-gray-400">No events found. Try a different search.</p>
            </div>
          )}

          {categoryOrder.map((category) => {
            const items = groups[category];
            const collapsed = !!collapsedCategories[category];
            return (
              <div key={category} className="space-y-3">
                {/* Category header */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2 text-gray-800 dark:text-gray-200">
                    <Bookmark className="w-4 h-4 text-emerald-500" />
                    <h2 className="font-semibold">{category}</h2>
                    <span className="text-xs text-gray-500">{items.length} {items.length === 1 ? 'event' : 'events'}</span>
                  </div>
                  <button
                    onClick={() => setCollapsedCategories(prev => ({ ...prev, [category]: !collapsed }))}
                    className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white inline-flex items-center gap-1"
                  >
                    {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    {collapsed ? 'Expand' : 'Collapse'}
                  </button>
                </div>

                <AnimatePresence initial={false}>
                  {!collapsed && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3"
                    >
                      {items.map((ev: any) => (
                        <div
                          key={ev.id}
                          className="flex items-start gap-4 p-4 bg-white dark:bg-gray-900/50 rounded-2xl border border-gray-200 dark:border-gray-800/50 hover:border-emerald-500/30 transition-colors"
                        >
                          {/* Date badge */}
                          <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex flex-col items-center justify-center">
                            <div className="text-[10px] uppercase tracking-wide leading-none">{new Date(ev.start).toLocaleString([], { month: 'short' })}</div>
                            <div className="text-base font-semibold -mt-0.5 leading-none">{new Date(ev.start).getDate()}</div>
                          </div>
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-3">
                              <h3 className="text-gray-900 dark:text-white font-medium truncate">{ev.title || 'Untitled Event'}</h3>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
                              <div className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {formatTimeRange(ev.start ? new Date(ev.start) : undefined, ev.end ? new Date(ev.end) : undefined)}</div>
                              {ev.location && (
                                <div className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {ev.location}</div>
                              )}
                              {ev.createdBy && (
                                <div className="inline-flex items-center gap-1">Owner: {ev.createdBy}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

          {/* Bottom pagination */}
          {total > 0 && (
            <div className="flex flex-col items-center justify-center gap-2 pt-4">
              <div className="text-xs text-gray-500">
                Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-700 disabled:opacity-50"
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <div className="px-2 text-xs text-gray-600 dark:text-gray-400 select-none">
                  Page {page}
                </div>
                <button
                  className="px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-700 disabled:opacity-50"
                  disabled={page * pageSize >= total}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </button>
                <select
                  className="ml-2 h-8 text-xs bg-gray-100 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded px-2"
                  value={pageSize}
                  onChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPage(1); }}
                  aria-label="Page size"
                >
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


