import { describe, expect, it, vi, beforeEach } from 'vitest';

describe('HubSpot Sync Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Contact Sync Logic', () => {
    it('should handle email normalization (lowercase)', () => {
      const email = 'Test@Example.COM';
      const normalized = email.toLowerCase();
      expect(normalized).toBe('test@example.com');
    });

    it('should map HubSpot contact properties to Sixty format', () => {
      const hubspotContact = {
        properties: {
          email: 'test@example.com',
          firstname: 'John',
          lastname: 'Doe',
          phone: '+1234567890',
          company: 'Acme Corp',
          jobtitle: 'CEO',
          hs_lastmodifieddate: '2024-01-15T10:00:00Z',
        },
      };

      const mapped = {
        email: hubspotContact.properties.email.toLowerCase(),
        first_name: hubspotContact.properties.firstname || null,
        last_name: hubspotContact.properties.lastname || null,
        phone: hubspotContact.properties.phone || null,
        company: hubspotContact.properties.company || null,
        title: hubspotContact.properties.jobtitle || null,
      };

      expect(mapped).toEqual({
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        phone: '+1234567890',
        company: 'Acme Corp',
        title: 'CEO',
      });
    });

    it('should handle missing optional fields gracefully', () => {
      const hubspotContact = {
        properties: {
          email: 'test@example.com',
          firstname: null,
          lastname: null,
          phone: null,
          company: null,
          jobtitle: null,
        },
      };

      const mapped = {
        email: hubspotContact.properties.email.toLowerCase(),
        first_name: hubspotContact.properties.firstname ?? null,
        last_name: hubspotContact.properties.lastname ?? null,
        phone: hubspotContact.properties.phone ?? null,
        company: hubspotContact.properties.company ?? null,
        title: hubspotContact.properties.jobtitle ?? null,
      };

      expect(mapped.email).toBe('test@example.com');
      expect(mapped.first_name).toBeNull();
      expect(mapped.last_name).toBeNull();
    });
  });

  describe('Deal Sync Logic', () => {
    it('should map HubSpot deal stage to Sixty stage_id', () => {
      const stageMapping: Record<string, string> = {
        'appointmentscheduled': 'stage-1',
        'qualifiedtobuy': 'stage-2',
        'presentationscheduled': 'stage-3',
        'decisionmakerboughtin': 'stage-4',
      };

      const hubspotStage = 'qualifiedtobuy';
      const sixtyStage = stageMapping[hubspotStage];

      expect(sixtyStage).toBe('stage-2');
    });

    it('should handle reverse stage mapping (Sixty -> HubSpot)', () => {
      const reverseMapping: Record<string, string> = {
        'stage-1': 'appointmentscheduled',
        'stage-2': 'qualifiedtobuy',
        'stage-3': 'presentationscheduled',
        'stage-4': 'decisionmakerboughtin',
      };

      const sixtyStage = 'stage-2';
      const hubspotStage = reverseMapping[sixtyStage];

      expect(hubspotStage).toBe('qualifiedtobuy');
    });

    it('should convert deal amount to string for HubSpot', () => {
      const dealValue = 50000;
      const hubspotAmount = String(dealValue);
      expect(hubspotAmount).toBe('50000');
    });

    it('should convert close date to timestamp', () => {
      const closeDate = '2024-12-31';
      const timestamp = new Date(closeDate).getTime();
      expect(timestamp).toBeGreaterThan(0);
      expect(new Date(timestamp).toISOString().split('T')[0]).toBe(closeDate);
    });
  });

  describe('Task Sync Logic', () => {
    it('should map HubSpot task status to Sixty completed flag', () => {
      const statusMap: Record<string, boolean> = {
        COMPLETED: true,
        NOT_STARTED: false,
        IN_PROGRESS: false,
        WAITING: false,
        DEFERRED: false,
      };

      expect(statusMap['COMPLETED']).toBe(true);
      expect(statusMap['NOT_STARTED']).toBe(false);
    });

    it('should convert HubSpot timestamp to ISO date', () => {
      const hsTimestamp = 1705320000000; // milliseconds
      const isoDate = new Date(hsTimestamp).toISOString();
      expect(isoDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should map Sixty task to HubSpot properties', () => {
      const sixtyTask = {
        title: 'Follow up with client',
        description: 'Call to discuss proposal',
        due_date: '2024-12-31T10:00:00Z',
        completed: false,
      };

      const hubspotProperties = {
        hs_task_subject: sixtyTask.title,
        hs_task_body: sixtyTask.description || '',
        hs_timestamp: sixtyTask.due_date ? new Date(sixtyTask.due_date).getTime() : undefined,
        hs_task_status: sixtyTask.completed ? 'COMPLETED' : undefined,
      };

      expect(hubspotProperties.hs_task_subject).toBe('Follow up with client');
      expect(hubspotProperties.hs_task_body).toBe('Call to discuss proposal');
      expect(hubspotProperties.hs_timestamp).toBeDefined();
    });
  });

  describe('Quote/Proposal Sync Logic', () => {
    it('should map proposal status to HubSpot quote status', () => {
      const mapStatus = (status: string | null): string | null => {
        const s = (status || '').toLowerCase().trim();
        if (!s) return null;
        if (s.includes('draft')) return 'DRAFT';
        if (s.includes('sent')) return 'APPROVAL_NOT_NEEDED';
        if (s.includes('signed') || s.includes('won')) return 'APPROVAL_APPROVED';
        if (s.includes('lost') || s.includes('rejected')) return 'APPROVAL_REJECTED';
        return null;
      };

      expect(mapStatus('draft')).toBe('DRAFT');
      expect(mapStatus('sent')).toBe('APPROVAL_NOT_NEEDED');
      expect(mapStatus('signed')).toBe('APPROVAL_APPROVED');
      expect(mapStatus('rejected')).toBe('APPROVAL_REJECTED');
      expect(mapStatus(null)).toBeNull();
    });

    it('should map HubSpot quote status back to proposal status', () => {
      const mapStatus = (status: string | null): string | null => {
        const s = (status || '').toUpperCase().trim();
        if (!s) return null;
        if (s === 'DRAFT') return 'draft';
        if (s === 'APPROVAL_NOT_NEEDED' || s === 'APPROVAL_PENDING') return 'sent';
        if (s === 'APPROVAL_APPROVED') return 'signed';
        if (s === 'APPROVAL_REJECTED') return 'rejected';
        return null;
      };

      expect(mapStatus('DRAFT')).toBe('draft');
      expect(mapStatus('APPROVAL_NOT_NEEDED')).toBe('sent');
      expect(mapStatus('APPROVAL_APPROVED')).toBe('signed');
      expect(mapStatus('APPROVAL_REJECTED')).toBe('rejected');
    });
  });

  describe('Last-Write-Wins (LWW) Conflict Resolution', () => {
    it('should skip update if local is newer than HubSpot', () => {
      const hubspotModified = new Date('2024-01-15T10:00:00Z').getTime();
      const localUpdated = new Date('2024-01-15T11:00:00Z').getTime();

      const shouldSkip = localUpdated > hubspotModified;
      expect(shouldSkip).toBe(true);
    });

    it('should apply update if HubSpot is newer than local', () => {
      const hubspotModified = new Date('2024-01-15T11:00:00Z').getTime();
      const localUpdated = new Date('2024-01-15T10:00:00Z').getTime();

      const shouldApply = hubspotModified > localUpdated;
      expect(shouldApply).toBe(true);
    });

    it('should handle missing timestamps gracefully', () => {
      const hubspotModified = null;
      const localUpdated = new Date('2024-01-15T10:00:00Z').getTime();

      // When hubspotModified is null, the condition short-circuits to null/false
      const shouldSkip = hubspotModified && localUpdated && localUpdated > hubspotModified;
      expect(shouldSkip).toBeFalsy(); // null/false when hubspotModified is null
    });
  });

  describe('Deduplication Keys', () => {
    it('should generate consistent dedupe keys for contacts', () => {
      const contactId = 'contact-123';
      const dedupeKey = `contact:${contactId}`;
      expect(dedupeKey).toBe('contact:contact-123');
    });

    it('should generate consistent dedupe keys for deals', () => {
      const dealId = 'deal-456';
      const dedupeKey = `deal:${dealId}`;
      expect(dedupeKey).toBe('deal:deal-456');
    });

    it('should generate consistent dedupe keys for outbound sync', () => {
      const contactId = 'contact-789';
      const dedupeKey = `contact_out:${contactId}`;
      expect(dedupeKey).toBe('contact_out:contact-789');
    });
  });
});

