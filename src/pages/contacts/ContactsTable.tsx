import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Search, 
  Plus, 
  Mail, 
  Phone,
  Edit,
  Trash2,
  ExternalLink,
  Building2,
  Download,
  ArrowUpDown,
  Star,
  StarOff
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useUser } from '@/lib/hooks/useUser';
import { API_BASE_URL } from '@/lib/config';
import { supabase } from '@/lib/supabase/clientV2';
import { getSupabaseHeaders } from '@/lib/utils/apiUtils';

interface Contact {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email: string;
  phone?: string | null;
  company_name?: string; // This is a text field, not a foreign key
  created_at: string;
  updated_at: string;
  // Optional fields that may not exist in database
  full_name?: string;
  title?: string;
  company_id?: string;
  owner_id?: string;
  linkedin_url?: string;
  notes?: string;
  is_primary?: boolean;
  // Company relationship (only available when Edge Functions work)
  company?: {
    id: string;
    name: string;
    domain?: string;
    size?: string;
    industry?: string;
    website?: string;
  };
}

interface ContactsResponse {
  data: Contact[];
  error: string | null;
  count: number;
}

type SortField = 'full_name' | 'email' | 'title' | 'company_name' | 'is_primary' | 'created_at' | 'updated_at';
type SortDirection = 'asc' | 'desc';

