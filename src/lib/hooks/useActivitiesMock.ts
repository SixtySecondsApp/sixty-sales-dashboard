import { useState, useEffect } from 'react';

// Mock activities data for development
const generateMockActivities = (dateRange?: { start: Date; end: Date }) => {
  const activities = [
    {
      id: '1',
      type: 'sale' as const,
      client_name: 'Acme Corp',
      date: new Date().toISOString(),
      amount: 5000,
      user_id: 'mock-user',
      sales_rep: 'Demo User',
      status: 'completed' as const,
      details: 'Monthly subscription',
      priority: 'high' as const,
      quantity: 1
    },
    {
      id: '2',
      type: 'outbound' as const,
      client_name: 'Tech Solutions',
      date: new Date(Date.now() - 86400000).toISOString(),
      user_id: 'mock-user',
      sales_rep: 'Demo User',
      status: 'completed' as const,
      details: 'Follow-up call',
      priority: 'medium' as const,
      quantity: 1
    },
    {
      id: '3',
      type: 'meeting' as const,
      client_name: 'Global Industries',
      date: new Date(Date.now() - 172800000).toISOString(),
      user_id: 'mock-user',
      sales_rep: 'Demo User',
      status: 'completed' as const,
      details: 'Product demo',
      priority: 'high' as const,
      quantity: 1
    },
    {
      id: '4',
      type: 'proposal' as const,
      client_name: 'StartUp Inc',
      date: new Date(Date.now() - 259200000).toISOString(),
      amount: 15000,
      user_id: 'mock-user',
      sales_rep: 'Demo User',
      status: 'pending' as const,
      details: 'Enterprise package proposal',
      priority: 'high' as const,
      quantity: 1
    },
    {
      id: '5',
      type: 'sale' as const,
      client_name: 'Beta Corp',
      date: new Date(Date.now() - 345600000).toISOString(),
      amount: 3000,
      user_id: 'mock-user',
      sales_rep: 'Demo User',
      status: 'completed' as const,
      details: 'One-time setup',
      priority: 'medium' as const,
      quantity: 1
    },
    {
      id: '6',
      type: 'outbound' as const,
      client_name: 'Innovation Labs',
      date: new Date().toISOString(),
      user_id: 'mock-user',
      sales_rep: 'Demo User',
      status: 'completed' as const,
      details: 'Cold call',
      priority: 'low' as const,
      quantity: 1
    },
    {
      id: '7',
      type: 'meeting' as const,
      client_name: 'Enterprise Co',
      date: new Date().toISOString(),
      user_id: 'mock-user',
      sales_rep: 'Demo User',
      status: 'completed' as const,
      details: 'Quarterly review',
      priority: 'medium' as const,
      quantity: 1
    },
    {
      id: '8',
      type: 'outbound' as const,
      client_name: 'Small Business LLC',
      date: new Date().toISOString(),
      user_id: 'mock-user',
      sales_rep: 'Demo User',
      status: 'completed' as const,
      details: 'Email follow-up',
      priority: 'low' as const,
      quantity: 1
    }
  ];

  // Filter by date range if provided
  if (dateRange) {
    return activities.filter(activity => {
      const activityDate = new Date(activity.date);
      return activityDate >= dateRange.start && activityDate <= dateRange.end;
    });
  }

  return activities;
};

export function useActivities(dateRange?: { start: Date; end: Date }) {
  const [data, setData] = useState(() => generateMockActivities(dateRange));
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Simulate data loading
    setIsLoading(true);
    const timer = setTimeout(() => {
      setData(generateMockActivities(dateRange));
      setIsLoading(false);
    }, 100);

    return () => clearTimeout(timer);
  }, [dateRange?.start?.toISOString(), dateRange?.end?.toISOString()]);

  return {
    data,
    isLoading,
    error: null
  };
}