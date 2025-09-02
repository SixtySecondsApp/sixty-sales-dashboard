import React, { RefObject, useState } from 'react';
import { FileText, Building, User, Calendar, PoundSterling, Star, AlignLeft, Clock, ChevronLeft, ChevronRight, Mail, Phone, Search, Plus, Map, AlertCircle } from 'lucide-react';
import { useFormContext, Controller } from 'react-hook-form';
import { format, addDays, addWeeks, startOfWeek, addMonths, isToday, isTomorrow, isThisWeek, isThisMonth } from 'date-fns';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useContacts } from '@/lib/hooks/useContacts';
import { Badge } from '@/components/ui/badge';
import logger from '@/lib/utils/logger';

interface DealDetailsSectionProps {
  initialFocusRef?: RefObject<HTMLInputElement>;
  isAdmin?: boolean;
}

const DealDetailsSection: React.FC<DealDetailsSectionProps> = ({ initialFocusRef, isAdmin = false }) => {
  const { register, watch, getValues, formState: { errors }, setValue } = useFormContext();
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    watch('closeDate') ? new Date(watch('closeDate')) : undefined
  );
  
  // Contact search states
  const [contactSearchQuery, setContactSearchQuery] = useState(watch('contactName') || '');
  const [searchedContacts, setSearchedContacts] = useState<any[]>([]);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [showCreateContact, setShowCreateContact] = useState(false);
  
  const { searchContacts } = useContacts();
  
  const priorityOptions = [
    { value: 'low', label: 'Low', icon: '🟢', color: 'bg-green-500/20 text-green-400 border-green-500/30', ringColor: 'ring-green-500/30' },
    { value: 'medium', label: 'Medium', icon: '🟡', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', ringColor: 'ring-yellow-500/30' },
    { value: 'high', label: 'High', icon: '🟠', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', ringColor: 'ring-orange-500/30' },
    { value: 'critical', label: 'Critical', icon: '🔴', color: 'bg-red-500/20 text-red-400 border-red-500/30', ringColor: 'ring-red-500/30' }
  ];

  // Lead source data and state
  const sourceTypes = [
    { id: 'inbound', label: 'Inbound' },
    { id: 'outbound', label: 'Outbound' },
    { id: 'event', label: 'Event' },
    { id: 'referral', label: 'Referral' }
  ];
  
  const channels = {
    inbound: [
      { id: 'website', label: 'Website' },
      { id: 'facebook', label: 'Facebook' },
      { id: 'linkedin', label: 'LinkedIn' },
      { id: 'twitter', label: 'Twitter' },
      { id: 'email', label: 'Email' },
      { id: 'organic-search', label: 'Organic Search' }
    ],
    outbound: [
      { id: 'cold-call', label: 'Cold Call' },
      { id: 'linkedin', label: 'LinkedIn' },
      { id: 'email', label: 'Email Campaign' },
      { id: 'other', label: 'Other' }
    ],
    event: [
      { id: 'webinar', label: 'Webinar' },
      { id: 'conference', label: 'Conference' },
      { id: 'trade-show', label: 'Trade Show' },
      { id: 'in-person', label: 'In Person' }
    ],
    referral: [
      { id: 'client', label: 'Client' },
      { id: 'partner', label: 'Partner' },
      { id: 'employee', label: 'Employee' },
      { id: 'other', label: 'Other' }
    ]
  };

  const currentSourceType = watch('leadSourceType') || 'inbound';
  const currentChannel = watch('leadSourceChannel');

  const handleSourceTypeChange = (sourceType: string) => {
    setValue('leadSourceType', sourceType, { shouldValidate: true });
    setValue('leadSourceChannel', '', { shouldValidate: true });
  };
  
  const handleChannelChange = (channelId: string) => {
    setValue('leadSourceChannel', channelId, { shouldValidate: true });
  };
  


  // Smart quick date options for deal close dates
  const getSmartQuickDates = () => {
    const now = new Date();
    return [
      {
        label: 'End of Week',
        value: format(addDays(startOfWeek(now, { weekStartsOn: 1 }), 4), 'yyyy-MM-dd'), // Friday
        icon: '📅',
        description: 'This Friday'
      },
      {
        label: 'This time next week',
        value: format(addWeeks(now, 1), 'yyyy-MM-dd'),
        icon: '🗓️',
        description: 'Same day next week'
      },
      {
        label: 'End of Month',
        value: format(addDays(addMonths(now, 1), -1), 'yyyy-MM-dd'),
        icon: '📊',
        description: 'Month end'
      },
      {
        label: 'Next Month',
        value: format(addDays(addMonths(now, 1), 15), 'yyyy-MM-dd'),
        icon: '📈',
        description: 'Mid next month'
      }
    ];
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    setIsCalendarOpen(false);
    
    if (date) {
      const formattedDate = format(date, 'yyyy-MM-dd');
      // Manually trigger the form field update
      const event = {
        target: {
          name: 'closeDate',
          value: formattedDate
        }
      } as any;
      register('closeDate').onChange(event);
    }
  };

  const handleQuickDate = (dateValue: string) => {
    const date = new Date(dateValue);
    setSelectedDate(date);
    
    const event = {
      target: {
        name: 'closeDate',
        value: dateValue
      }
    } as any;
    register('closeDate').onChange(event);
  };

  const formatDateDisplay = (date: Date | undefined) => {
    if (!date) return 'Select expected close date...';
    
    const formatted = format(date, 'MMM dd, yyyy');
    
    if (isToday(date)) return `${formatted} (Today)`;
    if (isTomorrow(date)) return `${formatted} (Tomorrow)`;
    if (isThisWeek(date)) return `${formatted} (This Week)`;
    if (isThisMonth(date)) return `${formatted} (This Month)`;
    
    return formatted;
  };

  // Contact search functionality
  const handleContactSearch = async (query: string) => {
    setContactSearchQuery(query);
    
    if (query.length < 2) {
      setSearchedContacts([]);
      setShowCreateContact(false);
      return;
    }
    
    try {
      const results = await searchContacts(query);
      setSearchedContacts(results.slice(0, 10));
      setShowCreateContact(results.length === 0);
    } catch (error) {
      logger.error('Error searching contacts:', error);
      setSearchedContacts([]);
      setShowCreateContact(true);
    }
  };

  // Select a contact from search results
  const handleContactSelect = (contact: any) => {
    setSelectedContact(contact);
    const contactName = contact.full_name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim();
    setContactSearchQuery(contactName);
    setSearchedContacts([]);
    setShowCreateContact(false);
    
    // Update form fields
    setValue('contactName', contactName);
    setValue('contactEmail', contact.email || '');
    setValue('contactPhone', contact.phone || '');
  };

  // Create new contact
  const handleCreateContact = () => {
    const newContactName = contactSearchQuery.trim();
    if (newContactName) {
      setSelectedContact({ full_name: newContactName, isNew: true });
      setValue('contactName', newContactName);
      setSearchedContacts([]);
      setShowCreateContact(false);
    }
  };

  // Clear contact selection
  const handleClearContact = () => {
    setSelectedContact(null);
    setContactSearchQuery('');
    setSearchedContacts([]);
    setShowCreateContact(false);
    setValue('contactName', '');
    setValue('contactEmail', '');
    setValue('contactPhone', '');
  };

  return (
    <div id="details-section" role="tabpanel" aria-labelledby="tab-details">
      <SectionHeading icon={<FileText className="w-4 h-4" />} title="Basic Information" />
      
      <FormField
        id="dealName"
        label="Deal Name"
        required
        error={errors?.name?.message as string}
        className="mb-4"
      >
                <InputWithIcon
          id="name"
          icon={<FileText className="w-4 h-4" />}
          placeholder="Enter deal name"
          aria-required="true"
          aria-invalid={!!errors?.name}
          aria-describedby={errors?.name ? "name-error" : undefined}
          {...register("name", { required: "Deal name is required." })}
        />
        {errors?.name && (
          <ErrorMessage id="name-error">{errors.name.message as string}</ErrorMessage>
        )}
      </FormField>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <FormField
          id="company"
          label="Company"
          required
          error={errors?.company?.message as string}
        >
          <InputWithIcon
            id="company" 
            icon={<Building className="w-4 h-4" />}
            placeholder="Enter company name"
            aria-required="true"
            aria-invalid={!!errors?.company}
            aria-describedby={errors?.company ? "company-error" : undefined}
            {...register("company", { required: "Company name is required." })}
          />
          {errors?.company && (
            <ErrorMessage id="company-error">{errors.company.message as string}</ErrorMessage>
          )}
        </FormField>
        
        <FormField
          id="contactName"
          label="Contact"
        >
          <div className="relative">
            {selectedContact ? (
              // Selected Contact Display
              <div className="bg-gray-900/80 border border-gray-700 rounded-lg py-3 px-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                    {selectedContact.full_name?.[0] || selectedContact.first_name?.[0] || '?'}
                  </div>
                  <div>
                    <div className="text-white font-medium">
                      {selectedContact.full_name || `${selectedContact.first_name || ''} ${selectedContact.last_name || ''}`.trim()}
                    </div>
                    {selectedContact.email && (
                      <div className="text-gray-400 text-sm">{selectedContact.email}</div>
                    )}
                    {selectedContact.isNew && (
                      <Badge variant="outline" className="text-xs bg-green-500/20 text-green-400 border-green-500/30 mt-1">
                        New Contact
                      </Badge>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClearContact}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  ×
                </button>
              </div>
            ) : (
              // Contact Search Interface
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    value={contactSearchQuery}
                    onChange={(e) => handleContactSearch(e.target.value)}
                    placeholder="Search contacts by name, email, or company..."
                    className="w-full bg-gray-900/80 border border-gray-700 rounded-lg py-3 pl-10 pr-3 
                      text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500 
                      focus:border-violet-500 transition-colors"
                  />
                </div>
                
                {/* Search Results Dropdown */}
                {(searchedContacts.length > 0 || showCreateContact) && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800/95 border border-gray-600/50 rounded-xl shadow-lg z-50 max-h-64 overflow-y-auto">
                    {searchedContacts.map((contact) => (
                      <div
                        key={contact.id}
                        onClick={() => handleContactSelect(contact)}
                        className="flex items-center gap-3 p-3 hover:bg-gray-700/50 cursor-pointer border-b border-gray-700/30 last:border-b-0"
                      >
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                          {contact.first_name?.[0] || contact.full_name?.[0] || '?'}
                        </div>
                        <div className="flex-1">
                          <div className="text-white font-medium">
                            {contact.full_name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim()}
                          </div>
                          {contact.email && (
                            <div className="text-gray-400 text-sm">{contact.email}</div>
                          )}
                          {contact.company && (
                            <div className="text-gray-500 text-xs">
                              {typeof contact.company === 'string' 
                                ? contact.company 
                                : contact.company?.name || 'Unknown Company'}
                            </div>
                          )}
                        </div>
                        <Badge variant="outline" className="text-xs bg-blue-500/20 text-blue-400 border-blue-500/30">
                          Select
                        </Badge>
                      </div>
                    ))}
                    
                    {/* Create New Contact Option */}
                    {showCreateContact && contactSearchQuery.trim() && (
                      <div
                        onClick={handleCreateContact}
                        className="flex items-center gap-3 p-3 hover:bg-gray-700/50 cursor-pointer border-t border-gray-700/30"
                      >
                        <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center text-white">
                          <Plus className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <div className="text-white font-medium">
                            Create "{contactSearchQuery.trim()}"
                          </div>
                          <div className="text-gray-400 text-sm">Add as new contact</div>
                        </div>
                        <Badge variant="outline" className="text-xs bg-green-500/20 text-green-400 border-green-500/30">
                          Create
                        </Badge>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
            
            {/* Hidden input for form registration */}
            <input
              type="hidden"
              {...register("contactName")}
            />
          </div>
        </FormField>
      </div>
      
      {/* Quick Contact Edit Section - Show when contact is mapped */}
      {watch('contactName') && (
        <>
          <SectionHeading 
            icon={<User className="w-4 h-4" />} 
            title="Contact Details" 
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <FormField
              id="contactEmail"
              label="Email Address"
            >
              <InputWithIcon 
                id="contactEmail"
                icon={<Mail className="w-4 h-4" />}
                type="email"
                placeholder="contact@company.com"
                {...register("contactEmail")}
              />
            </FormField>
            
            <FormField
              id="contactPhone"
              label="Phone Number"
            >
              <InputWithIcon 
                id="contactPhone"
                icon={<Phone className="w-4 h-4" />}
                type="tel"
                placeholder="+44 20 1234 5678"
                {...register("contactPhone")}
              />
            </FormField>
          </div>
        </>
      )}
      
      {/* Lead Source Section */}
      <SectionHeading 
        icon={<Map className="w-4 h-4" />} 
        title="Lead Source" 
      />
      
      <input type="hidden" {...register("leadSourceType")} />
      <input type="hidden" {...register("leadSourceChannel")} />

      <div className="flex flex-wrap gap-2 mb-4">
        {sourceTypes.map(source => (
          <button
            key={source.id}
            type="button"
            className={`px-3 py-1.5 text-xs font-medium rounded border transition-all
              ${currentSourceType === source.id
                ? 'bg-violet-500/10 border-violet-500/30 text-violet-400'
                : 'bg-gray-900/80 border-gray-700 text-gray-400 hover:bg-gray-800 hover:border-gray-600'
              }`}
            onClick={() => handleSourceTypeChange(source.id)}
            aria-pressed={currentSourceType === source.id}
          >
            {source.label}
          </button>
        ))}
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-4">
        {channels[currentSourceType as keyof typeof channels]?.map(channel => (
          <button
            key={channel.id}
            type="button"
            onClick={() => handleChannelChange(channel.id)}
            className={`flex items-center gap-1.5 p-2 border rounded transition-all text-xs font-medium
              ${currentChannel === channel.id 
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' 
                : 'border-gray-700 bg-gray-900/80 text-gray-400 hover:bg-gray-800 hover:border-gray-600'
              }`}
            aria-pressed={currentChannel === channel.id}
          >
            <div 
              className={`w-3 h-3 rounded-full border flex items-center justify-center 
                ${currentChannel === channel.id 
                  ? 'border-emerald-400' 
                  : 'border-gray-600'
                }`}
            >
              {currentChannel === channel.id && (
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
              )}
            </div>
            <span>{channel.label}</span>
          </button>
        ))}
      </div>
      
      <div className="flex items-start gap-3 p-3 bg-violet-500/10 border border-violet-500/20 rounded-lg text-violet-400 text-sm mb-6">
        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>
          Changing the lead source will update attribution reporting for this deal.
        </span>
      </div>
      
      <SectionHeading 
        icon={<Calendar className="w-4 h-4" />} 
        title="Deal Timeline & Value" 
      />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-6">
        {/* Left Column: Expected Close Date */}
        <div className="space-y-4">
          <FormField
            id="closeDate"
            label="Expected Close Date"
            error={errors?.closeDate?.message as string}
          >
            <div className="space-y-3">
              {/* Smart Quick Date Buttons */}
              <div className="grid grid-cols-2 gap-2">
                {getSmartQuickDates().map((quick) => (
                  <button
                    key={quick.label}
                    type="button"
                    onClick={() => handleQuickDate(quick.value)}
                    className={`p-3 rounded-lg border transition-all duration-200 group text-left hover:scale-[1.02] ${
                      watch('closeDate') === quick.value
                        ? 'bg-violet-500/20 border-violet-500/50 text-violet-300 shadow-lg shadow-violet-500/10'
                        : 'bg-gray-800/30 border-gray-600/30 text-gray-300 hover:bg-gray-700/50 hover:border-gray-500/50 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm group-hover:scale-110 transition-transform duration-200">{quick.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium truncate">{quick.label}</div>
                        <div className="text-xs opacity-70 truncate">{quick.description}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              
              {/* Custom Date Picker */}
              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="w-full bg-gray-900/80 border border-gray-700 rounded-lg py-3 px-4 
                      text-white hover:bg-gray-800/80 hover:border-gray-600 focus:outline-none 
                      focus:ring-1 focus:ring-violet-500 focus:border-violet-500 transition-all duration-200
                      flex items-center gap-3 text-left hover:shadow-lg hover:scale-[1.01] group"
                  >
                    <Calendar className="w-4 h-4 text-gray-400 group-hover:text-violet-400 transition-colors duration-200 flex-shrink-0" />
                    <span className={`transition-colors duration-200 ${selectedDate ? 'text-white' : 'text-gray-500 group-hover:text-gray-400'}`}>
                      {formatDateDisplay(selectedDate)}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-auto p-0 bg-gray-900/95 backdrop-blur-xl border border-gray-800/50 rounded-xl shadow-2xl shadow-black/20" 
                  align="start"
                >
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Calendar className="w-5 h-5 text-violet-400" />
                        <span className="font-medium text-white">Expected Close Date</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDate(undefined);
                          const event = {
                            target: {
                              name: 'closeDate',
                              value: ''
                            }
                          } as any;
                          register('closeDate').onChange(event);
                        }}
                        className="text-xs text-gray-400 hover:text-white transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                    
                    <CalendarComponent
                      mode="single"
                      selected={selectedDate}
                      onSelect={handleDateSelect}
                      disabled={(date) => date < new Date()}
                      className="rounded-md"
                      classNames={{
                        months: "text-white",
                        month: "space-y-4",
                        caption: "flex justify-center pt-1 relative items-center text-white",
                        caption_label: "text-sm font-medium text-white",
                        nav: "space-x-1 flex items-center",
                        nav_button: "h-7 w-7 bg-transparent p-0 text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-md transition-colors",
                        nav_button_previous: "absolute left-1",
                        nav_button_next: "absolute right-1",
                        table: "w-full border-collapse space-y-1",
                        head_row: "flex",
                        head_cell: "text-gray-400 rounded-md w-9 font-normal text-[0.8rem]",
                        row: "flex w-full mt-2",
                        cell: "text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
                        day: "h-9 w-9 p-0 font-normal text-white hover:bg-violet-500/20 rounded-md transition-colors",
                        day_selected: "bg-violet-500 text-white hover:bg-violet-600 focus:bg-violet-500 focus:text-white",
                        day_today: "bg-gray-800/70 text-white font-medium",
                        day_outside: "text-gray-500 opacity-50",
                        day_disabled: "text-gray-500 opacity-30 cursor-not-allowed",
                        day_hidden: "invisible",
                      }}
                      components={{
                        IconLeft: () => <ChevronLeft className="h-4 w-4" />,
                        IconRight: () => <ChevronRight className="h-4 w-4" />,
                      }}
                    />
                  </div>
                </PopoverContent>
              </Popover>
              
              {/* Hidden input for form registration */}
              <input
                type="hidden"
                {...register("closeDate")}
                aria-invalid={!!errors?.closeDate}
                aria-describedby={errors?.closeDate ? "closeDate-error" : undefined}
              />
            </div>
            
            {errors?.closeDate && (
              <ErrorMessage id="closeDate-error">{errors.closeDate.message as string}</ErrorMessage>
            )}
          </FormField>
          
          {/* First Billing Date */}
          <FormField
            id="firstBillingDate"
            label="First Billing Date"
            error={errors?.firstBillingDate?.message as string}
          >
            <InputWithIcon
              id="firstBillingDate"
              type="date"
              icon={<Calendar className="w-4 h-4" />}
              placeholder="Select first billing date..."
              {...register("firstBillingDate")}
              aria-invalid={!!errors?.firstBillingDate}
              aria-describedby={errors?.firstBillingDate ? "firstBillingDate-error" : undefined}
            />
            
            {errors?.firstBillingDate && (
              <ErrorMessage id="firstBillingDate-error">{errors.firstBillingDate.message as string}</ErrorMessage>
            )}
            
            <div className="mt-1 text-xs text-gray-500">
              When should billing/invoicing begin for this deal? (Optional)
            </div>
          </FormField>
        </div>

        {/* Right Column: Revenue & Priority Stack */}
        <div className="space-y-6">
          {/* Deal Revenue Section - Admin Only */}
          {isAdmin && (
            <div className="bg-gray-800/20 border border-gray-700/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <PoundSterling className="w-4 h-4 text-emerald-400" />
                <h4 className="text-sm font-medium text-gray-300">Deal Revenue</h4>
              </div>
            
            <div className="space-y-4">
              <FormField
                id="oneOffRevenue"
                label="One-off Revenue (£)"
                error={errors?.oneOffRevenue?.message as string}
              >
                <div className="relative">
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
                    £
                  </div>
                  <input
                    id="oneOffRevenue"
                    type="number"
                    placeholder="0"
                    min="0"
                    step="0.01"
                    aria-invalid={!!errors?.oneOffRevenue}
                    aria-describedby={errors?.oneOffRevenue ? "oneOffRevenue-error" : undefined}
                    className="w-full bg-gray-900/80 border border-gray-700 rounded-lg py-3 pl-8 pr-3 
                      text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500 
                      focus:border-violet-500 transition-colors"
                    {...register("oneOffRevenue", { 
                      valueAsNumber: true,
                      min: { value: 0, message: "Value must be non-negative." } 
                    })}
                  />
                </div>
                {errors?.oneOffRevenue && (
                  <ErrorMessage id="oneOffRevenue-error">{errors.oneOffRevenue.message as string}</ErrorMessage>
                )}
              </FormField>
              
              <FormField
                id="monthlyMrr"
                label="Monthly Recurring Revenue (£)"
                error={errors?.monthlyMrr?.message as string}
              >
                <div className="relative">
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
                    £
                  </div>
                  <input
                    id="monthlyMrr"
                    type="number"
                    placeholder="0"
                    min="0"
                    step="0.01"
                    aria-invalid={!!errors?.monthlyMrr}
                    aria-describedby={errors?.monthlyMrr ? "monthlyMrr-error" : undefined}
                    className="w-full bg-gray-900/80 border border-gray-700 rounded-lg py-3 pl-8 pr-3 
                      text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500 
                      focus:border-violet-500 transition-colors"
                    {...register("monthlyMrr", { 
                      valueAsNumber: true,
                      min: { value: 0, message: "Value must be non-negative." } 
                    })}
                  />
                </div>
                {errors?.monthlyMrr && (
                  <ErrorMessage id="monthlyMrr-error">{errors.monthlyMrr.message as string}</ErrorMessage>
                )}
              </FormField>

              {/* Total Deal Value Display */}
              {(watch('oneOffRevenue') || watch('monthlyMrr')) && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <div className="text-sm text-emerald-400">
                    <span className="font-medium">Total Deal Value: </span>
                    £{(
                      (parseFloat(watch('oneOffRevenue') as string) || 0) + 
                      ((parseFloat(watch('monthlyMrr') as string) || 0) * 3)
                    ).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </div>
                  {watch('monthlyMrr') && parseFloat(watch('monthlyMrr') as string) > 0 && (
                    <div className="text-xs text-gray-400 mt-1">
                      Annual Value: £{(
                        (parseFloat(watch('oneOffRevenue') as string) || 0) + 
                        ((parseFloat(watch('monthlyMrr') as string) || 0) * 12)
                      ).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                  )}
                </div>
              )}
            </div>
            </div>
          )}

          {/* Deal Priority Section */}
          <div className="bg-gray-800/20 border border-gray-700/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-4 h-4 text-yellow-400" />
              <h4 className="text-sm font-medium text-gray-300">Deal Priority</h4>
            </div>
            
            <input type="hidden" {...register("priority")} />
            
            <div className="grid grid-cols-2 gap-2">
              {priorityOptions.map((priority) => (
                <button
                  key={priority.value}
                  type="button"
                  onClick={() => setValue('priority', priority.value, { shouldValidate: true })}
                  className={`p-3 rounded-xl border transition-all ${
                    watch('priority') === priority.value
                      ? `${priority.color} ${priority.ringColor} ring-2`
                      : 'bg-gray-800/30 border-gray-600/30 text-gray-400 hover:bg-gray-700/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{priority.icon}</span>
                    <span className="text-xs font-medium">{priority.label}</span>
                  </div>
                </button>
              ))}
            </div>
            
            {errors?.priority && (
              <ErrorMessage id="priority-error">{errors.priority.message as string}</ErrorMessage>
            )}
          </div>
        </div>
      </div>
      
      <SectionHeading 
        icon={<AlignLeft className="w-4 h-4" />} 
        title="Additional Details" 
      />
      
      <FormField
        id="notes"
        label="Description & Notes"
        className="mb-4"
        error={errors?.notes?.message as string}
      >
        <TextAreaWithIcon 
          id="notes"
          icon={<AlignLeft className="w-4 h-4" />}
          placeholder="Add description or notes about this deal..."
          rows={4}
          defaultValue={getValues('notes')}
          {...register("notes")}
        />
        {errors?.notes && (
          <ErrorMessage id="notes-error">{errors.notes.message as string}</ErrorMessage>
        )}
      </FormField>


    </div>
  );
};

// Helper components
interface SectionHeadingProps {
  icon: React.ReactNode;
  title: string;
}

const SectionHeading: React.FC<SectionHeadingProps> = ({ icon, title }) => (
  <div className="flex items-center gap-2 mb-4 text-gray-400 text-sm font-medium">
    <div className="flex items-center justify-center">
      {icon}
    </div>
    <span>{title}</span>
  </div>
);

interface FormFieldProps {
  id: string;
  label: string;
  children: React.ReactNode;
  required?: boolean;
  error?: string;
  className?: string;
}

const FormField: React.FC<FormFieldProps> = ({ 
  id, 
  label, 
  children, 
  required, 
  error, 
  className 
}) => (
  <div className={className}>
    <label 
      htmlFor={id} 
      className="block text-sm font-medium text-gray-400 mb-1.5"
    >
      {label}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
    {children}
  </div>
);

interface InputWithIconProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon: React.ReactNode;
}

const InputWithIcon = React.forwardRef<HTMLInputElement, InputWithIconProps>(
  ({ icon, className, ...props }, ref) => (
    <div className="relative">
      <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
        {icon}
      </div>
      <input
        ref={ref}
        className={`w-full bg-gray-900/80 border border-gray-700 rounded-lg py-2.5 pl-10 pr-3 
          text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500 
          focus:border-violet-500 transition-colors ${className || ''}`}
        {...props}
      />
    </div>
  )
);

interface SelectWithIconProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  icon: React.ReactNode;
  children: React.ReactNode;
}

const SelectWithIcon = React.forwardRef<HTMLSelectElement, SelectWithIconProps>(
  ({ icon, children, ...props }, ref) => (
    <div className="relative">
      <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
        {icon}
      </div>
      <select
        ref={ref}
        className="w-full appearance-none bg-gray-900/80 border border-gray-700 rounded-lg py-2.5 pl-10 pr-9
          text-white focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 transition-colors"
        {...props}
      >
        {children}
      </select>
      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-500">
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>
    </div>
  )
);

interface TextAreaWithIconProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  icon: React.ReactNode;
}

const TextAreaWithIcon = React.forwardRef<HTMLTextAreaElement, TextAreaWithIconProps>(
  ({ icon, ...props }, ref) => (
    <div className="relative">
      <div className="absolute left-3 top-3 text-gray-500">
        {icon}
      </div>
      <textarea
        ref={ref}
        className="w-full bg-gray-900/80 border border-gray-700 rounded-lg py-2.5 pl-10 pr-3
          text-white placeholder-gray-500 focus:outline-none focus:ring-1 
          focus:ring-violet-500 focus:border-violet-500 transition-colors resize-none"
        {...props}
      />
    </div>
  )
);

interface ErrorMessageProps {
  id: string;
  children: React.ReactNode;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ id, children }) => (
  <p id={id} className="mt-1.5 text-sm text-red-400">
    {children}
  </p>
);

export default DealDetailsSection; 