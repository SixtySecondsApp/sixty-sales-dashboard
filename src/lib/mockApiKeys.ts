// Mock API Key System for Testing
// This allows the API testing interface to work without database setup

interface MockApiKey {
  id: string;
  name: string;
  key_preview: string;
  full_key: string;
  permissions: string[];
  rate_limit: number;
  usage_count: number;
  created_at: Date;
  expires_at: Date | null;
  is_active: boolean;
  last_used: Date | null;
}

// Store mock keys in localStorage
const MOCK_KEYS_STORAGE_KEY = 'sixty_mock_api_keys';

export const mockApiKeyService = {
  // Get all keys for current user
  getAllKeys: (): MockApiKey[] => {
    try {
      const stored = localStorage.getItem(MOCK_KEYS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  },

  // Create a new API key
  createKey: (name: string, permissions: string[], rateLimit: number, expiresInDays: number | null): MockApiKey => {
    const keys = mockApiKeyService.getAllKeys();
    
    // Generate a realistic-looking API key
    const keyId = crypto.randomUUID();
    const apiKey = `sk_test_${crypto.randomUUID().replace(/-/g, '')}`;
    const keyPreview = `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`;
    
    const newKey: MockApiKey = {
      id: keyId,
      name,
      key_preview: keyPreview,
      full_key: apiKey,
      permissions,
      rate_limit: rateLimit,
      usage_count: 0,
      created_at: new Date(),
      expires_at: expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : null,
      is_active: true,
      last_used: null
    };
    
    // Add to storage
    keys.push(newKey);
    localStorage.setItem(MOCK_KEYS_STORAGE_KEY, JSON.stringify(keys));
    
    return newKey;
  },

  // Delete a key
  deleteKey: (keyId: string): boolean => {
    try {
      const keys = mockApiKeyService.getAllKeys();
      const filtered = keys.filter(k => k.id !== keyId);
      localStorage.setItem(MOCK_KEYS_STORAGE_KEY, JSON.stringify(filtered));
      return true;
    } catch {
      return false;
    }
  },

  // Update key usage
  updateUsage: (keyId: string): void => {
    const keys = mockApiKeyService.getAllKeys();
    const key = keys.find(k => k.id === keyId);
    if (key) {
      key.usage_count++;
      key.last_used = new Date();
      localStorage.setItem(MOCK_KEYS_STORAGE_KEY, JSON.stringify(keys));
    }
  },

  // Validate an API key
  validateKey: (apiKey: string): boolean => {
    const keys = mockApiKeyService.getAllKeys();
    return keys.some(k => k.full_key === apiKey && k.is_active);
  },

  // Get key by API key string
  getKeyByApiKey: (apiKey: string): MockApiKey | null => {
    const keys = mockApiKeyService.getAllKeys();
    return keys.find(k => k.full_key === apiKey) || null;
  }
};

// Create some sample keys on first load
export const initializeMockKeys = () => {
  const existingKeys = mockApiKeyService.getAllKeys();
  
  if (existingKeys.length === 0) {
    // Create a sample key with full permissions
    mockApiKeyService.createKey(
      'Development Key',
      [
        'contacts:read', 'contacts:write', 'contacts:delete',
        'companies:read', 'companies:write', 'companies:delete',
        'deals:read', 'deals:write', 'deals:delete',
        'tasks:read', 'tasks:write', 'tasks:delete',
        'meetings:read', 'meetings:write', 'meetings:delete',
        'activities:read', 'activities:write', 'activities:delete',
        'analytics:read'
      ],
      1000,
      90
    );
    
    // Create a read-only key
    mockApiKeyService.createKey(
      'Read-Only Key',
      [
        'contacts:read',
        'companies:read',
        'deals:read',
        'tasks:read',
        'meetings:read',
        'activities:read',
        'analytics:read'
      ],
      500,
      30
    );
  }
};