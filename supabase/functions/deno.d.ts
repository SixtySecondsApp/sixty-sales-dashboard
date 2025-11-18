/// <reference types="https://deno.land/x/types/index.d.ts" />

// Deno global type declarations for Supabase Edge Functions
// These declarations allow TypeScript to recognize Deno globals and modules
// even though the IDE doesn't have Deno runtime types installed.

declare namespace Deno {
  interface Env {
    get(key: string): string | undefined;
  }
  
  const env: Env;
}

// Declare Deno module imports as valid
declare module 'https://deno.land/std@0.168.0/http/server.ts' {
  export function serve(handler: (req: Request) => Response | Promise<Response>): void;
}

declare module 'https://esm.sh/@supabase/supabase-js@2' {
  export function createClient(url: string, key: string, options?: any): any;
}

