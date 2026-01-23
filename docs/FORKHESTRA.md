# Forkhestra Documentation

Comprehensive guide for orchestrating Claude agents with forkhestra.

## Overview

Forkhestra is an agent orchestration system that chains and loops Claude agents. It provides:

- **Pipeline mode**: Run agents once each, in sequence
- **Loop mode**: Run agents repeatedly until completion or max iterations
- **Config mode**: Define reusable chains in `forge/chains.json`
- **Prompt support**: Pass instructions to agents at runtime or via configuration

## Quick Start

```bash
# Run a single agent once
forkhestra task-manager

# Loop an agent until it signals completion (max 10 iterations)
forkhestra task-coordinator:10

# Run a pipeline (each agent once)
forkhestra "task-manager -> task-coordinator"

# Run a named chain from config
forkhestra --chain plan-and-build

# Run with a prompt
forkhestra task-manager:3 -p "Create tasks from requirements.md"
```

---

## CLI Reference

### Basic Syntax

```bash
forkhestra <agent>[:iterations]              # Single agent mode
forkhestra "<dsl>"                           # DSL chain mode
forkhestra --chain <name> [VAR=value...]     # Config mode
```

### Options

| Option | Short | Description |
|--------|-------|-------------|
| `--cwd <path>` | | Working directory for all agents |
| `--verbose` | `-v` | Show full agent output and iteration details |
| `--dry-run` | | Show what would run without executing |
| `--chain <name>` | | Run named chain from `forge/chains.json` |
| `--prompt <text>` | `-p` | Inline prompt to pass to all agents |
| `--prompt-file <path>` | | Path to file containing prompt |
| `--help` | `-h` | Show help message |

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All steps completed successfully |
| 1 | One or more steps did not complete |
| 2 | Configuration or runtime error |

---

## DSL Syntax

The forkhestra DSL provides a simple way to define agent chains:

### Single Agent

```bash
# Run once (no iteration limit, no completion marker check)
forkhestra agent-name

# Loop up to N iterations, watching for completion marker
forkhestra agent-name:10
```

### Pipelines

```bash
# Run agents in sequence, once each
forkhestra "agent-a -> agent-b -> agent-c"

# Chain with iteration limits per step
forkhestra "agent-a:3 -> agent-b:10"
```

### Behavior Summary

| Syntax | Mode | Completion Check |
|--------|------|------------------|
| `agent` | Single run | Exit code 0 = success |
| `agent:N` | Loop | Marker or max iterations |
| `a -> b` | Pipeline | Each runs once |
| `a:N -> b:M` | Chain | Each loops with limits |

---

## Prompt Support

Forkhestra can pass prompts to agents, providing runtime instructions that tell agents what specific task to perform.

### CLI Prompts

CLI prompts apply to **all steps** in the chain:

```bash
# Inline prompt
forkhestra task-manager:3 --prompt "Create tasks from plan.md"
forkhestra task-manager:3 -p "Create tasks from plan.md"

# Prompt from file
forkhestra task-manager:3 --prompt-file prompts/instructions.md

# With config chain (overrides all config prompts)
forkhestra --chain plan-and-build --prompt "Focus on authentication feature"
```

### Config Prompts

For per-step prompts, use configuration in `forge/chains.json`:

```json
{
  "chains": {
    "feature-build": {
      "description": "Build a feature with different prompts per step",
      "prompt": "Chain-level prompt (used when step has no prompt)",
      "steps": [
        {
          "agent": "task-manager",
          "iterations": 3,
          "prompt": "Create tasks for the login feature"
        },
        {
          "agent": "task-coordinator",
          "iterations": 10,
          "promptFile": "prompts/coordinator-instructions.md"
        }
      ]
    }
  }
}
```

### Prompt Resolution Priority

When multiple prompt sources exist, the highest priority wins:

