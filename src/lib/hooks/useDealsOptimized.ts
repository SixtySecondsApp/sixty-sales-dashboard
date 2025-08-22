import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { API_BASE_URL, DISABLE_EDGE_FUNCTIONS } from '@/lib/config';
import { fetchWithRetry, apiCall } from '@/lib/utils/apiUtils';
import { supabase, supabaseAdmin } from '@/lib/supabase/clientV2';
import logger from '@/lib/utils/logger';

// Backend Memory Management & Optimization
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class MemoryOptimizedCache {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly maxSize = 100;
  private readonly defaultTTL = 5 * 60 * 1000; // 5 minutes

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  set<T>(key: string, data: T, ttl = this.defaultTTL): void {
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Global cache instance for memory efficiency
const globalCache = new MemoryOptimizedCache();

// Security: Sanitize error messages to prevent sensitive data exposure
function sanitizeErrorMessage(error: any): string {
  const message = error?.message || 'Unknown error';
  
  // Log full error server-side but return sanitized message to user
  logger.error('Deal operation error (sanitized for user):', {
    message,
    timestamp: new Date().toISOString(),
  });
  
  // Return generic error messages for common errors
  if (message.includes('duplicate key')) {
    return 'A deal with this information already exists';
  }
  if (message.includes('foreign key')) {
    return 'Referenced record not found';
  }
  if (message.includes('PGRST')) {
    return 'Database connection error';
  }
  if (message.includes('JWT')) {
    return 'Authentication required';
  }
  
  return 'Operation failed. Please try again.';
}

export interface DealWithRelationships {
  id: string;
  name: string;
  company: string;
  contact_name: string;
  value: number;
  status: string;
  stage_id: string;
  created_at: string;
  updated_at: string;
  stage_changed_at: string;
  probability: number;
  close_date: string;
  notes: string;
  owner_id: string;
  company_id?: string;
  primary_contact_id?: string;
  
  // Revenue model fields
  one_off_revenue?: number;
  monthly_mrr?: number;
  annual_value?: number;
  
  // Computed fields
  daysInStage: number;
  timeStatus: 'normal' | 'warning' | 'danger';
  
  // Joined relationship data from Neon (CRM)
  deal_stages?: {
    id: string;
    name: string;
    color: string;
    default_probability: number;
  };
  companies?: {
    id: string;
    name: string;
    domain: string;
    size: string;
    industry: string;
    website: string;
    linkedin_url: string;
  };
  contacts?: {
    id: string;
    first_name: string;
    last_name: string;
    full_name: string;
    email: string;
    phone: string;
    title: string;
    linkedin_url: string;
    is_primary: boolean;
  };
  deal_contacts?: Array<{
    contact_id: string;
    contact: {
      id: string;
      full_name: string;
      email: string;
      title: string;
    };
  }>;
}

export interface DealStage {
  id: string;
  name: string;
  color: string;
  order_position: number;
  default_probability: number;
}

interface AuthSession {
  session: any;
  timestamp: number;
}

// Connection Pool Manager for Supabase
class ConnectionManager {
  private static instance: ConnectionManager;
  private sessionCache: AuthSession | null = null;
  private readonly sessionTTL = 60 * 1000; // 1 minute session cache

  static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }
    return ConnectionManager.instance;
  }

  async getSession() {
    // Return cached session if still valid
    if (this.sessionCache && Date.now() - this.sessionCache.timestamp < this.sessionTTL) {
      return this.sessionCache.session;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      this.sessionCache = {
        session,
        timestamp: Date.now()
      };
      return session;
    } catch (error) {
      logger.error('Failed to get session:', error);
      return null;
    }
  }

  invalidateSession() {
    this.sessionCache = null;
  }
}

