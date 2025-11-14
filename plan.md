# Plan - Leads Inbox Presentation Upgrade

## Objectives
- Restore rich formatting for auto-generated lead prep notes so headings, bold text, and bullets render elegantly.
- Prevent content truncation for long narratives or JSON blocks inside lead insights.
- Keep the new renderer safe by default (no unsafe HTML) while matching the dark/light themes used elsewhere.
- Remove seconds from the meeting time display on the `/leads` page so values read like “Nov 18, 2025, 12:30 PM”.
- Add an animated search affordance to the /leads list so reps can quickly filter the queue without leaving the pipeline context.

## Tasks
- [x] Audit the existing `LeadDetailPanel` note rendering and catalogue markdown patterns coming from `process-lead-prep`.
- [ ] Implement a structured renderer that supports paragraphs, bold emphasis, bullet lists, and fenced code blocks without using `dangerouslySetInnerHTML`.
- [ ] Polish the card styling (spacing, typography, badges) and QA in both light/dark themes, then run lint/tests.
- [ ] Update `LeadDetailPanel` timestamp formatting to drop seconds from the Meeting tile.
- [ ] Smoke test the `/leads` page to confirm the new format renders as expected.
- [ ] Add a toolbar search icon that reveals a collapsible search input within `LeadList`.
- [ ] Filter visible leads by query with graceful empty states and document/testing notes.

## Milestones
- **Parser Ready** – New renderer parses `**Label:**` sections, list bullets, and code fences into semantic React blocks.
- **Visual Polish** – Lead cards use consistent spacing, typography, and badges matching the rest of the CRM.
- **QA Complete** – Notes verified with multiple sample payloads; lint/tests run with no regressions.
- **Meeting Display Polished** – Meeting tile shows localized date/time without seconds and matches product copy.
