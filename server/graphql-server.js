/**
 * ================================================================
 * GRAPHQL SERVER FOR EFFICIENT DATA FETCHING
 * Advanced data fetching with query optimization and caching
 * ================================================================
 */

import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { buildSchema } from 'graphql';
import { logger, redis, redisAvailable } from './performance-middleware.js';

/**
 * GraphQL Schema Definition
 */
const typeDefs = `
  scalar DateTime
  scalar JSON

  type Query {
    # Companies
    companies(
      ownerId: ID
      search: String
      includeStats: Boolean = false
      limit: Int = 50
      cursor: String
    ): CompanyConnection!
    
    company(id: ID!): Company
    
    # Deals
    deals(
      ownerId: ID
      includeRelationships: Boolean = false
      limit: Int = 50
      cursor: String
    ): DealConnection!
    
    deal(id: ID!): Deal
    
    # Contacts
    contacts(
      ownerId: ID
      companyId: ID
      search: String
      includeCompany: Boolean = false
      limit: Int = 50
      cursor: String
    ): ContactConnection!
    
    contact(id: ID!): Contact
    
    # Utility queries
    dealStages: [DealStage!]!
    owners: [Owner!]!
    
    # Performance monitoring
    performanceStats: PerformanceStats!
  }

  type Mutation {
    # Deal mutations
    createDeal(input: CreateDealInput!): DealMutationResponse!
    updateDeal(id: ID!, input: UpdateDealInput!): DealMutationResponse!
    deleteDeal(id: ID!): DeleteMutationResponse!
    
    # Batch operations
    batchRequests(requests: [BatchRequestInput!]!): BatchResponse!
  }

  # Company Types
  type Company {
    id: ID!
    name: String!
    domain: String
    industry: String
    size: String
    website: String
    ownerId: ID
    createdAt: DateTime!
    updatedAt: DateTime!
    
    # Stats (only when includeStats is true)
    contactCount: Int
    dealsCount: Int
    dealsValue: Float
    
    # Relationships
    contacts(limit: Int = 20): [Contact!]!
    deals(limit: Int = 20): [Deal!]!
    owner: Owner
  }

  type CompanyConnection {
    edges: [CompanyEdge!]!
    pageInfo: PageInfo!
    totalCount: Int
  }

  type CompanyEdge {
    node: Company!
    cursor: String!
  }

  # Deal Types
  type Deal {
    id: ID!
    name: String!
    company: String
    value: Float!
    companyId: ID
    primaryContactId: ID
    stageId: ID!
    probability: Int!
    expectedCloseDate: DateTime
    description: String
    ownerId: ID!
    contactIdentifier: String
    contactIdentifierType: String
    contactName: String
    status: String
    createdAt: DateTime!
    updatedAt: DateTime!
    stageChangedAt: DateTime
    
    # Relationships (only when includeRelationships is true)
    companyDetails: Company
    primaryContact: Contact
    stage: DealStage
    owner: Owner
    activities: [Activity!]!
  }

  type DealConnection {
    edges: [DealEdge!]!
    pageInfo: PageInfo!
    totalCount: Int
  }

  type DealEdge {
    node: Deal!
    cursor: String!
  }

  # Contact Types
  type Contact {
    id: ID!
    firstName: String
    lastName: String
    fullName: String
    email: String
    phone: String
    title: String
    companyId: ID
    ownerId: ID
    createdAt: DateTime!
    updatedAt: DateTime!
    
    # Relationships (only when includeCompany is true)
    company: Company
    owner: Owner
    deals: [Deal!]!
    activities: [Activity!]!
    stats: ContactStats
    tasks: [ContactTask!]!
  }

  type ContactConnection {
    edges: [ContactEdge!]!
    pageInfo: PageInfo!
    totalCount: Int
  }

  type ContactEdge {
    node: Contact!
    cursor: String!
  }

  type ContactStats {
    meetings: Int!
    emails: Int!
    calls: Int!
    totalDeals: Int!
    activeDeals: Int!
    totalDealsValue: Float!
    engagementScore: Int!
  }

  type ContactTask {
    id: ID!
    source: String!
    title: String!
    description: String
    priority: String!
    dueDate: DateTime
    completed: Boolean!
  }

  # Activity Types
  type Activity {
    id: ID!
    type: String!
    description: String
    contactId: ID
    companyId: ID
    createdAt: DateTime!
    updatedAt: DateTime!
    
    contact: Contact
    company: Company
  }

  # Utility Types
  type DealStage {
    id: ID!
    name: String!
    color: String!
    defaultProbability: Int!
    orderPosition: Int!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Owner {
    id: ID!
    firstName: String
    lastName: String
    fullName: String
    stage: String
    email: String
    dealCount: Int
    totalValue: Float
  }

  # Performance Types
  type PerformanceStats {
    queries: Int!
    cacheHits: Int!
    cacheMisses: Int!
    cacheHitRatio: String!
    errors: Int!
    pool: PoolStats!
    queryStats: JSON
  }

  type PoolStats {
    total: Int!
    idle: Int!
    waiting: Int!
  }

  # Pagination Types
  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  # Input Types
  input CreateDealInput {
    name: String!
    company: String
    value: Float = 0
    companyId: ID
    primaryContactId: ID
    stageId: ID
    probability: Int = 50
    expectedCloseDate: DateTime
    description: String
    ownerId: ID!
    contactIdentifier: String
    contactIdentifierType: String
    contactName: String
  }

  input UpdateDealInput {
    name: String
    company: String
    value: Float
    companyId: ID
    primaryContactId: ID
    stageId: ID
    probability: Int
    expectedCloseDate: DateTime
    description: String
    status: String
  }

  input BatchRequestInput {
    id: String!
    method: String!
    path: String!
    query: JSON
    body: JSON
    headers: JSON
  }

  # Response Types
  type DealMutationResponse {
    success: Boolean!
    deal: Deal
    error: String
  }

  type DeleteMutationResponse {
    success: Boolean!
    deletedId: ID
    error: String
  }

  type BatchResponse {
    results: [BatchResult!]!
    meta: BatchMeta!
  }

  type BatchResult {
    id: String!
    status: Int!
    data: JSON
    error: String
  }

  type BatchMeta {
    requestCount: Int!
    processingTime: Int!
    timestamp: DateTime!
  }
`;

