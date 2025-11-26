# Commit Tracking Guide

## Overview
Each task completion should be tracked with a commit hash. This ensures we can trace code changes back to specific tasks and maintain a clear development history.

## Quick Start

### Option 1: Use the Helper Script (Recommended)

```bash
# Complete a task and commit automatically
./scripts/complete-task.sh "Phase 1.1 - Create Onboarding Flow Controller" "2601491f-e81c-43d3-a888-7f37863e3e4f"
```

The script will:
1. Stage all changes
2. Commit with standardized message format
3. Push to `meetings-feature-v1` branch
4. Display the commit hash for you to add to the task

### Option 2: Manual Process

1. **Commit your changes:**
   ```bash
   git add .
   git commit -m "feat: Phase X.Y - Task Title"
   git push origin meetings-feature-v1
   ```

2. **Get commit hash:**
   ```bash
   git rev-parse HEAD          # Full hash
   git rev-parse --short HEAD  # Short hash
   ```

3. **Add comment to task in AI Dev Hub:**
   ```
   Commit: abc123def456
   Branch: meetings-feature-v1
   Ready for testing
   ```

4. **Update task status to "In Review"**

## Commit Message Format

Follow this standardized format:

```
feat: Phase X.Y - Task Title
```

Examples:
- `feat: Phase 1.1 - Create Onboarding Flow Controller`
- `feat: Phase 2.3 - Add resolveModelForFeature() to AIProviderService`
- `fix: Phase 3.1 - Fix TalkTimeChart rendering issue`
- `refactor: Phase 4.2 - Optimize meeting classification logic`

## Commit Types

- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code refactoring
- `docs:` - Documentation changes
- `test:` - Test additions/modifications
- `chore:` - Maintenance tasks (dependencies, config, etc.)

## Task Status Workflow

1. **To Do** → Work begins
2. **In Progress** → Actively working
3. **In Review** → Code committed, ready for testing
4. **Done** → Testing passed, task complete

## Adding Commit Hash to Task

When a task is completed:

1. Commit the code (see above)
2. Add a comment to the task with:
   ```
   Commit: [short-hash]
   Branch: meetings-feature-v1
   Status: Ready for testing
   ```
3. Update task status to "In Review"
4. After testing passes, update to "Done"

## Example Workflow

```bash
# 1. Complete implementation
# ... make changes ...

# 2. Commit using script
./scripts/complete-task.sh "Phase 1.1 - Create Onboarding Flow Controller" "2601491f-e81c-43d3-a888-7f37863e3e4f"

# Output:
# ✅ Committed: abc123d
# 
# 📝 Next steps:
# 1. Add comment to task with: Commit: abc123d
# 2. Update task status to 'In Review'

# 3. Go to AI Dev Hub and add comment:
#    Commit: abc123d
#    Branch: meetings-feature-v1
#    Ready for testing

# 4. Update task status to "In Review"
```

## Benefits

- **Traceability**: Link code changes to specific tasks
- **History**: Clear development timeline
- **Testing**: Easy to identify which commit introduced issues
- **Documentation**: Self-documenting commit history
- **Rollback**: Quick identification of commits to revert if needed

## Branch Strategy

- All work happens on `meetings-feature-v1` branch
- Each task gets its own commit
- Keep commits atomic (one logical change per commit)
- Merge to main only after phase completion and testing


