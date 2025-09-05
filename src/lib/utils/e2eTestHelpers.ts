// Helper functions for E2E tests to handle database column mapping

export const createTestDeal = (userId: string, stageId: string, name: string, value: number) => ({
  name,
  company: `Test Company - ${name}`,
  value,
  stage_id: stageId,
  owner_id: userId,
  status: 'active',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
});

export const createTestActivity = (userId: string, type: string, clientName: string, salesRep: string, details?: string) => ({
  type,
  client_name: clientName,
  details: details || `Test ${type} activity`,
  user_id: userId,
  sales_rep: salesRep,
  amount: 0,
  status: 'completed',
  priority: 'medium',
  date: new Date().toISOString(),
  created_at: new Date().toISOString()
});

export const createTestTask = (userId: string, title: string, dealId?: string, priority = 'medium') => ({
  title,
  description: `Test task: ${title}`,
  user_id: userId,
  deal_id: dealId,
  priority,
  status: 'pending',
  due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  created_at: new Date().toISOString()
});