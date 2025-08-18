import { supabase } from '@/lib/supabase/client';
import type { Contact, Company } from '@/lib/database/models';
import { CompanyService } from './companyService';

export class ContactService {
  
  /**
   * Get all contacts for the current user with optional search and filters
   */
  static async getContacts(options?: {
    search?: string;
    companyId?: string;
    isPrimary?: boolean;
    includeCompany?: boolean;
  }) {
    try {
      if (options?.includeCompany) {
        let query = supabase
          .from('contacts')
          .select(`
            *,
            companies(*)
          `)
          .order('full_name');

        // Apply search filter
        if (options?.search) {
          // Import security utilities
          const { validateSearchTerm, SafeQueryBuilder } = await import('@/lib/utils/sqlSecurity');
          
          // Validate search term
          const validation = validateSearchTerm(options.search);
          if (!validation.isValid) {
            throw new Error(validation.error || 'Invalid search term');
          }
          
          // Build safe OR clause
          const searchOrClause = new SafeQueryBuilder()
            .addSearchCondition('full_name', validation.sanitized)
            .addSearchCondition('email', validation.sanitized)
            .buildOrClause();
            
          query = query.or(searchOrClause);
        }

        // Apply company filter
        if (options?.companyId) {
          query = query.eq('company_id', options.companyId);
        }

        // Apply primary contact filter
        if (options?.isPrimary !== undefined) {
          query = query.eq('is_primary', options.isPrimary);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data as any as Contact[];
      } else {
        let query = supabase
          .from('contacts')
          .select('*')
          .order('full_name');

        // Apply search filter
        if (options?.search) {
          // Import security utilities
          const { validateSearchTerm, SafeQueryBuilder } = await import('@/lib/utils/sqlSecurity');
          
          // Validate search term
          const validation = validateSearchTerm(options.search);
          if (!validation.isValid) {
            throw new Error(validation.error || 'Invalid search term');
          }
          
          // Build safe OR clause
          const searchOrClause = new SafeQueryBuilder()
            .addSearchCondition('full_name', validation.sanitized)
            .addSearchCondition('email', validation.sanitized)
            .buildOrClause();
            
          query = query.or(searchOrClause);
        }

        // Apply company filter
        if (options?.companyId) {
          query = query.eq('company_id', options.companyId);
        }

        // Apply primary contact filter
        if (options?.isPrimary !== undefined) {
          query = query.eq('is_primary', options.isPrimary);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data as Contact[];
      }
    } catch (error) {
      console.error('Error fetching contacts:', error);
      throw error;
    }
  }

  /**
   * Get a single contact by ID with full details
   */
  static async getContactById(id: string, includeRelationships = true) {
    try {
      // First, get the basic contact data
      const { data: contact, error: contactError } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', id)
        .single();

      if (contactError) throw contactError;
      if (!contact) return null;

      // If relationships not needed, return basic contact
      if (!includeRelationships) {
        return contact as Contact;
      }

      // Manually fetch company data if company_id exists
      let companyData = null;
      if (contact.company_id) {
        const { data: company, error: companyError } = await supabase
          .from('companies')
          .select('*')
          .eq('id', contact.company_id)
          .single();

        if (!companyError && company) {
          companyData = company;
        }
      }

      // Manually fetch deals data if needed
      let dealsData = [];
      try {
        const { data: deals, error: dealsError } = await supabase
          .from('deals')
          .select('*')
          .eq('contact_email', contact.email);

        if (!dealsError && deals) {
          dealsData = deals;
        }
      } catch (dealsError) {
        console.warn('Could not fetch deals for contact:', dealsError);
      }

      // Combine the data
      return {
        ...contact,
        companies: companyData,
        deals: dealsData
      } as any as Contact;
    } catch (error) {
      console.error('Error fetching contact:', error);
      throw error;
    }
  }

  /**
   * Find contact by email
   */
  static async findContactByEmail(email: string) {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('email', email.toLowerCase())
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        throw error;
      }

      return data as Contact | null;
    } catch (error) {
      console.error('Error finding contact by email:', error);
      return null;
    }
  }

  /**
   * Create a new contact with automatic company assignment
   */
  static async createContact(contactData: Omit<Contact, 'id' | 'created_at' | 'updated_at' | 'full_name'>) {
    try {
      // Auto-assign company if not provided but email domain exists
      if (!contactData.company_id && contactData.email && contactData.owner_id) {
        const domain = CompanyService.extractDomainFromEmail(contactData.email);
        if (domain) {
          const company = await CompanyService.findCompanyByDomain(domain);
          if (company) {
            contactData.company_id = company.id;
          }
        }
      }

      // Ensure email is lowercase
      if (contactData.email) {
        contactData.email = contactData.email.toLowerCase();
      }

      const { data, error } = await supabase
        .from('contacts')
        .insert(contactData)
        .select('*')
        .single();

      if (error) throw error;
      return data as Contact;
    } catch (error) {
      console.error('Error creating contact:', error);
      throw error;
    }
  }

