# Plan - Leads Inbox Presentation Upgrade

## Objectives
- Restore rich formatting for auto-generated lead prep notes so headings, bold text, and bullets render elegantly.
- Prevent content truncation for long narratives or JSON blocks inside lead insights.
- Keep the new renderer safe by default (no unsafe HTML) while matching the dark/light themes used elsewhere.

## Tasks
- [x] Audit the existing `LeadDetailPanel` note rendering and catalogue markdown patterns coming from `process-lead-prep`.
- [ ] Implement a structured renderer that supports paragraphs, bold emphasis, bullet lists, and fenced code blocks without using `dangerouslySetInnerHTML`.
- [ ] Polish the card styling (spacing, typography, badges) and QA in both light/dark themes, then run lint/tests.

## Milestones
- **Parser Ready** – New renderer parses `**Label:**` sections, list bullets, and code fences into semantic React blocks.
- **Visual Polish** – Lead cards use consistent spacing, typography, and badges matching the rest of the CRM.
- **QA Complete** – Notes verified with multiple sample payloads; lint/tests run with no regressions.
