/**
 * Debug Permissions Component
 * Temporary component to debug permission issues
 */

import React from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useUser } from '@/lib/hooks/useUser';
import { useUserPermissions } from '@/contexts/UserPermissionsContext';
import { getUserTypeFromEmail, getCachedInternalDomains } from '@/lib/utils/userTypeUtils';

export function DebugPermissions() {
  const { user } = useAuth();
  const { userData } = useUser();
  const permissions = useUserPermissions();

  return (
    <div className="fixed bottom-4 right-4 bg-gray-900 border border-gray-700 rounded-lg p-4 max-w-md max-h-96 overflow-auto text-xs font-mono z-50">
      <h3 className="text-white font-bold mb-2">🔍 Permission Debug</h3>

      <div className="space-y-2 text-gray-300">
        <div>
          <div className="text-gray-500">Auth User:</div>
          <div className="text-white">{user?.email || 'null'}</div>
        </div>

        <div>
          <div className="text-gray-500">User Data (from useUser):</div>
          <div className="text-white">
            Email: {userData?.email || 'null'}<br/>
            is_admin: {String(userData?.is_admin)}<br/>
            ID: {userData?.id || 'null'}
          </div>
        </div>

        <div>
          <div className="text-gray-500">Cached Internal Domains:</div>
          <div className="text-white">{JSON.stringify(getCachedInternalDomains())}</div>
        </div>

        <div>
          <div className="text-gray-500">Computed User Type:</div>
          <div className="text-white">
            actualUserType: {permissions.userType}<br/>
            effectiveUserType: {permissions.effectiveUserType}<br/>
            isInternal: {String(permissions.isInternal)}<br/>
            isExternal: {String(permissions.isExternal)}
          </div>
        </div>

        <div>
          <div className="text-gray-500">Permission Flags:</div>
          <div className="text-white">
            isAdmin: {String(permissions.isAdmin)}<br/>
            isPlatformAdmin: {String(permissions.isPlatformAdmin)}<br/>
            isOrgAdmin: {String(permissions.isOrgAdmin)}<br/>
            permissionTier: {permissions.permissionTier}
          </div>
        </div>

        <div>
          <div className="text-gray-500">Manual Check:</div>
          <div className="text-white">
            getUserTypeFromEmail('{user?.email}'): {getUserTypeFromEmail(user?.email)}
          </div>
        </div>

        <div className="pt-2 border-t border-gray-700">
          <div className="text-yellow-400 font-bold">
            Should access platform admin?
          </div>
          <div className={permissions.isPlatformAdmin ? 'text-green-400' : 'text-red-400'}>
            {permissions.isPlatformAdmin ? '✅ YES' : '❌ NO'}
          </div>
          {!permissions.isPlatformAdmin && (
            <div className="text-red-400 text-xs mt-1">
              Reason: {!permissions.isInternal && 'Not internal user'}
              {permissions.isInternal && !permissions.isAdmin && 'Not admin (is_admin=false)'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
