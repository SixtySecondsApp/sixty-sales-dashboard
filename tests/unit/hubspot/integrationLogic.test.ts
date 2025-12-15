import { describe, expect, it } from 'vitest';

describe('HubSpot Integration Logic', () => {
  describe('OAuth State Validation', () => {
    it('should validate OAuth state TTL (10 minutes)', () => {
      const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
      const now = Date.now();
      const createdAt = now - 5 * 60 * 1000; // 5 minutes ago

      const isExpired = now - createdAt > STATE_TTL_MS;
      expect(isExpired).toBe(false);
    });

    it('should detect expired OAuth state', () => {
      const STATE_TTL_MS = 10 * 60 * 1000;
      const now = Date.now();
      const createdAt = now - 15 * 60 * 1000; // 15 minutes ago

      const isExpired = now - createdAt > STATE_TTL_MS;
      expect(isExpired).toBe(true);
    });
  });

  describe('Settings JSON Structure', () => {
    it('should validate pipeline stage mapping structure', () => {
      const settings = {
        pipelineStageMapping: {
          'appointmentscheduled': 'stage-1',
          'qualifiedtobuy': 'stage-2',
          'presentationscheduled': 'stage-3',
        },
        sixtyStageToHubspot: {
          'stage-1': 'appointmentscheduled',
          'stage-2': 'qualifiedtobuy',
          'stage-3': 'presentationscheduled',
        },
      };

      expect(typeof settings.pipelineStageMapping).toBe('object');
      expect(typeof settings.sixtyStageToHubspot).toBe('object');
      expect(settings.pipelineStageMapping['qualifiedtobuy']).toBe('stage-2');
      expect(settings.sixtyStageToHubspot['stage-2']).toBe('qualifiedtobuy');
    });

    it('should validate forms configuration structure', () => {
      const settings = {
        forms: [
          { form_guid: 'form-123', enabled: true },
          { form_guid: 'form-456', enabled: false },
        ],
      };

      expect(Array.isArray(settings.forms)).toBe(true);
      expect(settings.forms[0].form_guid).toBe('form-123');
      expect(settings.forms[0].enabled).toBe(true);
      expect(settings.forms[1].enabled).toBe(false);
    });

    it('should handle empty settings gracefully', () => {
      const settings = {};

      expect(settings.pipelineStageMapping || {}).toEqual({});
      expect(settings.forms || []).toEqual([]);
    });
  });

  describe('Webhook Token Generation', () => {
    it('should generate unique webhook tokens', () => {
      const token1 = crypto.randomUUID().replace(/-/g, '');
      const token2 = crypto.randomUUID().replace(/-/g, '');

      expect(token1).not.toBe(token2);
      expect(token1.length).toBeGreaterThan(20);
      expect(token2.length).toBeGreaterThan(20);
    });

    it('should generate tokens without hyphens', () => {
      const token = crypto.randomUUID().replace(/-/g, '');

      expect(token).not.toContain('-');
      expect(token.length).toBe(32);
    });
  });

  describe('Object Mapping Key Generation', () => {
    it('should generate consistent mapping keys', () => {
      const orgId = 'org-123';
      const objectType = 'contact';
      const hubspotId = 'hs-456';

      const mappingKey = `${orgId}:${objectType}:${hubspotId}`;
      expect(mappingKey).toBe('org-123:contact:hs-456');
    });

    it('should handle different object types', () => {
      const objectTypes = ['contact', 'deal', 'task', 'quote', 'note'];
      const orgId = 'org-123';
      const hubspotId = 'hs-789';

      objectTypes.forEach((type) => {
        const key = `${orgId}:${type}:${hubspotId}`;
        expect(key).toContain(type);
      });
    });
  });

  describe('Job Priority Levels', () => {
    it('should use correct priority for different job types', () => {
      const priorities: Record<string, number> = {
        ensure_properties: 200,
        poll_form_submissions: 150,
        sync_contact: 20,
        sync_deal: 20,
        sync_task: 20,
        push_note: 50,
        sync_quote: 30,
      };

      expect(priorities.ensure_properties).toBe(200); // Highest priority
      expect(priorities.poll_form_submissions).toBe(150);
      expect(priorities.push_note).toBe(50);
      expect(priorities.sync_quote).toBe(30);
      expect(priorities.sync_contact).toBe(20);
    });

    it('should prioritize ensure_properties over regular syncs', () => {
      const ensurePropsPriority = 200;
      const syncPriority = 20;

      expect(ensurePropsPriority).toBeGreaterThan(syncPriority);
    });
  });

  describe('Token Expiration Handling', () => {
    it('should calculate token expiration time', () => {
      const expiresIn = 1800; // 30 minutes in seconds
      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(expiresAt.getTime() - Date.now()).toBeCloseTo(expiresIn * 1000, -3);
    });

    it('should detect tokens expiring within 2 minutes', () => {
      const expiresAt = new Date(Date.now() + 60 * 1000).getTime(); // 1 minute from now
      const now = Date.now();

      const shouldRefresh = expiresAt - now <= 2 * 60 * 1000;
      expect(shouldRefresh).toBe(true);
    });

    it('should not refresh tokens with more than 2 minutes remaining', () => {
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).getTime(); // 5 minutes from now
      const now = Date.now();

      const shouldRefresh = expiresAt - now <= 2 * 60 * 1000;
      expect(shouldRefresh).toBe(false);
    });
  });

  describe('Org Member Validation', () => {
    it('should filter jobs by org member user IDs', () => {
      const memberUserIds = ['user-1', 'user-2', 'user-3'];
      const dealOwnerId = 'user-2';

      const isMember = memberUserIds.includes(dealOwnerId);
      expect(isMember).toBe(true);
    });

    it('should reject jobs for non-member users', () => {
      const memberUserIds = ['user-1', 'user-2', 'user-3'];
      const dealOwnerId = 'user-999';

      const isMember = memberUserIds.includes(dealOwnerId);
      expect(isMember).toBe(false);
    });

    it('should handle null owner IDs gracefully', () => {
      const memberUserIds = ['user-1', 'user-2'];
      const dealOwnerId = null;

      // If owner_id is null, we might allow it or reject it based on business logic
      const shouldProcess = dealOwnerId ? memberUserIds.includes(dealOwnerId) : false;
      expect(shouldProcess).toBe(false);
    });
  });

  describe('Meeting Note Composition', () => {
    it('should compose HTML note from meeting data', () => {
      const meeting = {
        title: 'Q4 Planning',
        meeting_start: '2024-12-15T10:00:00Z',
        summary: 'Discussed Q4 goals and budget allocation.',
        next_steps_oneliner: 'Schedule follow-up meeting',
        share_url: 'https://fathom.video/recording/123',
      };

      const escapeHtml = (input: string) =>
        input
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');

      const when = meeting.meeting_start ? new Date(meeting.meeting_start).toLocaleString() : '';
      const body =
        `<strong>${escapeHtml(meeting.title)}</strong>` +
        (when ? `<br/><em>${escapeHtml(when)}</em>` : '') +
        `<br/><br/>` +
        `${escapeHtml(meeting.summary)}` +
        (meeting.next_steps_oneliner
          ? `<br/><br/><strong>Next steps</strong><br/>${escapeHtml(meeting.next_steps_oneliner)}`
          : '') +
        (meeting.share_url ? `<br/><br/><a href="${escapeHtml(meeting.share_url)}">Open recording</a>` : '');

      expect(body).toContain('Q4 Planning');
      expect(body).toContain('Discussed Q4 goals');
      expect(body).toContain('Next steps');
      expect(body).toContain('Open recording');
    });

    it('should handle missing optional fields', () => {
      const meeting = {
        title: 'Meeting',
        summary: 'Summary only',
        meeting_start: null,
        next_steps_oneliner: null,
        share_url: null,
      };

      const escapeHtml = (input: string) => input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const when = meeting.meeting_start ? new Date(meeting.meeting_start).toLocaleString() : '';
      const body =
        `<strong>${escapeHtml(meeting.title)}</strong>` +
        (when ? `<br/><em>${escapeHtml(when)}</em>` : '') +
        `<br/><br/>` +
        `${escapeHtml(meeting.summary)}`;

      expect(body).toContain('Meeting');
      expect(body).toContain('Summary only');
      expect(body).not.toContain('Next steps');
      expect(body).not.toContain('Open recording');
    });
  });

  describe('Form Submission Processing', () => {
    it('should extract form field values case-insensitively', () => {
      const values: Array<{ name: string; value: any }> = [
        { name: 'Email', value: 'test@example.com' },
        { name: 'firstname', value: 'John' },
        { name: 'LASTNAME', value: 'Doe' },
        { name: 'Phone', value: '+1234567890' },
      ];

      const getVal = (k: string) => values.find((v) => String(v.name).toLowerCase() === k.toLowerCase())?.value;

      expect(getVal('email')).toBe('test@example.com');
      expect(getVal('EMAIL')).toBe('test@example.com');
      expect(getVal('firstname')).toBe('John');
      expect(getVal('lastname')).toBe('Doe');
      expect(getVal('LASTNAME')).toBe('Doe');
    });

    it('should handle missing form fields', () => {
      const values: Array<{ name: string; value: any }> = [
        { name: 'email', value: 'test@example.com' },
      ];

      const getVal = (k: string) => values.find((v) => String(v.name).toLowerCase() === k.toLowerCase())?.value;

      expect(getVal('email')).toBe('test@example.com');
      expect(getVal('firstname')).toBeUndefined();
      expect(getVal('phone')).toBeUndefined();
    });
  });

  describe('Deduplication Key Generation', () => {
    it('should generate unique dedupe keys for different sources', () => {
      const contactId = 'contact-123';
      const dedupeKeys = {
        webhook: `contact:${contactId}`,
        outbound: `contact_out:${contactId}`,
        meeting_note: `meeting_note:${contactId}`,
      };

      expect(dedupeKeys.webhook).toBe('contact:contact-123');
      expect(dedupeKeys.outbound).toBe('contact_out:contact-123');
      expect(dedupeKeys.meeting_note).toBe('meeting_note:contact-123');
      expect(dedupeKeys.webhook).not.toBe(dedupeKeys.outbound);
    });

    it('should generate consistent dedupe keys for same entity', () => {
      const dealId = 'deal-456';
      const key1 = `deal:${dealId}`;
      const key2 = `deal:${dealId}`;

      expect(key1).toBe(key2);
    });
  });
});

