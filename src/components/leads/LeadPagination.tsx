import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LeadPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function LeadPagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: LeadPaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (currentPage <= 3) {
        // Near the start
        for (let i = 2; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('ellipsis');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        // Near the end
        pages.push('ellipsis');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // In the middle
        pages.push('ellipsis');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('ellipsis');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950/40">
      <div className="text-sm text-gray-600 dark:text-gray-400">
        Showing <span className="font-medium text-gray-900 dark:text-gray-100">{startItem}</span> to{' '}
        <span className="font-medium text-gray-900 dark:text-gray-100">{endItem}</span> of{' '}
        <span className="font-medium text-gray-900 dark:text-gray-100">{totalItems}</span> results
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={cn(
            'inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium transition-colors',
            'dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300',
            currentPage === 1
              ? 'opacity-50 cursor-not-allowed text-gray-400 dark:text-gray-600'
              : 'text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/60'
          )}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </button>

        <div className="flex items-center gap-1">
          {pageNumbers.map((page, index) => {
            if (page === 'ellipsis') {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="px-2 py-1 text-sm text-gray-400 dark:text-gray-500"
                >
                  ...
                </span>
              );
            }

            return (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={cn(
                  'min-w-[2.5rem] px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                  page === currentPage
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'
                    : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/60'
                )}
              >
                {page}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={cn(
            'inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium transition-colors',
            'dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300',
            currentPage === totalPages
              ? 'opacity-50 cursor-not-allowed text-gray-400 dark:text-gray-600'
              : 'text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/60'
          )}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

