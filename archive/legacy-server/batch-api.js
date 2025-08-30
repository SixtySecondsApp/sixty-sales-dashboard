/**
 * ================================================================
 * REQUEST BATCHING API
 * Efficient bulk operations for reduced network overhead
 * ================================================================
 */

import { batchUtils, logger } from './performance-middleware.js';

/**
 * Batch endpoint processor
 * Handles multiple API requests in a single HTTP call
 */
class BatchProcessor {
  constructor(app, db) {
    this.app = app;
    this.db = db;
    this.maxBatchSize = 50;
    this.maxConcurrency = 10;
  }

  /**
   * Process batch requests with intelligent routing
   */
  async processBatch(requests) {
    const startTime = Date.now();
    const results = [];
    
    try {
      // Validate batch request
      batchUtils.validateBatchRequest(requests);
      
      // Group requests by type for optimization
      const groupedRequests = this.groupRequestsByType(requests);
      
      // Process different types with optimized strategies
      const processingPromises = Object.entries(groupedRequests).map(async ([type, typeRequests]) => {
        switch (type) {
          case 'companies':
            return this.processBatchCompanies(typeRequests);
          case 'deals':
            return this.processBatchDeals(typeRequests);
          case 'contacts':
            return this.processBatchContacts(typeRequests);
          default:
            return this.processGenericBatch(typeRequests);
        }
      });
      
      // Wait for all processing to complete
      const typeResults = await Promise.allSettled(processingPromises);
      
      // Flatten results maintaining original order
      const flatResults = [];
      typeResults.forEach(result => {
        if (result.status === 'fulfilled') {
          flatResults.push(...result.value);
        } else {
          // Add error results
          flatResults.push({
            id: 'batch_error',
            status: 500,
            error: result.reason?.message || 'Batch processing failed'
          });
        }
      });
      
      // Sort results by original request order
      const sortedResults = new Array(requests.length);
      flatResults.forEach(result => {
        const originalIndex = requests.findIndex(req => req.id === result.id);
        if (originalIndex >= 0) {
          sortedResults[originalIndex] = result;
        }
      });
      
      const processingTime = Date.now() - startTime;
      
      logger.info('Batch request processed', {
        requestCount: requests.length,
        processingTime: `${processingTime}ms`,
        successCount: sortedResults.filter(r => r && r.status < 400).length,
        errorCount: sortedResults.filter(r => r && r.status >= 400).length
      });
      
      return {
        results: sortedResults,
        meta: {
          requestCount: requests.length,
          processingTime,
          timestamp: new Date().toISOString()
        }
      };
      
    } catch (error) {
      logger.error('Batch processing failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Group requests by API endpoint type for optimized processing
   */
  groupRequestsByType(requests) {
    const groups = {};
    
    requests.forEach((request, index) => {
      const enhancedRequest = { ...request, originalIndex: index };
      
      if (request.path.startsWith('/api/companies')) {
        groups.companies = groups.companies || [];
        groups.companies.push(enhancedRequest);
      } else if (request.path.startsWith('/api/deals')) {
        groups.deals = groups.deals || [];
        groups.deals.push(enhancedRequest);
      } else if (request.path.startsWith('/api/contacts')) {
        groups.contacts = groups.contacts || [];
        groups.contacts.push(enhancedRequest);
      } else {
        groups.generic = groups.generic || [];
        groups.generic.push(enhancedRequest);
      }
    });
    
    return groups;
  }

  /**
   * Optimized batch processing for companies
   */
  async processBatchCompanies(requests) {
    const results = [];
    
    // Separate GET requests (can be bulk queried) from mutations
    const getRequests = requests.filter(req => req.method === 'GET');
    const mutationRequests = requests.filter(req => req.method !== 'GET');
    
    // Process GET requests in bulk
    if (getRequests.length > 0) {
      try {
        // Extract owner IDs and filters
        const ownerIds = [...new Set(getRequests.map(req => req.query?.ownerId).filter(Boolean))];
        
        if (ownerIds.length === 1) {
          // Single owner - can optimize with one query
          const ownerId = ownerIds[0];
          const includeStats = getRequests.some(req => req.query?.includeStats === 'true');
          
          const companiesResult = await this.db.getCompaniesWithStats(ownerId, {
            includeStats,
            limit: 1000 // Large limit for batch
          });
          
          // Map results back to individual requests
          getRequests.forEach(request => {
            let filteredData = companiesResult.rows;
            
            // Apply individual request filters
            if (request.query?.search) {
              const searchTerm = request.query.search.toLowerCase();
              filteredData = filteredData.filter(company => 
                company.name?.toLowerCase().includes(searchTerm) ||
                company.domain?.toLowerCase().includes(searchTerm)
              );
            }
            
            if (request.query?.limit) {
              filteredData = filteredData.slice(0, parseInt(request.query.limit));
            }
            
            results.push({
              id: request.id,
              status: 200,
              data: {
                data: filteredData,
                count: filteredData.length,
                error: null
              }
            });
          });
        } else {
          // Multiple owners or no owner - process individually
          for (const request of getRequests) {
            try {
              const result = await this.processSingleCompanyRequest(request);
              results.push(result);
            } catch (error) {
              results.push({
                id: request.id,
                status: 500,
                error: error.message
              });
            }
          }
        }
      } catch (error) {
        // Fallback to individual processing
        for (const request of getRequests) {
          try {
            const result = await this.processSingleCompanyRequest(request);
            results.push(result);
          } catch (err) {
            results.push({
              id: request.id,
              status: 500,
              error: err.message
            });
          }
        }
      }
    }
    
    // Process mutation requests individually
    for (const request of mutationRequests) {
      try {
        const result = await this.processSingleCompanyRequest(request);
        results.push(result);
      } catch (error) {
        results.push({
          id: request.id,
          status: 500,
          error: error.message
        });
      }
    }
    
    return results;
  }

  /**
   * Process single company request
   */
  async processSingleCompanyRequest(request) {
    const { method, path, query, body } = request;
    
    try {
      switch (method) {
        case 'GET':
          if (path === '/api/companies') {
            const result = await this.db.getCompaniesWithStats(query?.ownerId, {
              search: query?.search,
              includeStats: query?.includeStats === 'true',
              limit: query?.limit ? parseInt(query.limit) : 50
            });
            
            return {
              id: request.id,
              status: 200,
              data: {
                data: result.rows,
                count: result.rows.length,
                error: null
              }
            };
          }
          break;
          
        case 'POST':
          if (path === '/api/companies') {
            // Company creation logic would go here
            return {
              id: request.id,
              status: 201,
              data: { message: 'Company creation not implemented in batch yet' }
            };
          }
          break;
          
        default:
          return {
            id: request.id,
            status: 405,
            error: `Method ${method} not supported for companies in batch`
          };
      }
    } catch (error) {
      return {
        id: request.id,
        status: 500,
        error: error.message
      };
    }
  }

  /**
   * Optimized batch processing for deals
   */
  async processBatchDeals(requests) {
    const results = [];
    
    for (const request of requests) {
      try {
        const result = await this.processSingleDealRequest(request);
        results.push(result);
      } catch (error) {
        results.push({
          id: request.id,
          status: 500,
          error: error.message
        });
      }
    }
    
    return results;
  }

  /**
   * Process single deal request
   */
  async processSingleDealRequest(request) {
    const { method, path, query, body } = request;
    
    try {
      switch (method) {
        case 'GET':
          if (path === '/api/deals') {
            const result = await this.db.getDealsWithRelationships(query?.ownerId, {
              includeRelationships: query?.includeRelationships === 'true',
              limit: query?.limit ? parseInt(query.limit) : 50
            });
            
            return {
              id: request.id,
              status: 200,
              data: {
                data: result.rows,
                count: result.rows.length,
                error: null
              }
            };
          }
          break;
          
        case 'POST':
          if (path === '/api/deals') {
            // Deal creation logic would go here
            return {
              id: request.id,
              status: 201,
              data: { message: 'Deal creation not implemented in batch yet' }
            };
          }
          break;
          
        default:
          return {
            id: request.id,
            status: 405,
            error: `Method ${method} not supported for deals in batch`
          };
      }
    } catch (error) {
      return {
        id: request.id,
        status: 500,
        error: error.message
      };
    }
  }

  /**
   * Optimized batch processing for contacts
   */
  async processBatchContacts(requests) {
    const results = [];
    
    for (const request of requests) {
      try {
        const result = await this.processSingleContactRequest(request);
        results.push(result);
      } catch (error) {
        results.push({
          id: request.id,
          status: 500,
          error: error.message
        });
      }
    }
    
    return results;
  }

  /**
   * Process single contact request
   */
  async processSingleContactRequest(request) {
    const { method, path, query, body } = request;
    
    try {
      switch (method) {
        case 'GET':
          if (path === '/api/contacts') {
            const result = await this.db.getContactsWithCompany(query?.ownerId, {
              search: query?.search,
              companyId: query?.companyId,
              includeCompany: query?.includeCompany === 'true',
              limit: query?.limit ? parseInt(query.limit) : 50
            });
            
            return {
              id: request.id,
              status: 200,
              data: {
                data: result.rows,
                count: result.rows.length,
                error: null
              }
            };
          }
          break;
          
        default:
          return {
            id: request.id,
            status: 405,
            error: `Method ${method} not supported for contacts in batch`
          };
      }
    } catch (error) {
      return {
        id: request.id,
        status: 500,
        error: error.message
      };
    }
  }

  /**
   * Generic batch processing fallback
   */
  async processGenericBatch(requests) {
    const results = [];
    
    for (const request of requests) {
      results.push({
        id: request.id,
        status: 501,
        error: `Generic batch processing not implemented for ${request.path}`
      });
    }
    
    return results;
  }
}

export default BatchProcessor;