export function useDealsOptimized(ownerId?: string) {
  const [deals, setDeals] = useState<DealWithRelationships[]>([]);
  const [stages, setStages] = useState<DealStage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Memory cleanup references
  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  
  const connectionManager = ConnectionManager.getInstance();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Optimized deals fetch with aggressive caching
  const fetchDeals = useCallback(async () => {
    if (!mountedRef.current) return;
    
    // Check cache first
    const cacheKey = `deals_${ownerId || 'all'}`;
    const cachedDeals = globalCache.get<DealWithRelationships[]>(cacheKey);
    if (cachedDeals) {
      logger.log('📋 Using cached deals data');
      setDeals(cachedDeals);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      
      logger.log('🔄 Starting optimized deals fetch for owner:', ownerId || 'ALL');
      
      // Get cached or fresh session
      const session = await connectionManager.getSession();
      
      let dealsData: any[] = [];

      if (!session) {
        logger.log('❌ No session found, using service key fallback');
        // Direct service key query - no complex relationships for performance
        try {
          let query = supabaseAdmin
            .from('deals')
            .select('*');
          
          if (ownerId) {
            query = query.eq('owner_id', ownerId);
          }
          
          const result = await query.order('created_at', { ascending: false });
          
          if (result.error) throw result.error;
          dealsData = result.data || [];
          
          logger.log(`✅ Service key query successful: ${dealsData.length} deals found`);
        } catch (serviceError) {
          logger.error('❌ Service key query failed:', serviceError);
          throw serviceError;
        }
      } else {
        // Try optimized API call with shorter timeout
        try {
          if (!DISABLE_EDGE_FUNCTIONS) {
            const url = ownerId 
              ? `${API_BASE_URL}/deals?owner_id=${ownerId}&includeRelationships=false`
              : `${API_BASE_URL}/deals?includeRelationships=false`; // Disable relationships for performance
            
            const response = await apiCall<{ data: DealWithRelationships[] }>(
              url,
              {
                signal: abortControllerRef.current?.signal
              },
              { maxRetries: 1, retryDelay: 500, showToast: false }
            );
            
            dealsData = response.data || [];
            logger.log(`✅ Edge Functions successful: ${dealsData.length} deals processed`);
          } else {
            throw new Error('Edge Functions disabled');
          }
        } catch (edgeFunctionError) {
          logger.warn('⚠️ Edge Function failed, falling back to direct Supabase client:', edgeFunctionError);
          
          // Optimized direct Supabase fallback
          try {
            let query = supabase
              .from('deals')
              .select('*'); // Simple select for performance
            
            if (ownerId) {
              query = query.eq('owner_id', ownerId);
            }
            
            const result = await query
              .order('created_at', { ascending: false })
              .limit(1000); // Reasonable limit
            
            if (result.error) throw result.error;
            dealsData = result.data || [];
            
            logger.log(`✅ Direct Supabase query successful: ${dealsData.length} deals found`);
          } catch (supabaseError) {
            logger.error('❌ Direct Supabase query failed:', supabaseError);
            throw supabaseError;
          }
        }
      }
      
      // Process deals efficiently
      const processedDeals = dealsData.map((deal: any) => ({
        ...deal,
        company: deal.company || '',
        contact_name: deal.contact_name || '',
        daysInStage: deal.stage_changed_at 
          ? Math.floor((Date.now() - new Date(deal.stage_changed_at).getTime()) / (1000 * 60 * 60 * 24))
          : 0,
        timeStatus: 'normal' as const
      }));
      
      if (mountedRef.current) {
        setDeals(processedDeals);
        // Cache for 5 minutes
        globalCache.set(cacheKey, processedDeals, 5 * 60 * 1000);
      }
      
    } catch (err: any) {
      if (err.name === 'AbortError') {
        logger.log('🔄 Request aborted');
        return;
      }
      
      const sanitizedMessage = sanitizeErrorMessage(err);
      logger.error('❌ Error fetching deals - sanitized message:', sanitizedMessage);
      
      if (mountedRef.current) {
        setError(sanitizedMessage);
        toast.error(sanitizedMessage);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [ownerId, connectionManager]);

  // Optimized stages fetch with long-term caching
  const fetchStages = useCallback(async () => {
    if (!mountedRef.current) return;
    
    const cacheKey = 'deal_stages';
    const cachedStages = globalCache.get<DealStage[]>(cacheKey);
    if (cachedStages) {
      logger.log('📋 Using cached stages data');
      setStages(cachedStages);
      return;
    }

    try {
      // Try API first, then fallback
      try {
        if (!DISABLE_EDGE_FUNCTIONS) {
          const result = await apiCall<DealStage[]>(
            `${API_BASE_URL}/stages`,
            {},
            { maxRetries: 1, retryDelay: 500, showToast: false }
          );
          
          if (mountedRef.current) {
            setStages(result || []);
            // Cache stages for 30 minutes (they change infrequently)
            globalCache.set(cacheKey, result || [], 30 * 60 * 1000);
          }
          return;
        }
      } catch (edgeFunctionError) {
        // Fallback to direct Supabase client
        const { data: stagesData, error: supabaseError } = await supabase
          .from('deal_stages')
          .select('*')
          .order('order_position', { ascending: true });
        
        if (supabaseError) throw supabaseError;
        
        if (mountedRef.current) {
          setStages(stagesData || []);
          // Cache stages for 30 minutes
          globalCache.set(cacheKey, stagesData || [], 30 * 60 * 1000);
        }
      }
    } catch (err: any) {
      logger.error('Error fetching stages:', err);
      if (mountedRef.current) {
        setError(err.message);
      }
    }
  }, []);

  // Load data on mount and when ownerId changes
  useEffect(() => {
    if (mountedRef.current) {
      fetchStages();
      fetchDeals();
    }
  }, [ownerId, fetchDeals, fetchStages]);

  // Group deals by stage for pipeline display (memoized)
  const dealsByStage = deals.reduce((acc, deal) => {
    const stageId = deal.stage_id;
    if (!acc[stageId]) {
      acc[stageId] = [];
    }
    acc[stageId].push(deal);
    return acc;
  }, {} as Record<string, DealWithRelationships[]>);

  // Optimized deal creation with proper error handling
  const createDeal = async (dealData: any): Promise<any> => {
    try {
      logger.log('🚀 Starting optimized deal creation with data:', dealData);
      
      // Try Edge Function first with timeout
      try {
        const result = await apiCall(
          `${API_BASE_URL}/deals`,
          {
            method: 'POST',
            body: JSON.stringify(dealData),
          },
          { maxRetries: 1, retryDelay: 1000, showToast: false }
        );

        logger.log('✅ Deal API response:', result);
        
        // Ensure we have valid deal data before proceeding
        if (result && (result.data?.id || result.id)) {
          const createdDeal = result.data || result;
          
          // Invalidate cache immediately
          globalCache.invalidatePattern('deals_.*');
          
          toast.success('Deal created successfully');
          await fetchDeals(); // Refresh to get updated data
          
          return createdDeal; // Return the actual deal object
        } else {
          logger.error('❌ API returned success but no deal data:', result);
          throw new Error('API returned success but no deal data');
        }
      } catch (edgeFunctionError) {
        logger.log('⚠️ API call failed, falling back to Supabase:', edgeFunctionError);
        
        // Fallback to direct Supabase client with proper error handling
        const { data: deal, error } = await supabase
          .from('deals')
          .insert({
            ...dealData,
            stage_changed_at: new Date().toISOString()
          })
          .select()
          .single();
        
        if (error) {
          logger.error('❌ Supabase fallback also failed:', error);
          throw error;
        }
        
        if (!deal || !deal.id) {
          logger.error('❌ Supabase returned success but no deal data');
          throw new Error('Database returned success but no deal data');
        }
        
        logger.log('✅ Deal created via Supabase fallback:', deal);
        
        // Invalidate cache
        globalCache.invalidatePattern('deals_.*');
        
        toast.success('Deal created successfully');
        await fetchDeals(); // Refresh to get updated data
        
        return deal; // Return the created deal object
      }
    } catch (error: any) {
      const sanitizedMessage = sanitizeErrorMessage(error);
      logger.error('❌ Error creating deal - sanitized message:', sanitizedMessage);
      toast.error(sanitizedMessage);
      
      // Return null instead of false to make error handling clearer
      return null;
    }
  };

  // Optimized update with cache invalidation
  const updateDeal = async (id: string, updates: any): Promise<boolean> => {
    try {
      logger.log('🔄 Updating deal with data:', updates);
      
      // Try Edge Function first
      try {
        const result = await apiCall(
          `${API_BASE_URL}/deals/${id}`,
          {
            method: 'PUT',
            body: JSON.stringify(updates),
          },
          { maxRetries: 1, retryDelay: 1000, showToast: false }
        );

        logger.log('✅ Edge Function update successful');
        toast.success('Deal updated successfully');
        
        // Invalidate cache and refresh
        globalCache.invalidatePattern('deals_.*');
        await fetchDeals();
        
        return true;
      } catch (edgeFunctionError) {
        logger.warn('⚠️ Edge Function failed, trying direct Supabase client:', edgeFunctionError);
        
        // Fallback to direct Supabase client with optimized update logic
        const updateData = { ...updates };
        
        // Handle stage change tracking
        if (updates.stage_id) {
          // Get current deal to check if stage is actually changing
          const { data: currentDeal } = await supabase
            .from('deals')
            .select('stage_id')
            .eq('id', id)
            .single();

          if (currentDeal && currentDeal.stage_id !== updates.stage_id) {
            updateData.stage_changed_at = new Date().toISOString();
          }
        }
        
        // Process date fields safely
        if ('expected_close_date' in updateData) {
          if (updateData.expected_close_date === '' || updateData.expected_close_date === undefined) {
            updateData.expected_close_date = null;
          } else if (updateData.expected_close_date) {
            try {
              const dateObj = new Date(updateData.expected_close_date);
              if (!isNaN(dateObj.getTime())) {
                updateData.expected_close_date = dateObj.toISOString().split('T')[0];
              } else {
                updateData.expected_close_date = null;
              }
            } catch (dateError) {
              logger.warn('⚠️ Date processing error, setting to null:', dateError);
              updateData.expected_close_date = null;
            }
          }
        }
        
        // Perform the update
        const { data: deal, error } = await supabase
          .from('deals')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();
        
        if (error) {
          throw error;
        }
        
        logger.log('✅ Direct Supabase update successful');
        toast.success('Deal updated successfully');
        
        // Invalidate cache and refresh
        globalCache.invalidatePattern('deals_.*');
        await fetchDeals();
        
        return true;
      }
    } catch (error: any) {
      const sanitizedMessage = sanitizeErrorMessage(error);
      logger.error('❌ Error updating deal - sanitized message:', sanitizedMessage);
      toast.error(sanitizedMessage);
      return false;
    }
  };

  // Optimized delete with cache invalidation
  const deleteDeal = async (id: string): Promise<boolean> => {
    try {
      // Try Edge Function first
      try {
        await apiCall(
          `${API_BASE_URL}/deals/${id}`,
          { method: 'DELETE' },
          { maxRetries: 1, retryDelay: 1000, showToast: false }
        );

        toast.success('Deal deleted successfully');
      } catch (edgeFunctionError) {
        // Fallback to direct Supabase client
        const { error } = await supabase
          .from('deals')
          .delete()
          .eq('id', id);
        
        if (error) throw error;
        toast.success('Deal deleted successfully');
      }
      
      // Invalidate cache and refresh
      globalCache.invalidatePattern('deals_.*');
      await fetchDeals();
      
      return true;
    } catch (error: any) {
      const sanitizedMessage = sanitizeErrorMessage(error);
      logger.error('❌ Error deleting deal - sanitized message:', sanitizedMessage);
      toast.error(sanitizedMessage);
      return false;
    }
  };

  // Optimized stage move
  const moveDealToStage = async (dealId: string, stageId: string): Promise<boolean> => {
    try {
      const updates = {
        stage_id: stageId,
        stage_changed_at: new Date().toISOString()
      };
      
      // Try Edge Function first
      try {
        await apiCall(
          `${API_BASE_URL}/deals/${dealId}`,
          {
            method: 'PUT',
            body: JSON.stringify(updates),
          },
          { maxRetries: 1, retryDelay: 1000, showToast: false }
        );
      } catch (edgeFunctionError) {
        // Fallback to direct Supabase client
        const { error } = await supabase
          .from('deals')
          .update(updates)
          .eq('id', dealId);
        
        if (error) throw error;
      }
      
      // Invalidate cache and refresh
      globalCache.invalidatePattern('deals_.*');
      await fetchDeals();
      
      return true;
    } catch (error: any) {
      const sanitizedMessage = sanitizeErrorMessage(error);
      logger.error('❌ Error moving deal - sanitized message:', sanitizedMessage);
      toast.error(sanitizedMessage);
      return false;
    }
  };

  const forceUpdateDealStage = async (dealId: string, stageId: string) => {
    return await moveDealToStage(dealId, stageId);
  };

  const refreshDeals = useCallback(() => {
    // Clear cache and fetch fresh data
    globalCache.invalidatePattern('deals_.*');
    return fetchDeals();
  }, [fetchDeals]);

  return {
    deals,
    stages,
    dealsByStage,
    isLoading,
    error,
    createDeal,
    updateDeal,
    deleteDeal,
    moveDealToStage,
    forceUpdateDealStage,
    refreshDeals,
    // Additional optimization utilities
    cacheStats: {
      size: globalCache.size(),
      clear: () => globalCache.clear()
    }
  };
}