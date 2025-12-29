import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { handleCorsPreflightRequest } from '../_shared/corsHelper.ts';
import { captureException } from '../_shared/sentryEdge.ts';

const publicUrl =
  Deno.env.get('PUBLIC_URL') ||
  Deno.env.get('APP_URL') ||
  Deno.env.get('SITE_URL') ||
  Deno.env.get('FRONTEND_URL') ||
  'https://use60.com';

serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  try {
    // JustCall support confirmed OAuth is not available for their APIs.
    // Keep this endpoint for backwards compatibility, but return a clear message.
    return new Response(
      `<!DOCTYPE html>
       <html>
         <head>
           <meta charset="utf-8" />
           <meta name="viewport" content="width=device-width, initial-scale=1" />
           <title>JustCall OAuth Not Supported</title>
           <style>
             body { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif; margin: 0; min-height: 100vh; display:flex; align-items:center; justify-content:center; background: #050814; color: #e5e7eb; }
             .card { width: min(640px, calc(100% - 32px)); padding: 28px; border-radius: 18px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.10); box-shadow: 0 18px 60px rgba(0,0,0,0.45); }
             h1 { margin: 0 0 12px; font-size: 20px; }
             p { margin: 8px 0; line-height: 1.45; opacity: 0.9; }
             a { color: #93c5fd; }
             code { background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 6px; }
           </style>
         </head>
         <body>
           <div class="card">
             <h1>JustCall OAuth is not supported</h1>
             <p>JustCall does not support OAuth authentication for their API.</p>
             <p>Please configure an <strong>API Key</strong> and <strong>API Secret</strong> in Sixty → Integrations → JustCall.</p>
             <p><a href="${publicUrl}/integrations">Return to Integrations</a></p>
           </div>
         </body>
       </html>`,
      { status: 410, headers: { 'Content-Type': 'text/html' } }
    );
  } catch (e) {
    await captureException(e, {
      tags: {
        function: 'justcall-oauth-callback',
        integration: 'justcall',
      },
    });
    return new Response(e?.message || 'JustCall OAuth callback failed', { status: 500 });
  }
});













