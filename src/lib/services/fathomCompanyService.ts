import { supabase } from '../supabase/clientV2';

/**
 * Fathom Company Service
 * Handles company matching, creation, and linking for Fathom meeting contacts
 */

export interface Company {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  size: string | null;
  website: string | null;
  address: string | null;
  phone: string | null;
  description: string | null;
  linkedin_url: string | null;
  owner_id: string;
  source?: string;
  first_seen_at?: string;
  created_at: string;
  updated_at: string;
}

// Personal email domains to filter out (not business domains)
const PERSONAL_EMAIL_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'me.com',
  'aol.com',
  'live.com',
  'msn.com',
  'protonmail.com',
  'mail.com',
  'yandex.com',
  'zoho.com',
  'gmx.com',
  'fastmail.com',
];

/**
 * Extract business domain from email address
 * Filters out personal email domains (gmail, yahoo, etc.)
 * @param email - Email address to extract domain from
 * @returns Domain string or null if personal email or invalid
 */
export function extractBusinessDomain(email: string): string | null {
  if (!email || !email.includes('@')) {
    return null;
  }

  const domain = email.split('@')[1]?.toLowerCase().trim();

  if (!domain) {
    return null;
  }

  // Filter out personal email domains
  if (PERSONAL_EMAIL_DOMAINS.includes(domain)) {
    return null;
  }

  return domain;
}

/**
 * Calculate string similarity using Levenshtein distance
 * Used for fuzzy matching company names
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Similarity score between 0 and 1 (1 = identical)
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  if (s1 === s2) return 1;

  const len1 = s1.length;
  const len2 = s2.length;

  if (len1 === 0 || len2 === 0) return 0;

  // Create 2D array for dynamic programming
  const matrix: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  // Initialize first column and row
  for (let i = 0; i <= len1; i++) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  const distance = matrix[len1][len2];
  const maxLength = Math.max(len1, len2);

  return 1 - distance / maxLength;
}

/**
 * Normalize company name for fuzzy matching
 * Removes common suffixes, special characters, and standardizes format
 * @param name - Company name to normalize
 * @returns Normalized company name
 */
function normalizeCompanyName(name: string): string {
  if (!name) return '';

  let normalized = name.toLowerCase().trim();

  // Remove common company suffixes
  const suffixes = [
    ' inc',
    ' inc.',
    ' incorporated',
    ' corp',
    ' corp.',
    ' corporation',
    ' ltd',
    ' ltd.',
    ' limited',
    ' llc',
    ' l.l.c.',
    ' llp',
    ' plc',
    ' gmbh',
    ' ag',
    ' sa',
    ' bv',
    ' nv',
    ' co',
    ' co.',
    ' company',
    ' group',
    ' holdings',
    ' enterprises',
  ];

  for (const suffix of suffixes) {
    if (normalized.endsWith(suffix)) {
      normalized = normalized.slice(0, -suffix.length).trim();
    }
  }

  // Remove special characters and extra spaces
  normalized = normalized
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized;
}

/**
 * Generate a pretty company name from domain
 * e.g., "acmecorp.com" -> "Acme Corp"
 * @param domain - Domain name
 * @returns Formatted company name
 */
function generateCompanyNameFromDomain(domain: string): string {
  if (!domain) return '';

  // Remove TLDs and common patterns
  let name = domain
    .replace(/\.(com|org|net|co\.uk|io|ai|tech|app|dev|biz|info)$/i, '')
    .replace(/^www\./, '');

  // Split by dots and hyphens
  const parts = name.split(/[.\-_]/);

  // Capitalize each part
  const formatted = parts
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  return formatted;
}

/**
 * Find existing company by domain (exact match)
 * @param domain - Domain to search for
 * @param userId - User ID for filtering
 * @returns Company object or null if not found
 */
export async function findCompanyByDomain(
  domain: string,
  userId: string
): Promise<Company | null> {
  if (!domain || !userId) {
    return null;
  }

  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('owner_id', userId)
    .ilike('domain', domain)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows returned
    return null;
  }

  return data;
}

/**
 * Find existing company by fuzzy name matching
 * Uses normalized company name comparison with similarity threshold
 * @param name - Company name to search for
 * @param userId - User ID for filtering
 * @param similarityThreshold - Minimum similarity score (default: 0.85)
 * @returns Company object or null if no match found
 */
