import { describe, expect, it, vi } from 'vitest';
import { createHash, createHmac } from 'crypto';

// Simplified version of the webhook signature verification logic for testing
function verifyHubSpotSignatureV3(
  clientSecret: string,
  method: string,
  originalUrl: string,
  rawBody: string,
  signatureV3: string,
  requestTimestamp: string
): boolean {
  // Replay protection: timestamp must be within 5 minutes
  const ts = Number(requestTimestamp);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > 300) {
    return false;
  }

  // V3 signature: HMAC SHA256 Base64
  const sourceString = `${method}${originalUrl}${rawBody}${requestTimestamp}`;
  const computed = createHmac('sha256', clientSecret).update(sourceString).digest('base64');

  return computed === signatureV3;
}

function verifyHubSpotSignatureV2(
  clientSecret: string,
  method: string,
  originalUrl: string,
  rawBody: string,
  signatureV2: string
): boolean {
  // V2 signature: SHA256 Hex
  const sourceString = `${clientSecret}${rawBody}`;
  const computed = createHash('sha256').update(sourceString).digest('hex');

  return computed.toLowerCase() === signatureV2.toLowerCase();
}

function verifyHubSpotSignatureV1(
  clientSecret: string,
  rawBody: string,
  signatureV1: string
): boolean {
  // V1 signature: SHA256 Hex
  const sourceString = `${clientSecret}${rawBody}`;
  const computed = createHash('sha256').update(sourceString).digest('hex');

  return computed.toLowerCase() === signatureV1.toLowerCase();
}