/**
 * GraphQL Resolvers
 */
class GraphQLResolvers {
  constructor(db, queryOptimizer, batchProcessor, cursorPagination) {
    this.db = db;
    this.queryOptimizer = queryOptimizer;
    this.batchProcessor = batchProcessor;
    this.cursorPagination = cursorPagination;
    this.dataloaders = this.createDataLoaders();
  }

  /**
   * Create DataLoaders for batching and caching
   */
  createDataLoaders() {
    // In a full implementation, you would use libraries like DataLoader
    // For now, we'll implement basic batching
    return {
      companies: this.createCompanyLoader(),
      deals: this.createDealLoader(),
      contacts: this.createContactLoader()
    };
  }

  createCompanyLoader() {
    let batchedRequests = [];
    let batchTimeout = null;

    return async (id) => {
      return new Promise((resolve, reject) => {
        batchedRequests.push({ id, resolve, reject });

        if (!batchTimeout) {
          batchTimeout = setTimeout(async () => {
            const requests = [...batchedRequests];
            batchedRequests = [];
            batchTimeout = null;

            try {
              const ids = requests.map(req => req.id);
              const result = await this.db.query(
                'SELECT * FROM companies WHERE id = ANY($1)',
                [ids]
              );

              const companiesById = new Map();
              result.rows.forEach(company => {
                companiesById.set(company.id, company);
              });

              requests.forEach(req => {
                const company = companiesById.get(req.id);
                if (company) {
                  req.resolve(company);
                } else {
                  req.resolve(null);
                }
              });
            } catch (error) {
              requests.forEach(req => req.reject(error));
            }
          }, 10); // 10ms batch window
        }
      });
    };
  }

  createDealLoader() {
    // Similar implementation to company loader
    return async (id) => {
      const result = await this.db.query('SELECT * FROM deals WHERE id = $1', [id]);
      return result.rows[0] || null;
    };
  }

