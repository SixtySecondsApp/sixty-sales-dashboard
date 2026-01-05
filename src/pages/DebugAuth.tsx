import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/clientV2';

export default function DebugAuth() {
  const [authInfo, setAuthInfo] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Get environment variables
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        
        // Get session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        // Get user
        const { data: { user } } = await supabase.auth.getUser();
        
        setAuthInfo({
          env: {
            url: supabaseUrl,
            key: supabaseKey ? `${supabaseKey.substring(0, 50)}...` : 'NOT SET',
          },
          session: session ? {
            user: session.user?.email,
            expires: new Date(session.expires_at! * 1000).toLocaleString(),
            hasToken: !!session.access_token
          } : null,
          user: user?.email || null,
          error: error?.message || null,
          localStorage: {
            hasAuthToken: !!localStorage.getItem('sb-dzypskjhoupsdwfsrkeo-auth-token'),
            keys: Object.keys(localStorage).filter(k => k.includes('sb-') || k.includes('supabase'))
          }
        });
      } catch (err) {
        setAuthInfo({ error: err instanceof Error ? err.message : 'Unknown error' });
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', background: '#000', color: '#0f0' }}>
      <h1>Debug Auth Info</h1>
      <pre>{JSON.stringify(authInfo, null, 2)}</pre>
      
      <button 
        onClick={() => window.location.reload()} 
        style={{ marginTop: '20px', padding: '10px', background: '#333', color: '#fff', cursor: 'pointer' }}
      >
        Reload Page
      </button>
      
      <button 
        onClick={async () => {
          const keysToRemove = Object.keys(localStorage).filter(k => 
            k.includes('sb-') || k.includes('supabase') || k.includes('auth')
          );
          keysToRemove.forEach(k => localStorage.removeItem(k));
          window.location.reload();
        }} 
        style={{ marginLeft: '10px', marginTop: '20px', padding: '10px', background: '#f00', color: '#fff', cursor: 'pointer' }}
      >
        Clear All Auth & Reload
      </button>
    </div>
  );
}