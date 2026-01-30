# Forge Tasks

Task management via CLI. Store tasks in `forge/tasks/` as markdown files.

## CLI Reference

```bash
# Initialize
forge-tasks init --prefix TASK

# Create
forge-tasks create "Title" \
  --description "Details" \
  --priority high|medium|low \
  --label backend --label api \
  --ac "Acceptance criterion 1" \
  --ac "Acceptance criterion 2" \
  --depends-on TASK-001

# List
forge-tasks list --plain
forge-tasks list --status todo|in-progress|done|blocked --plain
forge-tasks list --ready --plain          # No blocking dependencies
forge-tasks list --priority high --plain
forge-tasks list --label backend --plain

# View & Search
forge-tasks view TASK-001 --plain
forge-tasks search "query" --plain

# Edit
forge-tasks edit TASK-001 --status "In Progress"
forge-tasks edit TASK-001 --status done
forge-tasks edit TASK-001 --status blocked
forge-tasks edit TASK-001 --check-ac 1              # Check off AC by index
forge-tasks edit TASK-001 --check-ac 1 --check-ac 2 # Multiple ACs
forge-tasks edit TASK-001 --append-notes "Progress update"
forge-tasks edit TASK-001 --plan "Implementation approach"
forge-tasks edit TASK-001 --add-label testing
forge-tasks edit TASK-001 --add-dep TASK-002

# Delete
forge-tasks delete TASK-001 --force
```

Always use `--plain` when processing task data programmatically.

## Standard Labels

| Label | Work Type | Route To |
|-------|-----------|----------|
| `backend` | Server-side logic, business rules | backend specialists |
| `frontend` | UI, components, styling | `frontend-design`, UI specialists |
| `api` | REST/GraphQL endpoints | API specialists |
| `database` | Models, migrations, queries | database specialists |
| `testing` | Tests, coverage | test agents |
| `devops` | CI/CD, deployment | devops agents |
| `refactoring` | Code improvement | refactoring specialists |
| `documentation` | Docs, READMEs | `general-purpose` |

Fallback chain: specialist agent → `tasks:worker` → `general-purpose`

## Acceptance Criteria Guidelines

**Good ACs (outcome-focused):**
- "User can log in with valid credentials"
- "POST /api/users returns 201 with user data on success"
- "Returns 400 for invalid email format"
- "Password is hashed before storage"

**Bad ACs (implementation steps):**
- "Add handleLogin function to auth.ts"
- "Import bcrypt library"
- "Create user-service.ts file"

ACs describe WHAT success looks like, not HOW to implement.

## Definition of Done

A task is complete when:
1. All acceptance criteria checked off (`--check-ac`)
2. Implementation notes added (`--append-notes`)
3. Status set to "done" (`--status done`)
4. Changes committed with task ID reference
5. Tests pass (if applicable)

## Sub-Agents

**tasks:manager** (Planning)
- Converts plans/PRDs into actionable tasks
- Creates tasks with labels, ACs, dependencies

**tasks:coordinator** (Execution)
- Matches tasks to specialist agents by labels
- Delegates with task-update instructions
- Monitors progress to completion

**tasks:worker** (Implementation)
- Implements single assigned task
- Updates status, checks ACs, reports blockers
