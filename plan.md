# Plan - Copilot Email Search Tool

## Objectives
- Give AI Copilot first-class access to connected Gmail accounts for historical lookup requests.
- Define a Claude tool schema that supports contact-scoped email searches with optional filters.
- Return rich structured responses (communication history) so the UI can render email timelines.

## Tasks
- [x] Review existing Copilot + Gmail integrations to understand available data and auth flows.
- [ ] Expand Copilot edge function with a Gmail search tool + handler.
- [ ] Add structured response detection that turns “show last emails” queries into communication history payloads.
- [ ] Document testing steps and follow-up work once backend + UI wiring is complete.

## Milestones
- **Tool Schema Ready** – `emails_search` tool published in `AVAILABLE_TOOLS`.
- **Server Handler Complete** – Gmail helper + fallback to CRM activities with structured response.
- **UI Verified** – Copilot renders `communication_history` blocks populated from Gmail.

## Current Focus – Email Retrieval Experience
- [x] Baseline analysis of Copilot architecture and Gmail edge functions.
- [ ] Implement Gmail access helper + token refresh inside `api-copilot`.
- [ ] Ship structured response builder + detection heuristics for communication questions.

## Workstream: Calendar Copilot Availability

### Objectives
- Enable Copilot to answer “when am I free?” queries without manual calendar IDs.
- Provide timezone-aware free/busy calculations sourced from `calendar_events`.
- Surface availability slots alongside meetings in the Copilot UI.

### Tasks
- [x] Implement `calendar_availability` tool + backend handler.
- [x] Add structured response detection + builder for availability questions.
- [ ] Polish UI actions (slot copy, quick scheduling) after validation.

### Milestones
- **Availability Tool Online** – Claude can call `calendar_availability` with inferred ranges.
- **Structured Response Ready** – Copilot emits calendar responses containing slots + meetings.
- **UI Visibility** – Calendar card displays open blocks with timezone context.

## Workstream: Freepik Workflow Image Linking

### Objectives
- Restore img2img flows on `/workflows` by ensuring Image Input nodes share data downstream.
- Prevent "No image data received" errors when Mystic runs with reference imagery.

### Tasks
- [x] Reproduce Freepik failure and confirm Image Input nodes do not update React Flow state.
- [x] Wire `ImageInputNode` to `useReactFlow().setNodes` so uploaded URLs/base64 strings persist.
- [x] Implement Freepik task polling so Mystic waits for completed generations.
- [ ] Validate in-app that Freepik generators receive reference data and can create images.

### Milestones
- **State Sync Fixed** – `data.src` updates immediately when users upload or paste images.
- **Mystic Img2Img Working** – Image Generator nodes render results using Image Input references.

## Workstream: Slack Demo + Integration Roadmap UX

### Objectives
- Make `/platform/slack-demo` faster to use for end-to-end validation.
- Make integration roadmap entries linkable per integration (e.g. `/platform/integrations/roadmap/slack`).
- Ensure the Slack roadmap entry reflects shipped functionality (not just a generic plan).

### Tasks
- [x] Add left padding + “Test Slack connection” button on Slack demo.
- [x] Add a recent-meetings picker so tests don’t require copy/pasting meeting IDs.
- [x] Add per-integration roadmap routes (`/platform/integrations/roadmap/:integrationId`) and a “Copy link” button.
- [x] Update Slack roadmap plan to include meeting debriefs, prep cards, daily digest, deal rooms, and user mapping.
- [x] Restore per-integration roadmap *pages* (card grid → click-through page), replacing the modal popup.
- [ ] Make Daily Digest delivery configurable: team, individual, or both (Slack settings + edge function fanout).

## Workstream: Integrations Page Logos + External View

### Objectives
- Eliminate logo flicker on `/integrations` by avoiding repeated remount + placeholder swap.
- Load logos directly from the cached public S3 bucket on first paint (no “over the top of icons” flicker).
- Make `/integrations` available in external view mode (and for external users where allowed).

### Tasks
- [x] Stabilize Integrations page components to prevent remount loops.
- [x] Render deterministic S3 logo URLs immediately; dedupe background cache warming calls.
- [x] Preload integration logos on page load to avoid visible swaps.
- [x] Allow `/integrations` route in external view routing rules.

## Workstream: Org Currency + Company Enrichment

### Objectives
- Support organization-level currency selection (display formatting across UI + Slack + Copilot context).
- Auto-enrich company profile from signup email domain using Gemini (platform-managed secret), with manual re-enrich in settings.

### Tasks
- [x] Add org fields: `currency_code`, `currency_locale`, `company_*` enrichment fields; add `profiles.bio`.
- [x] Implement `enrich-organization` edge function (Gemini) and persist org/user bio context.
- [x] Refactor key UI surfaces to use org-aware currency formatting (Slack settings + deal cards + shared currency helper).
- [x] Update Slack edge functions + Slack blocks currency formatting (no hardcoded `$`).
- [x] Update Copilot context builder to include org/company/user bio + org currency formatting.
- [x] Add org settings UI for currency + company profile, including Enrich/Re-enrich and background auto-enrichment in onboarding.
