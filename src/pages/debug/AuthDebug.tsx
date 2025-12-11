/**
 * Auth Debug Page
 * Helps debug authentication and permission issues
 */

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useUserPermissions } from '@/contexts/UserPermissionsContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase/clientV2';

export default function AuthDebug() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const {
    effectiveUserType,
    isAdmin,
    isPlatformAdmin,
    isOrgAdmin,
  } = useUserPermissions();
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error) throw error;
        setProfileData(data);
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [user]);

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Auth Debug</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Authentication Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <strong>Is Authenticated:</strong>{' '}
              <span className={isAuthenticated ? 'text-green-600' : 'text-red-600'}>
                {isAuthenticated ? '✅ Yes' : '❌ No'}
              </span>
            </div>
            <div>
              <strong>Auth Loading:</strong> {authLoading ? '⏳ Loading...' : '✅ Complete'}
            </div>
            {user && (
              <>
                <div>
                  <strong>User ID:</strong> {user.id}
                </div>
                <div>
                  <strong>Email:</strong> {user.email}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Profile Data</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div>Loading profile...</div>
            ) : profileData ? (
              <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-4 rounded overflow-auto">
                {JSON.stringify(profileData, null, 2)}
              </pre>
            ) : (
              <div className="text-red-600">No profile data found</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Permissions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <strong>User Type:</strong> {effectiveUserType || 'Unknown'}
            </div>
            <div>
              <strong>Is Admin:</strong>{' '}
              <span className={isAdmin ? 'text-green-600' : 'text-red-600'}>
                {isAdmin ? '✅ Yes' : '❌ No'}
              </span>
            </div>
            <div>
              <strong>Is Platform Admin:</strong>{' '}
              <span className={isPlatformAdmin ? 'text-green-600' : 'text-red-600'}>
                {isPlatformAdmin ? '✅ Yes' : '❌ No'}
              </span>
            </div>
            <div>
              <strong>Is Org Admin:</strong>{' '}
              <span className={isOrgAdmin ? 'text-green-600' : 'text-red-600'}>
                {isOrgAdmin ? '✅ Yes' : '❌ No'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Platform Admin Access</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <strong>Can Access /platform/email-templates:</strong>{' '}
                <span
                  className={
                    isPlatformAdmin && isAuthenticated
                      ? 'text-green-600'
                      : 'text-red-600'
                  }
                >
                  {isPlatformAdmin && isAuthenticated ? '✅ Yes' : '❌ No'}
                </span>
              </div>
              {!isAuthenticated && (
                <div className="text-yellow-600 text-sm">
                  ⚠️ You need to be authenticated first
                </div>
              )}
              {isAuthenticated && !isPlatformAdmin && (
                <div className="text-yellow-600 text-sm">
                  ⚠️ You need to be a platform admin (internal user with is_admin = true)
                </div>
              )}
              {isAuthenticated && effectiveUserType !== 'internal' && (
                <div className="text-yellow-600 text-sm">
                  ⚠️ You need to be an internal user (not external)
                </div>
              )}
              {isAuthenticated && !isAdmin && (
                <div className="text-yellow-600 text-sm">
                  ⚠️ Your profile needs is_admin = true
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-x-2">
          <Button
            onClick={() => {
              window.location.href = '/platform/email-templates';
            }}
            disabled={!isPlatformAdmin || !isAuthenticated}
          >
            Try Access Email Templates
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              const { data, error } = await supabase.auth.getSession();
              console.log('Current session:', data);
              alert('Check console for session data');
            }}
          >
            Check Session
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
