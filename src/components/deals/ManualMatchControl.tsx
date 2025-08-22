// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/clientV2';
import { Deal } from '@/lib/database/models'; // Assuming Deal model is defined here
import { useDebounce } from '@/lib/hooks/useDebounce'; // Assuming a debounce hook exists

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner'; // Assuming use of sonner for toasts
import { Loader2, Link2, Search } from 'lucide-react';
import logger from '@/lib/utils/logger';

interface ManualMatchControlProps {
  activityId: string;
  contactEmail?: string | null; // Optional email from activity
  // Function to call when linking is successful
  onLinkSuccess: (activityId: string) => void; 
  // Function to perform the update (passed from parent hook)
  updateActivityFn: (id: string, updates: { deal_id: string; is_matched: boolean }) => Promise<boolean>; 
}

export function ManualMatchControl({ 
  activityId,
  contactEmail,
  onLinkSuccess,
  updateActivityFn
}: ManualMatchControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Deal[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLinking, setIsLinking] = useState(false);

  // Use contactEmail's domain as initial search term if available
  useEffect(() => {
    if (contactEmail) {
      const domain = contactEmail.split('@')[1];
      if (domain) {
        setSearchTerm(domain);
      }
    }
  }, [contactEmail]); // Run only when contactEmail changes

  const debouncedSearchTerm = useDebounce(searchTerm, 500); // 500ms debounce

  // Function to search for deals
  const searchDeals = useCallback(async (term: string) => {
    if (!term || term.length < 3) { // Don't search for very short terms
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      // Import security utilities
      const { validateSearchTerm, SafeQueryBuilder } = await import('@/lib/utils/sqlSecurity');
      
      // Validate search terms
      const termValidation = validateSearchTerm(term);
      if (!termValidation.isValid) {
        logger.error('Invalid search term:', termValidation.error);
        throw new Error(termValidation.error || 'Invalid search term');
      }
      
      // Search by domain OR company name
      const domainSearchTerm = term.includes('@') ? term.split('@')[1] : term;
      const domainValidation = validateSearchTerm(domainSearchTerm);
      if (!domainValidation.isValid) {
        logger.error('Invalid domain search term:', domainValidation.error);
        throw new Error(domainValidation.error || 'Invalid domain search term');
      }
      
      // Build safe OR clause
      const searchOrClause = new SafeQueryBuilder()
        .addSearchCondition('contact_email', domainValidation.sanitized)
        .addSearchCondition('company', termValidation.sanitized)
        .buildOrClause();
      
      const { data, error } = await supabase
        .from('deals')
        .select('id, name, company, contact_email') // Select needed fields
        .or(searchOrClause) // Case-insensitive search
        .limit(10); // Limit results

      if (error) throw error;
      setSearchResults(data || []);

    } catch (error: any) {
      logger.error('Error searching deals:', error);
      toast.error('Failed to search for deals', { description: error.message });
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Trigger search when debounced term changes
  useEffect(() => {
    searchDeals(debouncedSearchTerm);
  }, [debouncedSearchTerm, searchDeals]);

  // Function to handle linking a deal
  const handleLinkDeal = async (dealId: string) => {
    setIsLinking(true);
    try {
      const success = await updateActivityFn(activityId, {
        deal_id: dealId,
        is_matched: true,
      });

      if (success) {
        toast.success('Activity successfully linked to deal!');
        setIsOpen(false); // Close popover
        onLinkSuccess(activityId); // Notify parent
      } else {
        // updateActivityFn should ideally handle its own errors/toasts
        // but we add a fallback here
        toast.error('Failed to link activity.');
      }
    } catch (error: any) { 
      logger.error('Error linking activity:', error);
      toast.error('Failed to link activity.', { description: error.message });
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={isLinking}>
          {isLinking ? (
             <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
          ) : (
            <Link2 className="mr-2 h-4 w-4" /> 
          )}
          Match
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Link Activity to Deal</h4>
            <p className="text-sm text-muted-foreground">
              Search for an existing deal by company or email domain.
            </p>
          </div>
          <div className="relative">
             <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              id="deal-search" 
              placeholder="e.g., acme.com or Acme Corp" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8" // Add padding for icon
            />
          </div>
          <ScrollArea className="h-[200px]">
            {isSearching && (
              <div className="flex justify-center items-center p-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {!isSearching && searchResults.length === 0 && debouncedSearchTerm.length >= 3 && (
              <p className="text-sm text-center text-muted-foreground p-4">No matching deals found.</p>
            )}
            {!isSearching && searchResults.length > 0 && (
              <div className="space-y-2">
                {searchResults.map((deal) => (
                  <div key={deal.id} className="flex items-center justify-between p-2 border rounded-md">
                    <div className='truncate mr-2'>
                       <p className="text-sm font-medium truncate">{deal.name}</p>
                       <p className="text-xs text-muted-foreground truncate">
                         {deal.company} {deal.contact_email ? `(${deal.contact_email})` : ''}
                       </p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleLinkDeal(deal.id)}
                      disabled={isLinking}
                    >
                      {isLinking ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Link'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
} 