describe('HubSpot Webhook Signature Verification', () => {
  const clientSecret = 'test-secret-key';
  const method = 'POST';
  const originalUrl = 'https://example.com/api/webhooks/hubspot?token=abc123';
  const rawBody = JSON.stringify({ events: [{ eventId: '123', subscriptionType: 'contact.created' }] });
  const requestTimestamp = Math.floor(Date.now() / 1000).toString();

  describe('V3 Signature (HMAC SHA256 Base64)', () => {
    it('should verify valid V3 signature', () => {
      const sourceString = `${method}${originalUrl}${rawBody}${requestTimestamp}`;
      const validSignature = createHmac('sha256', clientSecret).update(sourceString).digest('base64');

      const isValid = verifyHubSpotSignatureV3(
        clientSecret,
        method,
        originalUrl,
        rawBody,
        validSignature,
        requestTimestamp
      );

      expect(isValid).toBe(true);
    });

    it('should reject invalid V3 signature', () => {
      const invalidSignature = 'invalid-signature';

      const isValid = verifyHubSpotSignatureV3(
        clientSecret,
        method,
        originalUrl,
        rawBody,
        invalidSignature,
        requestTimestamp
      );

      expect(isValid).toBe(false);
    });

    it('should reject expired timestamps (replay protection)', () => {
      const expiredTimestamp = (Math.floor(Date.now() / 1000) - 400).toString(); // 400 seconds ago
      const sourceString = `${method}${originalUrl}${rawBody}${expiredTimestamp}`;
      const signature = createHmac('sha256', clientSecret).update(sourceString).digest('base64');

      const isValid = verifyHubSpotSignatureV3(
        clientSecret,
        method,
        originalUrl,
        rawBody,
        signature,
        expiredTimestamp
      );

      expect(isValid).toBe(false);
    });

    it('should accept recent timestamps within 5 minutes', () => {
      const recentTimestamp = (Math.floor(Date.now() / 1000) - 60).toString(); // 1 minute ago
      const sourceString = `${method}${originalUrl}${rawBody}${recentTimestamp}`;
      const signature = createHmac('sha256', clientSecret).update(sourceString).digest('base64');

      const isValid = verifyHubSpotSignatureV3(
        clientSecret,
        method,
        originalUrl,
        rawBody,
        signature,
        recentTimestamp
      );

      expect(isValid).toBe(true);
    });
  });

  describe('V2 Signature (SHA256 Hex)', () => {
    it('should verify valid V2 signature', () => {
      const validSignature = createHash('sha256').update(`${clientSecret}${rawBody}`).digest('hex');

      const isValid = verifyHubSpotSignatureV2(clientSecret, method, originalUrl, rawBody, validSignature);

      expect(isValid).toBe(true);
    });

    it('should reject invalid V2 signature', () => {
      const invalidSignature = 'invalid-signature';

      const isValid = verifyHubSpotSignatureV2(clientSecret, method, originalUrl, rawBody, invalidSignature);

      expect(isValid).toBe(false);
    });

    it('should handle case-insensitive comparison', () => {
      const validSignature = createHash('sha256').update(`${clientSecret}${rawBody}`).digest('hex').toUpperCase();

      const isValid = verifyHubSpotSignatureV2(clientSecret, method, originalUrl, rawBody, validSignature);

      expect(isValid).toBe(true);
    });
  });

  describe('V1 Signature (SHA256 Hex)', () => {
    it('should verify valid V1 signature', () => {
      const validSignature = createHash('sha256').update(`${clientSecret}${rawBody}`).digest('hex');

      const isValid = verifyHubSpotSignatureV1(clientSecret, rawBody, validSignature);

      expect(isValid).toBe(true);
    });

    it('should reject invalid V1 signature', () => {
      const invalidSignature = 'invalid-signature';

      const isValid = verifyHubSpotSignatureV1(clientSecret, rawBody, invalidSignature);

      expect(isValid).toBe(false);
    });
  });

  describe('Webhook Event Parsing', () => {
    it('should parse webhook event array format', () => {
      const payload = [
        { eventId: '1', subscriptionType: 'contact.created', objectId: '123' },
        { eventId: '2', subscriptionType: 'deal.updated', objectId: '456' },
      ];

      const events = Array.isArray(payload) ? payload : payload?.events && Array.isArray(payload.events) ? payload.events : [];

      expect(events).toHaveLength(2);
      expect(events[0].subscriptionType).toBe('contact.created');
      expect(events[1].subscriptionType).toBe('deal.updated');
    });

    it('should parse webhook events wrapper format', () => {
      const payload = {
        events: [
          { eventId: '1', subscriptionType: 'contact.created', objectId: '123' },
        ],
      };

      const events = Array.isArray(payload) ? payload : payload?.events && Array.isArray(payload.events) ? payload.events : [];

      expect(events).toHaveLength(1);
      expect(events[0].subscriptionType).toBe('contact.created');
    });

    it('should handle empty or invalid payloads', () => {
      const invalidPayloads = [null, undefined, {}, { events: null }, { events: [] }];

      invalidPayloads.forEach((payload) => {
        const events = Array.isArray(payload) ? payload : payload?.events && Array.isArray(payload.events) ? payload.events : [];
        expect(Array.isArray(events)).toBe(true);
      });
    });
  });

  describe('Job Type Mapping', () => {
    it('should map contact webhook events to sync_contact job', () => {
      const eventTypes = ['contact.created', 'contact.updated', 'contact.deleted'];
      const jobTypes = eventTypes.map((et) => {
        const lower = et.toLowerCase();
        if (lower.startsWith('contact.')) return 'sync_contact';
        return null;
      });

      expect(jobTypes).toEqual(['sync_contact', 'sync_contact', 'sync_contact']);
    });

    it('should map deal webhook events to sync_deal job', () => {
      const eventTypes = ['deal.created', 'deal.updated', 'deal.deleted'];
      const jobTypes = eventTypes.map((et) => {
        const lower = et.toLowerCase();
        if (lower.startsWith('deal.')) return 'sync_deal';
        return null;
      });

      expect(jobTypes).toEqual(['sync_deal', 'sync_deal', 'sync_deal']);
    });

    it('should map task webhook events to sync_task job', () => {
      const eventTypes = ['task.created', 'task.updated'];
      const jobTypes = eventTypes.map((et) => {
        const lower = et.toLowerCase();
        if (lower.startsWith('task.')) return 'sync_task';
        return null;
      });

      expect(jobTypes).toEqual(['sync_task', 'sync_task']);
    });
  });
});

