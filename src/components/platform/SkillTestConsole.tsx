/**
 * SkillTestConsole
 *
 * Admin console to run a skill through api-copilot test endpoint and inspect
 * tool executions + output.
 */

import { useEffect, useMemo, useState } from 'react';
import { Play, Loader2, TerminalSquare, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { API_BASE_URL } from '@/lib/config';
import { getSupabaseHeaders } from '@/lib/utils/apiUtils';
import { useOrgStore } from '@/lib/stores/orgStore';
import { useAuth } from '@/lib/contexts/AuthContext';
import { ContactTestModeSelector, type ContactTestMode } from './ContactTestModeSelector';
import { TestContactList } from './TestContactList';
import { TestContactSearch } from './TestContactSearch';
import { useTestContacts, type TestContact } from '@/lib/hooks/useTestContacts';
import { type ContactQualityTier } from '@/lib/utils/contactQualityScoring';

type TestMode = 'readonly' | 'mock';

interface ToolExecutionDetail {
  toolName: string;
  startTime?: string;
  endTime?: string;
  durationMs?: number;
  success: boolean;
  error?: string;
  args?: unknown;
  resultSummary?: string;
  resultSize?: number;
  metadata?: Record<string, unknown>;
}

interface TestSkillResponse {
  success: boolean;
  skill_key: string;
  output: string;
  tools_used: string[];
  tool_iterations: number;
  tool_executions: ToolExecutionDetail[];
  usage?: { input_tokens: number; output_tokens: number };
  error?: string;
}

export function SkillTestConsole({ skillKey }: { skillKey: string }) {
  const { activeOrgId, loadOrganizations, isLoading } = useOrgStore();
  const { user } = useAuth();

  const [testInput, setTestInput] = useState('Run this skill for a call prep briefing.');
  const [mode, setMode] = useState<TestMode>('readonly');
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<TestSkillResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Contact testing states
  const [contactMode, setContactMode] = useState<ContactTestMode>('none');
  const [selectedContact, setSelectedContact] = useState<TestContact | null>(null);
  const [showContactSection, setShowContactSection] = useState(false);

  // Fetch contacts based on quality tier (only for good/average/bad modes)
  const tierMode = contactMode !== 'none' && contactMode !== 'custom' ? contactMode : null;
  const { contacts, isLoading: isLoadingContacts } = useTestContacts({
    mode: (tierMode || 'good') as ContactQualityTier,
    enabled: !!tierMode && !!user?.id,
    limit: 10,
  });

  // Reset selected contact when mode changes
  const handleContactModeChange = (newMode: ContactTestMode) => {
    setContactMode(newMode);
    setSelectedContact(null);
    setShowContactSection(newMode !== 'none');
  };

  useEffect(() => {
    // Ensure we have an org loaded for authenticated admins
    if (!activeOrgId && !isLoading) {
      loadOrganizations().catch(() => {});
    }
  }, [activeOrgId, isLoading, loadOrganizations]);

  const canRun = useMemo(() => {
    const hasSkill = !!skillKey && !!activeOrgId && !isRunning;
    // If contact mode requires a selection, ensure one is selected
    if (contactMode !== 'none' && !selectedContact) {
      return false;
    }
    return hasSkill;
  }, [skillKey, activeOrgId, isRunning, contactMode, selectedContact]);

  const handleRun = async () => {
    setError(null);
    setResult(null);
    setIsRunning(true);
    try {
      const headers = await getSupabaseHeaders();

      // Build request body with optional contact context
      const requestBody: Record<string, unknown> = {
        skill_key: skillKey,
        test_input: testInput,
        mode,
      };

      // Add contact context if a contact is selected
      if (selectedContact && contactMode !== 'none') {
        requestBody.contact_id = selectedContact.id;
        requestBody.contact_test_mode = contactMode;
        requestBody.contact_context = {
          id: selectedContact.id,
          email: selectedContact.email,
          name: selectedContact.full_name ||
            [selectedContact.first_name, selectedContact.last_name].filter(Boolean).join(' '),
          title: selectedContact.title,
          company_id: selectedContact.company_id,
          company_name: selectedContact.company_name,
          total_meetings_count: selectedContact.total_meetings_count,
          quality_tier: selectedContact.qualityScore.tier,
          quality_score: selectedContact.qualityScore.score,
        };
      }

      const resp = await fetch(`${API_BASE_URL}/api-copilot/actions/test-skill`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = (await resp.json().catch(() => ({}))) as TestSkillResponse;
      if (!resp.ok || !data.success) {
        throw new Error((data as any).error || `Test failed (${resp.status})`);
      }

      setResult(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to run test';
      setError(msg);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-gray-200 dark:border-gray-700/50 px-4 py-3 flex items-center justify-between bg-gray-50 dark:bg-gray-800/30">
        <div className="flex items-center gap-2">
          <TerminalSquare className="w-4 h-4 text-gray-700 dark:text-gray-200" />
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Skill Test Console</span>
          <Badge variant="outline" className="font-mono text-xs">
            {skillKey}
          </Badge>
        </div>
        <Button onClick={handleRun} disabled={!canRun} className="gap-2">
          {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {isRunning ? 'Running…' : 'Run'}
        </Button>
      </div>

      <div className="p-4 space-y-3 overflow-auto">
        {!activeOrgId && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-800/50 dark:bg-amber-900/10 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 mt-0.5" />
            <div className="text-sm">
              No active org selected. The test endpoint runs against the authenticated user’s org membership.
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Test input</label>
            <Textarea value={testInput} onChange={(e) => setTestInput(e.target.value)} className="mt-1 min-h-[100px]" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Mode</label>
            <Input
              value={mode}
              onChange={(e) => setMode((e.target.value as TestMode) || 'readonly')}
              className="mt-1"
              placeholder="readonly | mock"
            />
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Use <span className="font-mono">readonly</span> unless you're mocking external calls.
            </p>
          </div>
        </div>

        {/* Contact Testing Section */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-700/50 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowContactSection(!showContactSection)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/30 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Contact Testing Mode
              </span>
              {contactMode !== 'none' && selectedContact && (
                <Badge variant="outline" className="text-xs">
                  {selectedContact.full_name || selectedContact.email}
                </Badge>
              )}
              {contactMode !== 'none' && !selectedContact && (
                <Badge variant="outline" className="text-xs text-amber-600 dark:text-amber-400">
                  Select a contact
                </Badge>
              )}
            </div>
            {showContactSection ? (
              <ChevronUp className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            )}
          </button>

          {showContactSection && (
            <div className="p-4 space-y-4 border-t border-gray-200 dark:border-gray-700/50">
              <ContactTestModeSelector
                mode={contactMode}
                onChange={handleContactModeChange}
                disabled={isRunning}
              />

              {/* Show contact list for good/average/bad modes */}
              {tierMode && (
                <TestContactList
                  contacts={contacts}
                  isLoading={isLoadingContacts}
                  selectedContactId={selectedContact?.id || null}
                  onSelect={setSelectedContact}
                  tier={tierMode}
                />
              )}

              {/* Show search for custom mode */}
              {contactMode === 'custom' && (
                <TestContactSearch
                  selectedContact={selectedContact}
                  onSelect={setSelectedContact}
                />
              )}
            </div>
          )}
        </div>

        {error && <div className="text-sm text-red-600 dark:text-red-400">{error}</div>}

        {result && (
          <div className="space-y-4">
            <div className="rounded-md border border-gray-200 dark:border-gray-800 p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Output</div>
                {result.usage && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    tokens: {result.usage.input_tokens} in / {result.usage.output_tokens} out
                  </div>
                )}
              </div>
              <pre className="mt-2 whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">{result.output}</pre>
            </div>

            <div className="rounded-md border border-gray-200 dark:border-gray-800 p-3">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Tool executions</div>
              <div className="mt-2 space-y-2">
                {(result.tool_executions || []).length === 0 && (
                  <div className="text-sm text-gray-500 dark:text-gray-400">No tool executions recorded.</div>
                )}
                {(result.tool_executions || []).map((t, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'flex items-center justify-between rounded-md border px-3 py-2',
                      t.success
                        ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800/40 dark:bg-emerald-900/10'
                        : 'border-red-200 bg-red-50 dark:border-red-800/40 dark:bg-red-900/10'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-gray-900 dark:text-gray-100">{t.toolName}</span>
                      {typeof t.durationMs === 'number' && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">{t.durationMs}ms</span>
                      )}
                    </div>
                    {!t.success && t.error && (
                      <span className="text-xs text-red-700 dark:text-red-300">{t.error}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

