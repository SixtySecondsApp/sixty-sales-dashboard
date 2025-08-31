import { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, 
  Users, 
  Heart, 
  Video,
  Search,
  Plus,
  Filter,
  Grid3X3,
  List,
  Star,
  Globe,
  Mail,
  Phone,
  MapPin,
  TrendingUp,
  Calendar,
  ChevronRight,
  Sparkles,
  Building,
  User,
  DollarSign,
  Clock,
  X
} from 'lucide-react';

interface FilterSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  sizeFilter: string[];
  setSizeFilter: (sizes: string[]) => void;
  industryFilter: string[];
  setIndustryFilter: (industries: string[]) => void;
  selectedOwnerId: string;
  setSelectedOwnerId: (ownerId: string) => void;
  uniqueSizes: string[];
  uniqueIndustries: string[];
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

// Multi-select dropdown component
const MultiSelect = ({ options, placeholder, selected = [], onChange }: {
  options: { label: string; count: number }[];
  placeholder: string;
  selected: string[];
  onChange: (values: string[]) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width
      });
    }
  }, [isOpen]);

  const toggleOption = (option: { label: string; count: number }) => {
    const newSelected = selected.includes(option.label)
      ? selected.filter(item => item !== option.label)
      : [...selected, option.label];
    onChange(newSelected);
  };

  const selectedCount = selected.length;

  return (
    <div ref={dropdownRef} className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-left flex items-center justify-between hover:border-gray-600 transition-colors duration-200"
      >
        <span className="text-sm text-gray-300">
          {selectedCount === 0 
            ? placeholder 
            : selectedCount === 1 
            ? selected[0]
            : `${selectedCount} selected`}
        </span>
        <div className="flex items-center gap-2">
          {selectedCount > 0 && (
            <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
              {selectedCount}
            </span>
          )}
          <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{ 
              position: 'fixed', 
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              width: dropdownPosition.width,
              zIndex: 99999 
            }}
            className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden"
          >
            <div className="max-h-64 overflow-y-auto">
              {options.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => toggleOption(option)}
                  className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-gray-700 transition-colors duration-150"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded border-2 transition-all duration-200 ${
                      selected.includes(option.label) 
                        ? 'bg-emerald-500 border-emerald-500' 
                        : 'border-gray-600 bg-transparent'
                    }`}>
                      {selected.includes(option.label) && (
                        <svg className="w-full h-full text-white" viewBox="0 0 16 16">
                          <path
                            fill="currentColor"
                            d="M13.5 3.5L6 11l-3.5-3.5L1 9l5 5L15 5z"
                          />
                        </svg>
                      )}
                    </div>
                    <span className={`text-sm ${
                      selected.includes(option.label) ? 'text-white' : 'text-gray-300'
                    }`}>
                      {option.label}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">{option.count}</span>
                </button>
              ))}
            </div>
            {options.length > 5 && (
              <div className="p-2 border-t border-gray-700 bg-gray-850">
                <div className="flex items-center justify-between text-xs">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(options.map(o => o.label));
                    }}
                    className="text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    Select all
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange([]);
                    }}
                    className="text-gray-400 hover:text-gray-300 transition-colors"
                  >
                    Clear all
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const FilterSidebar = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [selectedFilters, setSelectedFilters] = useState({
    companySize: [] as string[],
    industry: [] as string[],
    location: [] as string[],
    dealStage: [] as string[],
    includeLists: [] as string[],
    excludeLists: [] as string[],
  });

  const updateFilter = (filterType: string, values: string[]) => {
    setSelectedFilters(prev => ({ ...prev, [filterType]: values }));
  };

  const companySizes = [
    { label: '1-10 employees', count: 23 },
    { label: '11-50 employees', count: 45 },
    { label: '51-200 employees', count: 67 },
    { label: '201-500 employees', count: 12 },
    { label: '500+ employees', count: 9 },
  ];

  const industries = [
    { label: 'Software Development', count: 45 },
    { label: 'Healthcare', count: 23 },
    { label: 'Financial Services', count: 34 },
    { label: 'Retail & E-commerce', count: 28 },
    { label: 'Manufacturing', count: 19 },
    { label: 'Education', count: 7 },
    { label: 'Telecommunications', count: 15 },
    { label: 'Real Estate', count: 11 },
  ];

  const locations = [
    { label: 'United States', count: 89 },
    { label: 'United Kingdom', count: 34 },
    { label: 'Canada', count: 23 },
    { label: 'Germany', count: 10 },
    { label: 'France', count: 8 },
    { label: 'Australia', count: 6 },
  ];

  const dealStages = [
    { label: 'Prospecting', count: 34 },
    { label: 'Qualification', count: 23 },
    { label: 'Proposal', count: 8 },
    { label: 'Negotiation', count: 2 },
    { label: 'Closed Won', count: 45 },
    { label: 'Closed Lost', count: 12 },
  ];

  const includeLists = [
    { label: 'Hot Prospects', count: 34 },
    { label: 'Enterprise Targets', count: 23 },
    { label: 'Partner Referrals', count: 12 },
    { label: 'Trade Show Leads', count: 8 },
  ];

  const excludeLists = [
    { label: 'Churned Accounts', count: 15 },
    { label: 'Do Not Contact', count: 8 },
    { label: 'Competitors', count: 4 },
  ];

  const FilterSection = ({ title, icon: Icon, expanded, filterKey, children }: {
    title: string;
    icon: React.ElementType;
    expanded: boolean;
    filterKey: string;
    children: React.ReactNode;
  }) => {
    const [isExpanded, setIsExpanded] = useState(expanded);
    
    return (
      <div className="border-b border-gray-800/50 last:border-0">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full py-4 flex items-center justify-between text-left hover:bg-gray-800/30 transition-colors duration-200"
        >
          <div className="flex items-center gap-3">
            <Icon className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-300">{title}</span>
          </div>
          <div className="flex items-center gap-2">
            {selectedFilters[filterKey as keyof typeof selectedFilters]?.length > 0 && (
              <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
                {selectedFilters[filterKey as keyof typeof selectedFilters].length}
              </span>
            )}
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronRight className="w-4 h-4 text-gray-500 rotate-90" />
            </motion.div>
          </div>
        </button>
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pb-4 px-1">
                {children}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const clearAllFilters = () => {
    setSelectedFilters({
      companySize: [],
      industry: [],
      location: [],
      dealStage: [],
      includeLists: [],
      excludeLists: [],
    });
  };

  const getTotalFilterCount = () => {
    return Object.values(selectedFilters).reduce((acc, curr) => acc + curr.length, 0);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ x: -256, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -256, opacity: 0 }}
            transition={{ 
              type: "spring", 
              damping: 30, 
              stiffness: 300,
              opacity: { duration: 0.2, ease: "easeOut" }
            }}
            className="fixed left-0 top-0 h-full w-[256px] bg-gray-900 border-r border-gray-800 z-[150] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-800">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Filter className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-lg font-semibold text-white">Filters</h3>
                  {getTotalFilterCount() > 0 && (
                    <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
                      {getTotalFilterCount()}
                    </span>
                  )}
                </div>
                <button 
                  onClick={onClose} 
                  className="p-1 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <p className="text-xs text-gray-500">Refine your search results</p>
            </div>

            {/* Filter sections */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-6">
                {/* Company Size */}
                <FilterSection
                  title="Company Size"
                  icon={Building}
                  expanded={true}
                  filterKey="companySize"
                >
                  <MultiSelect
                    options={companySizes}
                    placeholder="Select company sizes"
                    selected={selectedFilters.companySize}
                    onChange={(values) => updateFilter('companySize', values)}
                  />
                </FilterSection>

                {/* Industry */}
                <FilterSection
                  title="Industry"
                  icon={Building2}
                  expanded={true}
                  filterKey="industry"
                >
                  <MultiSelect
                    options={industries}
                    placeholder="Select industries"
                    selected={selectedFilters.industry}
                    onChange={(values) => updateFilter('industry', values)}
                  />
                </FilterSection>

                {/* Location */}
                <FilterSection
                  title="Location"
                  icon={MapPin}
                  expanded={true}
                  filterKey="location"
                >
                  <MultiSelect
                    options={locations}
                    placeholder="Select locations"
                    selected={selectedFilters.location}
                    onChange={(values) => updateFilter('location', values)}
                  />
                </FilterSection>

                {/* Deal Stage */}
                <FilterSection
                  title="Deal Stage"
                  icon={Heart}
                  expanded={true}
                  filterKey="dealStage"
                >
                  <MultiSelect
                    options={dealStages}
                    placeholder="Select deal stages"
                    selected={selectedFilters.dealStage}
                    onChange={(values) => updateFilter('dealStage', values)}
                  />
                </FilterSection>

                {/* List Filters */}
                <FilterSection
                  title="List Filters"
                  icon={List}
                  expanded={true}
                  filterKey="lists"
                >
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-medium text-gray-400 mb-2 block">Include Lists</label>
                      <MultiSelect
                        options={includeLists}
                        placeholder="Select lists to include"
                        selected={selectedFilters.includeLists}
                        onChange={(values) => updateFilter('includeLists', values)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-400 mb-2 block">Exclude Lists</label>
                      <MultiSelect
                        options={excludeLists}
                        placeholder="Select lists to exclude"
                        selected={selectedFilters.excludeLists}
                        onChange={(values) => updateFilter('excludeLists', values)}
                      />
                    </div>
                  </div>
                </FilterSection>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-800 bg-gray-900/50">
              <div className="flex items-center gap-3">
                <button 
                  onClick={clearAllFilters}
                  className="flex-1 py-2 px-4 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-all duration-200"
                >
                  Clear all
                </button>
                <button className="flex-1 py-2 px-4 text-sm bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-all duration-200 font-medium">
                  Apply filters
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default FilterSidebar;