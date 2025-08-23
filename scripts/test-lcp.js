#!/usr/bin/env node

/**
 * Test LCP (Largest Contentful Paint) Performance
 * Measures the performance improvements after optimization
 */

import puppeteer from 'puppeteer';

async function measureLCP(url) {
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Set viewport and user agent
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
  
  // Enable performance monitoring
  await page.evaluateOnNewDocument(() => {
    window.performanceMetrics = {
      lcp: 0,
      fcp: 0,
      tti: 0,
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
  
  console.log(`Testing: ${url}`);
  console.log('----------------------------------------');
  
  const startTime = Date.now();
  
  try {
    // Navigate to page
    await page.goto(url, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    
    // Wait a bit for LCP to be recorded
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get performance metrics
    const metrics = await page.evaluate(() => window.performanceMetrics);
    const loadTime = Date.now() - startTime;
    
    // Get navigation timing
    const navigationTiming = await page.evaluate(() => {
      const timing = performance.getEntriesByType('navigation')[0];
      return {
        domContentLoaded: timing.domContentLoadedEventEnd - timing.domContentLoadedEventStart,
        loadComplete: timing.loadEventEnd - timing.loadEventStart,
        domInteractive: timing.domInteractive - timing.fetchStart,
        responseTime: timing.responseEnd - timing.requestStart
      };
    });
    
    // Get resource timing for bundles
    const resourceTiming = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource');
      const jsResources = resources.filter(r => r.name.includes('.js'));
      const cssResources = resources.filter(r => r.name.includes('.css'));
      
      return {
        jsCount: jsResources.length,
        jsSize: jsResources.reduce((acc, r) => acc + (r.transferSize || 0), 0),
        jsLoadTime: Math.max(...jsResources.map(r => r.responseEnd)) || 0,
        cssCount: cssResources.length,
        cssSize: cssResources.reduce((acc, r) => acc + (r.transferSize || 0), 0),
        cssLoadTime: Math.max(...cssResources.map(r => r.responseEnd)) || 0,
      };
    });
    
    // Print results
    console.log('🎯 Core Web Vitals:');
    console.log(`  • LCP (Largest Contentful Paint): ${metrics.lcp.toFixed(0)}ms ${metrics.lcp < 2500 ? '✅' : metrics.lcp < 4000 ? '⚠️' : '❌'}`);
    console.log(`  • FCP (First Contentful Paint): ${metrics.fcp.toFixed(0)}ms ${metrics.fcp < 1800 ? '✅' : metrics.fcp < 3000 ? '⚠️' : '❌'}`);
    console.log(`  • CLS (Cumulative Layout Shift): ${metrics.cls.toFixed(3)} ${metrics.cls < 0.1 ? '✅' : metrics.cls < 0.25 ? '⚠️' : '❌'}`);
    
    console.log('\n📊 Page Load Metrics:');
    console.log(`  • Total Load Time: ${loadTime}ms`);
    console.log(`  • DOM Interactive: ${navigationTiming.domInteractive.toFixed(0)}ms`);
    console.log(`  • DOM Content Loaded: ${navigationTiming.domContentLoaded.toFixed(0)}ms`);
    console.log(`  • Response Time: ${navigationTiming.responseTime.toFixed(0)}ms`);
    
    console.log('\n📦 Resource Loading:');
    console.log(`  • JS Files: ${resourceTiming.jsCount} (${(resourceTiming.jsSize / 1024).toFixed(1)}KB) - ${resourceTiming.jsLoadTime.toFixed(0)}ms`);
    console.log(`  • CSS Files: ${resourceTiming.cssCount} (${(resourceTiming.cssSize / 1024).toFixed(1)}KB) - ${resourceTiming.cssLoadTime.toFixed(0)}ms`);
    
    console.log('\n✅ Performance Summary:');
    if (metrics.lcp < 2500) {
      console.log('  🎉 EXCELLENT: LCP under 2.5s target!');
    } else if (metrics.lcp < 4000) {
      console.log('  ⚠️  NEEDS IMPROVEMENT: LCP between 2.5s-4s');
    } else {
      console.log('  ❌ POOR: LCP over 4s, further optimization needed');
    }
    
  } catch (error) {
    console.error('Error measuring performance:', error.message);
  }
  
  await browser.close();
}

// Run the test
const url = process.argv[2] || 'http://localhost:5173';
measureLCP(url);