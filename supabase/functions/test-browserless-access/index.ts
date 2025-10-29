import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const base = Deno.env.get('BROWSERLESS_URL') || 'https://production-sfo.browserless.io'
    const token = Deno.env.get('BROWSERLESS_TOKEN')

    if (!token) {
      throw new Error('BROWSERLESS_TOKEN not configured')
    }

    // Test both the simple test page and the meeting thumbnail page
    const testUrls = [
      'https://sales.sixtyseconds.video/browserless-test',
      'https://sales.sixtyseconds.video/meetings/thumbnail/41537c13-f88a-4537-9dbd-9e657af53e66?shareUrl=https%3A%2F%2Ffathom.video%2Fshare%2FC2stxF1L9toaJSFmsy6WfrYpu1ayzJNJ&t=30'
    ]

    const results = []

    for (const url of testUrls) {
      console.log(`\n🧪 Testing access to: ${url}`)

      const playwrightScript = `
        export default async function({ page }) {
          console.log('🎬 Testing Browserless access...');
          console.log('📍 URL:', '${url}');


          const result = {
            url: '${url}',
            success: false,
            loadTime: 0,
            statusCode: null,
            finalUrl: null,
            title: null,
            error: null,
            hasReactRoot: false,
            hasIframe: false,
            pageContent: null
          };

          const startTime = Date.now();

          try {
            const response = await page.goto('${url}', {
              waitUntil: 'domcontentloaded',
              timeout: 30000
            });

            result.statusCode = response.status();
            result.finalUrl = page.url();
            result.title = await page.title();
            result.loadTime = Date.now() - startTime;

            // Check for React root
            result.hasReactRoot = await page.evaluate(() => {
              return !!(document.querySelector('#root') || document.querySelector('[data-reactroot]'));
            });

            // Check for iframe (for thumbnail page)
            result.hasIframe = await page.evaluate(() => {
              return !!document.querySelector('iframe');
            });

            // Get page content preview
            const bodyText = await page.evaluate(() => {
              const body = document.body;
              if (!body) return 'No body element';
              return (body.innerText || body.textContent || '').substring(0, 500);
            });
            result.pageContent = bodyText;

            // Check for specific markers
            const hasBrowserlessMarker = await page.evaluate(() => {
              return !!document.querySelector('#browserless-marker');
            });

            if (hasBrowserlessMarker) {
              console.log('✅ Found Browserless test marker!');
            }

            result.success = result.statusCode === 200;

            if (result.success) {
              console.log('✅ Page loaded successfully!');
              console.log('  Status:', result.statusCode);
              console.log('  Title:', result.title);
              console.log('  Final URL:', result.finalUrl);
              console.log('  Load time:', result.loadTime + 'ms');
              console.log('  Has React root:', result.hasReactRoot);
              console.log('  Has iframe:', result.hasIframe);
            }

          } catch (error) {
            console.error('❌ Failed to load page:', error.message);
            result.error = error.message;
          }

          return result;
        }
      `;

      try {
        const functionUrl = `${base}/function?token=${token}`;
        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/javascript' },
          body: playwrightScript,
        });

        if (!response.ok) {
          const error = await response.text();
          console.error(`❌ Browserless error for ${url}:`, error);
          results.push({
            url,
            success: false,
            error: `Browserless returned ${response.status}: ${error}`
          });
        } else {
          const result = await response.json();
          console.log(`Result for ${url}:`, result);
          results.push(result);
        }
      } catch (error) {
        console.error(`❌ Exception testing ${url}:`, error);
        results.push({
          url,
          success: false,
          error: error.message
        });
      }
    }

    // Analyze results
    const analysis = {
      timestamp: new Date().toISOString(),
      results,
      summary: {
        testPageAccessible: results[0]?.success || false,
        thumbnailPageAccessible: results[1]?.success || false,
        recommendation: ''
      }
    };

    if (analysis.summary.testPageAccessible && analysis.summary.thumbnailPageAccessible) {
      analysis.summary.recommendation = 'Both pages are accessible! Browserless can reach your app.';
    } else if (analysis.summary.testPageAccessible) {
      analysis.summary.recommendation = 'Test page works but thumbnail page fails. Check if MeetingThumbnail component is rendering correctly.';
    } else {
      analysis.summary.recommendation = 'Neither page is accessible. Browserless cannot reach your app - check Vercel deployment and routing.';
    }

    return new Response(
      JSON.stringify(analysis, null, 2),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in test-browserless-access:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        details: error.stack
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
})