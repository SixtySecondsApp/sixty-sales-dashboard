/**
 * Test data fixtures for comprehensive testing
 */

export const testUsers = {
  validUser: {
    email: 'test.user@example.com',
    password: 'TestPass123!',
    firstName: 'Test',
    lastName: 'User'
  },
  adminUser: {
    email: 'admin@example.com',
    password: 'AdminPass123!',
    firstName: 'Admin',
    lastName: 'User'
  },
  invalidUser: {
    email: 'invalid@example.com',
    password: 'wrongpassword'
  }
};

export const testContacts = {
  validContact: {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@acmecorp.com',
    phone: '+1234567890',
    company: 'Acme Corporation',
    position: 'CEO',
    linkedinUrl: 'https://linkedin.com/in/johndoe'
  },
  invalidContact: {
    firstName: '',
    lastName: '',
    email: 'invalid-email',
    phone: 'invalid-phone'
  },
  contactWithMinimalData: {
    firstName: 'Jane',
    email: 'jane@example.com'
  }
};

export const testCompanies = {
  validCompany: {
    name: 'Acme Corporation',
    website: 'https://acme.com',
    industry: 'Technology',
    size: '100-500 employees'
  },
  invalidCompany: {
    name: '',
    website: 'invalid-url'
  }
};

export const testDeals = {
  validDeal: {
    name: 'Acme Corp - Software License',
    company: 'Acme Corporation',
    value: 50000,
    stage: 'Opportunity',
    probability: 50,
    expectedCloseDate: '2024-12-31',
    contactEmail: 'john.doe@acmecorp.com',
    contactName: 'John Doe'
  },
  adminOnlyDeal: {
    name: 'Enterprise Deal - Revenue Split',
    company: 'Enterprise Corp',
    oneOffRevenue: 25000,
    monthlyMrr: 5000,
    stage: 'Signed',
    probability: 100
  }
};

export const testActivities = {
  outbound: {
    type: 'outbound',
    clientName: 'Acme Corporation',
    outboundType: 'Call',
    outboundCount: 5,
    date: '2024-01-15'
  },
  meeting: {
    type: 'meeting',
    clientName: 'Acme Corporation',
    details: 'Discovery',
    contactEmail: 'john.doe@acmecorp.com',
    contactName: 'John Doe',
    status: 'completed'
  },
  proposal: {
    type: 'proposal',
    clientName: 'Acme Corporation',
    amount: 50000,
    contactEmail: 'john.doe@acmecorp.com',
    contactName: 'John Doe'
  },
  sale: {
    type: 'sale',
    clientName: 'Acme Corporation',
    oneOffRevenue: 25000,
    monthlyMrr: 5000,
    contactEmail: 'john.doe@acmecorp.com',
    contactName: 'John Doe'
  }
};

export const testTasks = {
  validTask: {
    title: 'Call John about the proposal',
    description: 'Follow up on the proposal we sent last week',
    taskType: 'call',
    priority: 'high',
    dueDate: '2024-01-20T10:00:00',
    contactName: 'John Doe',
    company: 'Acme Corporation'
  },
  invalidTask: {
    title: '',
    taskType: 'unknown'
  }
};

export const errorScenarios = {
  networkError: {
    message: 'Network request failed',
    status: 0
  },
  authError: {
    message: 'Authentication failed',
    status: 401
  },
  forbiddenError: {
    message: 'Forbidden',
    status: 403
  },
  notFoundError: {
    message: 'Not found',
    status: 404
  },
  validationError: {
    message: 'Validation failed',
    status: 422
  },
  serverError: {
    message: 'Internal server error',
    status: 500
  }
};

export const testEnvironment = {
  baseUrl: 'http://127.0.0.1:5173',
  apiUrl: 'http://127.0.0.1:5173/api',
  timeout: {
    short: 5000,
    medium: 15000,
    long: 30000
  }
};