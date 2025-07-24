/**
 * Example usage of the new request context system for audit tracking
 * This demonstrates how to properly track HTTP requests in audit logs
 */

import { setRequestContext, updateRequestContext, trackDatabaseOperation } from './requestContext';
import { supabase } from '@/lib/supabase/clientV2';

// Example 1: Basic API request tracking
export async function exampleApiRequest(req: Request) {
  // Extract request metadata
  const metadata = {
    method: req.method,
    endpoint: new URL(req.url).pathname,
    headers: {
      'user-agent': req.headers.get('user-agent') || '',
      'content-type': req.headers.get('content-type') || '',
      'origin': req.headers.get('origin') || '',
    },
    startTime: Date.now()
  };

  // Set request context for audit logging
  await setRequestContext(metadata);

  try {
    // Your API logic here
    const result = await processApiRequest();
    
    // Update with success status
    await updateRequestContext(200);
    
    return result;
  } catch (error) {
    // Update with error status
    await updateRequestContext(500);
    throw error;
  }
}

// Example 2: Database operation tracking
export async function exampleDatabaseOperation() {
  return await trackDatabaseOperation(
    async () => {
      // Your database operations here
      const { data, error } = await supabase
        .from('deals')
        .update({ status: 'closed' })
        .eq('id', 'some-deal-id');
      
      if (error) throw error;
      return data;
    },
    {
      method: 'DATABASE',
      endpoint: 'deals_update',
      description: 'Update deal status to closed'
    }
  );
}

// Example 3: Client-side request tracking
export async function exampleClientSideRequest() {
  const metadata = {
    method: 'POST',
    endpoint: '/api/deals',
    headers: {
      'user-agent': navigator.userAgent,
      'origin': window.location.origin,
      'referer': document.referrer,
    },
    startTime: Date.now()
  };

  await setRequestContext(metadata);

  try {
    const response = await fetch('/api/deals', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'New Deal' }),
    });

    await updateRequestContext(response.status);
    
    return response.json();
  } catch (error) {
    await updateRequestContext(500);
    throw error;
  }
}

// Example 4: Middleware wrapper for automatic tracking
export function withAuditTracking(handler: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    const metadata = {
      method: req.method,
      endpoint: new URL(req.url).pathname,
      headers: {
        'user-agent': req.headers.get('user-agent') || '',
        'content-type': req.headers.get('content-type') || '',
        'origin': req.headers.get('origin') || '',
        'x-forwarded-for': req.headers.get('x-forwarded-for') || '',
      },
      startTime: Date.now()
    };

    await setRequestContext(metadata);

    try {
      const response = await handler(req);
      await updateRequestContext(response.status);
      return response;
    } catch (error) {
      await updateRequestContext(500);
      throw error;
    }
  };
}

// Helper function for processing (placeholder)
async function processApiRequest() {
  // Simulate API processing
  await new Promise(resolve => setTimeout(resolve, 100));
  return { success: true };
}

export default {
  exampleApiRequest,
  exampleDatabaseOperation,
  exampleClientSideRequest,
  withAuditTracking
};