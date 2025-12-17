import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SalesTemplateService, SalesTemplate, TemplateContext, TemplateCategory } from '../salesTemplateService';
import { supabase } from '@/lib/supabase/clientV2';
import { CopilotService } from '../copilotService';

// Mock dependencies
vi.mock('@/lib/supabase/clientV2', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock('../copilotService', () => ({
  CopilotService: {
    sendMessage: vi.fn(),
  },
}));

vi.mock('@/lib/utils/logger', () => ({
  default: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('SalesTemplateService', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  const mockTemplate: SalesTemplate = {
    id: 'template-1',
    user_id: 'user-123',
    org_id: 'org-1',
    name: 'Test Template',
    description: 'A test template',
    category: 'initial_outreach',
    subject_template: 'Hello {{contact_name}}',
    body_template: 'Hi {{contact_name}}, regarding {{deal_name}}',
    ai_instructions: 'Be professional',
    tone: 'professional',
    required_variables: ['contact_name'],
    optional_variables: ['deal_name'],
    context_types: ['contact', 'deal'],
    usage_count: 10,
    last_used_at: '2023-01-01T00:00:00Z',
    avg_response_rate: 0.5,
    avg_conversion_rate: 0.2,
    is_active: true,
    is_shared: false,
    is_default: false,
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock for auth
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any);
  });

  describe('getTemplates', () => {
    it('should fetch active templates for the user', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockOr = vi.fn().mockReturnThis();
      const mockOrder = vi.fn().mockResolvedValue({
        data: [mockTemplate],
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        or: mockOr,
        order: mockOrder,
      } as any);

      const result = await SalesTemplateService.getTemplates();

      expect(result).toEqual([mockTemplate]);
      expect(supabase.from).toHaveBeenCalledWith('sales_templates');
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockEq).toHaveBeenCalledWith('is_active', true);
    });

    it('should handle errors when fetching templates', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockOr = vi.fn().mockReturnThis();
      const mockOrder = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        or: mockOr,
        order: mockOrder,
      } as any);

      await expect(SalesTemplateService.getTemplates()).rejects.toEqual({ message: 'Database error' });
    });
  });

  describe('getTemplateById', () => {
    it('should return a template when found', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockTemplate,
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      } as any);

      const result = await SalesTemplateService.getTemplateById('template-1');
      expect(result).toEqual(mockTemplate);
      expect(mockEq).toHaveBeenCalledWith('id', 'template-1');
    });

    it('should return null when template not found (PGRST116)', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      } as any);

      const result = await SalesTemplateService.getTemplateById('invalid-id');
      expect(result).toBeNull();
    });
  });

  describe('createTemplate', () => {
    it('should create a new template', async () => {
      const newTemplate = {
        name: 'New Template',
        category: 'initial_outreach' as TemplateCategory,
        subject_template: 'Hi',
        body_template: 'Body',
        tone: 'professional',
        user_id: mockUser.id,
      };

      const mockInsert = vi.fn().mockReturnThis();
      const mockSelect = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({
        data: { ...mockTemplate, ...newTemplate },
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
        select: mockSelect,
        single: mockSingle,
      } as any);

      const result = await SalesTemplateService.createTemplate(newTemplate as any);

      expect(result).toEqual({ ...mockTemplate, ...newTemplate });
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        ...newTemplate,
        user_id: mockUser.id
      }));
    });
  });

  describe('personalizeTemplate', () => {
    const mockContext: TemplateContext = {
      contact: {
        id: 'c-1',
        first_name: 'John',
        last_name: 'Doe',
        full_name: 'John Doe',
        email: 'john@example.com',
        company_name: 'Acme Inc',
      },
      deal: {
        id: 'd-1',
        name: 'Big Deal',
        value: 10000,
        stage: 'negotiation',
        probability: 80,
      }
    };

    it('should replace variables correctly', async () => {
      // Mock getTemplateById
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockTemplate,
        error: null,
      });
      
      // Mock usage increment
      vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any);

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      } as any);

      const result = await SalesTemplateService.personalizeTemplate('template-1', mockContext, { skipAI: true });

      expect(result.subject).toBe('Hello John Doe');
      expect(result.body).toBe('Hi John Doe, regarding Big Deal');
      expect(result.variables_used.contact_name).toBe('John Doe');
      expect(result.variables_used.deal_name).toBe('Big Deal');
    });

    it('should use AI to personalize when requested', async () => {
      // Mock getTemplateById
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockTemplate,
        error: null,
      });
      
      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      } as any);

      // Mock AI response
      vi.mocked(CopilotService.sendMessage).mockResolvedValue({
        response: {
          content: 'SUBJECT: Enhanced Subject\n\nEnhanced Body Content',
          role: 'assistant'
        }
      } as any);

      const result = await SalesTemplateService.personalizeTemplate('template-1', mockContext, { skipAI: false });

      expect(CopilotService.sendMessage).toHaveBeenCalled();
      expect(result.subject).toBe('Enhanced Subject');
      expect(result.body).toBe('Enhanced Body Content');
      expect(result.ai_personalized).toBe(true);
    });

    it('should fall back to basic template if AI fails', async () => {
       // Mock getTemplateById
       const mockSelect = vi.fn().mockReturnThis();
       const mockEq = vi.fn().mockReturnThis();
       const mockSingle = vi.fn().mockResolvedValue({
         data: mockTemplate,
         error: null,
       });
       
       vi.mocked(supabase.from).mockReturnValue({
         select: mockSelect,
         eq: mockEq,
         single: mockSingle,
       } as any);
 
       // Mock AI failure
       vi.mocked(CopilotService.sendMessage).mockRejectedValue(new Error('AI Error'));
 
       const result = await SalesTemplateService.personalizeTemplate('template-1', mockContext, { skipAI: false });
 
       expect(result.subject).toBe('Hello John Doe'); // Original template
       expect(result.ai_personalized).toBe(false);
    });
  });
});































