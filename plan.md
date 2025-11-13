# Plan - Task View UX Improvements

## Objectives
- Make task pop-ups instantly communicate the task title, owner, and related meeting context.
- Provide a quick, friendly way to change task status without opening the full edit form.
- Keep advanced editing flows available on demand while reducing initial cognitive load.

## Tasks
- [x] Audit the current task detail modal and identify information gaps for meeting context and status updates.
- [ ] Redesign the modal layout to highlight key summary details and surface meeting links prominently.
- [ ] Implement quick status update controls and ensure they sync with existing task actions.
- [ ] Validate the updated experience in kanban view, run lint checks, and document the change.

## Milestones
- **Design Finalized** – Updated layout mock captured in code comments/readme for future reference.
- **Summary Ready** – Modal shows concise header with title, owner, status, and meeting callouts.
- **Actions Confirmed** – Status quick-actions work without opening the full edit flow and respect completion logic.
- **QA Complete** – Basic lint/tests executed and UX smoke-tested in the tasks kanban.