| Priority | Source | Scope | Example |
|----------|--------|-------|---------|
| 1 (highest) | CLI `--prompt` | All steps | `--prompt "Focus on auth"` |
| 1 | CLI `--prompt-file` | All steps | `--prompt-file prompts/auth.md` |
| 2 | Step `prompt` | This step only | `{ "prompt": "Step instruction" }` |
| 2 | Step `promptFile` | This step only | `{ "promptFile": "prompts/step.md" }` |
| 3 | Chain `prompt` | All steps in chain | `{ "prompt": "Chain default" }` |
| 3 | Chain `promptFile` | All steps in chain | `{ "promptFile": "prompts/chain.md" }` |
| 4 (lowest) | Agent `defaultPrompt` | Fallback for agent | See agents section |
| 4 | Agent `defaultPromptFile` | Fallback for agent | See agents section |

**Important**: At each level, inline `prompt` takes precedence over `promptFile`.

### Agent Default Prompts

Define default prompts for specific agents in the `agents` section:

```json
{
  "agents": {
    "task-manager": {
      "defaultPrompt": "Create tasks from current requirements"
    },
    "task-coordinator": {
      "defaultPromptFile": "prompts/coordinator-default.md"
    }
  },
  "chains": {
    "quick-build": {
      "description": "Agents use their default prompts",
      "steps": [
        { "agent": "task-manager", "iterations": 3 },
        { "agent": "task-coordinator", "iterations": 10 }
      ]
    }
  }
}
```

### Variable Substitution in Prompts

Variables (`${VAR_NAME}`) are substituted in prompt fields:

```json
{
  "chains": {
    "build-feature": {
      "description": "Build a specific feature",
      "prompt": "Work on the ${FEATURE_NAME} feature",
      "steps": [
        {
          "agent": "task-manager",
          "prompt": "Create tasks for ${FEATURE_NAME} from ${REQUIREMENTS_FILE}"
        },
        { "agent": "task-coordinator", "iterations": 10 }
      ]
    }
  }
}
```

Run with variables:

```bash
forkhestra --chain build-feature FEATURE_NAME=authentication REQUIREMENTS_FILE=docs/auth-spec.md
```

### Prompt File Paths

Prompt files are resolved relative to the working directory (`--cwd` or current directory):

```bash
# Reads ./prompts/instructions.md
forkhestra task-manager:3 --prompt-file prompts/instructions.md

# With explicit cwd
forkhestra task-manager:3 --cwd /path/to/project --prompt-file prompts/instructions.md
# Reads /path/to/project/prompts/instructions.md
```

### Per-Iteration Behavior

The same prompt applies to every iteration of a looping agent. Agents track their own state, and the prompt provides the overall objective:

```bash
# Same prompt used for all 10 iterations
forkhestra task-coordinator:10 -p "Complete all pending tasks"
```

---

## Configuration Reference

Configuration is stored in `forge/chains.json` at the project root.

### Full Schema

```json
{
  "agents": {
    "<agent-name>": {
      "defaultPrompt": "Default inline prompt for this agent",
      "defaultPromptFile": "path/to/default-prompt.md"
    }
  },
  "chains": {
    "<chain-name>": {
      "description": "Human-readable description of the chain",
      "prompt": "Chain-level prompt for all steps",
      "promptFile": "path/to/chain-prompt.md",
      "steps": [
        {
          "agent": "agent-binary-name",
          "iterations": 10,
          "args": ["--flag", "value", "${VARIABLE}"],
          "prompt": "Step-specific prompt",
          "promptFile": "path/to/step-prompt.md"
        }
      ]
    }
  }
}
```

### Field Reference

#### Root Level

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `chains` | object | Yes | Map of chain names to configurations |
| `agents` | object | No | Map of agent names to default configurations |

#### Agent Config

| Field | Type | Description |
|-------|------|-------------|
| `defaultPrompt` | string | Default prompt text for this agent |
| `defaultPromptFile` | string | Path to default prompt file |

#### Chain Config

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | string | No | Human-readable chain description |
| `prompt` | string | No | Default prompt for all steps |
| `promptFile` | string | No | Path to default prompt file |
| `steps` | array | Yes | Array of step configurations |

