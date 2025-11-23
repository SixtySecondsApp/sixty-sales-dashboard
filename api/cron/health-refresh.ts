/**
 * Vercel API Route: Health Refresh Cron Job
 * 
 * Called by Vercel cron jobs to refresh health scores.
 * Proxies request to Supabase Edge Function.
 */

export default async function handler(req: any, res: any) {
  // Only allow GET/POST requests (Vercel cron jobs use GET by default)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET;
  const providedSecret = req.headers['x-cron-secret'] || (req.query?.secret as string);

  if (cronSecret && providedSecret !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Verify this is a Vercel cron job
  const cronHeader = req.headers['x-vercel-cron'];
  if (!cronHeader && !providedSecret) {
    return res.status(401).json({ error: 'Unauthorized: Must be called by Vercel cron or with secret' });
  }

  try {
    // Note: Vercel serverless functions don't have access to VITE_ prefixed vars
    // Use SUPABASE_URL (set in Vercel environment variables) - NOT VITE_SUPABASE_URL
    // VITE_ prefixed vars are exposed to browser and should never contain sensitive keys
    // Supabase uses "Publishable key" (frontend-safe) and "Secret keys" (server-side only)
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseSecretKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Secret key (server-side only)

    if (!supabaseUrl || !supabaseSecretKey) {
      throw new Error('Missing Supabase configuration');
    }

    // Call Supabase Edge Function
    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/scheduled-health-refresh`;
    
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseSecretKey}`, // Secret key for server-side operations
        'x-cron-secret': cronSecret || '',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Edge function error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    return res.status(200).json({
      success: true,
      ...data,
      triggeredBy: 'vercel-cron',
    });
  } catch (error: any) {
    console.error('Health refresh cron error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
    });
  }
}