export async function findCompanyByFuzzyName(
  name: string,
  userId: string,
  similarityThreshold: number = 0.85
): Promise<Company | null> {
  if (!name || !userId) {
    return null;
  }

  // Get all companies for this user
  const { data: companies, error } = await supabase
    .from('companies')
    .select('*')
    .eq('owner_id', userId);

  if (error) {
    return null;
  }

  if (!companies || companies.length === 0) {
    return null;
  }

  // Normalize input name
  const normalizedInput = normalizeCompanyName(name);

  // Find best match
  let bestMatch: Company | null = null;
  let highestSimilarity = 0;

  for (const company of companies) {
    const normalizedCompanyName = normalizeCompanyName(company.name);
    const similarity = calculateStringSimilarity(normalizedInput, normalizedCompanyName);

    if (similarity > highestSimilarity && similarity >= similarityThreshold) {
      highestSimilarity = similarity;
      bestMatch = company;
    }
  }

  if (bestMatch) {
  }

  return bestMatch;
}

/**
 * Create new company from domain
 * @param domain - Domain name
 * @param userId - User ID who owns this company
 * @param suggestedName - Optional suggested name (from contact name or other source)
 * @returns Newly created company object
 */
export async function createCompanyFromDomain(
  domain: string,
  userId: string,
  suggestedName?: string
): Promise<Company | null> {
  if (!domain || !userId) {
    return null;
  }

  // Generate company name from domain if not suggested
  const companyName = suggestedName || generateCompanyNameFromDomain(domain);

  // Check if name already exists (fuzzy match)
  const existingCompany = await findCompanyByFuzzyName(companyName, userId);
  if (existingCompany) {
    // Update the existing company with domain if it doesn't have one
    if (!existingCompany.domain) {
      const { data: updated, error: updateError } = await supabase
        .from('companies')
        .update({
          domain,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingCompany.id)
        .select()
        .single();

      if (updateError) {
        return existingCompany;
      }

      return updated;
    }

    return existingCompany;
  }

  // Create new company
  const { data, error } = await supabase
    .from('companies')
    .insert({
      name: companyName,
      domain: domain.toLowerCase(),
      website: `https://${domain}`,
      owner_id: userId,
      source: 'fathom_meeting',
      first_seen_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    return null;
  }
  return data;
}

/**
 * Match or create company from email address
 * Main entry point for Fathom sync process
 *
 * Process:
 * 1. Extract domain from email (filter personal domains)
 * 2. Try to find existing company by domain (exact match)
 * 3. If not found by domain, try fuzzy name matching
 * 4. If still not found, create new company
 *
 * @param email - Email address to extract domain from
 * @param userId - User ID who owns the company
 * @param contactName - Optional contact name for better company name suggestion
 * @returns Company object or null if personal email domain
 */
export async function matchOrCreateCompany(
  email: string,
  userId: string,
  contactName?: string
): Promise<Company | null> {
  // Extract business domain
  const domain = extractBusinessDomain(email);

  if (!domain) {
    // Personal email or invalid format
    return null;
  }

  // Try to find existing company by domain
  let company = await findCompanyByDomain(domain, userId);

  if (company) {
    return company;
  }

  // Try fuzzy matching by generated company name
  const generatedName = generateCompanyNameFromDomain(domain);
  company = await findCompanyByFuzzyName(generatedName, userId);

  if (company) {
    // Update domain if missing
    if (!company.domain) {
      const { data: updated } = await supabase
        .from('companies')
        .update({
          domain,
          updated_at: new Date().toISOString()
        })
        .eq('id', company.id)
        .select()
        .single();

      return updated || company;
    }

    return company;
  }

  // Create new company
  return await createCompanyFromDomain(domain, userId, contactName);
}

/**
 * Batch process multiple emails to match/create companies
 * Optimized for processing meeting attendees
 * @param emails - Array of email addresses
 * @param userId - User ID who owns the companies
 * @returns Map of email -> Company (null for personal emails)
 */
export async function batchMatchOrCreateCompanies(
  emails: string[],
  userId: string
): Promise<Map<string, Company | null>> {
  const results = new Map<string, Company | null>();

  // Process each email
  for (const email of emails) {
    const company = await matchOrCreateCompany(email, userId);
    results.set(email, company);
  }

  return results;
}
