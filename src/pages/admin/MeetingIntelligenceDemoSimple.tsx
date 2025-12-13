/**
 * Simple Meeting Intelligence Demo Page
 * Testing CallTypeWorkflowEditor import (not using it, just importing)
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { useOrg } from '@/lib/contexts/OrgContext';
import { useAuth } from '@/lib/contexts/AuthContext';

export default function MeetingIntelligenceDemoSimple() {
  const { org } = useOrg();
  const { user } = useAuth();

  const [importState, setImportState] = React.useState<
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'success'; exportType: string }
    | { status: 'error'; message: string }
  >({ status: 'idle' });

  const testImport = React.useCallback(async () => {
    setImportState({ status: 'loading' });
    try {
      // IMPORTANT:
      // We catch errors here so a failed import doesn't bubble up as an unhandled
      // rejection and trigger the global "chunk error => clear cache => logout" handler.
      const mod = await import('@/components/admin/CallTypeWorkflowEditor');
      const exportType = typeof (mod as any).CallTypeWorkflowEditor;
      setImportState({ status: 'success', exportType });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setImportState({ status: 'error', message });
    }
  }, []);

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Meeting Intelligence Demo</h1>

      <Card>
        <CardHeader>
          <CardTitle>Testing CallTypeWorkflowEditor Import</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm">
            <li>🧪 CallTypeWorkflowEditor (dynamic import test)</li>
            <li>Org: {org?.name || 'loading...'}</li>
            <li>User: {user?.email || 'loading...'}</li>
          </ul>

          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              onClick={testImport}
              disabled={importState.status === 'loading'}
              className="w-fit rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {importState.status === 'loading' ? 'Testing import…' : 'Test import'}
            </button>

            {importState.status === 'idle' && (
              <div className="text-xs text-muted-foreground">
                Click “Test import” to load the module safely (errors are caught locally).
              </div>
            )}

            {importState.status === 'success' && (
              <div className="text-xs text-green-400">
                Import OK — `CallTypeWorkflowEditor` export type: {importState.exportType}
              </div>
            )}

            {importState.status === 'error' && (
              <div className="text-xs text-red-400 whitespace-pre-wrap">
                Import failed: {importState.message}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
