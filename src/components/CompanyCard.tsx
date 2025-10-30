import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Star, 
  Globe, 
  Users, 
  Heart,
  TrendingUp,
  Clock,
  ExternalLink,
  Edit,
  Trash2,
  ChevronRight,
  Building
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Company {
  id: string;
  name: string;
  domain?: string;
  industry?: string;
  size?: string;
  website?: string;
  contactCount?: number;
  dealsCount?: number;
  dealsValue?: number;
  created_at: string;
  updated_at: string;
}

interface CompanyCardProps {
  company: Company;
  viewMode: 'grid' | 'list';
  isSelected?: boolean;
  isSelectMode?: boolean;
  onSelect?: (companyId: string, isSelected: boolean) => void;
  onEdit?: (company: Company) => void;
  onDelete?: (company: Company) => void;
  onNavigate?: (company: Company) => void;
}

const CompanyCard: React.FC<CompanyCardProps> = ({
  company,
  viewMode,
  isSelected = false,
  isSelectMode = false,
  onSelect,
  onEdit,
  onDelete,
  onNavigate,
}) => {
  const [hovered, setHovered] = useState(false);

  // Generate logo from company name
  const generateLogo = (name: string) => {
    return name.split(' ').map(word => word.charAt(0)).join('').slice(0, 2).toUpperCase();
  };

  // Generate logo colors based on company name
  const getLogoColor = (name: string) => {
    const colors = [
      'bg-blue-600',
      'bg-orange-600',
      'bg-emerald-600',
      'bg-pink-600',
      'bg-indigo-600',
      'bg-yellow-600',
      'bg-purple-600',
      'bg-teal-600',
    ];

    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  // Calculate growth percentage (mock for MVP)
  const calculateGrowth = () => {
    // Simple mock calculation based on company data
    const mockGrowth = ((company.dealsValue || 0) % 100) - 50;
    return Math.round(mockGrowth);
  };

  // Format last activity (mock for MVP)
  const getLastActivity = () => {
    const daysSince = Math.floor((Date.now() - new Date(company.updated_at).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince === 0) return 'Today';
    if (daysSince === 1) return '1 day ago';
    if (daysSince < 7) return `${daysSince} days ago`;
    return `${Math.floor(daysSince / 7)} weeks ago`;
  };

  // Check if company is starred (mock for MVP)
  const isStarred = () => {
    // Simple mock based on company ID for demonstration
    return company.id.includes('1') || company.id.includes('3');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatDomain = (domain: string) => {
    return domain?.startsWith('www.') ? domain.slice(4) : domain;
  };

  if (viewMode === 'list') {
    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        whileHover={{ x: 4 }}
        className={`bg-white dark:bg-gray-900/80 backdrop-blur-sm rounded-xl p-4 border transition-all duration-300 group cursor-pointer shadow-sm dark:shadow-none ${
          isSelected && isSelectMode
            ? 'border-emerald-500 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/5'
            : 'border-gray-200 dark:border-gray-700/50 hover:border-emerald-500 dark:hover:border-emerald-500/30'
        }`}
        onClick={() => onNavigate?.(company)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Select Checkbox */}
            {isSelectMode && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => {
                  e.stopPropagation();
                  onSelect?.(company.id, e.target.checked);
                }}
                className="w-5 h-5 text-emerald-600 dark:text-emerald-500 bg-white dark:bg-gray-800/80 border-2 border-gray-300 dark:border-gray-600 rounded-md focus:ring-emerald-500 focus:ring-2"
                onClick={(e) => e.stopPropagation()}
              />
            )}
            
            {/* Company Logo */}
            <div className={`w-10 h-10 rounded-lg ${getLogoColor(company.name)} flex items-center justify-center text-white font-bold`}>
              {generateLogo(company.name)}
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors flex items-center gap-2">
                {company.name}
                {isStarred() && <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{company.industry || 'Industry not specified'} • {company.size || 'Size not specified'} employees</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(company.dealsValue || 0)}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Total value</div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-center">
                <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{company.dealsCount || 0}</div>
                <div className="text-xs text-gray-600 dark:text-gray-500">Deals</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">{company.contactCount || 0}</div>
                <div className="text-xs text-gray-600 dark:text-gray-500">Contacts</div>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              {!isSelectMode && (
                <>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit?.(company);
                    }}
                    className="text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete?.(company);
                    }}
                    className="text-gray-400 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </>
              )}
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-emerald-400 transition-colors" />
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // Grid view
  const growth = calculateGrowth();
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative bg-white dark:bg-gray-900/80 backdrop-blur-sm rounded-2xl p-6 border transition-all duration-300 overflow-hidden group cursor-pointer shadow-sm dark:shadow-none ${
        isSelected && isSelectMode
          ? 'border-emerald-500 dark:border-emerald-500/30 ring-1 ring-emerald-500/20'
          : 'border-gray-200 dark:border-gray-700/50 hover:border-emerald-500 dark:hover:border-emerald-500/30'
      }`}
      onClick={() => onNavigate?.(company)}
    >
      {/* Animated background gradient */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        animate={hovered ? { scale: 1.5, rotate: 180 } : { scale: 1, rotate: 0 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      />
      
      {/* Select Checkbox */}
      {isSelectMode && (
        <div className="absolute top-4 left-4 z-10">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onSelect?.(company.id, e.target.checked);
            }}
            className="w-5 h-5 text-emerald-600 dark:text-emerald-500 bg-white dark:bg-gray-800/80 border-2 border-gray-300 dark:border-gray-600 rounded-md focus:ring-emerald-500 focus:ring-2"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Star button */}
      <button 
        className="absolute top-4 right-4 z-10"
        onClick={(e) => {
          e.stopPropagation();
          // TODO: Implement star functionality
        }}
      >
        <Star className={`w-4 h-4 transition-all duration-300 ${
          isStarred() 
            ? 'fill-yellow-500 text-yellow-500' 
            : 'text-gray-600 hover:text-yellow-500'
        }`} />
      </button>

      <div className="relative z-10">
        {/* Company header */}
        <div className="flex items-start gap-4 mb-4">
          <motion.div
            className={`w-14 h-14 rounded-xl ${getLogoColor(company.name)} flex items-center justify-center text-white font-bold text-xl shadow-lg`}
            whileHover={{ scale: 1.05, rotate: 5 }}
          >
            {generateLogo(company.name)}
          </motion.div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg text-gray-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
              {company.name}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{company.industry || 'Industry not specified'}</p>
          </div>
        </div>

        {/* Company info */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Globe className="w-3 h-3" />
            <span>{formatDomain(company.domain || 'No domain')}</span>
            {company.website && (
              <a
                href={company.website}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Users className="w-3 h-3" />
            <span>{company.size || 'Size not specified'} employees</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2.5 text-center">
            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{company.dealsCount || 0}</div>
            <div className="text-xs text-gray-600 dark:text-gray-500">Deals</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2.5 text-center">
            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{company.contactCount || 0}</div>
            <div className="text-xs text-gray-600 dark:text-gray-500">Contacts</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2.5 text-center">
            <div className={`text-lg font-bold flex items-center justify-center gap-1 ${
              growth > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
            }`}>
              {growth > 0 ? '+' : ''}{growth}%
              <TrendingUp className={`w-3 h-3 ${growth < 0 ? 'rotate-180' : ''}`} />
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-500">Growth</div>
          </div>
        </div>

        {/* Value and Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-800">
          <div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(company.dealsValue || 0)}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Total value</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-gray-600 dark:text-gray-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {getLastActivity()}
            </div>
            {!isSelectMode && (
              <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit?.(company);
                  }}
                  className="text-gray-400 hover:text-blue-400 hover:bg-blue-400/10"
                >
                  <Edit className="w-3 h-3" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete?.(company);
                  }}
                  className="text-gray-400 hover:text-red-400 hover:bg-red-400/10"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default CompanyCard;