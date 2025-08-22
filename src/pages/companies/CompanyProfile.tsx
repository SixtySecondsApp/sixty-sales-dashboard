import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Building2, 
  Users, 
  DollarSign,
  Calendar,
  Settings,
  Activity,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCompany } from '@/lib/hooks/useCompany';
import { CompanyHeader } from './components/CompanyHeader';
import { CompanyTabs } from './components/CompanyTabs';
import { CompanySidebar } from './components/CompanySidebar';
import { CompanyMainContent } from './components/CompanyMainContent';
import { CompanyRightPanel } from './components/CompanyRightPanel';
import logger from '@/lib/utils/logger';

interface CompanyProfileProps {
  className?: string;
}

export default function CompanyProfile({ className }: CompanyProfileProps) {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const { company, deals, activities, clients, isLoading, error } = useCompany(companyId);
  
  // Debug: Log company profile state changes
  React.useEffect(() => {
    logger.log('📋 CompanyProfile render:', {
      companyId,
      companyName: company?.name,
      companyStatus: company?.status,
      isLoading,
      error,
      dealsCount: deals?.length,
      clientsCount: clients?.length
    });
  }, [companyId, company?.name, company?.status, isLoading, error, deals?.length, clients?.length]);
  
  const [activeTab, setActiveTab] = useState<'overview' | 'deals' | 'contacts' | 'activities' | 'documents'>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-800 rounded w-1/4"></div>
            <div className="h-64 bg-gray-800 rounded"></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 h-96 bg-gray-800 rounded"></div>
              <div className="h-96 bg-gray-800 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="min-h-screen bg-gray-950 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-900/20 border border-red-800/50 rounded-xl p-6 text-center">
            <h2 className="text-xl font-bold text-red-400 mb-2">Company Not Found</h2>
            <p className="text-gray-400 mb-4">
              {error || 'The company you are looking for does not exist or you do not have permission to view it.'}
            </p>
            <Button
              onClick={() => navigate('/companies')}
              className="bg-gray-800 hover:bg-gray-700 text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Companies
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="border-b border-gray-800/50 bg-gray-900/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto p-6">
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/companies')}
              className="bg-gray-800/50 border-gray-700/50 text-white hover:bg-gray-700/50"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </div>

          <CompanyHeader 
            company={company}
            deals={deals}
            activities={activities}
            clients={clients}
          />
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-800/50 bg-gray-900/30">
        <div className="max-w-7xl mx-auto px-6">
          <CompanyTabs 
            activeTab={activeTab}
            onTabChange={setActiveTab}
            company={company}
            deals={deals}
            activities={activities}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className={`${sidebarCollapsed ? 'lg:col-span-1' : 'lg:col-span-1'} transition-all duration-300`}>
            <CompanySidebar 
              company={company}
              collapsed={sidebarCollapsed}
              onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
            />
          </div>

          {/* Main Content Area */}
          <div className={`${sidebarCollapsed ? 'lg:col-span-2' : 'lg:col-span-2'} transition-all duration-300`}>
            <CompanyMainContent 
              activeTab={activeTab}
              company={company}
              deals={deals}
              activities={activities}
              clients={clients}
            />
          </div>

          {/* Right Panel */}
          <div className="lg:col-span-1">
            <CompanyRightPanel 
              company={company}
              deals={deals}
              activities={activities}
            />
          </div>
        </div>
      </div>
    </div>
  );
}