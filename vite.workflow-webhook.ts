import { Plugin } from 'vite';

export function workflowWebhookPlugin(): Plugin {
  return {
    name: 'workflow-webhook',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // Match the webhook URL pattern: /api/workflows/webhook/{workflowId}
        const webhookPattern = /^\/api\/workflows\/webhook\/([a-f0-9-]+)$/;
        const match = req.url?.match(webhookPattern);
        
        if (match && req.method === 'POST') {
          const workflowId = match[1];
          console.log('🔗 Webhook request for workflow:', workflowId);
          
          // Collect request body
          let body = '';
          req.on('data', chunk => {
            body += chunk.toString();
          });
          
          req.on('end', async () => {
            try {
              const payload = JSON.parse(body);
              console.log('📦 Webhook payload received:', payload);
              
              // Import Supabase client
              const { createClient } = await import('@supabase/supabase-js');
              const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ewtuefzeogytgmsnkpmb.supabase.co';
              const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHVlZnplb2d5dGdtc25rcG1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc4OTQ5MjcsImV4cCI6MjA1MzQ3MDkyN30.wJJiRJRKxZfV7kqEhqEJRhOJFWT7r7ANrtJ30tjyTSw';
              
              const supabase = createClient(supabaseUrl, supabaseAnonKey);
              
              // Invoke the Supabase Edge Function with the workflow ID in the path
              const { data, error } = await supabase.functions.invoke(`workflow-webhook/${workflowId}`, {
                body: payload
              });
              
              if (error) {
                console.error('❌ Edge Function error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
              } else {
                console.log('✅ Edge Function success:', data);
                res.writeHead(200, { 
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*',
                  'Access-Control-Allow-Methods': 'POST, OPTIONS',
                  'Access-Control-Allow-Headers': 'Content-Type'
                });
                res.end(JSON.stringify(data));
              }
            } catch (err) {
              console.error('❌ Webhook processing error:', err);
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          
          return; // Don't call next() as we handled the request
        }
        
        // Handle OPTIONS requests for CORS
        if (match && req.method === 'OPTIONS') {
          res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
          });
          res.end();
          return;
        }
        
        next();
      });
    }
  };
}