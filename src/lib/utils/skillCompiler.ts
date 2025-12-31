/**
 * Skill Compiler - Variable interpolation for platform skill templates
 *
 * Supports the following variable syntax:
 * - ${variable_name}              - Simple substitution
 * - ${variable_name|'default'}    - With default value
 * - ${products[0].name}           - Array/object access
 * - ${competitors|join(', ')}     - Formatter: join array
 * - ${company_name|upper}         - Formatter: uppercase
 * - ${company_name|lower}         - Formatter: lowercase
 * - ${products|first}             - Formatter: first element of array
 * - ${products|last}              - Formatter: last element of array
 * - ${products|count}             - Formatter: array length
 */

export interface CompilationResult {
  success: boolean;
  content: string;
  frontmatter: Record<string, unknown>;
  missingVariables: string[];
  warnings: string[];
}

export interface OrganizationContext {
  [key: string]: unknown;
}

/**
 * Navigate a path like 'products[0].name' or 'competitors' in an object
 */
function navigatePath(path: string, context: OrganizationContext): unknown {
  if (!path || !context) return undefined;

  // Handle array index notation: products[0] -> products.0
  const normalizedPath = path.replace(/\[(\d+)\]/g, '.$1');
  const parts = normalizedPath.split('.');

  let current: unknown = context;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (typeof current === 'object') {
      // Handle array index
      if (Array.isArray(current) && /^\d+$/.test(part)) {
        current = current[parseInt(part, 10)];
      } else {
        current = (current as Record<string, unknown>)[part];
      }
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Apply a modifier/formatter to a value
 */
function applyModifier(value: unknown, modifier: string): unknown {
  if (value === null || value === undefined) {
    // Check for default value: 'default text'
    const defaultMatch = modifier.match(/^'([^']*)'$/);
    if (defaultMatch) {
      return defaultMatch[1];
    }
    return value;
  }

  // Modifiers
  switch (modifier.toLowerCase()) {
    case 'upper':
      return String(value).toUpperCase();

    case 'lower':
      return String(value).toLowerCase();

    case 'capitalize':
      return String(value)
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');

    case 'first':
      if (Array.isArray(value)) {
        return value[0];
      }
      return value;

    case 'last':
      if (Array.isArray(value)) {
        return value[value.length - 1];
      }
      return value;

    case 'count':
      if (Array.isArray(value)) {
        return value.length;
      }
      if (typeof value === 'object' && value !== null) {
        return Object.keys(value).length;
      }
      return 1;

    case 'json':
      return JSON.stringify(value, null, 2);

    default:
      // Check for join(separator)
      const joinMatch = modifier.match(/^join\(['"]?([^'"]*?)['"]?\)$/i);
      if (joinMatch && Array.isArray(value)) {
        return value.join(joinMatch[1]);
      }

      // Check for default value: 'default text'
      const defaultMatch = modifier.match(/^'([^']*)'$/);
      if (defaultMatch && (value === null || value === undefined)) {
        return defaultMatch[1];
      }

      // Check for slice(start, end)
      const sliceMatch = modifier.match(/^slice\((\d+)(?:,\s*(\d+))?\)$/i);
      if (sliceMatch && Array.isArray(value)) {
        const start = parseInt(sliceMatch[1], 10);
        const end = sliceMatch[2] ? parseInt(sliceMatch[2], 10) : undefined;
        return value.slice(start, end);
      }

      return value;
  }
}

/**
 * Evaluate a full expression like 'products[0].name|upper' or 'company_name|\'Unknown\''
 */
