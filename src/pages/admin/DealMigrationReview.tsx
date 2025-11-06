/**
 * Admin Review Interface for Deal Migration
 *
 * Allows administrators to review and resolve deals flagged during
 * entity resolution migration that need manual attention.
 */

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Search, AlertCircle, CheckCircle2, Archive, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase/clientV2';
import { useUser } from '@/lib/hooks/useUser';
import { useCompanies } from '@/lib/hooks/useCompanies';
import { useContacts } from '@/lib/hooks/useContacts';
import logger from '@/lib/utils/logger';

interface DealMigrationReview {
  review_id: string;
  deal_id: string;
  reason: string;
  status: 'pending' | 'resolved' | 'archived';
  original_company: string | null;
  original_contact_name: string | null;
  original_contact_email: string | null;
  suggested_company_id: string | null;
  suggested_contact_id: string | null;
  resolution_notes: string | null;
  flagged_at: string;
  resolved_at: string | null;
  deal_name: string;
  deal_value: number;
  owner_id: string;
  owner_email: string | null;
  suggested_company_name: string | null;
  suggested_contact_name: string | null;
}

interface ResolveFormData {
  company_id: string;
  contact_id: string;
  notes: string;
}

export function DealMigrationReview() {
  const { userData } = useUser();
  const { companies, fetchCompanies, createCompany } = useCompanies({ autoFetch: true });
  const { contacts, fetchContacts, createContact } = useContacts({ autoFetch: false });

  const [reviews, setReviews] = useState<DealMigrationReview[]>([]);
  const [selectedReview, setSelectedReview] = useState<DealMigrationReview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'pending' | 'all'>('pending');

  // Resolution form state
  const [resolveForm, setResolveForm] = useState<ResolveFormData>({
    company_id: '',
    contact_id: '',
    notes: ''
  });

  // New entity creation state
  const [showNewCompanyForm, setShowNewCompanyForm] = useState(false);
  const [showNewContactForm, setShowNewContactForm] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newContactData, setNewContactData] = useState({
    first_name: '',
    last_name: '',
    email: ''
  });

  // Fetch reviews on component mount
  useEffect(() => {
    fetchReviews();
  }, [filterStatus]);

  // Fetch contacts when a company is selected
  useEffect(() => {
    if (resolveForm.company_id) {
      fetchContacts({ companyId: resolveForm.company_id });
    }
  }, [resolveForm.company_id]);

  async function fetchReviews() {
    try {
      setIsLoading(true);

      const query = supabase
        .from('deal_migration_review_details')
        .select('*');

      if (filterStatus === 'pending') {
        query.eq('status', 'pending');
      }

      const { data, error } = await query.order('flagged_at', { ascending: false });

      if (error) throw error;

      setReviews(data || []);
    } catch (error) {
      logger.error('Error fetching migration reviews:', error);
      toast.error('Failed to load migration reviews');
    } finally {
      setIsLoading(false);
    }
  }

  function handleSelectReview(review: DealMigrationReview) {
    setSelectedReview(review);

    // Pre-populate form with suggestions if available
    setResolveForm({
      company_id: review.suggested_company_id || '',
      contact_id: review.suggested_contact_id || '',
      notes: ''
    });

    // Pre-fill new entity forms with original data
    setNewCompanyName(review.original_company || '');
    setNewContactData({
      first_name: review.original_contact_name?.split(' ')[0] || '',
      last_name: review.original_contact_name?.split(' ').slice(1).join(' ') || '',
      email: review.original_contact_email || ''
    });
  }

  async function handleCreateCompany() {
    if (!newCompanyName.trim()) {
      toast.error('Company name is required');
      return;
    }

    try {
      const newCompany = await createCompany({
        name: newCompanyName.trim(),
        owner_id: userData?.id || ''
      });

      if (newCompany) {
        setResolveForm({ ...resolveForm, company_id: newCompany.id });
        setShowNewCompanyForm(false);
        toast.success('Company created successfully');
        await fetchCompanies();
      }
    } catch (error) {
      logger.error('Error creating company:', error);
      toast.error('Failed to create company');
    }
  }

  async function handleCreateContact() {
    if (!newContactData.email.trim() || !resolveForm.company_id) {
      toast.error('Email and company are required');
      return;
    }

    try {
      const newContact = await createContact({
        first_name: newContactData.first_name.trim(),
        last_name: newContactData.last_name.trim(),
        email: newContactData.email.trim(),
        company_id: resolveForm.company_id,
        owner_id: userData?.id || ''
      });

      if (newContact) {
        setResolveForm({ ...resolveForm, contact_id: newContact.id });
        setShowNewContactForm(false);
        toast.success('Contact created successfully');
        await fetchContacts({ companyId: resolveForm.company_id });
      }
    } catch (error) {
      logger.error('Error creating contact:', error);
      toast.error('Failed to create contact');
    }
  }

  async function handleResolve() {
    if (!selectedReview || !resolveForm.company_id || !resolveForm.contact_id) {
      toast.error('Please select both company and contact');
      return;
    }

    try {
      const { error } = await supabase.rpc('resolve_deal_migration_review', {
        p_review_id: selectedReview.review_id,
        p_company_id: resolveForm.company_id,
        p_contact_id: resolveForm.contact_id,
        p_resolved_by: userData?.id,
        p_notes: resolveForm.notes || null
      });

      if (error) throw error;

      toast.success('Deal resolved successfully!');
      setSelectedReview(null);
      await fetchReviews();
    } catch (error) {
      logger.error('Error resolving review:', error);
      toast.error('Failed to resolve deal');
    }
  }

  async function handleArchive() {
    if (!selectedReview) return;

    try {
      const { error } = await supabase
        .from('deal_migration_reviews')
        .update({ status: 'archived' })
        .eq('id', selectedReview.review_id);

      if (error) throw error;

      toast.success('Deal archived');
      setSelectedReview(null);
      await fetchReviews();
    } catch (error) {
      logger.error('Error archiving review:', error);
      toast.error('Failed to archive deal');
    }
  }

  const filteredReviews = reviews.filter(review => {
    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase();
    return (
      review.deal_name.toLowerCase().includes(query) ||
      review.original_company?.toLowerCase().includes(query) ||
      review.original_contact_name?.toLowerCase().includes(query) ||
      review.original_contact_email?.toLowerCase().includes(query)
    );
  });

  const reasonBadgeColor = (reason: string) => {
    switch (reason) {
      case 'no_email': return 'bg-red-500/20 text-red-400';
      case 'invalid_email': return 'bg-orange-500/20 text-orange-400';
      case 'fuzzy_match_uncertainty': return 'bg-yellow-500/20 text-yellow-400';
      case 'entity_creation_failed': return 'bg-purple-500/20 text-purple-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">
            Deal Migration Review
          </h1>
          <p className="text-gray-400">
            Review and resolve deals flagged during entity resolution migration
          </p>
        </div>

        {/* Filters and Search */}
        <div className="mb-6 flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search deals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as 'pending' | 'all')}
            className="px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="pending">Pending Only</option>
            <option value="all">All Reviews</option>
          </select>

          <button
            onClick={fetchReviews}
            className="px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white hover:bg-gray-800 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Reviews List */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-gray-800">
              <h2 className="text-lg font-semibold text-white">
                Flagged Deals ({filteredReviews.length})
              </h2>
            </div>

            <div className="overflow-y-auto max-h-[calc(100vh-300px)]">
              {filteredReviews.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No deals need review</p>
                </div>
              ) : (
                filteredReviews.map(review => (
                  <button
                    key={review.review_id}
                    onClick={() => handleSelectReview(review)}
                    className={`w-full p-4 border-b border-gray-800 text-left transition-colors ${
                      selectedReview?.review_id === review.review_id
                        ? 'bg-emerald-500/10 border-l-4 border-l-emerald-500'
                        : 'hover:bg-gray-800/50'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-white truncate">
                        {review.deal_name}
                      </h3>
                      <span className={`text-xs px-2 py-1 rounded ${reasonBadgeColor(review.reason)}`}>
                        {review.reason.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div className="text-sm text-gray-400 space-y-1">
                      <div className="truncate">
                        Company: {review.original_company || 'N/A'}
                      </div>
                      <div className="truncate">
                        Contact: {review.original_contact_name || 'N/A'}
                      </div>
                      <div className="truncate text-xs">
                        {review.original_contact_email || 'No email'}
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-gray-500">
                      Value: ${review.deal_value?.toLocaleString() || 0}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Resolution Form */}
          {selectedReview ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-white mb-2">
                  Resolve Deal
                </h2>
                <p className="text-sm text-gray-400">
                  {selectedReview.deal_name}
                </p>
              </div>

              {/* Original Data Display */}
              <div className="mb-6 p-4 bg-gray-800/50 rounded-lg">
                <h3 className="text-sm font-medium text-gray-300 mb-2">Original Data</h3>
                <div className="text-sm text-gray-400 space-y-1">
                  <div>Company: {selectedReview.original_company || 'N/A'}</div>
                  <div>Contact: {selectedReview.original_contact_name || 'N/A'}</div>
                  <div>Email: {selectedReview.original_contact_email || 'N/A'}</div>
                  <div className={`${reasonBadgeColor(selectedReview.reason)} inline-block px-2 py-1 rounded mt-2`}>
                    Issue: {selectedReview.reason.replace(/_/g, ' ')}
                  </div>
                </div>
              </div>

              {/* Company Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Select Company
                </label>
                <select
                  value={resolveForm.company_id}
                  onChange={(e) => setResolveForm({ ...resolveForm, company_id: e.target.value, contact_id: '' })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Select a company...</option>
                  {companies.map(company => (
                    <option key={company.id} value={company.id}>
                      {company.name} {company.domain ? `(${company.domain})` : ''}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => setShowNewCompanyForm(!showNewCompanyForm)}
                  className="mt-2 text-sm text-emerald-400 hover:text-emerald-300"
                >
                  + Create new company
                </button>

                {showNewCompanyForm && (
                  <div className="mt-2 p-3 bg-gray-800 rounded-lg">
                    <input
                      type="text"
                      value={newCompanyName}
                      onChange={(e) => setNewCompanyName(e.target.value)}
                      placeholder="Company name"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white mb-2"
                    />
                    <button
                      onClick={handleCreateCompany}
                      className="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                    >
                      Create Company
                    </button>
                  </div>
                )}
              </div>

              {/* Contact Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Select Contact
                </label>
                <select
                  value={resolveForm.contact_id}
                  onChange={(e) => setResolveForm({ ...resolveForm, contact_id: e.target.value })}
                  disabled={!resolveForm.company_id}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                >
                  <option value="">Select a contact...</option>
                  {contacts.map(contact => (
                    <option key={contact.id} value={contact.id}>
                      {contact.full_name} ({contact.email})
                    </option>
                  ))}
                </select>

                {resolveForm.company_id && (
                  <button
                    onClick={() => setShowNewContactForm(!showNewContactForm)}
                    className="mt-2 text-sm text-emerald-400 hover:text-emerald-300"
                  >
                    + Create new contact
                  </button>
                )}

                {showNewContactForm && (
                  <div className="mt-2 p-3 bg-gray-800 rounded-lg space-y-2">
                    <input
                      type="text"
                      value={newContactData.first_name}
                      onChange={(e) => setNewContactData({ ...newContactData, first_name: e.target.value })}
                      placeholder="First name"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                    />
                    <input
                      type="text"
                      value={newContactData.last_name}
                      onChange={(e) => setNewContactData({ ...newContactData, last_name: e.target.value })}
                      placeholder="Last name"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                    />
                    <input
                      type="email"
                      value={newContactData.email}
                      onChange={(e) => setNewContactData({ ...newContactData, email: e.target.value })}
                      placeholder="Email"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                    />
                    <button
                      onClick={handleCreateContact}
                      className="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                    >
                      Create Contact
                    </button>
                  </div>
                )}
              </div>

              {/* Resolution Notes */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Resolution Notes (optional)
                </label>
                <textarea
                  value={resolveForm.notes}
                  onChange={(e) => setResolveForm({ ...resolveForm, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Add any notes about this resolution..."
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleResolve}
                  disabled={!resolveForm.company_id || !resolveForm.contact_id}
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Resolve Deal
                </button>

                <button
                  onClick={handleArchive}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  <Archive className="w-4 h-4" />
                  Archive
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Select a deal to review</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