  createContactLoader() {
    // Similar implementation to company loader
    return async (id) => {
      const result = await this.db.query('SELECT * FROM contacts WHERE id = $1', [id]);
      return result.rows[0] || null;
    };
  }

  /**
   * Get resolvers object
   */
  getResolvers() {
    return {
      Query: {
        // Company resolvers
        companies: async (parent, args, context) => {
          try {
            const pagination = this.cursorPagination.parsePaginationParams({
              cursor: args.cursor,
              limit: args.limit,
              direction: 'forward'
            });

            let result;
            if (args.includeStats) {
              result = await this.queryOptimizer.executeOptimized(
                'get_companies_with_stats',
                [args.ownerId || null, args.search ? `%${args.search}%` : null, args.limit || 50]
              );
            } else {
              result = await this.queryOptimizer.executeOptimized(
                'get_companies_simple',
                [args.ownerId || null, args.search ? `%${args.search}%` : null, args.limit || 50]
              );
            }

            return this.formatConnection(result.rows, pagination, 'company');
          } catch (error) {
            logger.error('GraphQL companies query failed', { error: error.message });
            throw new Error('Failed to fetch companies');
          }
        },

        company: async (parent, args) => {
          return this.dataloaders.companies(args.id);
        },

        // Deal resolvers
        deals: async (parent, args) => {
          try {
            const pagination = this.cursorPagination.parsePaginationParams({
              cursor: args.cursor,
              limit: args.limit,
              direction: 'forward'
            });

            let result;
            if (args.includeRelationships) {
              result = await this.queryOptimizer.executeOptimized(
                'get_deals_with_relationships',
                [args.ownerId || null, args.limit || 50]
              );
            } else {
              result = await this.queryOptimizer.executeOptimized(
                'get_deals_simple',
                [args.ownerId || null, args.limit || 50]
              );
            }

            return this.formatConnection(result.rows, pagination, 'deal');
          } catch (error) {
            logger.error('GraphQL deals query failed', { error: error.message });
            throw new Error('Failed to fetch deals');
          }
        },

        deal: async (parent, args) => {
          return this.dataloaders.deals(args.id);
        },

        // Contact resolvers
        contacts: async (parent, args) => {
          try {
            const pagination = this.cursorPagination.parsePaginationParams({
              cursor: args.cursor,
              limit: args.limit,
              direction: 'forward'
            });

            let result;
            if (args.includeCompany) {
              result = await this.queryOptimizer.executeOptimized(
                'get_contacts_with_company',
                [
                  args.ownerId || null,
                  args.search ? `%${args.search}%` : null,
                  args.companyId || null,
                  args.limit || 50
                ]
              );
            } else {
              result = await this.queryOptimizer.executeOptimized(
                'get_contacts_simple',
                [
                  args.ownerId || null,
                  args.search ? `%${args.search}%` : null,
                  args.companyId || null,
                  args.limit || 50
                ]
              );
            }

            return this.formatConnection(result.rows, pagination, 'contact');
          } catch (error) {
            logger.error('GraphQL contacts query failed', { error: error.message });
            throw new Error('Failed to fetch contacts');
          }
        },

        contact: async (parent, args) => {
          return this.dataloaders.contacts(args.id);
        },

        // Utility resolvers
        dealStages: async () => {
          const result = await this.queryOptimizer.executeOptimized('get_deal_stages');
          return result.rows;
        },

        owners: async () => {
          const result = await this.queryOptimizer.executeOptimized('get_owners_with_stats');
          return result.rows;
        },

        performanceStats: async () => {
          return this.db.getStats();
        }
      },

      Mutation: {
        createDeal: async (parent, args) => {
          try {
            const dealData = args.input;
            
            // Set default values if not provided
            const finalData = {
              name: dealData.name,
              company: dealData.company || dealData.name,
              value: dealData.value || 0,
              company_id: dealData.companyId || null,
              primary_contact_id: dealData.primaryContactId || null,
              stage_id: dealData.stageId,
              probability: dealData.probability || 50,
              expected_close_date: dealData.expectedCloseDate || null,
              description: dealData.description || '',
              owner_id: dealData.ownerId,
              contact_identifier: dealData.contactIdentifier || null,
              contact_identifier_type: dealData.contactIdentifierType || 'unknown',
              contact_name: dealData.contactName || ''
            };

            // If no stage_id provided, get the first stage
            if (!finalData.stage_id) {
              const stageResult = await this.db.query(
                'SELECT id FROM deal_stages ORDER BY order_position ASC LIMIT 1'
              );
              if (stageResult.rows.length > 0) {
                finalData.stage_id = stageResult.rows[0].id;
              }
            }

            const query = `
              INSERT INTO deals (
                name, company, value, company_id, primary_contact_id, stage_id,
                probability, expected_close_date, description, owner_id,
                contact_identifier, contact_identifier_type, contact_name,
                stage_changed_at
              ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW()
              ) RETURNING *
            `;

            const params = [
              finalData.name, finalData.company, finalData.value, finalData.company_id,
              finalData.primary_contact_id, finalData.stage_id, finalData.probability,
              finalData.expected_close_date, finalData.description, finalData.owner_id,
              finalData.contact_identifier, finalData.contact_identifier_type, finalData.contact_name
            ];

            const result = await this.db.query(query, params);

            return {
              success: true,
              deal: result.rows[0],
              error: null
            };
          } catch (error) {
            logger.error('GraphQL createDeal mutation failed', { error: error.message });
            return {
              success: false,
              deal: null,
              error: error.message
            };
          }
        },

        updateDeal: async (parent, args) => {
          try {
            const { id } = args;
            const updates = args.input;

            // Build dynamic update query
            const updateFields = [];
            const params = [];
            let paramCount = 1;

            Object.keys(updates).forEach(key => {
              if (updates[key] !== undefined && updates[key] !== null) {
                // Convert camelCase to snake_case for database columns
                const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
                updateFields.push(`${dbKey} = $${paramCount}`);
                params.push(updates[key]);
                paramCount++;
              }
            });

            if (updateFields.length === 0) {
              return {
                success: false,
                deal: null,
                error: 'No fields to update'
              };
            }

            // Add updated_at timestamp
            updateFields.push(`updated_at = NOW()`);

            // If stage_id is being updated, also update stage_changed_at
            if (updates.stageId) {
              updateFields.push(`stage_changed_at = NOW()`);
            }

            params.push(id);

            const query = `
              UPDATE deals 
              SET ${updateFields.join(', ')}
              WHERE id = $${paramCount}
              RETURNING *
            `;

            const result = await this.db.query(query, params);

            if (result.rows.length === 0) {
              return {
                success: false,
                deal: null,
                error: 'Deal not found'
              };
            }

            return {
              success: true,
              deal: result.rows[0],
              error: null
            };
          } catch (error) {
            logger.error('GraphQL updateDeal mutation failed', { error: error.message });
            return {
              success: false,
              deal: null,
              error: error.message
            };
          }
        },

        deleteDeal: async (parent, args) => {
          try {
            const { id } = args;

            const query = 'DELETE FROM deals WHERE id = $1 RETURNING id';
            const result = await this.db.query(query, [id]);

            if (result.rows.length === 0) {
              return {
                success: false,
                deletedId: null,
                error: 'Deal not found'
              };
            }

            return {
              success: true,
              deletedId: id,
              error: null
            };
          } catch (error) {
            logger.error('GraphQL deleteDeal mutation failed', { error: error.message });
            return {
              success: false,
              deletedId: null,
              error: error.message
            };
          }
        },

        batchRequests: async (parent, args) => {
          try {
            const result = await this.batchProcessor.processBatch(args.requests);
            return result;
          } catch (error) {
            logger.error('GraphQL batch request failed', { error: error.message });
            throw new Error('Batch processing failed');
          }
        }
      },

      // Field resolvers for relationships
      Company: {
        contacts: async (parent, args) => {
          const result = await this.db.query(
            'SELECT * FROM contacts WHERE company_id = $1 ORDER BY updated_at DESC LIMIT $2',
            [parent.id, args.limit || 20]
          );
          return result.rows;
        },

        deals: async (parent, args) => {
          const result = await this.db.query(
            'SELECT * FROM deals WHERE company_id = $1 ORDER BY updated_at DESC LIMIT $2',
            [parent.id, args.limit || 20]
          );
          return result.rows;
        },

        owner: async (parent) => {
          if (!parent.owner_id) return null;
          const result = await this.db.query(
            'SELECT * FROM profiles WHERE id = $1',
            [parent.owner_id]
          );
          return result.rows[0] || null;
        }
      },

      Contact: {
        company: async (parent) => {
          if (!parent.company_id) return null;
          return this.dataloaders.companies(parent.company_id);
        },

        deals: async (parent) => {
          const result = await this.queryOptimizer.executeOptimized(
            'get_contact_deals',
            [parent.id]
          );
          return result.rows;
        },

        activities: async (parent, args) => {
          const result = await this.queryOptimizer.executeOptimized(
            'get_contact_activities',
            [parent.id, args.limit || 10]
          );
          return result.rows;
        },

        stats: async (parent) => {
          const result = await this.queryOptimizer.executeOptimized(
            'get_contact_stats',
            [parent.id]
          );
          return result.rows[0] || null;
        }
      },

      Deal: {
        companyDetails: async (parent) => {
          if (!parent.company_id) return null;
          return this.dataloaders.companies(parent.company_id);
        },

        primaryContact: async (parent) => {
          if (!parent.primary_contact_id) return null;
          return this.dataloaders.contacts(parent.primary_contact_id);
        },

        stage: async (parent) => {
          if (!parent.stage_id) return null;
          const result = await this.db.query(
            'SELECT * FROM deal_stages WHERE id = $1',
            [parent.stage_id]
          );
          return result.rows[0] || null;
        }
      }
    };
  }

