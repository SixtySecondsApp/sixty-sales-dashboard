/**
 * Company Navigation Utilities
 * Standardizes company ID generation and navigation across the application
 */

/**
 * Generates a URL-friendly company ID from a company name
 * @param companyName - The company name to convert
 * @returns A URL-safe company ID
 */
export function generateCompanyId(companyName: string): string {
  return companyName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Navigates to a company profile page
 * @param companyName - The company name
 * @param openInNewTab - Whether to open in a new tab (default: true)
 */
export function navigateToCompanyProfile(companyName: string, openInNewTab: boolean = true): void {
  const companyId = generateCompanyId(companyName);
  const url = `/companies/${encodeURIComponent(companyId)}`;
  
  if (openInNewTab) {
    window.open(url, '_blank');
  } else {
    window.location.href = url;
  }
}

/**
 * Gets the company profile URL for a given company name
 * @param companyName - The company name
 * @returns The company profile URL
 */
export function getCompanyProfileUrl(companyName: string): string {
  const companyId = generateCompanyId(companyName);
  return `/companies/${encodeURIComponent(companyId)}`;
}

/**
 * Example company ID conversions:
 * - "Viewpoint VC" → "viewpoint-vc"
 * - "Bergmann Direct Co. UK" → "bergmann-direct-co-uk"
 * - "ABC Company Ltd." → "abc-company-ltd"
 */