#### Step Config

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agent` | string | Yes | Agent binary name (must be in PATH) |
| `iterations` | number | No | Max iterations (enables loop mode) |
| `args` | string[] | No | Arguments to pass to agent |
| `prompt` | string | No | Prompt for this step |
| `promptFile` | string | No | Path to prompt file for this step |

---

## Completion Marker Contract

Agents participating in forkhestra loops must output `FORKHESTRA_COMPLETE` on its own line when their work is done.

### How It Works

1. Forkhestra spawns the agent and streams stdout
2. After each iteration, forkhestra checks if stdout contained `FORKHESTRA_COMPLETE`
3. If marker detected: stop looping, mark step as complete
4. If not detected: continue to next iteration (up to max)

### Implementing in Agents

```typescript
// At the end of your agent's work
if (workComplete) {
  console.log("All tasks done!");
  console.log("FORKHESTRA_COMPLETE");
}
```

### Single-Run vs Loop Mode

| Mode | Completion Check |
|------|------------------|
| Single (`agent`) | Exit code 0 = success |
| Loop (`agent:N`) | `FORKHESTRA_COMPLETE` marker or max iterations |

---

## Examples

### Basic Pipeline

```bash
# Create tasks, then implement them
forkhestra "task-manager -> task-coordinator"
```

### Loop with Prompt

```bash
# Keep coordinating until all tasks done (max 15 iterations)
forkhestra task-coordinator:15 -p "Complete all high-priority tasks first"
```

### Config Chain with Variables

```json
{
  "chains": {
    "implement-task": {
      "description": "Work on a specific task",
      "steps": [
        {
          "agent": "forge-task-worker",
          "iterations": 8,
          "args": ["--task", "${TASK_ID}"],
          "prompt": "Implement ${TASK_ID} following TDD practices"
        }
      ]
    }
  }
}
```

```bash
forkhestra --chain implement-task TASK_ID=TASK-001
```

### Multi-Step with Different Prompts

```json
{
  "chains": {
    "full-workflow": {
      "description": "Planning and execution with tailored prompts",
      "steps": [
        {
          "agent": "task-manager",
          "iterations": 2,
          "prompt": "Break down requirements.md into atomic tasks with clear ACs"
        },
        {
          "agent": "task-coordinator",
          "iterations": 15,
          "prompt": "Implement tasks in dependency order, running tests after each"
        }
      ]
    }
  }
}
```

### CLI Override of Config Prompts

```bash
# Config has default prompts, but this overrides ALL of them
forkhestra --chain full-workflow --prompt "Focus only on authentication tasks"
```

### Dry Run to Preview Prompts

```bash
forkhestra --chain full-workflow --dry-run
```

Output shows resolved prompts for each step:

```
[forkhestra] Dry run - would execute the following chain:

  1. task-manager - loop up to 2 iterations
       prompt: "Break down requirements.md into atomic tasks with clear ACs"
  2. task-coordinator - loop up to 15 iterations
       prompt: "Implement tasks in dependency order, running tests after each"

[forkhestra] Dry run complete. No agents were executed.
```

---

## Troubleshooting

### Agent Not Found

```
Error: spawn task-manager ENOENT
```

Ensure the agent binary is in your PATH. For forge agents, compile them first:

```bash
bun compile agents/forge-task-manager.ts
# Binary created at ./bin/forge-task-manager
export PATH="$PATH:$(pwd)/bin"
```

### Prompt File Not Found

```
Error: Prompt file not found: prompts/missing.md
```

Prompt files are resolved relative to the working directory. Check:
1. File exists at the specified path
2. Working directory is correct (use `--cwd` if needed)

### Max Iterations Reached

If a loop agent never outputs `FORKHESTRA_COMPLETE`:
1. Check agent logs for errors
2. Increase iteration limit if needed
3. Ensure agent outputs the marker when work is complete

### Variable Not Provided

```
Error: Variable 'TASK_ID' referenced in 'forge-task-worker' but not provided
```

Pass the variable via CLI:

```bash
forkhestra --chain single-task TASK_ID=TASK-001
```

---

## Tips

1. **Use `--dry-run` first**: Preview what will execute before running
2. **Start with low iteration counts**: Debug with `:3` before using `:15`
3. **Verbose mode for debugging**: Use `-v` to see iteration progress and prompt resolution
4. **Config for complex workflows**: Use `forge/chains.json` for reproducible, version-controlled chains
5. **CLI prompts for one-off runs**: Use `--prompt` for quick experiments
6. **Agent defaults for consistency**: Set default prompts in the `agents` section
