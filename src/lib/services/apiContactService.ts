import type { Contact } from '@/lib/database/models';
import { API_BASE_URL, DISABLE_EDGE_FUNCTIONS } from '@/lib/config';
import { getSupabaseHeaders } from '@/lib/utils/apiUtils';
import { supabase } from '@/lib/supabase/clientV2';
import logger from '@/lib/utils/logger';

export class ApiContactService {
  
  /**
   * Get all contacts with optional search and filters
   */
  static async getContacts(options?: {
    search?: string;
    companyId?: string;
    isPrimary?: boolean;
    includeCompany?: boolean;
    limit?: number;
    ownerId?: string;
  }) {
    try {
      // Always use direct Supabase queries for contacts (Edge Function seems to be having issues)
      logger.log('📋 Fetching contacts directly from Supabase');
      
      let query = supabase
        .from('contacts')
        .select('*', { count: 'exact' });

      // Apply search filter (only search on columns that exist in the database)
      if (options?.search) {
        const searchTerm = options.search.trim();
        query = query.or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
      }

      // Apply other filters
      if (options?.companyId) {
        query = query.eq('company_id', options.companyId);
      }
      if (options?.ownerId) {
        query = query.eq('owner_id', options.ownerId);
      }

      // Apply limit
      if (options?.limit) {
        query = query.limit(options.limit);
      } else {
        query = query.limit(50); // Default limit
      }

      // Order by created_at
      query = query.order('created_at', { ascending: false });

      const { data: contacts, error, count } = await query;

      if (error) {
        logger.error('Error fetching contacts from Supabase:', error);
        throw error;
      }

      // Process contacts to add computed fields
      let processedContacts = (contacts || []).map(contact => ({
        ...contact,
        // Generate full_name since it doesn't exist in the database
        full_name: (contact.first_name && contact.last_name 
          ? `${contact.first_name} ${contact.last_name}` 
          : contact.first_name || contact.last_name || '')
      }));

      // If includeCompany is true, fetch companies for all contacts
      let enrichedContacts = processedContacts;
      if (options?.includeCompany && processedContacts.length > 0) {
        const companyIds = [...new Set(processedContacts
          .filter(c => c.company_id)
          .map(c => c.company_id))];
        
        if (companyIds.length > 0) {
          const { data: companies, error: companiesError } = await supabase
            .from('companies')
            .select('*')
            .in('id', companyIds);
          
          if (!companiesError && companies) {
            const companiesMap = new Map(companies.map(c => [c.id, c]));
            enrichedContacts = processedContacts.map(contact => ({
              ...contact,
              company: contact.company_id ? companiesMap.get(contact.company_id) : undefined
            }));
          }
        }
      }

      logger.log(`✅ Fetched ${enrichedContacts.length} contacts`);
      return enrichedContacts as Contact[];
    } catch (error) {
      logger.error('Error fetching contacts:', error);
      throw error;
    }
  }

