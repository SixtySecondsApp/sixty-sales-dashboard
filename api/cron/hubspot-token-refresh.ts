/**
 * Vercel API Route: HubSpot Token Refresh Cron Job
 *
 * Called daily by Vercel cron to proactively refresh all HubSpot OAuth tokens.
 */

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify cron secret or Vercel cron header
  const cronSecret = process.env.CRON_SECRET;
  const providedSecret = req.headers['x-cron-secret'] || (req.query?.secret as string);

  if (cronSecret && providedSecret !== cronSecret) {
    const cronHeader = req.headers['x-vercel-cron'];
    if (!cronHeader) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) throw new Error('Missing SUPABASE_URL');
    if (!supabaseServiceKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');

    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/hubspot-token-refresh`;

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseServiceKey}`,
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
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('HubSpot token refresh cron error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
}


