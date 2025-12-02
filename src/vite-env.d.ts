/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
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