# Plan - Workflow Node Audit

## Objectives
- Inventory every node in the workflow automation feature and capture its configuration surface area.
- Validate that each node's configuration schema matches what the runtime expects (inputs, secrets, triggers).
- Exercise each node by sending the appropriate API requests or simulated payloads to confirm connectivity.
- Produce an audit artifact summarizing status, failures, and remediation steps.

## Tasks
- [ ] Locate workflow node definitions (DB tables, config files, or code) and document their metadata.
- [ ] Map configuration requirements (fields, defaults, external dependencies) for every node.
- [ ] Design and run API-level tests that call each node with realistic data to verify they complete successfully.
- [ ] Capture results/logs, file bugs for broken nodes, and update documentation with findings.

## Milestones
- **Node Inventory Complete** – Full list of nodes with owner/config references.
- **Connectivity Verified** – API exercise executed for all nodes with pass/fail notes.
- **Audit Report Delivered** – Written summary checked into repo with recommended fixes.

## Current Focus – Freepik Workflow Reliability
- [x] Inspect Freepik workflow nodes and client service for CORS blockers.
- [x] Build Supabase `freepik-proxy` edge function that forwards authenticated requests.
- [x] Refactor `freepikService` to route through the proxy instead of browser fetch calls.
- [ ] Validate UI generators against the proxy and document deployment/secret steps.