  /**
   * Format results as GraphQL connection
   */
  formatConnection(rows, pagination, nodeType) {
    const edges = rows.map((row, index) => ({
      node: row,
      cursor: this.cursorPagination.encodeCursor({
        updated_at: row.updated_at,
        id: row.id
      })
    }));

    const pageInfo = {
      hasNextPage: rows.length === pagination.limit,
      hasPreviousPage: false, // Would need to implement based on cursor
      startCursor: edges.length > 0 ? edges[0].cursor : null,
      endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null
    };

    return {
      edges,
      pageInfo,
      totalCount: null // Not calculated for performance
    };
  }
}

/**
 * Create and configure Apollo Server
 */
async function createGraphQLServer(db, queryOptimizer, batchProcessor, cursorPagination) {
  const resolvers = new GraphQLResolvers(db, queryOptimizer, batchProcessor, cursorPagination);

  const server = new ApolloServer({
    typeDefs,
    resolvers: resolvers.getResolvers(),
    cache: redisAvailable ? {
      async get(key) {
        try {
          const result = await redis.get(`graphql:${key}`);
          return result ? JSON.parse(result) : undefined;
        } catch (error) {
          logger.warn('GraphQL cache get failed', { key, error: error.message });
          return undefined;
        }
      },
      async set(key, value, options = {}) {
        try {
          const ttl = options.ttl || 300; // 5 minutes default
          await redis.setex(`graphql:${key}`, ttl, JSON.stringify(value));
        } catch (error) {
          logger.warn('GraphQL cache set failed', { key, error: error.message });
        }
      }
    } : undefined,
    plugins: [
      {
        requestDidStart() {
          return {
            didResolveOperation(requestContext) {
              logger.info('GraphQL operation', {
                operationName: requestContext.request.operationName,
                query: requestContext.request.query?.slice(0, 200) + '...'
              });
            },
            didEncounterErrors(requestContext) {
              logger.error('GraphQL errors', {
                errors: requestContext.errors.map(err => err.message)
              });
            }
          };
        }
      }
    ],
    introspection: process.env.NODE_ENV !== 'production',
    csrfPrevention: true
  });

  await server.start();

  return server;
}

export { createGraphQLServer, GraphQLResolvers };