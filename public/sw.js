/**
 * Service Worker for Performance Optimization
 * 
 * Provides:
 * - Asset caching strategies
 * - API response caching
 * - Offline fallbacks
 * - Background sync for data updates
 */

const CACHE_NAME = 'sixty-sales-dashboard-v1.2.0';
const STATIC_CACHE = 'static-v1.2.0';
const DYNAMIC_CACHE = 'dynamic-v1.2.0';
const API_CACHE = 'api-v1.2.0';
const CHUNK_CACHE = 'chunks-v1.2.0';

// Assets to cache immediately
const CRITICAL_ASSETS = [
  '/',
  '/static/js/main.js',
  '/static/css/main.css',
  '/manifest.json'
];

// API endpoints to cache
const API_ENDPOINTS = [
  '/api/dashboard',
  '/api/activities',
  '/api/targets'
];

// Install event - cache critical assets
self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('Caching critical assets');
        return cache.addAll(CRITICAL_ASSETS);
      })
      .then(() => {
        // Skip waiting to activate immediately
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            // Delete old caches
            if (cacheName !== STATIC_CACHE && 
                cacheName !== DYNAMIC_CACHE && 
                cacheName !== API_CACHE) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        // Take control of all clients immediately
        return self.clients.claim();
      })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle different types of requests
  if (request.method === 'GET') {
    // API requests - cache with network first strategy
    if (url.pathname.startsWith('/api/')) {
      event.respondWith(handleAPIRequest(request));
    }
    // Static assets - cache first strategy
    else if (isStaticAsset(url.pathname)) {
      event.respondWith(handleStaticAsset(request));
    }
    // HTML pages - network first with cache fallback
    else if (request.headers.get('accept')?.includes('text/html')) {
      event.respondWith(handleHTMLRequest(request));
    }
    // Other requests - default strategy
    else {
      event.respondWith(handleDefaultRequest(request));
    }
  }
});

// API request handler - Network first with cache fallback
async function handleAPIRequest(request) {
  const cache = await caches.open(API_CACHE);
  
  try {
    // Try network first
    const response = await fetch(request);
    
    if (response.ok) {
      // Cache successful responses
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Network failed, try cache
    console.log('Network failed for API request, trying cache:', request.url);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // No cache available, return error response
    return new Response(
      JSON.stringify({ 
        error: 'Network unavailable', 
        offline: true 
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Static asset handler - Cache first
async function handleStaticAsset(request) {
  const cache = await caches.open(STATIC_CACHE);
  
  // Try cache first
  let response = await cache.match(request);
  
  if (response) {
    return response;
  }
  
  // Not in cache, fetch from network
  try {
    response = await fetch(request);
    
    if (response.ok) {
      // Cache the response
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Network failed and no cache - return fallback
    console.log('Failed to load static asset:', request.url);
    return new Response('Asset not available', { status: 404 });
  }
}

// HTML request handler - Network first with cache fallback
async function handleHTMLRequest(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  
  try {
    // Try network first
    const response = await fetch(request);
    
    if (response.ok) {
      // Cache the response
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Network failed, try cache
    console.log('Network failed for HTML request, trying cache:', request.url);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // No cache, return offline page
    return cache.match('/') || new Response('Offline', { status: 503 });
  }
}

// Default request handler
async function handleDefaultRequest(request) {
  try {
    return await fetch(request);
  } catch (error) {
    console.log('Request failed:', request.url);
    return new Response('Request failed', { status: 503 });
  }
}

// Helper function to check if URL is a static asset
function isStaticAsset(pathname) {
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.woff', '.woff2', '.ttf'];
  return staticExtensions.some(ext => pathname.endsWith(ext)) || 
         pathname.startsWith('/static/') ||
         pathname.startsWith('/assets/');
}

// Background sync for data updates
self.addEventListener('sync', event => {
  console.log('Background sync triggered:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

// Background sync implementation
async function doBackgroundSync() {
  try {
    // Get pending data from IndexedDB or localStorage
    // This would contain offline actions to sync
    console.log('Performing background sync...');
    
    // Example: Sync pending activities
    // const pendingActivities = await getPendingActivities();
    // for (const activity of pendingActivities) {
    //   await syncActivity(activity);
    // }
    
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// Message handling for cache management
self.addEventListener('message', event => {
  const { type, payload } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CLEAR_CACHE':
      clearAllCaches();
      break;
      
    case 'PRELOAD_ROUTES':
      preloadRoutes(payload.routes);
      break;
      
    default:
      console.log('Unknown message type:', type);
  }
});

// Clear all caches
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(name => caches.delete(name)));
  console.log('All caches cleared');
}

// Preload routes
async function preloadRoutes(routes) {
  const cache = await caches.open(DYNAMIC_CACHE);
  
  for (const route of routes) {
    try {
      const response = await fetch(route);
      if (response.ok) {
        await cache.put(route, response);
        console.log('Preloaded route:', route);
      }
    } catch (error) {
      console.log('Failed to preload route:', route, error);
    }
  }
}

// Periodic cache cleanup
setInterval(async () => {
  try {
    // Clean up old entries in dynamic cache
    const cache = await caches.open(DYNAMIC_CACHE);
    const requests = await cache.keys();
    
    // Remove entries older than 1 week
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    for (const request of requests) {
      const response = await cache.match(request);
      const dateHeader = response?.headers.get('date');
      
      if (dateHeader) {
        const responseDate = new Date(dateHeader).getTime();
        if (responseDate < oneWeekAgo) {
          await cache.delete(request);
          console.log('Removed old cache entry:', request.url);
        }
      }
    }
  } catch (error) {
    console.error('Cache cleanup failed:', error);
  }
}, 24 * 60 * 60 * 1000); // Run daily