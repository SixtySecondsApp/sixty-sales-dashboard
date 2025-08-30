import { SalesActivity, SalesPerformance } from '@/lib/hooks/useSalesData';
import { UserTargets } from '@/lib/hooks/useTargets';

export function calculateDailyPoints(
  activities: SalesActivity[],
  performance: SalesPerformance[],
  date: string
): number {
  const dayActivities = activities.filter(a => a.activity_date === date);
  const dayPerformance = performance.filter(p => p.sales_date === date);

  const activityPoints = dayActivities.reduce((sum, activity) => {
    return sum + (activity.activity_type?.points || 0) * activity.count;
  }, 0);

  const performancePoints = dayPerformance.reduce((sum, perf) => {
    return sum + (perf.sales_type?.points || 0);
  }, 0);

  return activityPoints + performancePoints;
}

export function calculateProgress(current: number, target: number): number {
  if (target === 0) return 0;
  return Math.min(Math.round((current / target) * 100), 100);
}

export function getProgressColor(progress: number): string {
  if (progress >= 100) return 'emerald';
  if (progress >= 75) return 'blue';
  if (progress >= 50) return 'amber';
  return 'red';
}

export function calculateTrend(current: number, previous: number): string {
  if (previous === 0) return '+0%';
  const change = ((current - previous) / previous) * 100;
  return `${change > 0 ? '+' : ''}${change.toFixed(1)}%`;
}