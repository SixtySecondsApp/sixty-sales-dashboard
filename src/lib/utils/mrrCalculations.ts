import { ClientWithRelationships, MRRSummary } from '@/lib/hooks/useClients';

/**
 * Calculate MRR summary from client data
 */
export function calculateMRRSummary(clients: ClientWithRelationships[]): MRRSummary {
  const activeClients = clients.filter(c => c.status === 'active');
  const churned = clients.filter(c => c.status === 'churned');
  const paused = clients.filter(c => c.status === 'paused');
  
  const totalMRR = activeClients.reduce((sum, client) => sum + client.subscription_amount, 0);
  const activeMRRAmounts = activeClients.map(c => c.subscription_amount).filter(amount => amount > 0);
  
  return {
    total_clients: clients.length,
    active_clients: activeClients.length,
    churned_clients: churned.length,
    paused_clients: paused.length,
    total_mrr: totalMRR,
    avg_mrr: activeMRRAmounts.length > 0 ? totalMRR / activeMRRAmounts.length : 0,
    min_mrr: activeMRRAmounts.length > 0 ? Math.min(...activeMRRAmounts) : 0,
    max_mrr: activeMRRAmounts.length > 0 ? Math.max(...activeMRRAmounts) : 0,
    churn_rate: clients.length > 0 ? (churned.length / clients.length) * 100 : 0,
    active_rate: clients.length > 0 ? (activeClients.length / clients.length) * 100 : 0
  };
}

/**
 * Calculate MRR metrics by time period
 */
export function calculateMRRTrends(clients: ClientWithRelationships[], months: number = 12) {
  const now = new Date();
  const trends = [];
  
  for (let i = months - 1; i >= 0; i--) {
    const periodStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    
    // Clients active during this period
    const activeInPeriod = clients.filter(client => {
      const startDate = client.subscription_start_date ? new Date(client.subscription_start_date) : null;
      const churnDate = client.churn_date ? new Date(client.churn_date) : null;
      
      // Started before or during period
      const startedByPeriod = !startDate || startDate <= periodEnd;
      
      // Still active or churned after period start
      const activeInPeriod = !churnDate || churnDate >= periodStart;
      
      return startedByPeriod && activeInPeriod;
    });
    
    // New clients this period
    const newClients = clients.filter(client => {
      const startDate = client.subscription_start_date ? new Date(client.subscription_start_date) : null;
      return startDate && startDate >= periodStart && startDate <= periodEnd;
    });
    
    // Churned clients this period
    const churnedInPeriod = clients.filter(client => {
      const churnDate = client.churn_date ? new Date(client.churn_date) : null;
      return churnDate && churnDate >= periodStart && churnDate <= periodEnd;
    });
    
    const periodMRR = activeInPeriod.reduce((sum, client) => sum + client.subscription_amount, 0);
    
    trends.push({
      period: periodStart.toISOString().slice(0, 7), // YYYY-MM format
      period_start: periodStart.toISOString().split('T')[0],
      period_end: periodEnd.toISOString().split('T')[0],
      total_mrr: periodMRR,
      active_clients: activeInPeriod.length,
      new_clients: newClients.length,
      churned_clients: churnedInPeriod.length,
      churn_rate: activeInPeriod.length > 0 ? (churnedInPeriod.length / activeInPeriod.length) * 100 : 0
    });
  }
  
  return trends;
}

/**
 * Calculate growth metrics
 */
