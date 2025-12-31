/**
 * Get Agent Skills Edge Function
 *
 * MCP-compatible endpoint for AI agents to retrieve organization skills.
 * Returns compiled skills with frontmatter metadata and content.
 *
 * Actions:
 * - list: Get all skills for an organization (with optional filters)
 * - get: Get a single skill by key
 * - search: Search skills by query string
 *
 * @see platform-controlled-skills-for-orgs.md - Phase 5: Agent Integration
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  handleCorsPreflightRequest,
  jsonResponse,
  errorResponse,
} from '../_shared/corsHelper.ts';

// =============================================================================
// Types
// =============================================================================

interface AgentSkillsRequest {
  action: 'list' | 'get' | 'search';
  organization_id: string;
  category?: 'sales-ai' | 'writing' | 'enrichment' | 'workflows' | 'data-access' | 'output-format';
  enabled_only?: boolean;
  skill_key?: string;
  query?: string;
}

interface AgentSkill {
  skill_key: string;
  category: string;
  frontmatter: Record<string, unknown>;
  content: string;
  is_enabled: boolean;
  version: number;
}

interface AgentSkillsResponse {
  success: boolean;
  skills?: AgentSkill[];
  skill?: AgentSkill | null;
  count?: number;
  error?: string;
}

// =============================================================================
// Helper: Extract error message from any error type
// =============================================================================

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>;
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj.error === 'string') return obj.error;
    if (typeof obj.details === 'string') return obj.details;
    return JSON.stringify(error);
  }
  return String(error);
}

// =============================================================================
// Main Handler
// =============================================================================

serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;

  // Only accept POST requests
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', req, 405);
  }

  try {
    // Authenticate request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return errorResponse('No authorization header', req, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Verify user token
    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return errorResponse('Invalid authentication token', req, 401);
    }

    // Parse request body
    const requestBody: AgentSkillsRequest = await req.json();
    const {
      action = 'list',
      organization_id,
      category,
      enabled_only = true,
      skill_key,
      query,
    } = requestBody;

    // Validate organization_id
    if (!organization_id) {
      return errorResponse('organization_id is required', req, 400);
    }

    // Verify user has access to this organization
    const { data: membership, error: membershipError } = await supabase
      .from('organization_memberships')
      .select('id')
      .eq('organization_id', organization_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (membershipError || !membership) {
      return errorResponse('Access denied to this organization', req, 403);
    }

    // Route to appropriate handler
    let response: AgentSkillsResponse;

    switch (action) {
      case 'list':
        response = await listSkills(supabase, organization_id, category, enabled_only);
        break;

      case 'get':
        if (!skill_key) {
          return errorResponse('skill_key is required for get action', req, 400);
        }
        response = await getSkill(supabase, organization_id, skill_key);
        break;

      case 'search':
        if (!query) {
          return errorResponse('query is required for search action', req, 400);
        }
        response = await searchSkills(supabase, organization_id, query, category, enabled_only);
        break;

      default:
        return errorResponse(`Unknown action: ${action}`, req, 400);
    }

    return jsonResponse(response, req);
  } catch (error) {
    const errorMessage = extractErrorMessage(error);
    console.error('[get-agent-skills] Error:', errorMessage);
    return errorResponse(errorMessage, req, 500);
  }
});

// =============================================================================
// List Skills
// =============================================================================

async function listSkills(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  category?: string,
  enabledOnly = true
): Promise<AgentSkillsResponse> {
  try {
    // Use the RPC function to get compiled skills
    const { data: skills, error } = await supabase.rpc(
      'get_organization_skills_for_agent',
      { p_org_id: organizationId }
    );

    if (error) {
      console.error('[listSkills] RPC error:', error);
      throw error;
    }

    let filteredSkills: AgentSkill[] = (skills || []).map((s: any) => ({
      skill_key: s.skill_key,
      category: s.category || 'uncategorized',
      frontmatter: s.frontmatter || {},
      content: s.content || '',
      is_enabled: s.is_enabled ?? true,
      version: s.version ?? 1,
    }));

    // Apply category filter
    if (category) {
      filteredSkills = filteredSkills.filter((s) => s.category === category);
    }

    // Apply enabled filter
    if (enabledOnly) {
      filteredSkills = filteredSkills.filter((s) => s.is_enabled);
    }

    return {
      success: true,
      skills: filteredSkills,
      count: filteredSkills.length,
    };
  } catch (error) {
    const errorMessage = extractErrorMessage(error);
    console.error('[listSkills] Error:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

// =============================================================================
// Get Single Skill
// =============================================================================

async function getSkill(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  skillKey: string
): Promise<AgentSkillsResponse> {
  try {
    // Use the RPC function and filter to the specific skill
    const { data: skills, error } = await supabase.rpc(
      'get_organization_skills_for_agent',
      { p_org_id: organizationId }
    );

    if (error) {
      console.error('[getSkill] RPC error:', error);
      throw error;
    }

    const skill = (skills || []).find((s: any) => s.skill_key === skillKey);

    if (!skill) {
      return {
        success: true,
        skill: null,
      };
    }

    return {
      success: true,
      skill: {
        skill_key: skill.skill_key,
        category: skill.category || 'uncategorized',
        frontmatter: skill.frontmatter || {},
        content: skill.content || '',
        is_enabled: skill.is_enabled ?? true,
        version: skill.version ?? 1,
      },
    };
  } catch (error) {
    const errorMessage = extractErrorMessage(error);
    console.error('[getSkill] Error:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

// =============================================================================
// Search Skills
// =============================================================================

async function searchSkills(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  query: string,
  category?: string,
  enabledOnly = true
): Promise<AgentSkillsResponse> {
  try {
    // Get all skills first
    const { data: skills, error } = await supabase.rpc(
      'get_organization_skills_for_agent',
      { p_org_id: organizationId }
    );

    if (error) {
      console.error('[searchSkills] RPC error:', error);
      throw error;
    }

    const queryLower = query.toLowerCase();

    // Filter by search query
    let filteredSkills: AgentSkill[] = (skills || [])
      .filter((s: any) => {
        // Search in skill_key
        if (s.skill_key?.toLowerCase().includes(queryLower)) return true;

        // Search in frontmatter
        const frontmatter = s.frontmatter || {};
        if (frontmatter.name?.toLowerCase().includes(queryLower)) return true;
        if (frontmatter.description?.toLowerCase().includes(queryLower)) return true;
        if (Array.isArray(frontmatter.triggers)) {
          if (frontmatter.triggers.some((t: string) => t.toLowerCase().includes(queryLower))) {
            return true;
          }
        }

        // Search in content
        if (s.content?.toLowerCase().includes(queryLower)) return true;

        // Search in category
        if (s.category?.toLowerCase().includes(queryLower)) return true;

        return false;
      })
      .map((s: any) => ({
        skill_key: s.skill_key,
        category: s.category || 'uncategorized',
        frontmatter: s.frontmatter || {},
        content: s.content || '',
        is_enabled: s.is_enabled ?? true,
        version: s.version ?? 1,
      }));

    // Apply category filter
    if (category) {
      filteredSkills = filteredSkills.filter((s) => s.category === category);
    }

    // Apply enabled filter
    if (enabledOnly) {
      filteredSkills = filteredSkills.filter((s) => s.is_enabled);
    }

    return {
      success: true,
      skills: filteredSkills,
      count: filteredSkills.length,
    };
  } catch (error) {
    const errorMessage = extractErrorMessage(error);
    console.error('[searchSkills] Error:', errorMessage);
    return { success: false, error: errorMessage };
  }
}
