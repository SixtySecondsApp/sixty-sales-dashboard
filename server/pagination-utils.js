/**
 * ================================================================
 * CURSOR-BASED PAGINATION UTILITIES
 * Efficient pagination for large datasets at scale
 * ================================================================
 */

import crypto from 'crypto';
import { logger } from './performance-middleware.js';

/**
 * Cursor-based pagination implementation
 * More efficient than offset-based pagination for large datasets
 */
class CursorPagination {
  constructor(options = {}) {
    this.defaultLimit = options.defaultLimit || 50;
    this.maxLimit = options.maxLimit || 1000;
    this.encryptionKey = options.encryptionKey || process.env.PAGINATION_KEY || 'sixty-sales-pagination-key-2024';
  }

  /**
   * Encode cursor data securely
   */
  encodeCursor(data) {
    try {
      const jsonData = JSON.stringify(data);
      const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
      let encrypted = cipher.update(jsonData, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      return encrypted.replace(/[+/=]/g, (char) => {
        switch (char) {
          case '+': return '-';
          case '/': return '_';
          case '=': return '';
          default: return char;
        }
      });
    } catch (error) {
      logger.error('Cursor encoding failed', { error: error.message });
      return null;
    }
  }

  /**
   * Decode cursor data securely
   */
  decodeCursor(cursor) {
    try {
      // Restore base64 characters
      let base64 = cursor.replace(/[-_]/g, (char) => {
        switch (char) {
          case '-': return '+';
          case '_': return '/';
          default: return char;
        }
      });
      
      // Add padding if needed
      while (base64.length % 4) {
        base64 += '=';
      }
      
      const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
      let decrypted = decipher.update(base64, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      return JSON.parse(decrypted);
    } catch (error) {
      logger.warn('Cursor decoding failed', { error: error.message, cursor });
      return null;
    }
  }

  /**
   * Parse pagination parameters from request
   */
  parsePaginationParams(query) {
    const {
      cursor = null,
      limit = this.defaultLimit,
      direction = 'forward' // 'forward' or 'backward'
    } = query;

    const parsedLimit = Math.min(parseInt(limit) || this.defaultLimit, this.maxLimit);
    let cursorData = null;

    if (cursor) {
      cursorData = this.decodeCursor(cursor);
      if (!cursorData) {
        throw new Error('Invalid cursor provided');
      }
    }

    return {
      cursor: cursorData,
      limit: parsedLimit,
      direction: direction === 'backward' ? 'backward' : 'forward'
    };
  }

  /**
   * Build pagination query for companies
   */
  buildCompaniesQuery(baseQuery, params, pagination) {
    const { cursor, limit, direction } = pagination;
    const conditions = [];
    const queryParams = [...params];

    if (cursor) {
      const { updated_at, id } = cursor;
      const operator = direction === 'forward' ? '<' : '>';
      const orderDirection = direction === 'forward' ? 'DESC' : 'ASC';
      
      conditions.push(`(updated_at ${operator} $${queryParams.length + 1} OR (updated_at = $${queryParams.length + 1} AND id ${operator} $${queryParams.length + 2}))`);
      queryParams.push(updated_at, id);
    }

    // Add cursor condition to base query
    let finalQuery = baseQuery;
    if (conditions.length > 0) {
      const whereClause = baseQuery.includes('WHERE') ? ' AND ' : ' WHERE ';
      finalQuery += whereClause + conditions.join(' AND ');
    }

    // Add ordering and limit
    const orderDirection = direction === 'forward' ? 'DESC' : 'ASC';
    finalQuery += ` ORDER BY updated_at ${orderDirection}, id ${orderDirection}`;
    finalQuery += ` LIMIT $${queryParams.length + 1}`;
    queryParams.push(limit + 1); // Request one extra to determine if there are more results

    return { query: finalQuery, params: queryParams };
  }

  /**
   * Build pagination query for deals
   */
  buildDealsQuery(baseQuery, params, pagination) {
    const { cursor, limit, direction } = pagination;
    const conditions = [];
    const queryParams = [...params];

    if (cursor) {
      const { updated_at, id } = cursor;
      const operator = direction === 'forward' ? '<' : '>';
      
      conditions.push(`(d.updated_at ${operator} $${queryParams.length + 1} OR (d.updated_at = $${queryParams.length + 1} AND d.id ${operator} $${queryParams.length + 2}))`);
      queryParams.push(updated_at, id);
    }

    let finalQuery = baseQuery;
    if (conditions.length > 0) {
      const whereClause = baseQuery.includes('WHERE') ? ' AND ' : ' WHERE ';
      finalQuery += whereClause + conditions.join(' AND ');
    }

    const orderDirection = direction === 'forward' ? 'DESC' : 'ASC';
    finalQuery += ` ORDER BY d.updated_at ${orderDirection}, d.id ${orderDirection}`;
    finalQuery += ` LIMIT $${queryParams.length + 1}`;
    queryParams.push(limit + 1);

    return { query: finalQuery, params: queryParams };
  }

  /**
   * Build pagination query for contacts
   */
  buildContactsQuery(baseQuery, params, pagination) {
    const { cursor, limit, direction } = pagination;
    const conditions = [];
    const queryParams = [...params];

    if (cursor) {
      const { updated_at, id } = cursor;
      const operator = direction === 'forward' ? '<' : '>';
      
      conditions.push(`(ct.updated_at ${operator} $${queryParams.length + 1} OR (ct.updated_at = $${queryParams.length + 1} AND ct.id ${operator} $${queryParams.length + 2}))`);
      queryParams.push(updated_at, id);
    }

    let finalQuery = baseQuery;
    if (conditions.length > 0) {
      const whereClause = baseQuery.includes('WHERE') ? ' AND ' : ' WHERE ';
      finalQuery += whereClause + conditions.join(' AND ');
    }

    const orderDirection = direction === 'forward' ? 'DESC' : 'ASC';
    finalQuery += ` ORDER BY ct.updated_at ${orderDirection}, ct.id ${orderDirection}`;
    finalQuery += ` LIMIT $${queryParams.length + 1}`;
    queryParams.push(limit + 1);

    return { query: finalQuery, params: queryParams };
  }

  /**
   * Process paginated results and generate response
   */
  processResults(results, requestedLimit, direction = 'forward') {
    const hasMore = results.length > requestedLimit;
    const data = hasMore ? results.slice(0, requestedLimit) : results;
    
    let nextCursor = null;
    let prevCursor = null;

    if (data.length > 0) {
      if (hasMore && direction === 'forward') {
        // Create cursor for next page
        const lastItem = data[data.length - 1];
        nextCursor = this.encodeCursor({
          updated_at: lastItem.updated_at,
          id: lastItem.id
        });
      }

      if (direction === 'backward' || hasMore) {
        // Create cursor for previous page
        const firstItem = data[0];
        prevCursor = this.encodeCursor({
          updated_at: firstItem.updated_at,
          id: firstItem.id
        });
      }
    }

    return {
      data: direction === 'backward' ? data.reverse() : data,
      pagination: {
        hasMore: hasMore && direction === 'forward',
        hasPrevious: direction === 'backward' || Boolean(prevCursor),
        nextCursor: nextCursor,
        prevCursor: direction === 'backward' ? null : prevCursor,
        limit: requestedLimit,
        count: data.length
      },
      meta: {
        totalCount: null, // Not calculated for performance reasons
        direction,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Create pagination response with standard format
   */
  createResponse(results, requestedLimit, direction, additionalMeta = {}) {
    const processedResults = this.processResults(results, requestedLimit, direction);
    
    return {
      ...processedResults,
      error: null,
      meta: {
        ...processedResults.meta,
        ...additionalMeta
      }
    };
  }

  /**
   * Generate pagination links for API responses
   */
  generatePaginationLinks(baseUrl, pagination, additionalParams = {}) {
    const links = {};
    const params = new URLSearchParams(additionalParams);

    if (pagination.nextCursor) {
      params.set('cursor', pagination.nextCursor);
      params.set('limit', pagination.limit.toString());
      links.next = `${baseUrl}?${params.toString()}`;
    }

    if (pagination.prevCursor) {
      params.set('cursor', pagination.prevCursor);
      params.set('direction', 'backward');
      params.set('limit', pagination.limit.toString());
      links.prev = `${baseUrl}?${params.toString()}`;
    }

    return links;
  }
}

/**
 * Search pagination for full-text search results
 */
class SearchPagination extends CursorPagination {
  /**
   * Build search query with cursor pagination
   */
  buildSearchQuery(baseQuery, params, pagination, searchColumn = 'name') {
    const { cursor, limit, direction } = pagination;
    const conditions = [];
    const queryParams = [...params];

    if (cursor) {
      const { search_rank, updated_at, id } = cursor;
      const operator = direction === 'forward' ? '<' : '>';
      
      // Use search rank as primary cursor, then updated_at, then id
      conditions.push(`(search_rank ${operator} $${queryParams.length + 1} OR 
                      (search_rank = $${queryParams.length + 1} AND updated_at ${operator} $${queryParams.length + 2}) OR
                      (search_rank = $${queryParams.length + 1} AND updated_at = $${queryParams.length + 2} AND id ${operator} $${queryParams.length + 3}))`);
      queryParams.push(search_rank, updated_at, id);
    }

    let finalQuery = baseQuery;
    if (conditions.length > 0) {
      const whereClause = baseQuery.includes('WHERE') ? ' AND ' : ' WHERE ';
      finalQuery += whereClause + conditions.join(' AND ');
    }

    const orderDirection = direction === 'forward' ? 'DESC' : 'ASC';
    finalQuery += ` ORDER BY search_rank ${orderDirection}, updated_at ${orderDirection}, id ${orderDirection}`;
    finalQuery += ` LIMIT $${queryParams.length + 1}`;
    queryParams.push(limit + 1);

    return { query: finalQuery, params: queryParams };
  }

  /**
   * Process search results with rank-based cursors
   */
  processSearchResults(results, requestedLimit, direction = 'forward') {
    const hasMore = results.length > requestedLimit;
    const data = hasMore ? results.slice(0, requestedLimit) : results;
    
    let nextCursor = null;
    let prevCursor = null;

    if (data.length > 0) {
      if (hasMore && direction === 'forward') {
        const lastItem = data[data.length - 1];
        nextCursor = this.encodeCursor({
          search_rank: lastItem.search_rank,
          updated_at: lastItem.updated_at,
          id: lastItem.id
        });
      }

      if (direction === 'backward' || hasMore) {
        const firstItem = data[0];
        prevCursor = this.encodeCursor({
          search_rank: firstItem.search_rank,
          updated_at: firstItem.updated_at,
          id: firstItem.id
        });
      }
    }

    return {
      data: direction === 'backward' ? data.reverse() : data,
      pagination: {
        hasMore: hasMore && direction === 'forward',
        hasPrevious: direction === 'backward' || Boolean(prevCursor),
        nextCursor: nextCursor,
        prevCursor: direction === 'backward' ? null : prevCursor,
        limit: requestedLimit,
        count: data.length
      },
      meta: {
        totalCount: null,
        direction,
        timestamp: new Date().toISOString()
      }
    };
  }
}

// Export singleton instances
const cursorPagination = new CursorPagination();
const searchPagination = new SearchPagination();

export {
  CursorPagination,
  SearchPagination,
  cursorPagination,
  searchPagination
};