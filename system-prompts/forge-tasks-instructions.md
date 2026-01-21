# Forge Tasks

Task management via CLI. Store tasks in `forge/tasks/` as markdown files.

## CLI Quick Reference

```bash
forge-tasks init --prefix TASK              # Initialize project
forge-tasks create "Title" --ac "Criterion" # Create task with acceptance criteria
forge-tasks list --plain                    # List all tasks
forge-tasks list --status todo              # Filter by status (todo|in-progress|done|blocked)
forge-tasks list --ready --plain            # Tasks with no blocking dependencies
forge-tasks view TASK-1 --plain             # View task details
forge-tasks edit TASK-1 --status in-progress --check-ac 1  # Update task
forge-tasks edit TASK-1 --append-notes "Progress update"   # Add notes
forge-tasks search "query" --plain          # Search tasks
forge-tasks delete TASK-1 --force           # Delete task
```

## Standard Labels

Use these labels for routing tasks to appropriate agents:

| Label | Work Type |
|-------|-----------|
| `backend` | Server-side logic, business rules |
| `frontend` | UI, components, styling |
| `api` | REST/GraphQL endpoints |
| `database` | Models, migrations, queries |
| `testing` | Tests, coverage |
| `devops` | CI/CD, deployment |
| `refactoring` | Code improvement |
| `documentation` | Docs, READMEs |

## Sub-Agents

**forge-task-manager** (Planning Phase)
- Digests implementation plans and requirements
- Creates well-structured tasks with labels and dependencies
- Sets priorities and organizes work breakdown
- Use for: converting plans/PRDs into actionable tasks

**forge-task-coordinator** (Execution Phase)
- Reads existing tasks and discovers available agents
- Matches tasks to appropriate specialists based on labels
- Delegates with embedded task-update instructions
- Monitors progress and verifies completion
- Use for: coordinating implementation across multiple tasks

**forge-task-worker** (Implementation Phase)
- Implements a single assigned task
- Updates status, checks off ACs, adds notes
- Reports blockers and completion
- Use for: focused implementation work

## Workflow

```
1. Planning:   User requirements → forge-task-manager → Tasks created
2. Execution:  Tasks exist → forge-task-coordinator → Delegates to agents
3. Implementation: Agent receives task → forge-task-worker or specialist → Work done
```

## Output Formats

- `--plain`: Key=value format for agent parsing
- `--json`: Structured JSON output
- Default: Human-readable table/formatted output

Always use `--plain` when processing task data programmatically.
