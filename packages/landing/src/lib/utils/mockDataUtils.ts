// TICKET #12: Mock Data Support - Comprehensive mock data utilities for easier testing

import logger from '@/lib/utils/logger';

interface MockDataConfig {
  seed?: string;
  count?: number;
  startDate?: Date;
  endDate?: Date;
}

interface MockUser {
  id: string;
  email: string;
  full_name: string;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

interface MockCompany {
  id: string;
  name: string;
  domain: string;
  industry: string;
  size: string;
  location: string;
  created_at: string;
  updated_at: string;
}

interface MockContact {
  id: string;
  company_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  position: string;
  created_at: string;
  updated_at: string;
}

// TICKET #12: Utility functions for generating realistic mock data
export class MockDataGenerator {
  private static instance: MockDataGenerator;
  private rng: () => number;

  private constructor(seed?: string) {
    // Simple seeded random number generator for consistent test data
    if (seed) {
      let seedNum = 0;
      for (let i = 0; i < seed.length; i++) {
        seedNum += seed.charCodeAt(i);
      }
      let s = seedNum;
      this.rng = () => {
        s = Math.sin(s) * 10000;
        return s - Math.floor(s);
      };
    } else {
      this.rng = Math.random;
    }
  }

  public static getInstance(seed?: string): MockDataGenerator {
    if (!MockDataGenerator.instance) {
      MockDataGenerator.instance = new MockDataGenerator(seed);
    }
    return MockDataGenerator.instance;
  }

  private randomChoice<T>(array: T[]): T {
    return array[Math.floor(this.rng() * array.length)];
  }

  private randomInt(min: number, max: number): number {
    return Math.floor(this.rng() * (max - min + 1)) + min;
  }

  private randomDate(start: Date, end: Date): Date {
    return new Date(start.getTime() + this.rng() * (end.getTime() - start.getTime()));
  }

