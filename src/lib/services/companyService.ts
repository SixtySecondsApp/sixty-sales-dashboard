import type { Company } from '@/lib/database/models';
import { API_BASE_URL } from '@/lib/config';
import logger from '@/lib/utils/logger';

export class CompanyService {
  
  /**
   * Get all companies for the current user with optional search and filters
   */
  static async getCompanies(options?: {
    search?: string;
    domain?: string;
    size?: string;
    industry?: string;
    includeStats?: boolean;
  }) {
    try {
      const params = new URLSearchParams();
      
      if (options?.search) params.append('search', options.search);
      if (options?.includeStats) params.append('includeStats', 'true');
      if (options?.domain) params.append('domain', options.domain);
      if (options?.size) params.append('size', options.size);
      if (options?.industry) params.append('industry', options.industry);

      const response = await fetch(`${API_BASE_URL}/companies?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      return result.data as Company[];
    } catch (error) {
      logger.error('Error fetching companies:', error);
      throw error;
    }
  }

  /**
   * Get a single company by ID with full details
   */
  static async getCompanyById(id: string, includeRelationships = true) {
    try {
      const response = await fetch(`${API_BASE_URL}/companies/${id}?includeRelationships=${includeRelationships}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json() as Company;
    } catch (error) {
      logger.error('Error fetching company:', error);
      throw error;
    }
  }

  /**
   * Find company by domain (for auto-matching)
   */
  static async findCompanyByDomain(domain: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/companies?domain=${encodeURIComponent(domain.toLowerCase())}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      return result.data.length > 0 ? result.data[0] as Company : null;
    } catch (error) {
      logger.error('Error finding company by domain:', error);
      return null;
    }
  }

  /**
   * Extract domain from email address
   */
  static extractDomainFromEmail(email: string): string | null {
    if (!email || !email.includes('@')) return null;
    
    const domain = email.split('@')[1]?.toLowerCase();
    
    // Filter out common personal email domains
    const personalDomains = [
      'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 
      'icloud.com', 'me.com', 'aol.com', 'live.com'
    ];
    
    if (personalDomains.includes(domain)) return null;
    
    return domain;
  }

  /**
   * Suggest company name from domain
   */
  static suggestCompanyNameFromDomain(domain: string): string {
    if (!domain) return '';
    
    // Remove common TLDs and format as company name
    const name = domain
      .replace(/\.(com|org|net|co\.uk|io|ai|tech)$/i, '')
      .split('.')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
    
    return name;
  }

  /**
   * Create a new company
   */
  static async createCompany(companyData: Omit<Company, 'id' | 'created_at' | 'updated_at'>) {
    try {
      // Ensure domain is lowercase
      if (companyData.domain) {
        companyData.domain = companyData.domain.toLowerCase();
      }

      const response = await fetch(`${API_BASE_URL}/companies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(companyData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json() as Company;
    } catch (error) {
      logger.error('Error creating company:', error);
      throw error;
    }
  }

  /**
   * Update an existing company
   */
  static async updateCompany(id: string, updates: Partial<Company>) {
    try {
      // Ensure domain is lowercase
      if (updates.domain) {
        updates.domain = updates.domain.toLowerCase();
      }

      const response = await fetch(`${API_BASE_URL}/companies/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json() as Company;
    } catch (error) {
      logger.error('Error updating company:', error);
      throw error;
    }
  }

  /**
   * Delete a company
   */
  static async deleteCompany(id: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/companies/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return true;
    } catch (error) {
      logger.error('Error deleting company:', error);
      throw error;
    }
  }

  /**
   * Auto-create company from email domain
   */
  static async autoCreateCompanyFromEmail(
    email: string, 
    owner_id: string,
    suggestedName?: string
  ): Promise<Company | null> {
    try {
      const domain = this.extractDomainFromEmail(email);
      if (!domain) return null;

      // Check if company already exists
      const existing = await this.findCompanyByDomain(domain);
      if (existing) return existing;

      // Create new company
      const companyName = suggestedName || this.suggestCompanyNameFromDomain(domain);
      
      return await this.createCompany({
        name: companyName,
        domain,
        owner_id: owner_id || 'dev-user-123' // Provide default for development
      });
    } catch (error) {
      logger.error('Error auto-creating company:', error);
      return null;
    }
  }

  /**
   * Get company statistics
   */
  static async getCompanyStats(companyId: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/companies/${companyId}/stats`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      logger.error('Error fetching company stats:', error);
      throw error;
    }
  }
} 