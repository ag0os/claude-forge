# Forge Tasks

Task management via CLI. Store tasks in `forge/tasks/` as markdown files.

## CLI Quick Reference

```bash
forge-tasks init --prefix TASK              # Initialize project
forge-tasks create "Title" --ac "Criterion" # Create task with acceptance criteria
forge-tasks list --plain                    # List all tasks
forge-tasks list --status todo              # Filter by status (todo|in-progress|done|blocked)
forge-tasks view TASK-1 --plain             # View task details
forge-tasks edit TASK-1 --status in-progress --check-ac 1  # Update task
forge-tasks edit TASK-1 --append-notes "Progress update"   # Add notes
forge-tasks search "query" --plain          # Search tasks
forge-tasks delete TASK-1 --force           # Delete task
```

## Sub-Agents

**forge-task-manager**: Creates tasks, breaks down work, manages dependencies, tracks progress.
Use for: planning, task creation, work breakdown, progress monitoring.

**forge-task-worker**: Implements a single task, updates ACs, adds notes.
Use for: executing specific tasks, focused implementation work.

## Workflow

1. **Planning phase**: Use task-manager to break requirements into tasks with clear ACs
2. **Execution phase**: Delegate individual tasks to task-worker agents
3. **Tracking**: Monitor via `forge-tasks list --plain` and task notes

## Output Formats

- `--plain`: Key=value format for agent parsing
- `--json`: Structured JSON output
- Default: Human-readable table/formatted output

Always use `--plain` when processing task data programmatically.