  // TICKET #12: Generate mock users for development testing
  generateMockUsers(config: MockDataConfig = {}): MockUser[] {
    const count = config.count || 10;
    const users: MockUser[] = [];
    
    const firstNames = ['Andrew', 'Sarah', 'Mike', 'Emma', 'David', 'Lisa', 'John', 'Maria', 'Tom', 'Anna'];
    const lastNames = ['Smith', 'Johnson', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas'];
    const domains = ['company.com', 'business.co', 'enterprise.org', 'startup.io', 'tech.com'];

    for (let i = 0; i < count; i++) {
      const firstName = this.randomChoice(firstNames);
      const lastName = this.randomChoice(lastNames);
      const domain = this.randomChoice(domains);
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`;
      const now = new Date().toISOString();

      users.push({
        id: `user-${i + 1}-mock`,
        email,
        full_name: `${firstName} ${lastName}`,
        is_admin: i === 0, // First user is admin
        created_at: now,
        updated_at: now
      });
    }

    return users;
  }

  // TICKET #12: Generate mock companies for testing
  generateMockCompanies(config: MockDataConfig = {}): MockCompany[] {
    const count = config.count || 20;
    const companies: MockCompany[] = [];
    
    const companyNames = [
      'TechCorp', 'InnovateHub', 'DataSolutions', 'CloudTech', 'StartupBase',
      'Enterprise Systems', 'Digital Works', 'Software Labs', 'AI Dynamics', 'Future Tech',
      'Smart Solutions', 'Web Innovations', 'Mobile First', 'Cloud Nine', 'Tech Pioneers',
      'Digital Edge', 'Innovation Labs', 'Code Masters', 'Data Insights', 'Tech Ventures'
    ];
    
    const industries = ['Technology', 'Healthcare', 'Finance', 'Education', 'Manufacturing', 'Retail', 'Media'];
    const sizes = ['1-10', '11-50', '51-200', '201-1000', '1000+'];
    const locations = ['San Francisco', 'New York', 'London', 'Toronto', 'Berlin', 'Sydney', 'Singapore'];

    for (let i = 0; i < count; i++) {
      const name = this.randomChoice(companyNames);
      const domain = `${name.toLowerCase().replace(/\s+/g, '')}.com`;
      const now = new Date().toISOString();

      companies.push({
        id: `company-${i + 1}-mock`,
        name,
        domain,
        industry: this.randomChoice(industries),
        size: this.randomChoice(sizes),
        location: this.randomChoice(locations),
        created_at: now,
        updated_at: now
      });
    }

    return companies;
  }

  // TICKET #12: Generate mock contacts for testing
  generateMockContacts(companies: MockCompany[], config: MockDataConfig = {}): MockContact[] {
    const count = config.count || 50;
    const contacts: MockContact[] = [];
    
    const firstNames = [
      'Alex', 'Jordan', 'Casey', 'Taylor', 'Morgan', 'Riley', 'Avery', 'Quinn',
      'Cameron', 'Sage', 'Dakota', 'Emery', 'Finley', 'Harper', 'Jamie', 'Kendall'
    ];
    
    const lastNames = [
      'Adams', 'Baker', 'Clark', 'Evans', 'Garcia', 'Hall', 'Jackson', 'King',
      'Lewis', 'Martin', 'Nelson', 'Parker', 'Roberts', 'Scott', 'Turner', 'Walker'
    ];
    
    const positions = [
      'CEO', 'CTO', 'VP Sales', 'VP Marketing', 'Head of Product', 'Engineering Manager',
      'Sales Director', 'Marketing Manager', 'Product Manager', 'Business Development',
      'Account Executive', 'Software Engineer', 'Data Analyst', 'UI/UX Designer'
    ];

    for (let i = 0; i < count; i++) {
      const company = this.randomChoice(companies);
      const firstName = this.randomChoice(firstNames);
      const lastName = this.randomChoice(lastNames);
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${company.domain}`;
      const phone = `+1 ${this.randomInt(200, 999)}-${this.randomInt(100, 999)}-${this.randomInt(1000, 9999)}`;
      const now = new Date().toISOString();

      contacts.push({
        id: `contact-${i + 1}-mock`,
        company_id: company.id,
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        position: this.randomChoice(positions),
        created_at: now,
        updated_at: now
      });
    }

    return contacts;
  }

  // TICKET #12: Clear all mock data from localStorage
  static clearAllMockData(): void {
    const keys = [
      'sixty_mock_api_keys',
      'sixty_mock_users',
      'sixty_mock_companies',
      'sixty_mock_contacts',
      'sixty_mock_deals',
      'sixty_mock_activities'
    ];
    
    keys.forEach(key => {
      localStorage.removeItem(key);
    });
    
    logger.log('All mock data cleared from localStorage');
  }

  // TICKET #12: Initialize comprehensive mock data for development
  static initializeFullMockData(): void {
    const generator = MockDataGenerator.getInstance('development-seed');
    
    // Generate interrelated mock data
    const users = generator.generateMockUsers({ count: 5 });
    const companies = generator.generateMockCompanies({ count: 15 });
    const contacts = generator.generateMockContacts(companies, { count: 40 });
    
    // Store in localStorage for persistence across sessions
    localStorage.setItem('sixty_mock_users', JSON.stringify(users));
    localStorage.setItem('sixty_mock_companies', JSON.stringify(companies));
    localStorage.setItem('sixty_mock_contacts', JSON.stringify(contacts));
    
    logger.log('Full mock data initialized', {
      users: users.length,
      companies: companies.length,
      contacts: contacts.length
    });
  }

  // TICKET #12: Get mock data status for debugging
  static getMockDataStatus(): Record<string, any> {
    const status = {
      isDevelopment: process.env.NODE_ENV === 'development',
      mockApiKeys: JSON.parse(localStorage.getItem('sixty_mock_api_keys') || '[]').length,
      mockUsers: JSON.parse(localStorage.getItem('sixty_mock_users') || '[]').length,
      mockCompanies: JSON.parse(localStorage.getItem('sixty_mock_companies') || '[]').length,
      mockContacts: JSON.parse(localStorage.getItem('sixty_mock_contacts') || '[]').length,
      roadmapMockData: 'useRoadmap hook with 5 tickets',
      timestamp: new Date().toISOString()
    };
    
    return status;
  }
}

// TICKET #12: Development helper utilities
export const mockDataHelpers = {
  // Check if running in development with mock data enabled
  isDevModeWithMockData: (): boolean => {
    return process.env.NODE_ENV === 'development';
  },

  // Get mock user for development authentication bypass
  getDevMockUser: (): MockUser => {
    const users = JSON.parse(localStorage.getItem('sixty_mock_users') || '[]');
    if (users.length > 0) {
      return users[0]; // Return first user (admin)
    }
    
    // Create a default mock user if none exists
    return {
      id: 'dev-mock-user-1',
      email: 'andrew.bryce@company.com',
      full_name: 'Andrew Bryce',
      is_admin: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  },

  // Initialize mock data if in development mode
  ensureMockDataExists: (): void => {
    if (mockDataHelpers.isDevModeWithMockData()) {
      const status = MockDataGenerator.getMockDataStatus();
      
      // Initialize if no mock data exists
      if (status.mockUsers === 0 || status.mockCompanies === 0) {
        MockDataGenerator.initializeFullMockData();
        logger.log('Mock data initialized for development');
      } else {
        logger.log('Using existing mock data', status);
      }
    }
  },

  // Log mock data status for debugging
  logMockDataStatus: (): void => {
    if (mockDataHelpers.isDevModeWithMockData()) {
      const status = MockDataGenerator.getMockDataStatus();
      logger.log('Mock data status:', status);
    }
  }
};

// TICKET #12: Auto-initialize mock data in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // Initialize mock data when module loads
  setTimeout(() => {
    mockDataHelpers.ensureMockDataExists();
  }, 100);
}