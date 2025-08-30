import { create } from 'zustand';
import { startOfMonth, endOfMonth } from 'date-fns';

interface ActivityFilters {
  type?: string;
  salesRep?: string;
  dateRange: {
    start: Date;
    end: Date;
  };
  searchQuery: string;
}

interface ActivityFiltersStore {
  filters: ActivityFilters;
  setFilters: (filters: Partial<ActivityFilters>) => void;
  resetFilters: () => void;
}

export const useActivityFilters = create<ActivityFiltersStore>((set) => ({
  filters: {
    dateRange: {
      start: startOfMonth(new Date()),
      end: new Date(),
    },
    searchQuery: '',
  },
  setFilters: (newFilters) => 
    set((state) => ({
      filters: { ...state.filters, ...newFilters }
    })),
  resetFilters: () =>
    set({
      filters: {
        dateRange: {
          start: startOfMonth(new Date()),
          end: new Date(),
        },
        searchQuery: '',
      }
    }),
}));