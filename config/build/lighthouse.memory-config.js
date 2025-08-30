// Lighthouse CI configuration for memory-constrained performance testing
module.exports = {
  ci: {
    collect: {
      // Memory-optimized collection settings
      numberOfRuns: 3,
      settings: {
        // Chrome flags for memory efficiency
        chromeFlags: [
          '--headless',
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--memory-pressure-off',
          '--max_old_space_size=512',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--no-first-run',
          '--disable-default-apps',
          '--disable-extensions',
          '--disable-component-extensions-with-background-pages',
          '--disable-background-networking',
        ],
        
        // Performance settings for memory constraints
        throttling: {
          rttMs: 40,
          throughputKbps: 10240,
          cpuSlowdownMultiplier: 1,
          requestLatencyMs: 0,
          downloadThroughputKbps: 0,
          uploadThroughputKbps: 0
        },
        
        // Memory-aware audits
        onlyAudits: [
          'largest-contentful-paint',
          'max-potential-fid',
          'cumulative-layout-shift',
          'interactive',
          'speed-index',
          'total-blocking-time',
          'unused-javascript',
          'unused-css-rules',
          'dom-size',
          'bootup-time',
          'mainthread-work-breakdown',
          'diagnostics',
          'network-requests',
          'resource-summary',
          'third-party-summary'
        ],
        
        // Skip heavy audits that use too much memory
        skipAudits: [
          'full-page-screenshot',
          'screenshot-thumbnails',
          'final-screenshot'
        ],
        
        // Device simulation for memory testing
        emulatedFormFactor: 'mobile',
        throttlingMethod: 'simulate'
      }
    },
    
    assert: {
      // Strict performance assertions for memory-constrained environment
      assertions: {
        'categories:performance': ['error', { minScore: 0.85 }],
        'categories:accessibility': ['warn', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.8 }],
        'categories:seo': ['warn', { minScore: 0.8 }],
        
        // Memory-related performance metrics
        'largest-contentful-paint': ['error', { maxNumericValue: 2000 }],
        'max-potential-fid': ['error', { maxNumericValue: 50 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.05 }],
        'interactive': ['error', { maxNumericValue: 3000 }],
        'speed-index': ['warn', { maxNumericValue: 2500 }],
        'total-blocking-time': ['warn', { maxNumericValue: 200 }],
        
        // Bundle size and resource optimization
        'unused-javascript': ['warn', { maxNumericValue: 20000 }], // 20KB max unused JS
        'unused-css-rules': ['warn', { maxNumericValue: 10000 }],  // 10KB max unused CSS
        'dom-size': ['warn', { maxNumericValue: 1500 }],           // Max 1500 DOM nodes
        'bootup-time': ['warn', { maxNumericValue: 1000 }],        // 1s max bootup time
        
        // Network efficiency
        'network-requests': ['warn', { maxNumericValue: 50 }],     // Max 50 requests
        'resource-summary:totalBytes': ['warn', { maxNumericValue: 2000000 }], // 2MB total
        'resource-summary:imageBytes': ['warn', { maxNumericValue: 500000 }],  // 500KB images
        'resource-summary:scriptBytes': ['warn', { maxNumericValue: 1000000 }], // 1MB scripts
        'resource-summary:styleBytes': ['warn', { maxNumericValue: 200000 }],   // 200KB styles
      }
    },
    
    upload: {
      // Upload results for analysis
      target: 'temporary-public-storage',
      githubToken: process.env.LHCI_GITHUB_APP_TOKEN,
    },
    
    server: {
      // Lightweight server configuration
      port: 9001,
      storage: {
        sqlDialect: 'sqlite',
        sqlDatabasePath: './lighthouse-results.db'
      }
    }
  },
  
  // Custom collection script for memory testing
  extends: 'lighthouse:default',
  
  settings: {
    // Memory optimization settings
    maxWaitForFcp: 15000,
    maxWaitForLoad: 35000,
    
    // Reduced timeouts for memory efficiency
    pauseAfterFcpMs: 1000,
    pauseAfterLoadMs: 1000,
    networkQuietThresholdMs: 1000,
    cpuQuietThresholdMs: 1000,
    
    // Skip heavy operations
    skipAudits: [
      'screenshot-thumbnails',
      'full-page-screenshot',
      'final-screenshot'
    ],
    
    // Memory-efficient throttling
    throttling: {
      rttMs: 40,
      throughputKbps: 10240,
      cpuSlowdownMultiplier: 1
    },
    
    // Reduced trace categories
    onlyCategories: ['performance', 'best-practices'],
    
    // Memory-conscious Chrome launch
    chrome: {
      chromePath: '/usr/bin/google-chrome',
      chromeFlags: [
        '--headless',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--memory-pressure-off',
        '--max_old_space_size=512',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    }
  }
};