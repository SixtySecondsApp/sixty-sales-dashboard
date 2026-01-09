/**
 * Playwriter test setup utilities
 * Provides helpers for connecting to Playwriter MCP server via CDP
 */

import { startPlayWriterCDPRelayServer, getCdpUrl } from 'playwriter';
import { chromium, Browser, BrowserContext, Page } from 'playwright-core';

let server: any = null;
let browser: Browser | null = null;
let context: BrowserContext | null = null;
let setupPromise: Promise<{ server: any; browser: Browser; context: BrowserContext; page: Page }> | null = null;

/**
 * Initialize Playwriter CDP relay server and connect browser
 * Note: If Playwriter Chrome extension is active, the server is already running
 * Uses singleton pattern to prevent multiple server starts
 */
export async function setupPlaywriter(): Promise<{
  server: any;
  browser: Browser;
  context: BrowserContext;
  page: Page;
}> {
  // If setup is already in progress, wait for it
  if (setupPromise) {
    return setupPromise;
  }

  // If already set up, return existing resources
  if (browser && context) {
    const pages = context.pages();
    const page = pages.length > 0 ? pages[0] : await context.newPage();
    return { server, browser, context, page };
  }

  // Start setup
  setupPromise = (async () => {
    // Get CDP URL (server should already be running via Chrome extension)
    const cdpUrl = getCdpUrl();

    // Try to start server, but don't fail if it's already running
    try {
      if (!server) {
        server = await startPlayWriterCDPRelayServer();
      }
    } catch (error: any) {
      // Server is already running (via Chrome extension or another test) - this is fine
      if (error.code === 'EADDRINUSE' || error.message?.includes('EADDRINUSE')) {
        // Server already exists, continue
        console.log('Playwriter CDP server already running, reusing existing connection');
      } else {
        // Re-throw if it's a different error
        throw error;
      }
    }

    // Connect browser via CDP
    if (!browser) {
      try {
        browser = await chromium.connectOverCDP(cdpUrl);
      } catch (error: any) {
        if (error.message?.includes('Extension not connected') || error.message?.includes('Protocol error')) {
          throw new Error(
            '❌ Playwriter Chrome Extension not connected!\n\n' +
            'Please follow these steps:\n' +
            '1. Install the Playwriter Chrome extension from: https://chromewebstore.google.com/detail/playwriter-mcp/jfeammnjpkecdekppnclgkkffahnhfhe\n' +
            '2. Open Chrome and navigate to any tab\n' +
            '3. Click the Playwriter extension icon in your toolbar\n' +
            '4. The icon should turn GREEN when connected ✅\n' +
            '5. Then run your tests again\n\n' +
            `CDP URL attempted: ${cdpUrl}\n` +
            `Original error: ${error.message}`
          );
        }
        throw error;
      }
    }

    // Get or create context
    if (!context) {
      if (browser.contexts().length > 0) {
        context = browser.contexts()[0];
      } else {
        context = await browser.newContext();
      }
    }

    // Get or create page
    let page: Page;
    if (context.pages().length > 0) {
      page = context.pages()[0];
    } else {
      page = await context.newPage();
    }

    return { server, browser, context, page };
  })();

  try {
    return await setupPromise;
  } finally {
    // Clear promise after setup completes (success or failure)
    setupPromise = null;
  }
}

/**
 * Cleanup Playwriter resources
 * Note: Only closes browser connection, not the CDP server (managed by Chrome extension)
 */
export async function teardownPlaywriter(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
  // Only close server if we started it (not if it was already running)
  if (server && typeof server.close === 'function') {
    try {
      server.close();
    } catch (error) {
      // Ignore errors when closing (server might be managed by extension)
    }
    server = null;
  }
  context = null;
}

/**
 * Get a new page from the current context
 */
export async function getPage(): Promise<Page> {
  if (!context) {
    throw new Error('Playwriter not initialized. Call setupPlaywriter() first.');
  }
  
  if (context.pages().length > 0) {
    return context.pages()[0];
  }
  
  return await context.newPage();
}

/**
 * Test helper that wraps Playwriter setup/teardown
 */
export async function withPlaywriter<T>(
  testFn: (page: Page) => Promise<T>
): Promise<T> {
  const { page } = await setupPlaywriter();
  try {
    return await testFn(page);
  } finally {
    await teardownPlaywriter();
  }
}
