#!/usr/bin/env node

/**
 * Architecture Monitoring Script
 * Monitors component sizes, complexity, and code quality metrics
 * Part of the Phase 1 Quick Wins implementation
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ArchitectureMonitor {
  constructor() {
    this.srcPath = path.join(process.cwd(), 'src');
    this.componentMetrics = new Map();
    this.config = {
      maxLines: 500,
      maxFileSize: 50 * 1024, // 50KB
      excludePatterns: [
        '.test.tsx',
        '.test.ts', 
        '.spec.tsx',
        '.spec.ts',
        'node_modules/',
        '.d.ts'
      ]
    };
  }

  /**
   * Analyze all TypeScript/React files
   */
  analyzeComponents() {
    this.walkDirectory(this.srcPath);
    this.generateReport();
  }

  /**
   * Recursively walk through source directory
   */
  walkDirectory(dirPath) {
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        this.walkDirectory(fullPath);
      } else if (this.shouldAnalyze(fullPath)) {
        this.analyzeFile(fullPath);
      }
    }
  }

  /**
   * Check if file should be analyzed
   */
  shouldAnalyze(filePath) {
    const isTypeScriptFile = /\.(tsx?|jsx?)$/.test(filePath);
    const isExcluded = this.config.excludePatterns.some(pattern => 
      filePath.includes(pattern)
    );
    
    return isTypeScriptFile && !isExcluded;
  }

  /**
   * Analyze individual file
   */
  analyzeFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const relativePath = path.relative(this.srcPath, filePath);
      const componentName = path.basename(filePath, path.extname(filePath));
      
      const metrics = {
        path: relativePath,
        name: componentName,
        lineCount: this.countLines(content),
        fileSize: Buffer.byteLength(content, 'utf8'),
        complexity: this.calculateComplexity(content),
        imports: this.countImports(content),
        exports: this.countExports(content),
        hasDefaultExport: content.includes('export default'),
        isComponent: this.isReactComponent(content),
        lastModified: fs.statSync(filePath).mtime
      };

      this.componentMetrics.set(filePath, metrics);
      
      // Check thresholds
      this.checkThresholds(metrics);
      
    } catch (error) {
    }
  }

  /**
   * Count non-empty lines excluding comments
   */
  countLines(content) {
    return content
      .split('\n')
      .filter(line => {
        const trimmed = line.trim();
        return trimmed.length > 0 && 
               !trimmed.startsWith('//') && 
               !trimmed.startsWith('*') &&
               !trimmed.startsWith('/*');
      }).length;
  }

  /**
   * Calculate cyclomatic complexity
   */
  calculateComplexity(content) {
    const patterns = [
      /if\s*\(/g,
      /else\s+if\s*\(/g,
      /for\s*\(/g,
      /while\s*\(/g,
      /switch\s*\(/g,
      /catch\s*\(/g,
      /\?\s*.*\s*:/g, // ternary operators
      /&&/g,
      /\|\|/g,
      /case\s+.*:/g
    ];

    let complexity = 1; // Base complexity
    patterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    });

    return complexity;
  }

  /**
   * Count import statements
   */
  countImports(content) {
    const importMatches = content.match(/^import\s+/gm);
    return importMatches ? importMatches.length : 0;
  }

  /**
   * Count export statements
   */
  countExports(content) {
    const exportMatches = content.match(/^export\s+/gm);
    return exportMatches ? exportMatches.length : 0;
  }

  /**
   * Check if file is a React component
   */
  isReactComponent(content) {
    return content.includes('React') || 
           content.includes('jsx') || 
           content.includes('tsx') ||
           content.includes('useState') ||
           content.includes('useEffect');
  }

  /**
   * Check if metrics exceed thresholds
   */
  checkThresholds(metrics) {
    const warnings = [];
    
    if (metrics.lineCount > this.config.maxLines) {
      warnings.push(`Lines: ${metrics.lineCount} > ${this.config.maxLines}`);
    }
    
    if (metrics.fileSize > this.config.maxFileSize) {
      warnings.push(`Size: ${Math.round(metrics.fileSize / 1024)}KB > ${Math.round(this.config.maxFileSize / 1024)}KB`);
    }

    if (metrics.complexity > 15) {
      warnings.push(`Complexity: ${metrics.complexity} (consider refactoring)`);
    }

    if (warnings.length > 0) {
    }
  }

  /**
   * Generate comprehensive report
   */
  generateReport() {
    const metrics = Array.from(this.componentMetrics.values());
    const overSized = metrics.filter(
      m => m.lineCount > this.config.maxLines || 
           m.fileSize > this.config.maxFileSize
    );
    const complex = metrics.filter(m => m.complexity > 15);
    const components = metrics.filter(m => m.isComponent);
    if (overSized.length > 0) {
      overSized
        .sort((a, b) => b.lineCount - a.lineCount)
        .slice(0, 10) // Top 10 largest
        .forEach(file => {
        });
    }

    if (complex.length > 0) {
      complex
        .sort((a, b) => b.complexity - a.complexity)
        .slice(0, 5)
        .forEach(file => {
        });
    }

    // Statistics
    const avgLines = Math.round(metrics.reduce((sum, m) => sum + m.lineCount, 0) / metrics.length);
    const avgComplexity = Math.round(metrics.reduce((sum, m) => sum + m.complexity, 0) / metrics.length);
    const avgFileSize = Math.round(metrics.reduce((sum, m) => sum + m.fileSize, 0) / metrics.length / 1024);
    // Recommendations
    if (overSized.length > 0) {
    }
    
    if (complex.length > 0) {
    }
    
    if (overSized.length === 0 && complex.length === 0) {
    }
    // Generate JSON report
    this.generateJsonReport(metrics);
  }

  /**
   * Generate JSON report for tooling integration
   */
  generateJsonReport(metrics) {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalFiles: metrics.length,
        components: metrics.filter(m => m.isComponent).length,
        overSized: metrics.filter(m => m.lineCount > this.config.maxLines || m.fileSize > this.config.maxFileSize).length,
        highComplexity: metrics.filter(m => m.complexity > 15).length,
        averageLines: Math.round(metrics.reduce((sum, m) => sum + m.lineCount, 0) / metrics.length),
        averageComplexity: Math.round(metrics.reduce((sum, m) => sum + m.complexity, 0) / metrics.length),
        averageFileSize: Math.round(metrics.reduce((sum, m) => sum + m.fileSize, 0) / metrics.length)
      },
      metrics: metrics,
      thresholds: this.config
    };

    fs.writeFileSync('architecture-report.json', JSON.stringify(report, null, 2));
  }
}

// Run monitoring
if (import.meta.url === `file://${process.argv[1]}`) {
  const monitor = new ArchitectureMonitor();
  monitor.analyzeComponents();
}