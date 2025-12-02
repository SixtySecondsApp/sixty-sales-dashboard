# Task Completion & Commit Tracking Workflow

## Overview
This workflow ensures that each completed task is properly committed and tracked with its commit hash.

## Process

### 1. Complete the Task
- Implement all requirements from the task description
- Test the implementation
- Ensure code follows project standards

### 2. Commit the Changes
```bash
# Stage all changes
git add .

# Commit with standardized message format
git commit -m "feat: [Phase X.Y] - [Task Title]"

# Example:
git commit -m "feat: Phase 1.1 - Create Onboarding Flow Controller"
```

### 3. Get Commit Hash
```bash
# Get the latest commit hash
git rev-parse HEAD

# Or get short hash
git rev-parse --short HEAD
```

### 4. Update Task in AI Dev Hub
1. Add a comment to the task with the commit hash:
   ```
   Commit: abc123def456789
   Branch: meetings-feature-v1
   ```

2. Update task status to "In Review" for testing

3. (Optional) Add testing notes in comments

### 5. Push to Branch
```bash
git push origin meetings-feature-v1
```

## Commit Message Format

Follow this format for consistency:
- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code refactoring
- `docs:` - Documentation
- `test:` - Tests
- `chore:` - Maintenance tasks

Format: `[type]: Phase [X.Y] - [Brief Description]`

Examples:
- `feat: Phase 1.1 - Create Onboarding Flow Controller`
- `fix: Phase 2.3 - Fix model resolution fallback logic`
- `refactor: Phase 3.1 - Optimize TalkTimeChart rendering`

## Testing Workflow

After committing:
1. Update task status to "In Review"
2. Add comment: "Ready for testing - Commit: [hash]"
3. Create test checklist in task comments
4. After testing passes, update status to "Done"
5. If issues found, add comment with details and update status back to "In Progress"

## Branch Strategy

- Work on branch: `meetings-feature-v1`
- Each task should be committed individually
- Keep commits atomic (one logical change per commit)
- Merge to main only after all phase tasks are complete and tested


