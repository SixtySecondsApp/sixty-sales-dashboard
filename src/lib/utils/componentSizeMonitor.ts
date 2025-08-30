import React from 'react';

/**
 * Component Size Monitoring System
 * Tracks component file sizes and provides alerts for components >500 lines
 * Internal monitoring system that doesn't affect UI/UX
 */

interface ComponentMetrics {
  path: string;
  name: string;
  lineCount: number;
  fileSize: number;
  lastModified: Date;
  complexity?: number;
}

interface MonitoringConfig {
  maxLines: number;
  maxFileSize: number; // in bytes
  excludePatterns: string[];
  enableLogging: boolean;
}

class ComponentSizeMonitor {
  private static instance: ComponentSizeMonitor;
  private metrics: Map<string, ComponentMetrics> = new Map();
  private config: MonitoringConfig = {
    maxLines: 500,
    maxFileSize: 50 * 1024, // 50KB
    excludePatterns: [
      '*.test.tsx',
      '*.test.ts', 
      '*.spec.tsx',
      '*.spec.ts',
      'node_modules/',
      '.d.ts'
    ],
    enableLogging: process.env.NODE_ENV === 'development'
  };

  public static getInstance(): ComponentSizeMonitor {
    if (!ComponentSizeMonitor.instance) {
      ComponentSizeMonitor.instance = new ComponentSizeMonitor();
    }
    return ComponentSizeMonitor.instance;
  }

  /**
   * Register a component for monitoring
   * Should be called in development mode only
   */
  public registerComponent(
    componentPath: string, 
    componentName: string,
    sourceCode?: string
  ): void {
    if (!this.shouldMonitor() || this.isExcluded(componentPath)) {
      return;
    }

    const metrics: ComponentMetrics = {
      path: componentPath,
      name: componentName,
      lineCount: this.countLines(sourceCode),
      fileSize: this.calculateFileSize(sourceCode),
      lastModified: new Date(),
      complexity: this.calculateComplexity(sourceCode)
    };

    this.metrics.set(componentPath, metrics);
    this.checkThresholds(metrics);
  }

  /**
   * Get all component metrics
   */
  public getMetrics(): ComponentMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get components exceeding size thresholds
   */
  public getOverSizedComponents(): ComponentMetrics[] {
    return this.getMetrics().filter(
      metric => metric.lineCount > this.config.maxLines ||
                metric.fileSize > this.config.maxFileSize
    );
  }

  /**
   * Generate size report
   */
  public generateReport(): string {
    const overSized = this.getOverSizedComponents();
    const totalComponents = this.metrics.size;
    
    let report = `\n📊 Component Size Monitoring Report\n`;
    report += `════════════════════════════════════\n`;
    report += `Total Components: ${totalComponents}\n`;
    report += `Over-sized Components: ${overSized.length}\n`;
    report += `Threshold: ${this.config.maxLines} lines, ${Math.round(this.config.maxFileSize / 1024)}KB\n\n`;

    if (overSized.length > 0) {
      report += `⚠️  Components Exceeding Thresholds:\n`;
      report += `──────────────────────────────────\n`;
      
      overSized.forEach(component => {
        const exceedsLines = component.lineCount > this.config.maxLines;
        const exceedsSize = component.fileSize > this.config.maxFileSize;
        
        report += `${component.name}\n`;
        report += `  Path: ${component.path}\n`;
        report += `  Lines: ${component.lineCount}${exceedsLines ? ' ⚠️' : ''}\n`;
        report += `  Size: ${Math.round(component.fileSize / 1024)}KB${exceedsSize ? ' ⚠️' : ''}\n`;
        if (component.complexity) {
          report += `  Complexity: ${component.complexity}\n`;
        }
        report += `  Last Modified: ${component.lastModified.toISOString()}\n\n`;
      });
    } else {
      report += `✅ All components are within size thresholds!\n`;
    }

    return report;
  }

  /**
   * Update monitoring configuration
   */
  public updateConfig(newConfig: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  private shouldMonitor(): boolean {
    return process.env.NODE_ENV === 'development' && this.config.enableLogging;
  }

  private isExcluded(path: string): boolean {
    return this.config.excludePatterns.some(pattern => 
      path.includes(pattern.replace('*', ''))
    );
  }

  private countLines(sourceCode?: string): number {
    if (!sourceCode) return 0;
    return sourceCode.split('\n').filter(line => 
      line.trim().length > 0 && !line.trim().startsWith('//')
    ).length;
  }

  private calculateFileSize(sourceCode?: string): number {
    if (!sourceCode) return 0;
    return new Blob([sourceCode]).size;
  }

  private calculateComplexity(sourceCode?: string): number | undefined {
    if (!sourceCode) return undefined;
    
    // Simple complexity calculation based on control structures
    const complexityPatterns = [
      /if\s*\(/g,
      /else\s+if\s*\(/g,
      /for\s*\(/g,
      /while\s*\(/g,
      /switch\s*\(/g,
      /catch\s*\(/g,
      /\?\s*.*\s*:/g, // ternary operators
      /&&/g,
      /\|\|/g
    ];

    let complexity = 1; // Base complexity
    complexityPatterns.forEach(pattern => {
      const matches = sourceCode.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    });

    return complexity;
  }

  private checkThresholds(metrics: ComponentMetrics): void {
    if (!this.config.enableLogging) return;

    const warnings: string[] = [];
    
    if (metrics.lineCount > this.config.maxLines) {
      warnings.push(`Lines: ${metrics.lineCount} > ${this.config.maxLines}`);
    }
    
    if (metrics.fileSize > this.config.maxFileSize) {
      warnings.push(`Size: ${Math.round(metrics.fileSize / 1024)}KB > ${Math.round(this.config.maxFileSize / 1024)}KB`);
    }

    if (warnings.length > 0) {
      console.warn(
        `⚠️  Component Size Alert: ${metrics.name}\n` +
        `   Path: ${metrics.path}\n` +
        `   Issues: ${warnings.join(', ')}\n` +
        `   Consider refactoring into smaller components`
      );
    }
  }
}

// Development-only component registration hook
export const useComponentSizeMonitoring = (
  componentName: string,
  componentPath?: string
): void => {
  if (process.env.NODE_ENV === 'development') {
    const monitor = ComponentSizeMonitor.getInstance();
    
    // Register component on mount
    React.useEffect(() => {
      if (componentPath) {
        monitor.registerComponent(componentPath, componentName);
      }
    }, [componentName, componentPath]);
  }
};

// Helper function to generate and log monitoring report
export const logComponentSizeReport = (): void => {
  if (process.env.NODE_ENV === 'development') {
    const monitor = ComponentSizeMonitor.getInstance();
    const report = monitor.generateReport();
    console.log(report);
  }
};

// Export for direct usage
export const componentSizeMonitor = ComponentSizeMonitor.getInstance();

export default ComponentSizeMonitor;