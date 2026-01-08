## 60/get-started — Ralph-style “small stories” loop for use60

This command is the **start-of-work ritual** for any new feature/initiative in this repo. It’s based on the “small, verifiable, iterative” pattern popularized by Ralph ([`snarktank/ralph`](https://github.com/snarktank/ralph)).

### What this sets up

- **A tiny work queue**: `scripts/ralph/prd.json` (ordered user stories with `passes: false/true`)
- **A persistent learnings log**: `scripts/ralph/progress.txt` (append-only)
- **A consistent execution loop**: implement 1 story → run quality gates → record learnings → repeat

### Pre-flight (repo + environment)

- **Confirm the stack + rules**
  - Read `CLAUDE.md`
  - Skim `.cursor/rules/index.mdc` (and any relevant rule files)
  - Skim `agent.md` for quality gates + “ASK vs PROCEED” boundaries

- **Install + run**

```bash
cd /Users/andrewbryce/Documents/sixty-sales-dashboard
npm install
npm run dev
```

### Create a PRD (small stories only)

Create a PRD that breaks work into **1-iteration-sized** stories (each story should be doable without blowing context).

- **Option A (recommended if you’re using Amp)**: use the globally installed skills from Ralph:
  - Use PRD skill to generate the PRD:
    - “Load the `prd` skill and create a PRD for [feature]”
  - Save it to: `tasks/prd-[feature-name].md`

- **Option B (Cursor-only)**: write `tasks/prd-[feature-name].md` manually with:
  - 3–6 user stories max to start
  - Acceptance criteria that are checkable (not “works” / “good UX”)
  - For UI stories, include: “Verify in browser”

### Convert PRD → `prd.json` (the work queue)

Create the queue file used by `60/continue-phase`.

- **Create the folder structure**:

```bash
mkdir -p /Users/andrewbryce/Documents/sixty-sales-dashboard/scripts/ralph
mkdir -p /Users/andrewbryce/Documents/sixty-sales-dashboard/tasks
```

- **Generate `scripts/ralph/prd.json`**
  - If using Amp: “Load the `ralph` skill and convert `tasks/prd-[feature-name].md` to `scripts/ralph/prd.json`”
  - If not using Amp: manually create `scripts/ralph/prd.json` using Ralph’s JSON shape (keep it simple and small).

### Initialize `progress.txt` (learnings + decisions)

```bash
cat > /Users/andrewbryce/Documents/sixty-sales-dashboard/scripts/ralph/progress.txt <<'EOF'
# progress.txt
#
# Append-only learnings log for iterative implementation.
# Keep entries short and actionable (patterns, gotchas, commands to run, where code lives).
EOF
```

### Quality gates (must be runnable locally)

When executing stories, prefer these repo gates (see `agent.md`):

```bash
npm run lint
npm run build:check
npm run test:run
```

### Next command

Run: `60/continue-phase` to implement the **next** `passes: false` story from `scripts/ralph/prd.json`.