function evaluateExpression(
  expr: string,
  context: OrganizationContext
): { value: string | null; variableName: string } {
  // Split by pipe, but handle escaped pipes and pipes within function calls
  const parts: string[] = [];
  let current = '';
  let parenDepth = 0;
  let inQuote = false;
  let quoteChar = '';

  for (let i = 0; i < expr.length; i++) {
    const char = expr[i];

    if ((char === "'" || char === '"') && expr[i - 1] !== '\\') {
      if (!inQuote) {
        inQuote = true;
        quoteChar = char;
      } else if (char === quoteChar) {
        inQuote = false;
      }
    }

    if (!inQuote) {
      if (char === '(') parenDepth++;
      if (char === ')') parenDepth--;
    }

    if (char === '|' && parenDepth === 0 && !inQuote) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  parts.push(current.trim());

  const [path, ...modifiers] = parts;
  const variableName = path.split('[')[0].split('.')[0]; // Get base variable name

  // Navigate to get the value
  let value = navigatePath(path, context);

  // Apply modifiers in sequence
  for (const mod of modifiers) {
    value = applyModifier(value, mod);
  }

  // Convert to string for output
  if (value === null || value === undefined) {
    return { value: null, variableName };
  }

  if (typeof value === 'object') {
    return { value: JSON.stringify(value), variableName };
  }

  return { value: String(value), variableName };
}

/**
 * Compile a skill template by interpolating organization context
 *
 * @param template - The skill template with ${variable} placeholders
 * @param context - Organization context key-value pairs
 * @returns Compiled content with variables replaced
 */
export function compileSkillTemplate(
  template: string,
  context: OrganizationContext
): CompilationResult {
  const missingVariables: string[] = [];
  const warnings: string[] = [];
  const usedVariables = new Set<string>();

  const compiled = template.replace(/\$\{([^}]+)\}/g, (match, expression) => {
    const { value, variableName } = evaluateExpression(expression.trim(), context);
    usedVariables.add(variableName);

    if (value === null) {
      // Check if there's a default value in the expression
      if (!expression.includes("'") && !expression.includes('"')) {
        missingVariables.push(variableName);
      }
      return match; // Keep original placeholder if no value and no default
    }

    return value;
  });

  // Check if any placeholders remain (indicates missing variables)
  const remainingPlaceholders = compiled.match(/\$\{([^}]+)\}/g);
  if (remainingPlaceholders && remainingPlaceholders.length > 0) {
    warnings.push(
      `${remainingPlaceholders.length} unresolved placeholder(s) in compiled content`
    );
  }

  return {
    success: missingVariables.length === 0,
    content: compiled,
    frontmatter: {},
    missingVariables: [...new Set(missingVariables)],
    warnings,
  };
}

/**
 * Compile both frontmatter and content template
 */
export function compileSkillDocument(
  frontmatter: Record<string, unknown>,
  contentTemplate: string,
  context: OrganizationContext
): CompilationResult {
  // Compile the content
  const contentResult = compileSkillTemplate(contentTemplate, context);

  // Compile any string values in frontmatter
  const compiledFrontmatter: Record<string, unknown> = {};
  const frontmatterMissing: string[] = [];

  function compileValue(value: unknown): unknown {
    if (typeof value === 'string') {
      const result = compileSkillTemplate(value, context);
      frontmatterMissing.push(...result.missingVariables);
      return result.content;
    }
    if (Array.isArray(value)) {
      return value.map(compileValue);
    }
    if (typeof value === 'object' && value !== null) {
      const compiled: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        compiled[k] = compileValue(v);
      }
      return compiled;
    }
    return value;
  }

  for (const [key, value] of Object.entries(frontmatter)) {
    compiledFrontmatter[key] = compileValue(value);
  }

  // Merge missing variables
  const allMissing = [...new Set([...contentResult.missingVariables, ...frontmatterMissing])];

  return {
    success: allMissing.length === 0,
    content: contentResult.content,
    frontmatter: compiledFrontmatter,
    missingVariables: allMissing,
    warnings: contentResult.warnings,
  };
}

/**
 * Validate that a context object has all required variables
 */
export function validateContextForSkill(
  requiredVariables: string[],
  context: OrganizationContext
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  for (const varName of requiredVariables) {
    const value = navigatePath(varName, context);
    if (value === null || value === undefined) {
      missing.push(varName);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Extract all variable names from a template
 */
export function extractVariablesFromTemplate(template: string): string[] {
  const variables = new Set<string>();
  const regex = /\$\{([^}]+)\}/g;
  let match;

  while ((match = regex.exec(template)) !== null) {
    const expression = match[1].trim();
    // Extract the base variable name (before any modifiers or array access)
    const baseName = expression.split(/[|.\[]/)[0];
    variables.add(baseName);
  }

  return Array.from(variables);
}

/**
 * Get sample context for preview purposes
 */
export function getSampleContext(): OrganizationContext {
  return {
    company_name: 'Acme Corp',
    domain: 'acme.com',
    tagline: 'Making the world better',
    description: 'Acme Corp is a leading provider of innovative solutions.',
    industry: 'Technology',
    employee_count: '50-200',
    founded_year: 2015,
    headquarters: 'San Francisco, CA',
    products: [
      { name: 'Product One', description: 'Our flagship product', pricing_tier: 'Enterprise' },
      { name: 'Product Two', description: 'For small teams', pricing_tier: 'Starter' },
    ],
    main_product: 'Product One',
    value_propositions: ['Save time', 'Reduce costs', 'Increase productivity'],
    pricing_model: 'Subscription',
    competitors: ['Competitor A', 'Competitor B', 'Competitor C'],
    primary_competitor: 'Competitor A',
    target_market: 'Mid-market B2B SaaS companies',
    target_customers: 'Sales teams and revenue operations',
    icp_summary: 'B2B SaaS companies with 20-500 employees looking to improve sales efficiency',
    brand_tone: 'Professional yet approachable',
    words_to_avoid: ['cheap', 'basic', 'simple'],
    key_phrases: ['transform your sales', 'revenue intelligence', 'close more deals'],
    buying_signals: ['evaluating CRM', 'sales team growth', 'budget approved'],
  };
}
