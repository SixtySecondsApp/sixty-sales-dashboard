/**
 * Configuration interfaces following Dependency Inversion Principle
 * Abstractions for configuration management
 */

// Database configuration interface
export interface IDatabaseConfig {
  getConnectionString(): string;
  getMaxConnections(): number;
  getConnectionTimeout(): number;
  getQueryTimeout(): number;
  isReadOnlyMode(): boolean;
}

// Feature flag configuration interface
export interface IFeatureFlags {
  isFeatureEnabled(feature: string): boolean;
  getFeatureConfig<T>(feature: string): T | null;
  getAllFeatures(): Record<string, boolean>;
}

// Environment configuration interface
export interface IEnvironmentConfig {
  isDevelopment(): boolean;
  isProduction(): boolean;
  isTest(): boolean;
  getEnvironmentName(): string;
  getApiBaseUrl(): string;
}

// Security configuration interface
export interface ISecurityConfig {
  getJWTSecret(): string;
  getPasswordHashRounds(): number;
  getRateLimitWindow(): number;
  getRateLimitMaxRequests(): number;
  isSecurityAuditEnabled(): boolean;
}

// Business rules configuration interface
export interface IBusinessConfig {
  getLTVMultiplier(): number;
  getDefaultStages(): string[];
  getMaxDealValue(): number;
  getMinDealValue(): number;
  getDefaultTaskPriority(): string;
}

// Integration configuration interface
export interface IIntegrationConfig {
  getSlackWebhookUrl(): string | null;
  getSlackChannels(): Record<string, string>;
  getEmailProvider(): string;
  getNotificationSettings(): Record<string, boolean>;
}

// Performance configuration interface
export interface IPerformanceConfig {
  getCacheTimeout(): number;
  getMaxPageSize(): number;
  getDefaultPageSize(): number;
  isCompressionEnabled(): boolean;
  getRequestTimeout(): number;
}

// Main application configuration interface
export interface IApplicationConfig extends
  IDatabaseConfig,
  IFeatureFlags,
  IEnvironmentConfig,
  ISecurityConfig,
  IBusinessConfig,
  IIntegrationConfig,
  IPerformanceConfig {
  validateConfig(): string[];
  reloadConfig(): Promise<void>;
}