export function calculateGrowthMetrics(clients: ClientWithRelationships[]) {
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  
  // This month metrics
  const thisMonthActive = clients.filter(client => {
    const startDate = client.subscription_start_date ? new Date(client.subscription_start_date) : null;
    const churnDate = client.churn_date ? new Date(client.churn_date) : null;
    
    const startedByThisMonth = !startDate || startDate <= thisMonthEnd;
    const activeThisMonth = !churnDate || churnDate >= thisMonth;
    
    return startedByThisMonth && activeThisMonth;
  });
  
  // Last month metrics
  const lastMonthActive = clients.filter(client => {
    const startDate = client.subscription_start_date ? new Date(client.subscription_start_date) : null;
    const churnDate = client.churn_date ? new Date(client.churn_date) : null;
    
    const startedByLastMonth = !startDate || startDate <= lastMonthEnd;
    const activeLastMonth = !churnDate || churnDate >= lastMonth;
    
    return startedByLastMonth && activeLastMonth;
  });
  
  const thisMonthMRR = thisMonthActive.reduce((sum, client) => sum + client.subscription_amount, 0);
  const lastMonthMRR = lastMonthActive.reduce((sum, client) => sum + client.subscription_amount, 0);
  
  const mrrGrowth = lastMonthMRR > 0 ? ((thisMonthMRR - lastMonthMRR) / lastMonthMRR) * 100 : 0;
  const clientGrowth = lastMonthActive.length > 0 ? 
    ((thisMonthActive.length - lastMonthActive.length) / lastMonthActive.length) * 100 : 0;
  
  return {
    this_month_mrr: thisMonthMRR,
    last_month_mrr: lastMonthMRR,
    mrr_growth_rate: mrrGrowth,
    this_month_clients: thisMonthActive.length,
    last_month_clients: lastMonthActive.length,
    client_growth_rate: clientGrowth,
    mrr_change: thisMonthMRR - lastMonthMRR,
    client_change: thisMonthActive.length - lastMonthActive.length
  };
}

/**
 * Calculate customer lifetime value (LTV)
 */
export function calculateClientLTV(client: ClientWithRelationships): number {
  if (client.status !== 'active' && !client.churn_date) {
    return 0;
  }
  
  const startDate = client.subscription_start_date ? new Date(client.subscription_start_date) : new Date();
  const endDate = client.churn_date ? new Date(client.churn_date) : new Date();
  
  // Calculate months between start and end (or current date)
  const months = client.churn_date ? 
    (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth()) :
    (new Date().getFullYear() - startDate.getFullYear()) * 12 + (new Date().getMonth() - startDate.getMonth());
  
  return Math.max(months, 1) * client.subscription_amount;
}

/**
 * Calculate cohort analysis
 */
export function calculateCohortAnalysis(clients: ClientWithRelationships[]) {
  const cohorts = new Map<string, {
    period: string;
    initial_clients: number;
    clients_by_month: number[];
    mrr_by_month: number[];
  }>();
  
  // Group clients by their start month
  clients.forEach(client => {
    if (!client.subscription_start_date) return;
    
    const startDate = new Date(client.subscription_start_date);
    const cohortKey = startDate.toISOString().slice(0, 7); // YYYY-MM
    
    if (!cohorts.has(cohortKey)) {
      cohorts.set(cohortKey, {
        period: cohortKey,
        initial_clients: 0,
        clients_by_month: [],
        mrr_by_month: []
      });
    }
    
    const cohort = cohorts.get(cohortKey)!;
    cohort.initial_clients++;
  });
  
  // For each cohort, calculate retention by month
  const now = new Date();
  
  cohorts.forEach((cohort, cohortKey) => {
    const cohortStart = new Date(cohortKey + '-01');
    const monthsSinceCohort = (now.getFullYear() - cohortStart.getFullYear()) * 12 + 
                             (now.getMonth() - cohortStart.getMonth()) + 1;
    
    for (let monthOffset = 0; monthOffset < monthsSinceCohort; monthOffset++) {
      const checkDate = new Date(cohortStart.getFullYear(), cohortStart.getMonth() + monthOffset, 1);
      const checkDateEnd = new Date(cohortStart.getFullYear(), cohortStart.getMonth() + monthOffset + 1, 0);
      
      const cohortClients = clients.filter(client => {
        if (!client.subscription_start_date) return false;
        const startDate = new Date(client.subscription_start_date);
        return startDate.toISOString().slice(0, 7) === cohortKey;
      });
      
      const activeInMonth = cohortClients.filter(client => {
        const churnDate = client.churn_date ? new Date(client.churn_date) : null;
        return !churnDate || churnDate > checkDateEnd;
      });
      
      const mrrInMonth = activeInMonth.reduce((sum, client) => sum + client.subscription_amount, 0);
      
      cohort.clients_by_month[monthOffset] = activeInMonth.length;
      cohort.mrr_by_month[monthOffset] = mrrInMonth;
    }
  });
  
  return Array.from(cohorts.values()).sort((a, b) => a.period.localeCompare(b.period));
}

/**
 * Format currency values
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

/**
 * Format percentage values
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}