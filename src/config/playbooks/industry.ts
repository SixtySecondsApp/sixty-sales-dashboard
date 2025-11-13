/**
 * Industry Playbooks Configuration
 * Maps industries to discovery questions, value points, and risks
 */

export interface IndustryPlaybook {
  industry: string;
  discoveryQuestions: string[];
  valuePoints: string[];
  risks: string[];
}

export const industryPlaybooks: IndustryPlaybook[] = [
  {
    industry: 'Technology',
    discoveryQuestions: [
      'What technical challenges are you facing with your current stack?',
      'How does your team currently handle scaling and infrastructure?',
      'What integration requirements do you have with existing tools?',
    ],
    valuePoints: [
      'Reduced technical debt and improved system reliability',
      'Faster time-to-market for new features',
      'Better developer experience and productivity',
    ],
    risks: [
      'Complex migration from legacy systems',
      'Team resistance to new tooling',
    ],
  },
  {
    industry: 'Healthcare',
    discoveryQuestions: [
      'How do you ensure HIPAA compliance in your current processes?',
      'What patient data management challenges are you facing?',
      'How do you handle interoperability with other healthcare systems?',
    ],
    valuePoints: [
      'Enhanced patient care coordination',
      'Improved regulatory compliance',
      'Reduced administrative burden on clinical staff',
    ],
    risks: [
      'Strict regulatory requirements and compliance concerns',
      'Long approval cycles and procurement processes',
    ],
  },
  {
    industry: 'Financial Services',
    discoveryQuestions: [
      'What regulatory compliance requirements must you meet?',
      'How do you currently handle risk management and reporting?',
      'What security and data protection measures are in place?',
    ],
    valuePoints: [
      'Improved regulatory reporting and compliance',
      'Enhanced fraud detection and risk management',
      'Better customer data security and privacy',
    ],
    risks: [
      'Stringent security and compliance requirements',
      'Complex integration with legacy banking systems',
    ],
  },
  {
    industry: 'Retail',
    discoveryQuestions: [
      'How do you manage inventory across multiple channels?',
      'What customer experience initiatives are you prioritizing?',
      'How do you handle peak season demand fluctuations?',
    ],
    valuePoints: [
      'Improved omnichannel customer experience',
      'Better inventory visibility and management',
      'Increased sales through personalization',
    ],
    risks: [
      'Seasonal demand fluctuations',
      'Competition from e-commerce giants',
    ],
  },
  {
    industry: 'Manufacturing',
    discoveryQuestions: [
      'How do you track production efficiency and quality?',
      'What supply chain visibility challenges do you face?',
      'How are you implementing Industry 4.0 initiatives?',
    ],
    valuePoints: [
      'Improved production efficiency and quality control',
      'Better supply chain visibility and optimization',
      'Reduced downtime through predictive maintenance',
    ],
    risks: [
      'Complex integration with existing manufacturing systems',
      'Workforce training requirements for new technology',
    ],
  },
  {
    industry: 'Education',
    discoveryQuestions: [
      'How do you currently manage student data and records?',
      'What challenges do you face with remote or hybrid learning?',
      'How do you measure and improve student outcomes?',
    ],
    valuePoints: [
      'Enhanced student engagement and outcomes',
      'Streamlined administrative processes',
      'Better data-driven decision making',
    ],
    risks: [
      'Budget constraints and limited IT resources',
      'Privacy concerns with student data',
    ],
  },
  {
    industry: 'Real Estate',
    discoveryQuestions: [
      'How do you manage property listings and client relationships?',
      'What challenges do you face with transaction management?',
      'How do you track market trends and property valuations?',
    ],
    valuePoints: [
      'Improved client relationship management',
      'Faster transaction processing',
      'Better market insights and analytics',
    ],
    risks: [
      'Market volatility and economic uncertainty',
      'Regulatory changes affecting the industry',
    ],
  },
  {
    industry: 'Professional Services',
    discoveryQuestions: [
      'How do you currently track billable hours and project profitability?',
      'What challenges do you face with client communication?',
      'How do you manage resource allocation across projects?',
    ],
    valuePoints: [
      'Improved project profitability and resource utilization',
      'Better client communication and satisfaction',
      'Streamlined billing and invoicing processes',
    ],
    risks: [
      'Client resistance to changing established processes',
      'Integration with existing accounting systems',
    ],
  },
];

/**
 * Get playbook for a specific industry
 */
export function getPlaybookForIndustry(industry: string | null | undefined): IndustryPlaybook | null {
  if (!industry) return null;
  
  const normalized = industry.toLowerCase().trim();
  
  // Try exact match first
  const exactMatch = industryPlaybooks.find(
    (p) => p.industry.toLowerCase() === normalized
  );
  if (exactMatch) return exactMatch;
  
  // Try partial match
  const partialMatch = industryPlaybooks.find(
    (p) => normalized.includes(p.industry.toLowerCase()) || 
           p.industry.toLowerCase().includes(normalized)
  );
  if (partialMatch) return partialMatch;
  
  return null;
}

/**
 * Get default playbook (Technology) when industry is unknown
 */
export function getDefaultPlaybook(): IndustryPlaybook {
  return industryPlaybooks[0]; // Technology
}
