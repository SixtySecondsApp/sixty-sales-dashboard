// Test Payload Templates for Workflow Testing Lab
export interface PayloadTemplate {
  id: string;
  name: string;
  category: 'fathom' | 'crm' | 'task' | 'webhook' | 'general';
  description: string;
  payload: any;
  variables?: Array<{
    key: string;
    description: string;
  }>;
}

export const payloadTemplates: PayloadTemplate[] = [
  // Fathom Templates
  {
    id: 'fathom-summary',
    name: 'Fathom Meeting Summary',
    category: 'fathom',
    description: 'Complete Fathom meeting summary with transcript and action items',
    payload: {
      id: 'fathom_123456',
      title: 'Sales Discovery Call - Acme Corp',
      meeting_id: 'zoom_987654321',
      date: new Date().toISOString(),
      duration: 1800,
      participants: [
        {
          name: 'John Smith',
          email: 'john@company.com',
          role: 'host',
          talk_time: 720
        },
        {
          name: 'Sarah Johnson',
          email: 'sarah@acmecorp.com',
          role: 'guest',
          talk_time: 1080
        }
      ],
      summary: 'Discussed product requirements, budget constraints, and implementation timeline. Client showed strong interest in enterprise features.',
      transcript: 'John: Good morning Sarah, thanks for taking the time to meet...\nSarah: Happy to be here. We\'ve been looking for a solution that...',
      action_items: [
        {
          text: 'Send proposal with enterprise pricing',
          assignee: 'john@company.com',
          due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          text: 'Schedule technical deep dive session',
          assignee: 'john@company.com',
          due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        }
      ],
      keywords: ['enterprise', 'pricing', 'implementation', 'Q1 2024'],
      sentiment: 'positive',
      deal_probability: 0.75,
      next_steps: 'Follow up with proposal by end of week'
    }
  },
  {
    id: 'fathom-transcript',
    name: 'Fathom Transcript Only',
    category: 'fathom',
    description: 'Meeting transcript without summary for testing transcript processing',
    payload: {
      id: 'fathom_transcript_001',
      title: 'Product Demo Call',
      meeting_id: 'teams_abc123',
      date: new Date().toISOString(),
      duration: 2400,
      transcript: `Host: Welcome everyone to today's product demo. Let me share my screen.
Guest: Great, I can see your screen clearly.
Host: Perfect. Let me walk you through our core features.
Guest: This looks really impressive. How does the integration work?
Host: Our API supports REST and GraphQL endpoints...
Guest: What about security and compliance?
Host: We're SOC 2 Type II certified and GDPR compliant...`,
      participants: [
        { name: 'Demo Host', email: 'demo@company.com', role: 'host' },
        { name: 'Prospect', email: 'prospect@client.com', role: 'guest' }
      ]
    }
  },
  {
    id: 'fathom-action-items',
    name: 'Fathom Action Items',
    category: 'fathom',
    description: 'Meeting with multiple action items for task creation testing',
    payload: {
      id: 'fathom_actions_001',
      title: 'Quarterly Planning Session',
      meeting_id: 'zoom_planning_q1',
      date: new Date().toISOString(),
      action_items: [
        {
          text: 'Review and approve Q1 budget',
          assignee: 'cfo@company.com',
          priority: 'high',
          due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          text: 'Update product roadmap',
          assignee: 'product@company.com',
          priority: 'medium',
          due_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          text: 'Schedule team offsite',
          assignee: 'hr@company.com',
          priority: 'low',
          due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
        }
      ],
      summary: 'Quarterly planning session covering budget, roadmap, and team activities'
    }
  },

  // CRM Templates
  {
    id: 'crm-deal-created',
    name: 'CRM Deal Created',
    category: 'crm',
    description: 'New deal creation event for CRM workflows',
    payload: {
      event_type: 'deal_created',
      deal_id: 'deal_987654',
      deal_name: 'Enterprise Software License - TechCorp',
      company_name: 'TechCorp Solutions',
      contact: {
        name: 'Alice Chen',
        email: 'alice@techcorp.com',
        phone: '+1-555-0123',
        title: 'VP of Engineering'
      },
      value: {
        amount: 75000,
        currency: 'USD',
        type: 'one_time'
      },
      monthly_value: 5000,
      stage: 'SQL',
      probability: 0.3,
      expected_close: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      source: 'inbound_demo_request',
      tags: ['enterprise', 'saas', 'high_priority']
    }
  },
  {
    id: 'crm-stage-change',
    name: 'CRM Deal Stage Change',
    category: 'crm',
    description: 'Deal moved to new pipeline stage',
    payload: {
      event_type: 'stage_changed',
      deal_id: 'deal_456789',
      deal_name: 'Consulting Services - GlobalTech',
      previous_stage: 'SQL',
      new_stage: 'Opportunity',
      stage_duration: 5,
      updated_by: 'sales@company.com',
      timestamp: new Date().toISOString(),
      notes: 'Proposal sent, awaiting feedback',
      next_action: 'Follow up call scheduled for next week'
    }
  },
  {
    id: 'crm-contact-update',
    name: 'CRM Contact Updated',
    category: 'crm',
    description: 'Contact information updated in CRM',
    payload: {
      event_type: 'contact_updated',
      contact_id: 'contact_789',
      changes: {
        title: { old: 'Manager', new: 'Director' },
        company: { old: 'StartupCo', new: 'BigCorp' },
        email: { old: 'john@startup.com', new: 'john@bigcorp.com' }
      },
      contact: {
        name: 'John Williams',
        email: 'john@bigcorp.com',
        title: 'Director of Sales',
        company: 'BigCorp'
      },
      updated_by: 'admin@company.com',
      timestamp: new Date().toISOString()
    }
  },

  // Task Management Templates
  {
    id: 'task-created',
    name: 'Task Created',
    category: 'task',
    description: 'New task creation for workflow automation',
    payload: {
      event_type: 'task_created',
      task_id: 'task_001',
      title: 'Follow up with prospect',
      description: 'Send proposal and schedule follow-up call',
      assignee: 'sales@company.com',
      due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      priority: 'high',
      tags: ['sales', 'follow-up', 'proposal'],
      related_deal: 'deal_123',
      created_by: 'system',
      created_at: new Date().toISOString()
    }
  },
  {
    id: 'task-completed',
    name: 'Task Completed',
    category: 'task',
    description: 'Task marked as complete',
    payload: {
      event_type: 'task_completed',
      task_id: 'task_002',
      title: 'Send contract for signature',
      completed_by: 'sales@company.com',
      completed_at: new Date().toISOString(),
      time_to_complete: 48,
      outcome: 'Contract sent via DocuSign',
      next_task: {
        title: 'Follow up on contract signature',
        due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
      }
    }
  },
  {
    id: 'task-overdue',
    name: 'Task Overdue',
    category: 'task',
    description: 'Task past due date notification',
    payload: {
      event_type: 'task_overdue',
      task_id: 'task_003',
      title: 'Quarterly business review preparation',
      assignee: 'account@company.com',
      original_due_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      days_overdue: 1,
      priority: 'high',
      escalation_level: 1,
      manager_notified: true
    }
  },

  // Generic Webhook Templates
  {
    id: 'webhook-form-submission',
    name: 'Form Submission',
    category: 'webhook',
    description: 'Generic form submission webhook',
    payload: {
      event_type: 'form_submitted',
      form_id: 'contact_form_001',
      form_name: 'Contact Us',
      submission_id: 'sub_123456',
      fields: {
        name: 'Jane Smith',
        email: 'jane@example.com',
        company: 'Example Corp',
        message: 'Interested in learning more about your enterprise plan',
        phone: '+1-555-0456',
        source: 'website'
      },
      metadata: {
        ip_address: '192.168.1.1',
        user_agent: 'Mozilla/5.0',
        referrer: 'https://google.com',
        submission_time: new Date().toISOString()
      }
    }
  },
  {
    id: 'webhook-payment',
    name: 'Payment Received',
    category: 'webhook',
    description: 'Payment notification webhook',
    payload: {
      event_type: 'payment_received',
      payment_id: 'pay_abc123',
      amount: 9999.99,
      currency: 'USD',
      customer: {
        id: 'cust_123',
        name: 'Acme Corporation',
        email: 'billing@acme.com'
      },
      invoice: {
        id: 'inv_456',
        number: 'INV-2024-001',
        due_date: new Date().toISOString()
      },
      payment_method: 'credit_card',
      status: 'succeeded',
      timestamp: new Date().toISOString()
    }
  },
  {
    id: 'webhook-api-event',
    name: 'API Event',
    category: 'webhook',
    description: 'Generic API event notification',
    payload: {
      event_type: 'api_event',
      event_name: 'user.subscription.updated',
      user_id: 'user_789',
      subscription: {
        id: 'sub_456',
        plan: 'enterprise',
        status: 'active',
        seats: 50,
        billing_cycle: 'annual',
        next_billing_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      },
      changes: {
        seats: { old: 25, new: 50 },
        plan: { old: 'professional', new: 'enterprise' }
      },
      timestamp: new Date().toISOString()
    }
  },

  // General Purpose Templates
  {
    id: 'general-minimal',
    name: 'Minimal Test Data',
    category: 'general',
    description: 'Simple payload for basic testing',
    payload: {
      id: '123',
      type: 'test',
      data: 'Hello World',
      timestamp: new Date().toISOString()
    }
  },
  {
    id: 'general-complex',
    name: 'Complex Nested Data',
    category: 'general',
    description: 'Complex nested structure for advanced testing',
    payload: {
      id: 'complex_001',
      metadata: {
        version: '1.0',
        source: 'test_system',
        environment: 'development'
      },
      data: {
        level1: {
          level2: {
            level3: {
              value: 'Deeply nested value',
              array: [1, 2, 3, 4, 5],
              boolean: true
            }
          },
          items: [
            { id: 1, name: 'Item 1', active: true },
            { id: 2, name: 'Item 2', active: false },
            { id: 3, name: 'Item 3', active: true }
          ]
        },
        calculations: {
          total: 12345.67,
          tax: 2345.67,
          subtotal: 10000.00,
          discount: 0.15
        }
      },
      arrays: {
        strings: ['alpha', 'beta', 'gamma'],
        numbers: [1.1, 2.2, 3.3, 4.4],
        mixed: ['text', 123, true, null, { nested: 'object' }]
      }
    }
  }
];

// Helper functions for template management
export function getTemplatesByCategory(category: PayloadTemplate['category']): PayloadTemplate[] {
  return payloadTemplates.filter(t => t.category === category);
}

export function getTemplateById(id: string): PayloadTemplate | undefined {
  return payloadTemplates.find(t => t.id === id);
}

export function interpolateTemplate(template: PayloadTemplate, variables: Record<string, any>): any {
  let payload = JSON.stringify(template.payload);
  
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    payload = payload.replace(regex, JSON.stringify(value).slice(1, -1));
  });
  
  return JSON.parse(payload);
}

export function validatePayload(payload: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  try {
    // Check if it's valid JSON
    if (typeof payload === 'string') {
      JSON.parse(payload);
    }
    
    // Basic validation rules
    if (!payload || typeof payload !== 'object') {
      errors.push('Payload must be a valid JSON object');
    }
    
    // Check for common required fields based on payload type
    if (payload.event_type === 'deal_created' && !payload.deal_id) {
      errors.push('Deal creation payload requires deal_id');
    }
    
    if (payload.action_items && !Array.isArray(payload.action_items)) {
      errors.push('action_items must be an array');
    }
    
  } catch (e) {
    errors.push('Invalid JSON format');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}