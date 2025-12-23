# Workflow Node Audit — 20 Nov 2025

## Scope & Method
- Enumerated every node surfaced through `WorkflowCanvas` (builder UI) and cross-checked shipped templates (`fathomWorkflowTemplate`, `salesAnalysisWorkflow`) to confirm coverage.
- Reviewed each node component/service to document configuration contracts, runtime dependencies, and execution paths.
- Probed all reachable edge functions and external APIs that back workflow nodes using authenticated `curl` calls where possible; when dependencies were unavailable, captured the blocking condition.

Base node registrations (UI + execution engine coverage) confirm 19 first-class node types plus any runtime-registered custom nodes:

```105:140:src/components/workflows/WorkflowCanvas.tsx
const baseNodeTypes: NodeTypes = {
  trigger: TriggerNode,
  condition: ConditionNode,
  action: ActionNode,
  router: RouterNode,
  aiAgent: AIAgentNode,
  customGPT: CustomGPTNode,
  assistantManager: AssistantManagerNode,
  form: FormNode,
  googleEmail: GoogleEmailNode,
  googleDocs: GoogleDocsNode,
  fathomWebhook: FathomWebhookNode,
  conditionalBranch: ConditionalBranchNode,
  googleDocsCreator: GoogleDocsCreatorNode,
  meetingUpsert: MeetingUpsertNode,
  actionItemProcessor: ActionItemProcessorNode,
  imageInput: ImageInputNode,
  freepikImageGen: FreepikImageGenNode,
  freepikUpscale: FreepikUpscaleNode,
  freepikVideoGen: FreepikVideoGenNode,
  freepikLipSync: FreepikLipSyncNode,
  freepikMusic: FreepikMusicNode,
  prospectResearch: ProspectResearchNode
};
```

## Node Inventory & Status

| Node Type | Component / Service | External Dependency | Status (20 Nov) | Notes |
|-----------|--------------------|---------------------|-----------------|-------|
| Trigger / Condition / Router / Action | `standard/*.tsx` | None (controls) | ✅ Working | Internal logic only; no external calls. |
| Form | `FormNode.tsx`, `formStorageService` | Supabase storage | ⚠️ Requires Supabase session | Defaults auto-create test/prod forms via `formStorageService.storeFormConfig` (async). |
| Fathom Webhook | `FathomWebhookNode.tsx`, `supabase/functions/workflow-webhook` | Supabase function + Fathom payload | ✅ Working | POST to `/functions/v1/workflow-webhook/b224…` succeeded (HTTP 200, execution recorded). |
| Conditional Branch | `ConditionalBranchNode.tsx` | None | ✅ Working | Pure UI logic; used heavily in Fathom template router. |
| Meeting Upsert | `MeetingUpsertNode.tsx` | Supabase `meetings` table | ✅ Working (via webhook test) | Handles attendees, embed URLs, AI metadata etc. |
| Google Docs Creator | `GoogleDocsCreatorNode.tsx`, `GoogleDocsService.createDocument` | Supabase Edge `google-docs-create` + Google OAuth | ⛔ Blocked (auth) | Edge function rejects anon tokens (`missing sub claim`); needs user session or service token. |
| Google Docs (generic) | `GoogleDocsNode.tsx` | Same as above | ⛔ Blocked (auth) | Requires configured template + Google OAuth tokens. |
| Google Email | `GoogleEmailNode.tsx`, `supabase/functions/google-gmail` | Google OAuth (per-user) | ⛔ Blocked (invalid auth token) | Edge function enforces `supabase.auth.getUser`; tests with anon key return `Invalid authentication token`. |
| Calendar MCP | `CalendarMCPNode.tsx`, `MCPService`, `mcp-servers/calendar-mcp` | Local MCP server (stdio) | ⛔ Blocked (server not running) | Predefined config expects `node mcp-servers/calendar-mcp/dist/index.js`; needs OAuth secrets before start. |
| Email MCP | `EmailMCPNode.tsx`, `mcp-servers/gmail-mcp` | Local MCP server | ⛔ Blocked (server not running) | Same as Calendar MCP, but for Gmail toolchain. |
| AI Agent / Custom GPT / Assistant Manager | `AIAgentNode.tsx`, `CustomGPTNode.tsx`, `AssistantManagerNode.tsx`, `AIProviderService` | OpenAI / Anthropic / Gemini API keys | ⚠️ Requires valid API keys | `AIProviderService` loads keys from `user_settings` or env; missing keys will short-circuit execution. |
| Action Item Processor | `ActionItemProcessorNode.tsx`, `supabase/functions/analyze-action-item` | Anthropic API + `meeting_action_items` table | ⚠️ Requires seeded action_item_id | Edge function insists on existing DB record; test call returned `Action item not found`. |
| Task Creator & Database Nodes | Template-only (no dedicated component) | Supabase RPC/DB | ⚠️ Execution handled by engine | `workflowTestEngine` mocks these operations when real DB calls fail. |
| Freepik Image / Upscale / Video / Lip Sync / Music / ImageInput | `freepik/*.tsx`, `freepikService.ts`, `supabase/functions/freepik-proxy` | Supabase Edge `freepik-proxy` + `FREEPIK_API_KEY` secret | ⚠️ Blocked (missing secret) | Requests now go through Supabase; without setting `FREEPIK_API_KEY` via `supabase secrets set`, the proxy returns `Freepik API key is not configured`. |
| Prospect Research | `ProspectResearchNode.tsx` | (Planned AI research service) | ⚠️ Mock only | Currently simulates research with `setTimeout`; no backend call. |

