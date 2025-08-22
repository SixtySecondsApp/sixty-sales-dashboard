import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Building2, User, Calendar, DollarSign, Target, TrendingUp, Edit, Phone, Mail, MessageCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { API_BASE_URL } from '@/lib/config';
import logger from '@/lib/utils/logger';

interface Deal {
  id: string;
  title?: string;
  description?: string;
  value?: number;
  status?: string;
  stage_name?: string;
  stage_color?: string;
  default_probability?: number;
  created_at?: string;
  updated_at?: string;
  company_name?: string;
  contact_name?: string;
  contact_email?: string;
}

const DealRecord: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDeal = async () => {
      if (!id) {
        setError('Deal ID is required');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        // Fetch deal data from API
        const response = await fetch(`${API_BASE_URL}/deals/${id}?includeRelationships=true`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('Deal not found');
          } else {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return;
        }
        
        const result = await response.json();
        
        if (result.error) {
          setError(result.error);
          return;
        }
        
        setDeal(result.data);
      } catch (err) {
        logger.error('Error fetching deal:', err);
        setError(err instanceof Error ? err.message : 'Failed to load deal');
      } finally {
        setLoading(false);
      }
    };

    fetchDeal();
  }, [id]);

  const handleBack = () => {
    if (returnTo) {
      navigate(returnTo);
    } else {
      navigate('/crm/deals');
    }
  };

  const formatCurrency = (amount: number) => {
    return `£${amount?.toLocaleString() || 0}`;
  };

  const formatDate = (dateString?: string) => {
    try {
      if (!dateString) return 'Unknown';
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return 'Unknown';
    }
  };

  const getStageBadge = (stage: string, color?: string) => {
    switch (stage?.toLowerCase()) {
      case 'won':
      case 'signed':
      case 'closed won':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Signed</Badge>;
      case 'signed & paid':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Signed & Paid</Badge>;
      case 'lost':
      case 'closed lost':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Lost</Badge>;
      case 'negotiation': 
      case 'negotiate': 
        return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Negotiation</Badge>;
      case 'proposal': 
      case 'quote': 
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Proposal</Badge>;
      case 'qualified': 
      case 'discovery': 
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Qualified</Badge>;
      default: 
        return <Badge variant="outline">{stage || 'Unknown'}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen text-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center min-h-96">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
              <p className="text-sm text-gray-400">Loading deal...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen text-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <nav className="breadcrumb-nav">
            <button onClick={handleBack} className="breadcrumb-item flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          </nav>
          
          <div className="section-card bg-red-900/20 border-red-700 text-red-300">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-5 h-5" />
              <span className="font-medium">Deal Error</span>
            </div>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="min-h-screen text-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <nav className="breadcrumb-nav">
            <button onClick={handleBack} className="breadcrumb-item flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          </nav>
          
          <div className="section-card">
            <p className="text-gray-400">Deal not found</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb Navigation */}
        <nav className="breadcrumb-nav">
          <button onClick={handleBack} className="breadcrumb-item flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" />
            {returnTo?.includes('/contacts/') ? 'Contact Record' : 'Deals'}
          </button>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">{deal.title || `Deal ${deal.id}`}</span>
        </nav>

        {/* Deal Header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-full border-3 border-purple-400 bg-gradient-to-r from-purple-500 to-blue-600 flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                <Target className="w-10 h-10" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">
                  {deal.title || `Deal ${deal.id}`}
                </h1>
                <div className="flex items-center gap-3 text-gray-400 mb-2">
                  {deal.company_name && (
                    <>
                      <span className="text-lg flex items-center gap-1">
                        <Building2 className="w-4 h-4" />
                        {deal.company_name}
                      </span>
                      <span className="text-gray-600">•</span>
                    </>
                  )}
                  {deal.contact_name && (
                    <span className="text-lg flex items-center gap-1">
                      <User className="w-4 h-4" />
                      {deal.contact_name}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  {getStageBadge(deal.stage_name || '', deal.stage_color)}
                  {deal.status && (
                    <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">
                      {deal.status}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="btn-group">
              <button className="btn-primary">
                <Edit className="w-4 h-4" />
                <span>Edit Deal</span>
              </button>
              {deal.contact_email && (
                <button className="btn-secondary">
                  <Mail className="w-4 h-4" />
                  <span>Email Contact</span>
                </button>
              )}
              <button className="btn-secondary">
                <MessageCircle className="w-4 h-4" />
                <span>Add Note</span>
              </button>
            </div>
          </div>
        </div>

        {/* Deal Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Deal Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Deal Summary */}
            <div className="section-card">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-400" />
                Deal Summary
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="activity-metric text-center">
                  <div className="text-2xl font-bold text-white mb-1">
                    {formatCurrency(deal.value || 0)}
                  </div>
                  <div className="text-xs text-gray-400">Deal Value</div>
                </div>
                
                <div className="activity-metric text-center">
                  <div className="text-2xl font-bold text-white mb-1">
                    {deal.default_probability || 0}%
                  </div>
                  <div className="text-xs text-gray-400">Win Probability</div>
                </div>
                
                <div className="activity-metric text-center">
                  <div className="text-2xl font-bold text-white mb-1">
                    {deal.created_at ? Math.ceil((new Date().getTime() - new Date(deal.created_at).getTime()) / (1000 * 60 * 60 * 24)) : 0}
                  </div>
                  <div className="text-xs text-gray-400">Days Active</div>
                </div>
              </div>
            </div>

            {/* Deal Description */}
            {deal.description && (
              <div className="section-card">
                <h2 className="text-lg font-semibold mb-4">Description</h2>
                <p className="text-gray-300 leading-relaxed">{deal.description}</p>
              </div>
            )}

            {/* Timeline */}
            <div className="section-card">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-400" />
                Timeline
              </h2>
              
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-3 rounded-lg bg-gray-800/50">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-white font-medium">Deal Created</p>
                    <p className="text-gray-400 text-sm">{deal.created_at ? formatDate(deal.created_at) : 'Unknown'}</p>
                  </div>
                </div>
                
                {deal.updated_at && deal.updated_at !== deal.created_at && (
                  <div className="flex items-center gap-4 p-3 rounded-lg bg-gray-800/50">
                    <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-white font-medium">Last Updated</p>
                      <p className="text-gray-400 text-sm">{deal.updated_at ? formatDate(deal.updated_at) : 'Unknown'}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Contact & Company Info */}
          <div className="space-y-6">
            {/* Contact Information */}
            {(deal.contact_name || deal.contact_email) && (
              <div className="section-card">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-400" />
                  Primary Contact
                </h2>
                
                <div className="space-y-3">
                  {deal.contact_name && (
                    <div>
                      <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Name</p>
                      <p className="text-white">{deal.contact_name}</p>
                    </div>
                  )}
                  
                  {deal.contact_email && (
                    <div>
                      <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Email</p>
                      <p className="text-white">{deal.contact_email}</p>
                    </div>
                  )}
                  
                  <div className="pt-2">
                    <button className="btn-sm btn-secondary w-full">
                      <User className="w-4 h-4" />
                      <span>View Contact Record</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Company Information */}
            {deal.company_name && (
              <div className="section-card">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-purple-400" />
                  Company
                </h2>
                
                <div className="space-y-3">
                  <div>
                    <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Company Name</p>
                    <p className="text-white">{deal.company_name}</p>
                  </div>
                  
                  <div className="pt-2">
                    <button className="btn-sm btn-secondary w-full">
                      <Building2 className="w-4 h-4" />
                      <span>View Company Profile</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Stats */}
            <div className="section-card bg-gradient-to-br from-purple-900/20 to-blue-900/20 border-purple-500/20">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-purple-400" />
                Quick Stats
              </h2>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Stage</span>
                  <span className="text-white font-medium">{deal.stage_name || 'Unknown'}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Status</span>
                  <span className="text-white font-medium">{deal.status || 'Active'}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Value</span>
                  <span className="text-white font-medium">{formatCurrency(deal.value || 0)}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Win Probability</span>
                  <span className="text-white font-medium">{deal.default_probability || 0}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DealRecord; 