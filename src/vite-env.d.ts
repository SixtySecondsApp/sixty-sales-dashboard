/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  // Non-prefixed versions for Vercel deployments
  readonly SUPABASE_URL?: string;
  readonly SUPABASE_ANON_KEY?: string;
  readonly SUPABASE_SERVICE_ROLE_KEY?: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
  // add more env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Service Worker window extensions
declare global {
  interface Window {
    swRegistration?: ServiceWorkerRegistration;
    clearSWCache?: () => void;
    clearApiCache?: () => void;
    detectAndResolveCacheConflicts?: () => void;
  }
} 