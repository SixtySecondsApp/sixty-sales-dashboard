/**
 * Service Worker for sixty-sales-dashboard
 * Provides offline support and caching for production
 */

const CACHE_NAME = 'sixty-sales-v2-audit-optimized';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Check if we're in development mode
const isDevelopment = self.location.hostname === 'localhost' && 
                       (self.location.port === '5173' || 
                        self.location.port === '5174' || 
                        self.location.port === '5175' ||
                        self.location.port === '5176');

// Install event - cache essential files
self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  
  if (isDevelopment) {
    console.log('Skipping install in development mode');
    self.skipWaiting();
    return;
  }
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker activating...');
  
  if (isDevelopment) {
    console.log('Skipping activation in development mode');
    return self.clients.claim();
  }
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache when available
self.addEventListener('fetch', event => {
  // In development, don't intercept any requests
  if (isDevelopment) {
    return;
  }
  
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip cross-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }
  
  // Skip API requests and Supabase functions (let them go through normally)
  if (url.pathname.startsWith('/api/') || 
      url.pathname.startsWith('/functions/') ||
      url.pathname.includes('/functions/v1/') ||
      url.hostname !== self.location.hostname ||
      url.pathname.includes('/auth') ||
      url.pathname.includes('/rest/v1/') ||
      url.searchParams.has('timestamp') ||
      request.headers.get('Authorization')) {
    return;
  }
  
  // For other requests, try cache first then network
  event.respondWith(
    caches.match(request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        
        // Clone the request
        const fetchRequest = request.clone();
        
        return fetch(fetchRequest).then(response => {
          // Check if valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // Only cache static assets, not dynamic content
          const isStatic = url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/);
          const isHTML = url.pathname === '/' || url.pathname.endsWith('.html') || !url.pathname.includes('.');
          
          if (isStatic || isHTML) {
            // Clone the response
            const responseToCache = response.clone();
            
            // Cache the response for future use
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(request, responseToCache);
              });
          }
          
          return response;
        });
      })
      .catch(() => {
        // Network failed, return offline page if available
        if (request.destination === 'document') {
          return caches.match('/');
        }
        return new Response('Network error', { 
          status: 503, 
          statusText: 'Service Unavailable' 
        });
      })
  );
});

// Message handler for cache control
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(names => {
      names.forEach(name => caches.delete(name));
    });
    event.ports[0].postMessage({ type: 'CACHE_CLEARED' });
  }
  
  if (event.data && event.data.type === 'CLEAR_API_CACHE') {
    // Clear only dynamic/API related cached entries
    caches.open(CACHE_NAME).then(cache => {
      cache.keys().then(requests => {
        requests.forEach(request => {
          const url = new URL(request.url);
          if (url.pathname.includes('/api/') || 
              url.pathname.includes('/functions/') ||
              url.searchParams.has('timestamp')) {
            cache.delete(request);
          }
        });
      });
    });
    event.ports[0].postMessage({ type: 'API_CACHE_CLEARED' });
  }
});

console.log('Service Worker loaded successfully');