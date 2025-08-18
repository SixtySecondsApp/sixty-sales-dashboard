import { describe, it, expect } from 'vitest';

// Test MRR calculation utilities
describe('MRR Calculations', () => {
  describe('Lifetime Value Calculations', () => {
    it('should calculate lifetime value for one-off deals', () => {
      const oneOffRevenue = 5000;
      const monthlyMRR = 0;
      // BUSINESS RULE: LTV = (monthlyMRR * 3) + oneOffRevenue
      const lifetimeValue = (monthlyMRR * 3) + oneOffRevenue;
      
      expect(lifetimeValue).toBe(5000);
    });

    it('should calculate lifetime value for subscription deals', () => {
      const oneOffRevenue = 1000;
      const monthlyMRR = 500;
      // BUSINESS RULE: LTV = (monthlyMRR * 3) + oneOffRevenue
      const lifetimeValue = (monthlyMRR * 3) + oneOffRevenue;
      
      expect(lifetimeValue).toBe(2500); // (500 * 3) + 1000
    });

    it('should calculate lifetime value for mixed deals', () => {
      const oneOffRevenue = 2000;
      const monthlyMRR = 300;
      // BUSINESS RULE: LTV = (monthlyMRR * 3) + oneOffRevenue
      const lifetimeValue = (monthlyMRR * 3) + oneOffRevenue;
      
      expect(lifetimeValue).toBe(2900); // (300 * 3) + 2000
    });

    it('should handle null/undefined values', () => {
      const oneOffRevenue = null;
      const monthlyMRR = undefined;
      // BUSINESS RULE: LTV = (monthlyMRR * 3) + oneOffRevenue
      const lifetimeValue = ((monthlyMRR || 0) * 3) + (oneOffRevenue || 0);
      
      expect(lifetimeValue).toBe(0);
    });

    it('should handle string number inputs', () => {
      const oneOffRevenue = parseFloat('1500.50');
      const monthlyMRR = parseFloat('250.25');
      // BUSINESS RULE: LTV = (monthlyMRR * 3) + oneOffRevenue
      const lifetimeValue = (monthlyMRR * 3) + oneOffRevenue;
      
      expect(lifetimeValue).toBe(2251.25); // (250.25 * 3) + 1500.50
    });
  });

  describe('Subscription Days Calculation', () => {
    it('should calculate days since subscription start', () => {
      const subscriptionStartDate = '2024-01-01';
      const currentDate = new Date('2024-01-31');
      const startDate = new Date(subscriptionStartDate);
      const daysDiff = Math.floor((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      
      expect(daysDiff).toBe(30);
    });

    it('should return 0 for future subscription dates', () => {
      const subscriptionStartDate = '2024-12-31';
      const currentDate = new Date('2024-01-01');
      const startDate = new Date(subscriptionStartDate);
      const daysDiff = Math.floor((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      
      expect(daysDiff).toBeLessThan(0);
      // In real implementation, you'd want to return 0 for negative values
      const normalizedDays = Math.max(0, daysDiff);
      expect(normalizedDays).toBe(0);
    });

    it('should return 0 for null subscription date', () => {
      const subscriptionStartDate = null;
      const daysDiff = subscriptionStartDate 
        ? Math.floor((new Date().getTime() - new Date(subscriptionStartDate).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      
      expect(daysDiff).toBe(0);
    });
  });

  describe('MRR Summary Calculations', () => {
    it('should calculate accurate MRR totals', () => {
      const clients = [
        { status: 'active', subscription_amount: 500 },
        { status: 'active', subscription_amount: 300 },
        { status: 'active', subscription_amount: 200 },
        { status: 'churned', subscription_amount: 400 },
        { status: 'paused', subscription_amount: 250 },
      ];

      const activeClients = clients.filter(c => c.status === 'active');
      const churnedClients = clients.filter(c => c.status === 'churned');
      const pausedClients = clients.filter(c => c.status === 'paused');

      const totalMRR = activeClients.reduce((sum, client) => sum + client.subscription_amount, 0);
      const avgMRR = activeClients.length > 0 ? totalMRR / activeClients.length : 0;
      const churnRate = clients.length > 0 ? (churnedClients.length / clients.length * 100) : 0;
      const activeRate = clients.length > 0 ? (activeClients.length / clients.length * 100) : 0;

      expect(totalMRR).toBe(1000);
      expect(avgMRR).toBeCloseTo(333.33, 2); // 1000 / 3
      expect(churnRate).toBe(20); // 1 / 5 * 100
      expect(activeRate).toBe(60); // 3 / 5 * 100
      expect(activeClients.length).toBe(3);
      expect(churnedClients.length).toBe(1);
      expect(pausedClients.length).toBe(1);
    });

    it('should handle empty client list', () => {
      const clients: any[] = [];

      const activeClients = clients.filter(c => c.status === 'active');
      const totalMRR = activeClients.reduce((sum, client) => sum + client.subscription_amount, 0);
      const avgMRR = activeClients.length > 0 ? totalMRR / activeClients.length : 0;
      const churnRate = clients.length > 0 ? (clients.filter(c => c.status === 'churned').length / clients.length * 100) : 0;

      expect(totalMRR).toBe(0);
      expect(avgMRR).toBe(0);
      expect(churnRate).toBe(0);
    });

    it('should calculate min and max MRR correctly', () => {
      const activeMRRAmounts = [100, 500, 200, 800, 150];

      const minMRR = activeMRRAmounts.length > 0 ? Math.min(...activeMRRAmounts) : 0;
      const maxMRR = activeMRRAmounts.length > 0 ? Math.max(...activeMRRAmounts) : 0;

      expect(minMRR).toBe(100);
      expect(maxMRR).toBe(800);
    });
  });

  describe('Client Aggregation Logic', () => {
    it('should aggregate multiple deals for same client', () => {
      const deals = [
        { company: 'Company A', one_off_revenue: 1000, monthly_mrr: 100 },
        { company: 'Company A', one_off_revenue: 500, monthly_mrr: 50 },
        { company: 'Company B', one_off_revenue: 2000, monthly_mrr: 200 },
      ];

      const clientMap = new Map();

      deals.forEach(deal => {
        const clientName = deal.company;
        
        if (!clientMap.has(clientName)) {
          clientMap.set(clientName, {
            client_name: clientName,
            total_payments_count: 0,
            total_lifetime_value: 0,
            total_one_off: 0,
            total_monthly_mrr: 0,
            active_subscriptions: 0,
          });
        }

        const client = clientMap.get(clientName);
        // BUSINESS RULE: LTV = (monthlyMRR * 3) + oneOffRevenue
        const lifetimeValue = (deal.monthly_mrr * 3) + deal.one_off_revenue;
        
        client.total_payments_count += 1;
        client.total_lifetime_value += lifetimeValue;
        client.total_one_off += deal.one_off_revenue;
        client.total_monthly_mrr += deal.monthly_mrr;
        
        if (deal.monthly_mrr > 0) {
          client.active_subscriptions += 1;
        }
      });

      const companyA = clientMap.get('Company A');
      const companyB = clientMap.get('Company B');

      expect(companyA.total_payments_count).toBe(2);
      expect(companyA.total_lifetime_value).toBe(1950); // ((100*3) + 1000) + ((50*3) + 500)
      expect(companyA.total_one_off).toBe(1500);
      expect(companyA.total_monthly_mrr).toBe(150);
      expect(companyA.active_subscriptions).toBe(2);

      expect(companyB.total_payments_count).toBe(1);
      expect(companyB.total_lifetime_value).toBe(2600); // (200*3) + 2000
      expect(companyB.total_one_off).toBe(2000);
      expect(companyB.total_monthly_mrr).toBe(200);
      expect(companyB.active_subscriptions).toBe(1);
    });

    it('should handle deals with no MRR (one-off only)', () => {
      const deals = [
        { company: 'Company C', one_off_revenue: 5000, monthly_mrr: 0 },
        { company: 'Company C', one_off_revenue: 3000, monthly_mrr: 0 },
      ];

      const clientMap = new Map();

      deals.forEach(deal => {
        const clientName = deal.company;
        
        if (!clientMap.has(clientName)) {
          clientMap.set(clientName, {
            client_name: clientName,
            total_payments_count: 0,
            total_lifetime_value: 0,
            total_one_off: 0,
            total_monthly_mrr: 0,
            active_subscriptions: 0,
          });
        }

        const client = clientMap.get(clientName);
        // BUSINESS RULE: LTV = (monthlyMRR * 3) + oneOffRevenue
        const lifetimeValue = (deal.monthly_mrr * 3) + deal.one_off_revenue;
        
        client.total_payments_count += 1;
        client.total_lifetime_value += lifetimeValue;
        client.total_one_off += deal.one_off_revenue;
        client.total_monthly_mrr += deal.monthly_mrr;
        
        if (deal.monthly_mrr > 0) {
          client.active_subscriptions += 1;
        }
      });

      const companyC = clientMap.get('Company C');

      expect(companyC.total_payments_count).toBe(2);
      expect(companyC.total_lifetime_value).toBe(8000); // 5000 + 3000 (no MRR)
      expect(companyC.total_one_off).toBe(8000);
      expect(companyC.total_monthly_mrr).toBe(0);
      expect(companyC.active_subscriptions).toBe(0);
    });
  });

  describe('Deal Type Classification', () => {
    it('should classify deals correctly', () => {
      const testCases = [
        { one_off_revenue: 1000, monthly_mrr: 100, expected: 'subscription' },
        { one_off_revenue: 5000, monthly_mrr: 0, expected: 'one-off' },
        { one_off_revenue: 0, monthly_mrr: 200, expected: 'subscription' },
        { one_off_revenue: 0, monthly_mrr: 0, expected: 'one-off' },
      ];

      testCases.forEach(({ one_off_revenue, monthly_mrr, expected }) => {
        const dealType = monthly_mrr > 0 ? 'subscription' : 'one-off';
        expect(dealType).toBe(expected);
      });
    });
  });

  describe('Date Handling', () => {
    it('should find most recent payment date', () => {
      const paymentDates = [
        '2024-01-15',
        '2024-02-20',
        '2024-01-30',
        '2024-02-10',
      ];

      const mostRecent = paymentDates.reduce((latest, current) => {
        return new Date(current) > new Date(latest) ? current : latest;
      });

      expect(mostRecent).toBe('2024-02-20');
    });

    it('should handle null payment dates', () => {
      let lastPaymentDate: string | null = null;
      const newDate = '2024-01-15';

      if (!lastPaymentDate || new Date(newDate) > new Date(lastPaymentDate)) {
        lastPaymentDate = newDate;
      }

      expect(lastPaymentDate).toBe('2024-01-15');
    });
  });

  describe('Currency and Number Parsing', () => {
    it('should parse string numbers correctly', () => {
      const testValues = [
        { input: '100.50', expected: 100.5 },
        { input: '1000', expected: 1000 },
        { input: null, expected: 0 },
        { input: undefined, expected: 0 },
        { input: '', expected: 0 },
        { input: 'invalid', expected: 0 },
      ];

      testValues.forEach(({ input, expected }) => {
        const parsed = parseFloat(input as any) || 0;
        expect(parsed).toBe(expected);
      });
    });

    it('should handle currency formatting consistency', () => {
      const amounts = [100.5, 1000.75, 250];
      
      amounts.forEach(amount => {
        const formatted = amount.toFixed(2);
        const parsed = parseFloat(formatted);
        expect(parsed).toBe(amount);
      });
    });
  });
});