import React from 'react';

/**
 * Type Guard Utilities
 * Collection of type guards to improve type safety and remove 'any' usage
 * Provides runtime type checking with TypeScript type narrowing
 */

/**
 * Check if value is defined (not null or undefined)
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value != null;
}

/**
 * Check if value is a string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Check if value is a number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * Check if value is a boolean
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Check if value is an object (not null, not array)
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Check if value is an array
 */
export function isArray<T = unknown>(value: unknown): value is T[] {
  return Array.isArray(value);
}

/**
 * Check if value is a function
 */
export function isFunction(value: unknown): value is Function {
  return typeof value === 'function';
}

/**
 * Check if value is a Date object
 */
export function isDate(value: unknown): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}

/**
 * Check if value is a valid email string
 */
export function isEmail(value: unknown): value is string {
  if (!isString(value)) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

/**
 * Check if value is a valid URL string
 */
export function isUrl(value: unknown): value is string {
  if (!isString(value)) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if object has a specific property
 */
export function hasProperty<T, K extends string>(
  obj: T,
  prop: K
): obj is T & Record<K, unknown> {
  return isObject(obj) && prop in obj;
}

/**
 * Check if object has a property with a specific type
 */
export function hasStringProperty<T, K extends string>(
  obj: T,
  prop: K
): obj is T & Record<K, string> {
  return hasProperty(obj, prop) && isString(obj[prop]);
}

export function hasNumberProperty<T, K extends string>(
  obj: T,
  prop: K
): obj is T & Record<K, number> {
  return hasProperty(obj, prop) && isNumber(obj[prop]);
}

export function hasBooleanProperty<T, K extends string>(
  obj: T,
  prop: K
): obj is T & Record<K, boolean> {
  return hasProperty(obj, prop) && isBoolean(obj[prop]);
}

/**
 * Check if value matches a specific interface shape
 */
export function isApiResponse<T>(
  value: unknown,
  dataValidator: (data: unknown) => data is T
): value is { data: T; status: number; message?: string } {
  return (
    isObject(value) &&
    hasNumberProperty(value, 'status') &&
    hasProperty(value, 'data') &&
    dataValidator(value.data) &&
    (!hasProperty(value, 'message') || isString(value.message))
  );
}

/**
 * Check if value is an Error object
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Check if value is a Promise
 */
export function isPromise<T = unknown>(value: unknown): value is Promise<T> {
  return (
    isObject(value) &&
    isFunction((value as Promise<T>).then) &&
    isFunction((value as Promise<T>).catch)
  );
}

/**
 * Check if value is a React component (function or class)
 */
export function isReactComponent(value: unknown): value is React.ComponentType {
  return isFunction(value);
}

/**
 * Type guard for non-empty arrays
 */
export function isNonEmptyArray<T>(arr: T[]): arr is [T, ...T[]] {
  return arr.length > 0;
}

/**
 * Type guard for positive numbers
 */
export function isPositiveNumber(value: unknown): value is number {
  return isNumber(value) && value > 0;
}

/**
 * Type guard for non-negative numbers (including 0)
 */
export function isNonNegativeNumber(value: unknown): value is number {
  return isNumber(value) && value >= 0;
}

/**
 * Type guard for valid database ID (positive integer)
 */
export function isDatabaseId(value: unknown): value is number {
  return isNumber(value) && Number.isInteger(value) && value > 0;
}

/**
 * Type guard for UUID strings
 */
export function isUUID(value: unknown): value is string {
  if (!isString(value)) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Assertion function for type narrowing with custom error messages
 */
export function assertIsDefined<T>(
  value: T | null | undefined,
  message = 'Expected value to be defined'
): asserts value is T {
  if (!isDefined(value)) {
    throw new Error(message);
  }
}

export function assertIsString(
  value: unknown,
  message = 'Expected value to be a string'
): asserts value is string {
  if (!isString(value)) {
    throw new Error(message);
  }
}

export function assertIsNumber(
  value: unknown,
  message = 'Expected value to be a number'
): asserts value is number {
  if (!isNumber(value)) {
    throw new Error(message);
  }
}

/**
 * Safe parser for JSON with type validation
 */
export function safeParse<T>(
  json: string,
  validator: (data: unknown) => data is T
): T | null {
  try {
    const parsed = JSON.parse(json);
    return validator(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Type guard for checking if value is one of the allowed literal types
 */
export function isOneOf<T extends readonly string[]>(
  value: unknown,
  allowedValues: T
): value is T[number] {
  return isString(value) && (allowedValues as readonly string[]).includes(value);
}

/**
 * Domain-specific type guards for the application
 */

// Deal stage type guard
export const DEAL_STAGES = ['SQL', 'Opportunity', 'Verbal', 'Signed'] as const;
export type DealStage = typeof DEAL_STAGES[number];

export function isDealStage(value: unknown): value is DealStage {
  return isOneOf(value, DEAL_STAGES);
}

// Activity type guard
export const ACTIVITY_TYPES = ['call', 'email', 'meeting', 'task', 'note', 'proposal'] as const;
export type ActivityType = typeof ACTIVITY_TYPES[number];

export function isActivityType(value: unknown): value is ActivityType {
  return isOneOf(value, ACTIVITY_TYPES);
}

// User role type guard
export const USER_ROLES = ['admin', 'user', 'readonly'] as const;
export type UserRole = typeof USER_ROLES[number];

export function isUserRole(value: unknown): value is UserRole {
  return isOneOf(value, USER_ROLES);
}

export default {
  isDefined,
  isString,
  isNumber,
  isBoolean,
  isObject,
  isArray,
  isFunction,
  isDate,
  isEmail,
  isUrl,
  hasProperty,
  hasStringProperty,
  hasNumberProperty,
  hasBooleanProperty,
  isApiResponse,
  isError,
  isPromise,
  isReactComponent,
  isNonEmptyArray,
  isPositiveNumber,
  isNonNegativeNumber,
  isDatabaseId,
  isUUID,
  assertIsDefined,
  assertIsString,
  assertIsNumber,
  safeParse,
  isOneOf,
  isDealStage,
  isActivityType,
  isUserRole
};