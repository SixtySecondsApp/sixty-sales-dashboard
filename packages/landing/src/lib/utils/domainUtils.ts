/**
 * Utility functions for extracting and normalizing domains from contacts and companies
 */

/**
 * Common free email providers that should be filtered out when extracting business domains
 */
const FREE_EMAIL_PROVIDERS = [
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'proton.me',
  'protonmail.com',
  'aol.com',
  'mail.com',
  'live.com',
  'msn.com',
  'ymail.com',
  'zoho.com',
  'gmx.com',
];

/**
 * Extract domain from a contact
 * Priority: company.domain > company.website > email domain (if not free provider)
 */
export function extractDomainFromContact(contact: {
  email?: string;
  company?: {
    domain?: string;
    website?: string;
  };
}): string | null {
  // First, try company domain
  if (contact.company?.domain) {
    return contact.company.domain;
  }

  // Then try company website
  if (contact.company?.website) {
    const domain = extractDomainFromWebsite(contact.company.website);
    if (domain) {
      return domain;
    }
  }

  // Finally, try extracting from email
  if (contact.email) {
    return extractDomainFromEmail(contact.email);
  }

  return null;
}

/**
 * Extract domain from a company
 * Priority: domain > website
 */
export function extractDomainFromCompany(company: {
  domain?: string;
  website?: string;
  primary_email?: string; // Optional - may exist in some contexts
}): string | null {
  // First, try domain field
  if (company.domain) {
    return company.domain;
  }

  // Then try website
  if (company.website) {
    const domain = extractDomainFromWebsite(company.website);
    if (domain) {
      return domain;
    }
  }

  // Finally, try primary email (if available)
  if (company.primary_email) {
    return extractDomainFromEmail(company.primary_email);
  }

  return null;
}

/**
 * Extract domain from an email address
 * Filters out free email providers
 */
export function extractDomainFromEmail(email: string): string | null {
  if (!email || !email.includes('@')) {
    return null;
  }

  const emailDomain = email.split('@')[1];
  if (!emailDomain) {
    return null;
  }

  const normalizedDomain = emailDomain.toLowerCase().trim();
  
  // Filter out common free email providers
  if (FREE_EMAIL_PROVIDERS.includes(normalizedDomain)) {
    return null;
  }

  return normalizedDomain;
}

/**
 * Extract domain from a website URL
 */
export function extractDomainFromWebsite(website: string): string | null {
  if (!website) {
    return null;
  }

  try {
    // Remove protocol
    let domain = website.replace(/^https?:\/\//, '');
    
    // Remove www.
    domain = domain.replace(/^www\./, '');
    
    // Remove path and query parameters
    domain = domain.split('/')[0];
    domain = domain.split('?')[0];
    
    // Remove port
    domain = domain.split(':')[0];
    
    // Normalize
    domain = domain.toLowerCase().trim();
    
    if (!domain) {
      return null;
    }

    return domain;
  } catch (error) {
    return null;
  }
}

/**
 * Extract domain from a deal
 * Priority: companies.domain > companies.website > company (if object) > contact_email domain
 */
export function extractDomainFromDeal(deal: {
  companies?: {
    domain?: string;
    website?: string;
  } | null;
  company?: string | {
    domain?: string;
    website?: string;
  } | null;
  contact_email?: string;
  company_website?: string;
}): string | null {
  // First, try normalized company relationship
  if (deal.companies) {
    if (deal.companies.domain) {
      return deal.companies.domain;
    }
    if (deal.companies.website) {
      const domain = extractDomainFromWebsite(deal.companies.website);
      if (domain) {
        return domain;
      }
    }
  }

  // Then try company object
  if (deal.company && typeof deal.company === 'object') {
    if (deal.company.domain) {
      return deal.company.domain;
    }
    if (deal.company.website) {
      const domain = extractDomainFromWebsite(deal.company.website);
      if (domain) {
        return domain;
      }
    }
  }

  // Try company_website field
  if (deal.company_website) {
    const domain = extractDomainFromWebsite(deal.company_website);
    if (domain) {
      return domain;
    }
  }

  // Finally, try extracting from contact email
  if (deal.contact_email) {
    return extractDomainFromEmail(deal.contact_email);
  }

  return null;
}

