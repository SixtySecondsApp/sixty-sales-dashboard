#!/usr/bin/env node

/**
 * Test performance across all application routes
 * Measures Core Web Vitals after optimization rollout
 */

import puppeteer from 'puppeteer';

const routes = [
  { path: '/', name: 'Dashboard' },
  { path: '/pipeline', name: 'Pipeline' },
  { path: '/clients', name: 'Clients' },
  { path: '/activity', name: 'Activity Log' },
  { path: '/tasks', name: 'Tasks' },
  { path: '/companies', name: 'Companies' },
  { path: '/roadmap', name: 'Roadmap' },
  { path: '/profile', name: 'Profile' },
];

async function measureRoute(browser, baseUrl, route) {
  const page = await browser.newPage();
  
  // Set viewport
  await page.setViewport({ width: 1920, height: 1080 });
  
  // Enable performance monitoring
  await page.evaluateOnNewDocument(() => {
    window.performanceMetrics = {
      lcp: 0,
      fcp: 0,
      cls: 0
    };
    
    // Observe LCP
    new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1];
      window.performanceMetrics.lcp = lastEntry.renderTime || lastEntry.loadTime;
    }).observe({ entryTypes: ['largest-contentful-paint'] });
    
    // Observe FCP
    new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      if (entries.length > 0) {
        window.performanceMetrics.fcp = entries[0].startTime;
      }
    }).observe({ entryTypes: ['paint'] });
    
    // Observe CLS
    new PerformanceObserver((entryList) => {
      let cls = 0;
      entryList.getEntries().forEach(entry => {
        if (!entry.hadRecentInput) {
          cls += entry.value;
        }
      });
      window.performanceMetrics.cls = cls;
    }).observe({ entryTypes: ['layout-shift'] });
  });
  
  const startTime = Date.now();
  
  try {
    // Navigate to route
    await page.goto(`${baseUrl}${route.path}`, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    
    // Wait for metrics to be recorded
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get performance metrics
    const metrics = await page.evaluate(() => window.performanceMetrics);
    const loadTime = Date.now() - startTime;
    
    await page.close();
    
    return {
      route: route.name,
      path: route.path,
      lcp: metrics.lcp,
      fcp: metrics.fcp,
      cls: metrics.cls,
      loadTime
    };
  } catch (error) {
    await page.close();
    return {
      route: route.name,
      path: route.path,
      error: error.message
    };
  }
}

async function main() {
  const baseUrl = process.argv[2] || 'http://localhost:5173';
  
  console.log('🚀 Testing Performance Across All Routes\n');
  console.log('========================================\n');
  
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const results = [];
  
  for (const route of routes) {
    process.stdout.write(`Testing ${route.name}...`);
    const result = await measureRoute(browser, baseUrl, route);
    results.push(result);
    
    if (result.error) {
      console.log(` ❌ Error: ${result.error}`);
    } else {
      const lcpStatus = result.lcp < 2500 ? '✅' : result.lcp < 4000 ? '⚠️' : '❌';
      console.log(` ${lcpStatus} LCP: ${result.lcp.toFixed(0)}ms`);
    }
  }
  
  await browser.close();
  
  // Print summary
  console.log('\n========================================');
  console.log('📊 PERFORMANCE SUMMARY\n');
  
  // Calculate averages
  const validResults = results.filter(r => !r.error);
  const avgLCP = validResults.reduce((sum, r) => sum + r.lcp, 0) / validResults.length;
  const avgFCP = validResults.reduce((sum, r) => sum + r.fcp, 0) / validResults.length;
  const avgCLS = validResults.reduce((sum, r) => sum + r.cls, 0) / validResults.length;
  
  console.log('Average Metrics:');
  console.log(`  • LCP: ${avgLCP.toFixed(0)}ms ${avgLCP < 2500 ? '✅' : avgLCP < 4000 ? '⚠️' : '❌'}`);
  console.log(`  • FCP: ${avgFCP.toFixed(0)}ms ${avgFCP < 1800 ? '✅' : avgFCP < 3000 ? '⚠️' : '❌'}`);
  console.log(`  • CLS: ${avgCLS.toFixed(3)} ${avgCLS < 0.1 ? '✅' : avgCLS < 0.25 ? '⚠️' : '❌'}`);
  
  // Print detailed table
  console.log('\nDetailed Results:');
  console.log('┌─────────────────┬──────────┬──────────┬──────────┬────────┐');
  console.log('│ Route           │ LCP (ms) │ FCP (ms) │ CLS      │ Status │');
  console.log('├─────────────────┼──────────┼──────────┼──────────┼────────┤');
  
  for (const result of results) {
    if (!result.error) {
      const status = result.lcp < 2500 ? '✅ Good' : result.lcp < 4000 ? '⚠️  Needs' : '❌ Poor';
      const routeName = result.route.padEnd(15);
      const lcp = result.lcp.toFixed(0).padStart(8);
      const fcp = result.fcp.toFixed(0).padStart(8);
      const cls = result.cls.toFixed(3).padStart(8);
      console.log(`│ ${routeName} │ ${lcp} │ ${fcp} │ ${cls} │ ${status} │`);
    }
  }
  
  console.log('└─────────────────┴──────────┴──────────┴──────────┴────────┘');
  
  // Overall assessment
  console.log('\n✨ Overall Performance:');
  if (avgLCP < 2500) {
    console.log('  🎉 EXCELLENT: All optimizations working effectively!');
  } else if (avgLCP < 4000) {
    console.log('  ⚠️  GOOD: Performance improved but can be optimized further');
  } else {
    console.log('  ❌ NEEDS WORK: Further optimization required');
  }
}

main().catch(console.error);