### Key Component References
- Meeting upsert capabilities (attendee & metadata toggles) are wired via the node data config:

```6:53:src/components/workflows/nodes/MeetingUpsertNode.tsx
export interface MeetingUpsertNodeData {
  label?: string;
  table?: string;
  upsertKey?: string;
  fields?: string[];
  config?: {
    handleAttendees?: boolean;
    storeEmbedUrl?: boolean;
    processMetrics?: boolean;
    aiTrainingMetadata?: boolean;
    linkContacts?: boolean;
    enrichContacts?: boolean;
    createCompanies?: boolean;
    updateEngagement?: boolean;
  };
}
```

- Google Docs creator flags (formatting, vector DB prep) are surfaced for configuration:

```6:50:src/components/workflows/nodes/GoogleDocsCreatorNode.tsx
export interface GoogleDocsCreatorNodeData {
  docTitle?: string;
  permissions?: string[];
  config?: {
    formatTranscript?: boolean;
    addTimestamps?: boolean;
    shareWithAI?: boolean;
    vectorDbReady?: boolean;
  };
}
```

- Email node requires `to`, `subject`, `body`, aligning with Gmail edge function requirements:

```6:92:src/components/workflows/nodes/GoogleEmailNode.tsx
export interface GoogleEmailNodeData {
  config?: {
    to: string[];
    subject: string;
    body: string;
    isHtml?: boolean;
    attachments?: string[];
  };
}
```

- Calendar MCP node exposes rich operation/parameter schema while relying on server registration in `MCPService`:

```22:51:src/components/workflows/nodes/CalendarMCPNode.tsx
export interface CalendarMCPNodeData {
  config?: {
    serverName?: 'google' | 'outlook' | 'custom';
    operation?: 'create_event' | 'update_event' | 'delete_event' | ...;
    parameters?: { summary?: string; startDateTime?: string; attendees?: string[]; ... };
    timeout?: number;
    retries?: number;
  };
}
```

```409:441:src/lib/services/mcpService.ts
private initializePredefinedConfigs(): void {
  this.predefinedConfigs.set('calendar', {
    transport: 'stdio',
    command: 'node',
    args: ['mcp-servers/calendar-mcp/dist/index.js']
  });
  this.predefinedConfigs.set('gmail', {
    transport: 'stdio',
    command: 'node',
    args: ['mcp-servers/gmail-mcp/dist/index.js']
  });
  this.predefinedConfigs.set('http-calendar', {
    transport: 'http',
    url: 'http://localhost:3001/mcp'
  });
}
```

- Action item classification depends on the Edge function fetching an existing `meeting_action_items` row before calling Anthropic:

```216:253:supabase/functions/analyze-action-item/index.ts
const { action_item_id } = await req.json();
...
const { data: actionItem } = await supabase
  .from('meeting_action_items')
  .select('...')
  .eq('id', action_item_id)
  .single();
if (!actionItem) {
  return new Response(JSON.stringify({ error: 'Action item not found' }), { status: 404, ... });
}
```

- Google Docs creation path uses the signed-in Supabase session; anon/service tokens without a `sub` claim fail:

```26:74:src/lib/services/googleDocsService.ts
const { data: { session } } = await supabase.auth.getSession();
...
const response = await fetch(`${supabase.supabaseUrl}/functions/v1/google-docs-create`, {
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
    'apikey': supabase.supabaseKey
  },
  body: JSON.stringify(requestBody)
});
if (!response.ok) throw new Error(`Edge Function failed: ${response.status}`);
```

- Gmail/Calendar edge functions explicitly validate Supabase JWTs and Google OAuth tokens, explaining the “Invalid authentication token” responses:

```101:140:supabase/functions/google-gmail/index.ts
const authHeader = req.headers.get('Authorization');
...
const { data: { user } } = await supabase.auth.getUser(token);
if (!user) throw new Error('Invalid authentication token');
const { data: integration } = await supabase
  .from('google_integrations')
  .select('access_token, refresh_token, expires_at')
  .eq('user_id', user.id)
  .eq('is_active', true)
  .single();
```

```93:141:supabase/functions/google-calendar/index.ts
const authHeader = req.headers.get('Authorization');
...
const { data: { user } } = await supabase.auth.getUser(token);
if (!user) throw new Error('Invalid authentication token');
const { data: integration } = await supabase
  .from('google_integrations')
  .select('access_token, refresh_token, expires_at')
  .eq('user_id', user.id)
  .eq('is_active', true)
  .single();
```

- Freepik nodes now route through the Supabase proxy:

