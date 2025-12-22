import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { handleCorsPreflightRequest, jsonResponse } from '../_shared/corsHelper.ts';

serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  try {
    return jsonResponse(
      {
        error: 'JustCall does not support OAuth for API authentication. Please configure API Key + API Secret instead.',
        code: 'OAUTH_NOT_SUPPORTED',
      },
      req,
      410
    );
  } catch (e) {
    return jsonResponse({ error: e?.message || 'Failed to initiate OAuth' }, req, 500);
  }
});