  /**
   * Update an existing contact
   */
  static async updateContact(id: string, updates: Partial<Contact>) {
    try {
      // Ensure email is lowercase if provided
      if (updates.email) {
        updates.email = updates.email.toLowerCase();
      }

      const { data, error } = await supabase
        .from('contacts')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      return data as Contact;
    } catch (error) {
      console.error('Error updating contact:', error);
      throw error;
    }
  }

  /**
   * Delete a contact
   */
  static async deleteContact(id: string) {
    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting contact:', error);
      throw error;
    }
  }

  /**
   * Check if a company has an existing primary contact
   */
  private static async hasExistingPrimaryContact(companyId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('id')
        .eq('company_id', companyId)
        .eq('is_primary', true)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return !!data;
    } catch (error) {
      console.error('Error checking primary contact:', error);
      return false;
    }
  }

  /**
   * Set contact as primary for their company
   */
  static async setPrimaryContact(contactId: string) {
    try {
      // Get the contact to find their company
      const contact = await this.getContactById(contactId, false);
      if (!contact || !contact.company_id) {
        throw new Error('Contact or company not found');
      }

      // This will be handled by the database trigger
      const { data, error } = await supabase
        .from('contacts')
        .update({ is_primary: true })
        .eq('id', contactId)
        .select('*')
        .single();

      if (error) throw error;
      return data as Contact;
    } catch (error) {
      console.error('Error setting primary contact:', error);
      throw error;
    }
  }

  /**
   * Auto-create contact from email with company detection
   */
  static async autoCreateContactFromEmail(
    email: string,
    owner_id: string,
    firstName?: string,
    lastName?: string,
    companyName?: string
  ): Promise<Contact | null> {
    try {
      // Check if contact already exists
      const existing = await this.findContactByEmail(email);
      if (existing) return existing;

      // Try to find or create company
      let company: Company | null = null;
      const domain = CompanyService.extractDomainFromEmail(email);
      
      if (domain) {
        company = await CompanyService.findCompanyByDomain(domain);
        
        // Create company if it doesn't exist and we have a company name
        if (!company && companyName) {
          company = await CompanyService.autoCreateCompanyFromEmail(email, owner_id, companyName);
        }
      }

      // Create the contact
      return await this.createContact({
        email,
        first_name: firstName,
        last_name: lastName,
        company_id: company?.id,
        owner_id,
        is_primary: company ? !await this.hasExistingPrimaryContact(company.id) : false
      });
    } catch (error) {
      console.error('Error auto-creating contact:', error);
      return null;
    }
  }

  /**
   * Get contacts for a specific company
   */
  static async getContactsByCompany(companyId: string) {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('company_id', companyId)
        .order('is_primary', { ascending: false })
        .order('full_name');

      if (error) throw error;
      return data as Contact[];
    } catch (error) {
      console.error('Error fetching company contacts:', error);
      throw error;
    }
  }

  /**
   * Search contacts with intelligent matching
   */
  static async searchContacts(query: string, includeCompany = true) {
    try {
      if (includeCompany) {
        // For now, do basic search without company join due to relationship issues
        const { data, error } = await supabase
          .from('contacts')
          .select('*')
          .or(`
            full_name.ilike.%${query}%,
            email.ilike.%${query}%,
            title.ilike.%${query}%
          `)
          .order('full_name')
          .limit(20);

        if (error) throw error;
        return data as Contact[];
      } else {
        const { data, error } = await supabase
          .from('contacts')
          .select('*')
          .or(`
            full_name.ilike.%${query}%,
            email.ilike.%${query}%,
            title.ilike.%${query}%
          `)
          .order('full_name')
          .limit(20);

        if (error) throw error;
        return data as Contact[];
      }
    } catch (error) {
      console.error('Error searching contacts:', error);
      throw error;
    }
  }

  /**
   * Get contact statistics
   */
  static async getContactStats(contactId: string) {
    try {
      const [dealsResult, activitiesResult] = await Promise.all([
        // Get deals count
        supabase
          .from('deal_contacts')
          .select('deals(value, status)')
          .eq('contact_id', contactId),
        
        // Get recent activities
        supabase
          .from('activities')
          .select('id, type, created_at')
          .eq('contact_id', contactId)
          .order('created_at', { ascending: false })
          .limit(10)
      ]);

      const dealContacts = dealsResult.data || [];
      const activities = activitiesResult.data || [];

      const deals = dealContacts.map((dc: any) => dc.deals).filter(Boolean);
      const totalDealsValue = deals.reduce((sum, deal) => sum + (deal.value || 0), 0);
      const activeDeals = deals.filter(deal => deal.status === 'active').length;

      return {
        totalDealsValue,
        activeDeals,
        totalDeals: deals.length,
        recentActivities: activities,
        activityCount: activities.length
      };
    } catch (error) {
      console.error('Error fetching contact stats:', error);
      throw error;
    }
  }
} 