/**
 * Debug Permissions Page
 * Shows current user permissions and access levels
 */

import { useAuth } from '@/lib/contexts/AuthContext';
import { useUserPermissions } from '@/contexts/UserPermissionsContext';
import { useUser } from '@/lib/hooks/useUser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, User, Building, CheckCircle, XCircle } from 'lucide-react';

export default function DebugPermissions() {
  const { user } = useAuth();
  const { userData } = useUser();
  const {
    userType,
    isInternal,
    isAdmin,
    isPlatformAdmin,
    isOrgAdmin,
    permissionTier,
    effectiveUserType,
  } = useUserPermissions();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Permission Debug
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Current user permissions and access levels
          </p>
        </div>

        {/* User Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              User Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Email:</span>
              <span className="text-sm">{user?.email || 'Not logged in'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">User ID:</span>
              <span className="text-sm font-mono text-xs">{user?.id || 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">User Type:</span>
              <Badge variant={isInternal ? 'default' : 'secondary'}>
                {userType}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Effective Type:</span>
              <Badge variant="outline">{effectiveUserType}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Permission Flags */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Permission Flags
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Is Internal User:</span>
              <div className="flex items-center gap-2">
                {isInternal ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
                <Badge variant={isInternal ? 'default' : 'secondary'}>
                  {isInternal ? 'Yes' : 'No'}
                </Badge>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Is Admin (is_admin flag):</span>
              <div className="flex items-center gap-2">
                {isAdmin ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
                <Badge variant={isAdmin ? 'default' : 'secondary'}>
                  {isAdmin ? 'Yes' : 'No'}
                </Badge>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Is Platform Admin:</span>
              <div className="flex items-center gap-2">
                {isPlatformAdmin ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
                <Badge variant={isPlatformAdmin ? 'default' : 'destructive'}>
                  {isPlatformAdmin ? 'Yes' : 'No'}
                </Badge>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Is Org Admin:</span>
              <div className="flex items-center gap-2">
                {isOrgAdmin ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-gray-400" />
                )}
                <Badge variant={isOrgAdmin ? 'default' : 'outline'}>
                  {isOrgAdmin ? 'Yes' : 'No'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Permission Tier */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="w-5 h-5" />
              Permission Tier
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Current Tier:</span>
              <Badge
                variant={
                  permissionTier === 'platformAdmin'
                    ? 'default'
                    : permissionTier === 'orgAdmin'
                    ? 'secondary'
                    : 'outline'
                }
                className="text-base px-3 py-1"
              >
                {permissionTier === 'platformAdmin'
                  ? 'Tier 3: Platform Admin'
                  : permissionTier === 'orgAdmin'
                  ? 'Tier 2: Org Admin'
                  : 'Tier 1: User'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Requirements for Platform Admin */}
        {!isPlatformAdmin && (
          <Card className="border-orange-200 bg-orange-50 dark:bg-orange-900/10 dark:border-orange-800">
            <CardHeader>
              <CardTitle className="text-orange-800 dark:text-orange-200">
                Platform Admin Requirements
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-orange-700 dark:text-orange-300">
                To access Platform Admin routes (like /platform/settings), you need:
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {isInternal ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-600" />
                  )}
                  <span className="text-sm">
                    <strong>Internal email domain</strong> (@sixtyseconds.video or configured domain)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-600" />
                  )}
                  <span className="text-sm">
                    <strong>is_admin flag</strong> set to true in profiles table
                  </span>
                </div>
              </div>

              {!isAdmin && isInternal && (
                <div className="mt-4 p-3 bg-white dark:bg-gray-800 rounded border border-orange-200 dark:border-orange-700">
                  <p className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-2">
                    Action Required:
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    Run this SQL in your Supabase SQL editor:
                  </p>
                  <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs overflow-x-auto">
{`UPDATE profiles
SET is_admin = true
WHERE email = '${user?.email}';`}
                  </pre>
                </div>
              )}

              {!isInternal && (
                <div className="mt-4 p-3 bg-white dark:bg-gray-800 rounded border border-orange-200 dark:border-orange-700">
                  <p className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-2">
                    Email Domain Issue:
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    Your email domain is not recognized as internal. Either:
                  </p>
                  <ul className="text-sm text-gray-700 dark:text-gray-300 list-disc list-inside mt-2 space-y-1">
                    <li>Use an @sixtyseconds.video email address</li>
                    <li>Add your domain to the internal_domains table</li>
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Profile Data */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Data (from database)</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-4 rounded overflow-x-auto">
              {JSON.stringify(userData, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
