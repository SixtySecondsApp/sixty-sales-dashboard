export type VercelApiHandler = (req: any, res: any) => Promise<any> | any;

/**
 * OpenTelemetry wrapper - temporarily disabled due to Vercel compatibility issues
 *
 * The @opentelemetry/sdk-trace-node package causes FUNCTION_INVOCATION_FAILED errors
 * in Vercel's serverless environment. Disabling for now until we can investigate a
 * proper fix (e.g., using web-compatible OpenTelemetry packages).
 *
 * TODO: Re-enable with proper Vercel serverless compatibility
 */
export function withOtel(routeName: string, handler: VercelApiHandler): VercelApiHandler {
  // Bypass OpenTelemetry entirely - just return the handler unwrapped
  return handler;
}