export default function ContactsTable() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [primaryFilter, setPrimaryFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('updated_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Fetch contacts from API
  useEffect(() => {
    const fetchContacts = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Check authentication first
        console.log('🔍 Checking user authentication for contacts...');
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          console.log('⚠️ No session found - using service key fallback for contacts...');
          
          // Skip Edge Functions entirely and go straight to service key fallback
          const { createClient } = await import('@supabase/supabase-js');
          const serviceSupabase = createClient(
            import.meta.env.VITE_SUPABASE_URL || '',
            import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || ''
          );
          
          console.log('🛡️ Using service key fallback for contacts (no auth)...');
          
          // Use the actual database structure - no companies join since relationship doesn't exist
          const { data: serviceContactsData, error: serviceError } = await (serviceSupabase as any)
            .from('contacts')
            .select('*') // Get all available fields
            .order('created_at', { ascending: false });
            
          if (serviceError) {
            console.error('❌ Service key contacts fallback failed:', serviceError);
            throw serviceError;
          }
          
          console.log(`✅ Service key contacts fallback successful: Retrieved ${serviceContactsData?.length || 0} contacts`);
          
          // Process contacts - no company join available, so use the company text field
          const processedContacts = serviceContactsData?.map((contact: any) => ({
            ...contact,
            is_primary: contact.is_primary || false,
            company: contact.company_name ? { name: contact.company_name } : null // Use company text field
          })) || [];
          
          setContacts(processedContacts);
          setIsLoading(false);
          return;
        }

        // If authenticated, try Edge Functions first
        console.log('🌐 User authenticated - trying Edge Functions for contacts...');
        
        const params = new URLSearchParams({
          includeCompany: 'true'
        });
        
        if (searchTerm) {
          params.append('search', searchTerm);
        }

        try {
          const response = await fetch(`${API_BASE_URL}/contacts?${params}`, {
            headers: await getSupabaseHeaders(),
          });
          
          if (response.status === 401) {
            setError('Authentication required. Please log in to view contacts.');
            return;
          }
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const result = await response.json();
          setContacts(result.data || []);
          return;
        } catch (edgeFunctionError) {
          console.warn('Contacts Edge Function failed, falling back to direct Supabase client:', edgeFunctionError);
        }

        // Fallback to direct Supabase client with anon key
        console.log('🛡️ Contacts fallback: Using direct Supabase client...');
        
        let query = (supabase as any)
          .from('contacts')
          .select('*')
          .order('created_at', { ascending: false });

        if (searchTerm) {
          query = query.or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
        }

        const { data: contactsData, error: supabaseError } = await query;

        if (supabaseError) {
          console.error('❌ Contacts anon fallback failed:', supabaseError);
          console.log('🔄 Trying contacts with service role key...');
          
          // Last resort: try with service role key
          const { createClient } = await import('@supabase/supabase-js');
          const serviceSupabase = createClient(
            import.meta.env.VITE_SUPABASE_URL || '',
            import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || ''
          );
          
          const { data: serviceContactsData, error: serviceError } = await (serviceSupabase as any)
            .from('contacts')
            .select('*')
            .order('created_at', { ascending: false });
            
          if (serviceError) {
            console.error('❌ Service key contacts fallback failed:', serviceError);
            throw serviceError;
          }
          
          console.log(`✅ Service key contacts fallback successful: Retrieved ${serviceContactsData?.length || 0} contacts`);
          const processedContacts = serviceContactsData?.map((contact: any) => ({
            ...contact,
            is_primary: contact.is_primary || false,
            company: null
          })) || [];
          
          setContacts(processedContacts);
          return;
        }

        console.log(`✅ Contacts fallback successful: Retrieved ${contactsData?.length || 0} contacts`);
        
        // Process the data to match expected interface
        const processedContacts = contactsData?.map((contact: any) => ({
          ...contact,
          is_primary: contact.is_primary || false,
          company: contact.company_name ? { name: contact.company_name } : null // Use company text field
        })) || [];

        setContacts(processedContacts);
      } catch (err) {
        console.error('Error fetching contacts:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch contacts');
        toast.error('Failed to load contacts');
      } finally {
        setIsLoading(false);
      }
    };

    fetchContacts();
  }, [searchTerm]);

  // Handle row click to navigate to contact record
  const handleContactClick = (contactId: string, event: React.MouseEvent) => {
    // Don't navigate if clicking on links or buttons
    const target = event.target as HTMLElement;
    if (target.tagName === 'A' || target.closest('button') || target.closest('a')) {
      return;
    }
    
    navigate(`/crm/contacts/${contactId}`);
  };

  // Filter and sort contacts
  const filteredAndSortedContacts = useMemo(() => {
    let filtered = contacts.filter(contact => {
      const companyName = contact.company_name || contact.company?.name;
      const matchesCompany = companyFilter === 'all' || (companyName === companyFilter);
      const matchesPrimary = primaryFilter === 'all' || 
        (primaryFilter === 'primary' ? contact.is_primary : !contact.is_primary);
      return matchesCompany && matchesPrimary;
    });

    // Sort contacts
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'company_name':
          aValue = a.company?.name || '';
          bValue = b.company?.name || '';
          break;
        default:
          aValue = a[sortField];
          bValue = b[sortField];
      }

      // Handle null/undefined values
      if (aValue == null) aValue = '';
      if (bValue == null) bValue = '';

      // Convert to string for comparison if needed
      if (typeof aValue === 'string') aValue = aValue.toLowerCase();
      if (typeof bValue === 'string') bValue = bValue.toLowerCase();

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [contacts, companyFilter, primaryFilter, sortField, sortDirection]);

  // Get unique values for filters
  const uniqueCompanies = [...new Set(contacts
    .filter(c => c.company_name || c.company?.name) // Check both company text field and company relationship
    .map(c => c.company_name || c.company?.name)
    .filter(Boolean)
  )];

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    return <ArrowUpDown className={`w-4 h-4 ${sortDirection === 'asc' ? 'text-blue-400' : 'text-blue-400 rotate-180'}`} />;
  };

  const formatName = (contact: Contact) => {
    // Try full_name first (if it exists)
    if (contact.full_name && contact.full_name.trim()) {
      return contact.full_name.trim();
    }
    
    // Try first_name and last_name combination
    const firstName = contact.first_name?.trim() || '';
    const lastName = contact.last_name?.trim() || '';
    
    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    }
    if (firstName) return firstName;
    if (lastName) return lastName;
    
    // Fallback to email username part (before @)
    if (contact.email) {
      const emailUsername = contact.email.split('@')[0];
      // Make it more readable (replace dots/underscores with spaces, capitalize)
      const readableName = emailUsername
        .replace(/[._-]/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      return `${readableName} (from email)`;
    }
    
    return 'Unnamed Contact';
  };

  const exportToCSV = () => {
    const csvContent = [
      ['Name', 'Email', 'Phone', 'Title', 'Company', 'Primary', 'Created'].join(','),
      ...filteredAndSortedContacts.map(contact => [
        `"${formatName(contact)}"`,
        `"${contact.email || ''}"`,
        `"${contact.phone || ''}"`,
        `"${contact.title || ''}"`,
        `"${contact.company_name || contact.company?.name || ''}"`,
        contact.is_primary ? 'Yes' : 'No',
        new Date(contact.created_at).toLocaleDateString()
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `contacts_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Contacts exported successfully');
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-gray-900/50 rounded-xl p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-800 rounded w-1/4"></div>
            <div className="h-4 bg-gray-800 rounded w-1/2"></div>
            <div className="space-y-3 mt-6">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-16 bg-gray-800/50 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-900/20 border border-red-700 rounded-xl p-6">
          <h3 className="text-red-400 font-medium mb-2">Error loading contacts</h3>
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Users className="w-8 h-8 text-green-400" />
          <h1 className="text-3xl font-bold text-white">Contacts</h1>
        </div>
        <p className="text-gray-400">
          Manage your contact database • {filteredAndSortedContacts.length} of {contacts.length} contacts • Click any row to view details
        </p>
      </div>

      {/* Search and Filters */}
      <div className="bg-gray-900/50 rounded-xl p-6 mb-6 border border-gray-800">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search contacts by name, email, or title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-800/50 border-gray-700 text-white placeholder-gray-400"
            />
          </div>
          
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger className="w-full sm:w-[200px] bg-gray-800/50 border-gray-700 text-white">
                <SelectValue placeholder="All Companies" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="all">All Companies</SelectItem>
                {uniqueCompanies.map(company => (
                  <SelectItem key={company} value={company}>{company}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={primaryFilter} onValueChange={setPrimaryFilter}>
              <SelectTrigger className="w-full sm:w-[150px] bg-gray-800/50 border-gray-700 text-white">
                <SelectValue placeholder="All Contacts" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="all">All Contacts</SelectItem>
                <SelectItem value="primary">Primary Only</SelectItem>
                <SelectItem value="secondary">Secondary Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button onClick={exportToCSV} variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Contact
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-gray-800 hover:bg-gray-800/50">
              <TableHead 
                className="text-gray-300 cursor-pointer hover:text-white"
                onClick={() => handleSort('full_name')}
              >
                <div className="flex items-center gap-2">
                  Contact {getSortIcon('full_name')}
                </div>
              </TableHead>
              <TableHead 
                className="text-gray-300 cursor-pointer hover:text-white"
                onClick={() => handleSort('email')}
              >
                <div className="flex items-center gap-2">
                  Email {getSortIcon('email')}
                </div>
              </TableHead>
              <TableHead className="text-gray-300">Phone</TableHead>
              <TableHead 
                className="text-gray-300 cursor-pointer hover:text-white"
                onClick={() => handleSort('title')}
              >
                <div className="flex items-center gap-2">
                  Title {getSortIcon('title')}
                </div>
              </TableHead>
              <TableHead 
                className="text-gray-300 cursor-pointer hover:text-white"
                onClick={() => handleSort('company_name')}
              >
                <div className="flex items-center gap-2">
                  Company {getSortIcon('company_name')}
                </div>
              </TableHead>
              <TableHead 
                className="text-gray-300 cursor-pointer hover:text-white text-center"
                onClick={() => handleSort('is_primary')}
              >
                <div className="flex items-center justify-center gap-2">
                  Primary {getSortIcon('is_primary')}
                </div>
              </TableHead>
              <TableHead className="text-gray-300 text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedContacts.map((contact) => (
              <TableRow 
                key={contact.id} 
                className="border-gray-800 hover:bg-gray-800/50 cursor-pointer"
                onClick={(e) => handleContactClick(contact.id, e)}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    {contact.is_primary && (
                      <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    )}
                    <div className="flex flex-col">
                      <div className="font-medium text-white">{formatName(contact)}</div>
                      {contact.linkedin_url && (
                        <a
                          href={contact.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          LinkedIn <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {contact.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <a
                        href={`mailto:${contact.email}`}
                        className="text-blue-400 hover:text-blue-300"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {contact.email}
                      </a>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {contact.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <a
                        href={`tel:${contact.phone}`}
                        className="text-gray-300 hover:text-white"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {contact.phone}
                      </a>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {contact.title && (
                    <Badge variant="outline" className="text-xs">
                      {contact.title}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {contact.company && (
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-300">{contact.company.name}</span>
                      {contact.company.website && (
                        <a
                          href={contact.company.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {contact.is_primary ? (
                    <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                      Primary
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-gray-400">
                      Secondary
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-gray-400 hover:text-white"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-gray-400 hover:text-red-400"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        
        {filteredAndSortedContacts.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-400 mb-2">No contacts found</h3>
            <p className="text-gray-500 text-sm">
              {searchTerm || companyFilter !== 'all' || primaryFilter !== 'all' 
                ? 'Try adjusting your search criteria or filters'
                : 'Get started by adding your first contact'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 