  /**
   * Get a single contact by ID with full details
   */
  static async getContactById(id: string, includeRelationships = true) {
    try {
      // If edge functions are disabled or we're in local development, use direct Supabase
      if (DISABLE_EDGE_FUNCTIONS || API_BASE_URL === '/api') {
        logger.log('🔄 Using direct Supabase for contact fetch');
        return await this.getContactByIdDirect(id, includeRelationships);
      }

      const params = new URLSearchParams();
      params.append('id', id);
      params.append('includeCompany', includeRelationships.toString());
      
      const headers = await getSupabaseHeaders();
      const response = await fetch(`${API_BASE_URL}/contacts?${params}`, {
        headers
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      return result.data as Contact;
    } catch (error) {
      logger.error('Error fetching contact via API, falling back to direct Supabase:', error);
      
      // Fallback to direct Supabase
      try {
        return await this.getContactByIdDirect(id, includeRelationships);
      } catch (fallbackError) {
        logger.error('Direct Supabase fallback also failed:', fallbackError);
        throw fallbackError;
      }
    }
  }

  /**
   * Direct Supabase method to get contact by ID
   */
  private static async getContactByIdDirect(id: string, includeRelationships = true): Promise<Contact | null> {
    try {
      logger.log('📋 Fetching contact directly from Supabase:', id);

      // Get the contact record
      const { data: contact, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          return null;
        }
        throw error;
      }

      if (!contact) {
        return null;
      }

      // Format the contact data to match the expected interface
      const formattedContact: Contact = {
        id: contact.id,
        email: contact.email,
        first_name: contact.first_name,
        last_name: contact.last_name,
        // Generate full_name since it doesn't exist in the database
        full_name: (contact.first_name && contact.last_name 
            ? `${contact.first_name} ${contact.last_name}` 
            : contact.first_name || contact.last_name || ''),
        phone: contact.phone,
        title: contact.title,
        company_id: contact.company_id,
        // company_name and is_primary don't exist in the database
        linkedin_url: contact.linkedin_url,
        notes: contact.notes,
        owner_id: contact.owner_id,
        created_at: contact.created_at,
        updated_at: contact.updated_at,
      };

      logger.log('✅ Contact fetched successfully from Supabase:', formattedContact.email);
      return formattedContact;
    } catch (error) {
      logger.error('❌ Error fetching contact from Supabase:', error);
      throw error;
    }
  }

  /**
   * Find contact by email
   */
  static async findContactByEmail(email: string) {
    try {
      const params = new URLSearchParams();
      params.append('search', email);
      params.append('limit', '1');
      
      const contacts = await this.getContacts({ search: email, limit: 1 });
      
      // Find exact email match
      const contact = contacts.find(c => c.email?.toLowerCase() === email.toLowerCase());
      return contact || null;
    } catch (error) {
      logger.error('Error finding contact by email:', error);
      return null;
    }
  }

  /**
   * Create a new contact
   */
  static async createContact(contactData: Omit<Contact, 'id' | 'created_at' | 'updated_at' | 'full_name'>) {
    try {
      // Use direct Supabase query for creating contacts
      logger.log('📋 Creating contact directly via Supabase');
      
      const { data: contact, error } = await supabase
        .from('contacts')
        .insert(contactData)
        .select()
        .single();

      if (error) {
        logger.error('Error creating contact in Supabase:', error);
        throw error;
      }

      logger.log('✅ Contact created successfully:', contact);
      return contact as Contact;
    } catch (error) {
      logger.error('Error creating contact:', error);
      throw error;
    }
  }

  /**
   * Update an existing contact
   */
  static async updateContact(id: string, updates: Partial<Contact>) {
    try {
      // Use direct Supabase query for updating contacts
      logger.log('📋 Updating contact directly via Supabase');
      
      const { data: contact, error } = await supabase
        .from('contacts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        logger.error('Error updating contact in Supabase:', error);
        throw error;
      }

      logger.log('✅ Contact updated successfully:', contact);
      return contact as Contact;
    } catch (error) {
      logger.error('Error updating contact:', error);
      throw error;
    }
  }

  /**
   * Delete a contact
   */
  static async deleteContact(id: string) {
    try {
      // Use direct Supabase query for deleting contacts
      logger.log('📋 Deleting contact directly via Supabase');
      
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', id);

      if (error) {
        logger.error('Error deleting contact in Supabase:', error);
        throw error;
      }

      logger.log('✅ Contact deleted successfully');
      return true;
    } catch (error) {
      logger.error('Error deleting contact:', error);
      throw error;
    }
  }

  /**
   * Get contacts for a specific company
   */
  static async getContactsByCompany(companyId: string) {
    try {
      return await this.getContacts({ 
        companyId, 
        includeCompany: false 
      });
    } catch (error) {
      logger.error('Error fetching company contacts:', error);
      throw error;
    }
  }

  /**
   * Search contacts with intelligent matching
   */
  static async searchContacts(query: string, includeCompany = true) {
    try {
      return await this.getContacts({ 
        search: query, 
        includeCompany,
        limit: 20
      });
    } catch (error) {
      logger.error('Error searching contacts:', error);
      throw error;
    }
  }

  /**
   * Get contact statistics and related data
   */
  static async getContactStats(contactId: string) {
    try {
      const headers = await getSupabaseHeaders();
      const response = await fetch(`${API_BASE_URL}/contacts?id=${contactId}&stats=true`, {
        headers
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      return result.data || {
        meetings: 0,
        emails: 0,
        calls: 0,
        totalDeals: 0,
        activeDeals: 0,
        totalDealsValue: 0,
        engagementScore: 0,
        recentActivities: []
      };
    } catch (error) {
      logger.error('Error fetching contact stats:', error);
      // Return fallback mock data
      return {
        meetings: 0,
        emails: 0,
        calls: 0,
        totalDeals: 0,
        activeDeals: 0,
        totalDealsValue: 0,
        engagementScore: 0,
        recentActivities: []
      };
    }
  }

  /**
   * Auto-create contact from email with company detection
   * TODO: Implement with Express API when needed
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

      // For now, create basic contact without company auto-detection
      return await this.createContact({
        email,
        first_name: firstName,
        last_name: lastName,
        owner_id,
        is_primary: false
        // TODO: Add company auto-detection logic via API
      });
    } catch (error) {
      logger.error('Error auto-creating contact:', error);
      return null;
    }
  }

  /**
   * Set contact as primary for their company
   * TODO: Implement with Express API when needed
   */
  static async setPrimaryContact(contactId: string) {
    try {
      // For now, just update the contact to set is_primary = true
      // TODO: Add server-side logic to handle making other contacts non-primary
      return await this.updateContact(contactId, { is_primary: true });
    } catch (error) {
      logger.error('Error setting primary contact:', error);
      throw error;
    }
  }

  /**
   * Get deals for a specific contact
   */
  static async getContactDeals(contactId: string) {
    try {
      const headers = await getSupabaseHeaders();
      const response = await fetch(`${API_BASE_URL}/contacts?id=${contactId}&deals=true`, {
        headers
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      return result.data || [];
    } catch (error) {
      logger.error('Error fetching contact deals:', error);
      return []; // Return empty array on error
    }
  }

  /**
   * Get activities for a specific contact
   */
  static async getContactActivities(contactId: string, limit = 10) {
    try {
      const headers = await getSupabaseHeaders();
      const response = await fetch(`${API_BASE_URL}/contacts?id=${contactId}&activities=true&limit=${limit}`, {
        headers
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      return result.data || [];
    } catch (error) {
      logger.error('Error fetching contact activities:', error);
      return []; // Return empty array on error
    }
  }

  /**
   * Get the owner (sales rep) info for a contact
   */
  static async getContactOwner(contactId: string) {
    try {
      const headers = await getSupabaseHeaders();
      const response = await fetch(`${API_BASE_URL}/contacts?id=${contactId}&owner=true`, {
        headers
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      return result.data || null;
    } catch (error) {
      logger.error('Error fetching contact owner:', error);
      return null; // Return null on error
    }
  }

  /**
   * Get tasks for a specific contact
   */
  static async getContactTasks(contactId: string) {
    try {
      const headers = await getSupabaseHeaders();
      const response = await fetch(`${API_BASE_URL}/contacts?id=${contactId}&tasks=true`, {
        headers
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      return result.data || [];
    } catch (error) {
      logger.error('Error fetching contact tasks:', error);
      return []; // Return empty array on error
    }
  }
} 