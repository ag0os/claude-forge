# Forge-Tasks Documentation

A hybrid task management system for claude-forge: CLI binary for manual and scripted use, plus programmatic sub-agents for coordinated workflows. Tasks are stored as markdown files with YAML frontmatter in `forge/tasks/`.

## Overview

Forge-tasks provides:

- **File-based storage**: Tasks are human-readable markdown files, easy to edit manually or commit to git
- **CLI interface**: Full-featured command-line tool for task CRUD operations
- **Programmatic API**: TypeScript `TaskManager` class for building custom workflows
- **Sub-agents**: Specialized agents for task management and implementation
- **Output formats**: Human-readable, plain text (for scripts/agents), and JSON

## Quick Start

### Initialize a project

```bash
forge-tasks init
```

This creates:
- `forge/tasks/` directory for task files
- `forge/tasks/config.json` configuration file

### Create your first task

```bash
forge-tasks create "Implement user authentication" \
  --description "Add JWT-based auth to the API" \
  --priority high \
  --ac "Login endpoint returns JWT token" \
  --ac "Protected routes require valid token"
```

### List all tasks

```bash
forge-tasks list
```

Output:
```
ID          STATUS       PRIORITY   TITLE
TASK-001    To Do        high       Implement user authentication
```

### View a task

```bash
forge-tasks view TASK-001
```

---

## Task File Format

Tasks are stored as markdown files in `forge/tasks/` with the naming convention:

```
{ID} - {Title}.md
```

Example: `TASK-001 - Implement user authentication.md`

### Complete Example

```markdown
---
id: TASK-001
title: Implement user authentication
status: In Progress
priority: high
assignee: alice
labels:
  - backend
  - security
dependencies:
  - TASK-002
dueDate: 2026-02-01T00:00:00.000Z
createdAt: 2026-01-20T10:00:00.000Z
updatedAt: 2026-01-20T14:30:00.000Z
---

## Description

Add JWT-based authentication to the REST API. Users should be able to
register, login, and access protected endpoints with a valid token.

## Implementation Plan

1. Create User model with password hashing
2. Add /api/auth/register endpoint
3. Add /api/auth/login endpoint
4. Implement JWT middleware
5. Add token refresh logic

<!-- AC:BEGIN -->
- [x] #1 Login endpoint returns JWT token
- [ ] #2 Protected routes require valid token
- [ ] #3 Token expires after 24 hours
<!-- AC:END -->

## Implementation Notes

Started with User model. Using bcrypt for password hashing.
JWT secret stored in environment variable.
```

### YAML Frontmatter Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier (e.g., "TASK-001") |
| `title` | string | Yes | Task title/summary |
| `status` | string | Yes | "To Do", "In Progress", "Done", or "Blocked" |
| `priority` | string | No | "high", "medium", or "low" |
| `assignee` | string | No | Person assigned to the task |
| `labels` | string[] | No | Tags for categorization |
| `dependencies` | string[] | No | IDs of tasks this depends on |
| `dueDate` | ISO date | No | When the task is due |
| `createdAt` | ISO date | Yes | When task was created (auto-set) |
| `updatedAt` | ISO date | Yes | When task was last modified (auto-set) |

### Markdown Sections

The body supports these standard sections:

- **## Description**: Detailed explanation of the task
- **## Implementation Plan**: Step-by-step approach for implementation
- **## Implementation Notes**: Progress updates and notes added during work

### Acceptance Criteria Format

Acceptance criteria are wrapped in special markers to preserve formatting:

```markdown
<!-- AC:BEGIN -->
- [ ] #1 First criterion
- [x] #2 Completed criterion
- [ ] #3 Third criterion
<!-- AC:END -->
```

Format per line: `- [ ] #N Text` or `- [x] #N Text` where:
- `[ ]` = incomplete, `[x]` = complete
- `#N` = 1-based index number
- `Text` = criterion description

---

## CLI Reference

### Global Options

These options work with all commands:

| Option | Description |
|--------|-------------|
| `--plain` | Output in plain text format (key=value, for scripts/agents) |
| `--json` | Output in JSON format |

---

### init

Initialize forge-tasks in the current directory.

```bash
forge-tasks init [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-p, --prefix <prefix>` | Task ID prefix | "TASK" |
| `-n, --name <name>` | Project name | none |
| `-f, --force` | Reinitialize even if already initialized | false |

**Examples:**

