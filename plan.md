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