```78:108:src/lib/services/freepikService.ts
const { data, error } = await supabase.functions.invoke(FREEPIK_PROXY_FUNCTION, {
  body: {
    endpoint,
    method: (options.method || 'POST').toUpperCase(),
    payload: options.payload
  }
});

if (error) {
  throw new Error(error.message || 'Freepik proxy request failed');
}
```

- Prospect Research node currently mocks API calls (no backend integration yet):

```55:91:src/components/workflows/nodes/ProspectResearchNode.tsx
const handleResearch = async (...) => {
  if (!prospectName && !companyName) { ... }
  setIsResearching(true);
  try {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const mockSummary = `Research completed for ${prospectName || companyName}...`;
    updateField('research_summary', mockSummary);
    ...
  } catch (err) {
    updateField('researchError', err.message || 'Research failed');
  }
};
```

## API Connectivity Probes

| Endpoint | Node(s) Exercised | Payload Summary | Result |
|----------|-------------------|-----------------|--------|
| `POST /functions/v1/workflow-webhook/b224bdca-…` | `fathomWebhook`, downstream `meetingUpsert` | `payload_type=summary`, sample meeting metadata | ✅ `200 OK`, returns execution ID `57148b55-d718-4f69-a9cc-e473bf9f8d36` and created meeting `e0fe3242-d609-47a7-97d6-00925d87d95c`. |
| `POST /functions/v1/google-docs-create` | `googleDocsCreator`, `googleDocs` | Basic doc title/content | ⛔ `{"error":"Authentication error: invalid claim: missing sub claim"}` — requires real Supabase user session. |
| `POST /functions/v1/google-gmail?action=list` | `googleEmail`, `EmailMCP` fallback | `{ "maxResults": 1 }` | ⛔ `{"error":"Invalid authentication token"}` — per-user JWT & Google OAuth missing. |
| `POST /functions/v1/google-calendar?action=list-events` | `CalendarMCP` (edge fallback) | `{ "maxResults": 1 }` | ⛔ Same invalid token message; user Google integration required. |
| `POST /functions/v1/analyze-action-item` | `actionItemProcessor` | `{ "action_item_id": "audit-1", ... }` | ⚠️ `{"error":"Action item not found"}` — function insists on existing `meeting_action_items.id`. |
| `POST /functions/v1/freepik-proxy` | `freepik*` nodes | `{ "endpoint": "/mystic", "method": "POST", "payload": { "prompt": "Test" } }` | ⛔ `{"error":"Freepik API key is not configured"}` — set `FREEPIK_API_KEY` secret before proxying to Freepik. |

## Key Findings
1. **Fathom workflow path is healthy end-to-end** – webhook ingestion, node routing, and meeting upsert all executed successfully using the baked-in test workflow ID.
2. **Google Workspace nodes are blocked by authentication flow** – both Docs and Gmail/Calendar functions validate Supabase JWTs and lookup real `google_integrations` rows. Automated tests must run with a user session or a service role token that includes a `sub`.
3. **Action item analysis cannot be probed without seeded data** – the edge function fetches `meeting_action_items` row before invoking Anthropic; supplying a fake ID immediately returns 404.
4. **Freepik creative nodes depend on the Supabase proxy + secret** – `freepikService` now invokes `freepik-proxy`, which returns `Freepik API key is not configured` until the `FREEPIK_API_KEY` secret is set.
5. **MCP nodes require local servers + OAuth secrets** – `MCPService` only registers stdio transports pointing to `mcp-servers/*/dist/index.js`. Without running `npm start` in those subprojects (and supplying Google credentials), Calendar/Gmail MCP nodes cannot connect.
6. **Prospect Research remains a UI stub** – button click currently returns mock data after a timeout; no real research API is called.

## Recommendations
1. **Authenticate Google edge calls**: Run tests under a real Supabase user session (or pass a service JWT that includes `sub`) so Docs/Gmail/Calendar functions can authorize and load `google_integrations`. Validate that OAuth refresh tokens exist.
2. **Seed test action items**: Insert a disposable row into `meeting_action_items` (and associated meeting) so `analyze-action-item` can be invoked end-to-end. Automate cleanup post-test.
3. **Provision Freepik credentials**: Configure the Supabase secret via `supabase secrets set FREEPIK_API_KEY=...` and deploy the `freepik-proxy` function so Freepik nodes can execute without browser-side keys.
4. **Stand up MCP servers locally**: Follow `mcp-servers/*/start.sh` to install deps, add Google OAuth secrets, and run `npm start`. Once running, re-run workflow execution via `WorkflowMCPExecutor` to ensure node connectivity.
5. **Upgrade Prospect Research node**: Wire it into an actual research service (could reuse `AIProviderService`) or clearly label it as “preview/mock” to avoid false expectations.
6. **Document required test fixtures**: Capture the prerequisites (logged-in user, OAuth tokens, seeded action items, API keys, MCP daemons) in the workflow QA runbook so future audits can be automated.

## Appendices
- Fathom workflow template demonstrates how these nodes chain together (webhook → conditional branch → meeting upsert/Docs/AI/ActionItem pipeline), reinforcing the dependency map for integration tests.
- `WorkflowTestEngine` contains graceful fallbacks (e.g., mock Google Doc creation) but those should only be used for local UI testing; production verification still needs real API connectivity.