```bash
# Basic initialization
forge-tasks init

# Custom prefix for task IDs
forge-tasks init --prefix FEAT

# Named project
forge-tasks init --name "My Project" --prefix BUG
```

---

### create

Create a new task.

```bash
forge-tasks create <title> [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `-d, --description <text>` | Task description |
| `-p, --priority <level>` | Priority: high, medium, low |
| `-a, --assignee <name>` | Assignee name |
| `-l, --label <label>` | Add label (repeatable) |
| `--due <date>` | Due date (ISO format: YYYY-MM-DD) |
| `--depends-on <taskId>` | Add dependency (repeatable) |
| `--ac <criterion>` | Add acceptance criterion (repeatable) |
| `--parent <taskId>` | Parent task ID (for subtasks) |

**Examples:**

```bash
# Simple task
forge-tasks create "Fix login bug"

# Task with all options
forge-tasks create "Add user registration" \
  --description "REST endpoint for new user registration" \
  --priority high \
  --assignee bob \
  --label backend \
  --label api \
  --due 2026-02-15 \
  --depends-on TASK-001 \
  --ac "POST /api/users returns 201 on success" \
  --ac "Returns 400 for invalid email" \
  --ac "Sends verification email"

# Get just the task ID (for scripts)
TASK_ID=$(forge-tasks create "New task" --plain)
```

---

### list (alias: ls)

List all tasks with optional filtering.

```bash
forge-tasks list [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `-s, --status <status>` | Filter by status: todo, in-progress, done, blocked |
| `-p, --priority <priority>` | Filter by priority: high, medium, low |
| `-a, --assignee <name>` | Filter by assignee |
| `-l, --label <label>` | Filter by label |
| `--ready` | Show only tasks with no dependencies |

**Examples:**

```bash
# List all tasks
forge-tasks list

# Filter by status
forge-tasks list --status todo
forge-tasks list --status in-progress

# Filter by priority
forge-tasks list --priority high

# Show tasks ready to work on (no dependencies)
forge-tasks list --ready

# Combine filters
forge-tasks list --status todo --priority high --label backend

# Plain output for parsing
forge-tasks list --plain
# Output: TASK-001 | To Do | high | Implement feature
```

---

### view (alias: show)

View a single task in detail.

```bash
forge-tasks view <taskId>
```

**Examples:**

```bash
# Human-readable output
forge-tasks view TASK-001

# Plain output (for scripts/agents)
forge-tasks view TASK-001 --plain

# JSON output
forge-tasks view TASK-001 --json
```

**Plain output format:**

```
id=TASK-001
title=Implement user authentication
status=In Progress
priority=high
assignee=alice
labels=backend,security
dependencies=TASK-002
created=2026-01-20T10:00:00.000Z
updated=2026-01-20T14:30:00.000Z
description=Add JWT-based auth to the API
plan=1. Create User model\n2. Add endpoints
ac.1=[ ] Login endpoint returns JWT
ac.2=[x] Protected routes require token
notes=Started with User model
```

---

### edit (alias: update)

Edit an existing task.

```bash
forge-tasks edit <taskId> [options]
```

**Basic Field Options:**

| Option | Description |
|--------|-------------|
| `-t, --title <title>` | Update title |
| `-d, --description <text>` | Update description |
| `-s, --status <status>` | Update status: todo, in-progress, done, blocked |
| `-p, --priority <priority>` | Update priority: high, medium, low |
| `-a, --assignee <name>` | Update assignee |
| `--due <date>` | Update due date (YYYY-MM-DD) |

**Plan and Notes Options:**

| Option | Description |
|--------|-------------|
| `--plan <text>` | Set implementation plan (replaces existing) |
| `--append-plan <text>` | Append to implementation plan |
| `--notes <text>` | Set implementation notes (replaces existing) |
| `--append-notes <text>` | Append to implementation notes |

**Label Options:**

| Option | Description |
|--------|-------------|
| `--add-label <label>` | Add a label (repeatable) |
| `--remove-label <label>` | Remove a label (repeatable) |

**Dependency Options:**

| Option | Description |
|--------|-------------|
| `--add-dep <taskId>` | Add a dependency (repeatable) |
| `--remove-dep <taskId>` | Remove a dependency (repeatable) |

**Acceptance Criteria Options:**

| Option | Description |
|--------|-------------|
| `--add-ac <text>` | Add acceptance criterion (repeatable) |
| `--remove-ac <index>` | Remove criterion by index (repeatable) |
| `--check-ac <index>` | Mark criterion as complete (repeatable) |
| `--uncheck-ac <index>` | Mark criterion as incomplete (repeatable) |

**Examples:**

```bash
# Update status
forge-tasks edit TASK-001 --status in-progress

# Multiple updates at once
forge-tasks edit TASK-001 \
  --status in-progress \
  --priority high \
  --assignee alice

# Add implementation plan
forge-tasks edit TASK-001 --plan "1. Step one
2. Step two
3. Step three"

# Append progress notes
forge-tasks edit TASK-001 --append-notes "Completed step one. Moving to step two."

# Check off acceptance criteria
forge-tasks edit TASK-001 --check-ac 1
forge-tasks edit TASK-001 --check-ac 2 --check-ac 3

# Manage labels
forge-tasks edit TASK-001 --add-label urgent --remove-label backlog

# Manage dependencies
forge-tasks edit TASK-001 --add-dep TASK-002 --remove-dep TASK-003
```

---

### delete (alias: rm)

Delete a task.

```bash
forge-tasks delete <taskId> [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `-f, --force` | Skip confirmation prompt |

**Examples:**

```bash
# Delete with confirmation
forge-tasks delete TASK-001

# Delete without confirmation (for scripts)
forge-tasks delete TASK-001 --force
```

---

### search

Search tasks by query string.

```bash
forge-tasks search <query> [options]
```

Searches across: title, description, implementation plan, and implementation notes.

**Options:**

| Option | Description |
|--------|-------------|
| `-s, --status <status>` | Filter by status |
| `-p, --priority <priority>` | Filter by priority |
| `-l, --label <label>` | Filter by label |
| `--limit <number>` | Maximum results (default: 10) |

**Examples:**

```bash
# Basic search
forge-tasks search "authentication"

# Search with filters
forge-tasks search "bug" --status todo --priority high

# Increase result limit
forge-tasks search "api" --limit 25

# Plain output
forge-tasks search "login" --plain
```

---

## Configuration

Configuration is stored in `forge/tasks/config.json`.

### config.json Options

```json
{
  "projectName": "My Project",
  "prefix": "TASK",
  "zeroPadding": 3,
  "defaultPriority": "medium",
  "defaultLabels": ["backlog"]
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `projectName` | string | none | Optional project name for display |
| `prefix` | string | "TASK" | Prefix for task IDs |
| `zeroPadding` | number | 3 | Digits in ID number (3 = "001") |
| `defaultPriority` | string | none | Default priority for new tasks |
| `defaultLabels` | string[] | [] | Labels applied to all new tasks |

### Example Configurations

**Bug tracker:**

```json
{
  "projectName": "Bug Tracker",
  "prefix": "BUG",
  "zeroPadding": 4,
  "defaultPriority": "medium",
  "defaultLabels": ["triage"]
}
```

**Feature backlog:**

```json
{
  "projectName": "Product Backlog",
  "prefix": "FEAT",
  "zeroPadding": 3,
  "defaultLabels": ["backlog", "needs-review"]
}
```

---

## Programmatic Usage

The `TaskManager` class provides programmatic access to all task operations.

### Import

```typescript
import { TaskManager } from "claude-forge/lib/forge-tasks";
// Or from the source:
import { TaskManager } from "./forge-tasks/core/task-manager";
```

### Initialize

```typescript
const manager = new TaskManager("/path/to/project");

// Initialize with custom config
await manager.init({
  prefix: "FEAT",
  projectName: "My Feature Project",
});
```

### Create Task

```typescript
import type { TaskCreateInput } from "claude-forge/lib/forge-tasks";

const input: TaskCreateInput = {
  title: "Implement caching layer",
  description: "Add Redis caching for API responses",
  priority: "high",
  labels: ["performance", "backend"],
  acceptanceCriteria: [
    "Cache GET requests for 5 minutes",
    "Invalidate cache on POST/PUT/DELETE",
  ],
};

const task = await manager.createTask(input);
console.log(`Created: ${task.id}`);
```

### Update Task

```typescript
import type { TaskUpdateInput } from "claude-forge/lib/forge-tasks";

const update: TaskUpdateInput = {
  status: "In Progress",
  implementationPlan: "1. Setup Redis\n2. Add middleware\n3. Test",
};

const updated = await manager.updateTask("TASK-001", update);
```

### List and Filter Tasks

```typescript
import type { TaskListFilter } from "claude-forge/lib/forge-tasks";

// List all tasks
const allTasks = await manager.listTasks();

// Filter tasks
const filter: TaskListFilter = {
  status: "To Do",
  priority: "high",
  hasNoDependencies: true,
};
const readyTasks = await manager.listTasks(filter);
```

### Search Tasks

```typescript
const results = await manager.search("authentication");

// Search with filter
const filtered = await manager.search("api", { status: "In Progress" });
```

### Get Single Task

```typescript
const task = await manager.getTask("TASK-001");
if (task) {
  console.log(`${task.id}: ${task.title}`);
  console.log(`Status: ${task.status}`);
  console.log(`ACs: ${task.acceptanceCriteria.length}`);
}
```

### Delete Task

```typescript
await manager.deleteTask("TASK-001");
```

### Type Definitions

All types are exported for use:

```typescript
import type {
  Task,
  TaskStatus,        // "To Do" | "In Progress" | "Done" | "Blocked"
  TaskPriority,      // "high" | "medium" | "low"
  AcceptanceCriterion,
  TaskCreateInput,
  TaskUpdateInput,
  TaskListFilter,
  ForgeTasksConfig,
} from "claude-forge/lib/forge-tasks";
```

---

## Sub-Agents

Forge-tasks includes specialized agents for automated task workflows, organized into three phases:

```
Planning → Execution → Implementation

┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  task-manager   │ ──▶ │   task-coordinator   │ ──▶ │   task-worker   │
│  (creates tasks)│     │ (delegates to agents)│     │ (implements)    │
└─────────────────┘     └──────────────────────┘     └─────────────────┘
```

### forge-task-manager (Planning Phase)

Digests implementation plans and requirements into well-structured tasks. Use this agent for:

- Breaking down requirements/PRDs into actionable tasks
- Creating tasks with standard labels for routing
- Setting dependencies and priorities
- Organizing work breakdown structure

**System prompt location:** `system-prompts/forge-task-manager-prompt.md`

**Example workflow:**

1. User provides implementation plan or requirements
2. Manager analyzes and breaks down into discrete tasks
3. Manager creates tasks with `forge-tasks create`, applying standard labels
4. Manager sets dependencies between tasks
5. Manager summarizes created tasks and dependency structure

### forge-task-coordinator (Execution Phase)

Coordinates sub-agents to implement existing tasks. Use this agent for:

- Reading and understanding tasks from forge-tasks
- Discovering available agents in the codebase
- Matching tasks to appropriate specialists based on labels
- Delegating with embedded task-update instructions
- Monitoring progress and verifying completion

**System prompt location:** `system-prompts/forge-task-coordinator-prompt.md`

**Example workflow:**

1. Tasks already exist in `forge/tasks/`
2. Coordinator reads tasks: `forge-tasks list --ready --plain`
3. Coordinator discovers available agents via Task tool
4. Coordinator matches task labels to agent capabilities
5. Coordinator delegates via Task tool with CLI instructions embedded
6. Coordinator monitors progress and verifies completion

### forge-task-worker (Implementation Phase)

Implements a single assigned task. Use this agent for:

- Focused implementation of a specific task
- Tracking progress through acceptance criteria
- Adding implementation notes
- Handling and reporting blockers

**System prompt location:** `system-prompts/forge-task-worker-prompt.md`

**Example workflow:**

1. Worker reads task: `forge-tasks view TASK-001 --plain`
2. Worker updates status: `forge-tasks edit TASK-001 --status in-progress`
3. Worker implements, checking off ACs: `forge-tasks edit TASK-001 --check-ac 1`
4. Worker adds notes: `forge-tasks edit TASK-001 --append-notes "Completed X"`
5. Worker marks done: `forge-tasks edit TASK-001 --status done`

### Standard Labels for Routing

The manager creates tasks with standard labels, and the coordinator uses these for routing:

| Label | Work Type | Routes To |
|-------|-----------|-----------|
| `backend` | Server-side logic | Backend specialists |
| `frontend` | UI, components | Frontend specialists |
| `api` | REST/GraphQL endpoints | API specialists |
| `database` | Models, migrations | Database/model agents |
| `testing` | Tests, coverage | Test agents |
| `devops` | CI/CD, deployment | DevOps agents |
| `refactoring` | Code improvement | Refactoring specialists |
| `documentation` | Docs, READMEs | General-purpose |

### Agent Registry

Agents are registered in `lib/forge-tasks.ts`:

```typescript
import { FORGE_TASK_AGENTS } from "claude-forge/lib/forge-tasks";

// Available agents:
// - "forge-task-manager"    (planning)
// - "forge-task-coordinator" (execution)
// - "forge-task-worker"     (implementation)

const coordinatorInfo = FORGE_TASK_AGENTS["forge-task-coordinator"];
console.log(coordinatorInfo.description);
console.log(coordinatorInfo.capabilities);
```

### Agent Discovery

The coordinator discovers available agents through Claude Code's Task tool, which lists:
- **Plugin agents** (namespaced): `plugin-name:agent-name` (e.g., `rails-dev-plugin:rails-model`)
- **Standalone agents**: `agent-name` (e.g., `frontend-design`, `general-purpose`)

When no specialist matches a task's labels, the coordinator falls back to `forge-task-worker` or `general-purpose`.

---

## Common Workflows

### Starting a New Feature

```bash
# 1. Initialize if needed
forge-tasks init --prefix FEAT

# 2. Create the main feature task
forge-tasks create "User authentication system" \
  --description "Complete auth system with JWT tokens" \
  --priority high \
  --ac "Users can register with email/password" \
  --ac "Users can login and receive JWT" \
  --ac "Protected routes validate tokens" \
  --ac "Tokens expire and can be refreshed"

# 3. Break down into subtasks
forge-tasks create "User registration endpoint" \
  --description "POST /api/auth/register" \
  --priority high \
  --ac "Validates email format" \
  --ac "Hashes password with bcrypt" \
  --ac "Returns 201 with user data" \
  --label backend

forge-tasks create "Login endpoint" \
  --description "POST /api/auth/login" \
  --priority high \
  --depends-on FEAT-002 \
  --ac "Validates credentials" \
  --ac "Returns JWT token" \
  --label backend
```

### Working on a Task

```bash
# 1. Find a task to work on
forge-tasks list --status todo --ready

# 2. Start working
forge-tasks edit TASK-001 --status in-progress

# 3. Add your implementation plan
forge-tasks edit TASK-001 --plan "1. Create model
2. Add validation
3. Write tests
4. Implement endpoint"

# 4. As you complete each AC
forge-tasks edit TASK-001 --check-ac 1 \
  --append-notes "Created User model with Prisma"

forge-tasks edit TASK-001 --check-ac 2 \
  --append-notes "Added zod schema for validation"

# 5. Mark complete when all ACs are done
forge-tasks edit TASK-001 --status done \
  --append-notes "All tests passing. Ready for review."
```

### Tracking Team Progress

```bash
# See all in-progress work
forge-tasks list --status in-progress

# Check blocked tasks
forge-tasks list --status blocked

# Find high-priority items
forge-tasks list --priority high --status todo

# Search for specific topics
forge-tasks search "database" --status todo
```

### Script Integration

```bash
#!/bin/bash

# Create task and capture ID
TASK_ID=$(forge-tasks create "Automated task" --plain)
echo "Created: $TASK_ID"

# Update status
forge-tasks edit "$TASK_ID" --status in-progress

# Run your process...
./build.sh

# Mark complete
forge-tasks edit "$TASK_ID" --status done \
  --append-notes "Build completed at $(date)"
```

### JSON Processing

```bash
# Get task data as JSON for processing
forge-tasks view TASK-001 --json | jq '.acceptanceCriteria[] | select(.checked == false)'

# List uncompleted high-priority tasks
forge-tasks list --priority high --json | jq '.[] | select(.status != "Done")'
```

---

## Directory Structure

After initialization:

```
project/
└── forge/
    └── tasks/
        ├── config.json               # Configuration file
        ├── TASK-001 - First task.md
        ├── TASK-002 - Second task.md
        └── TASK-003 - Third task.md
```

---

## Tips

1. **Use plain output for automation**: The `--plain` flag produces easily parseable output for scripts and agents.

2. **Commit task files to git**: Task files are plain markdown, perfect for version control and code review.

3. **Use meaningful acceptance criteria**: Each AC should be independently verifiable. Write from the tester's perspective.

4. **Keep tasks atomic**: If a task has more than 5-7 acceptance criteria, consider breaking it down.

5. **Track blockers immediately**: When stuck, use `--status blocked` with notes explaining why.

6. **Use labels for filtering**: Consistent labels make it easy to find related tasks.

7. **Dependencies prevent premature work**: Use `--depends-on` to ensure tasks are completed in order.
