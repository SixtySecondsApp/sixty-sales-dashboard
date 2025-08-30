import { format, addDays, addHours, setHours, setMinutes, startOfWeek, addWeeks } from 'date-fns';
import type { SmartDateOption } from '../types';

export const useSmartDates = () => {
  const getSmartQuickDates = (): SmartDateOption[] => {
    const now = new Date();
    return [
      {
        label: 'In 1 Hour',
        value: format(addHours(now, 1), "yyyy-MM-dd'T'HH:mm"),
        icon: '⏰',
        description: 'Quick follow up'
      },
      {
        label: 'End of Day',
        value: format(setHours(setMinutes(now, 0), 17), "yyyy-MM-dd'T'HH:mm"),
        icon: '🌅',
        description: 'Before close'
      },
      {
        label: 'Tomorrow 9AM',
        value: format(setHours(setMinutes(addDays(now, 1), 0), 9), "yyyy-MM-dd'T'HH:mm"),
        icon: '📅',
        description: 'Start fresh'
      },
      {
        label: 'Next Monday',
        value: format(setHours(setMinutes(addDays(startOfWeek(addWeeks(now, 1)), 1), 0), 9), "yyyy-MM-dd'T'HH:mm"),
        icon: '📆',
        description: 'Next week'
      }
    ];
  };

  return { getSmartQuickDates };
};