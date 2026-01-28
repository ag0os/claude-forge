# Forge Config: Global Configuration Access

Add a compiled binary that outputs shared configurations, allowing forkhestra and other tools to access claude-forge configs from any project.

## Problem Statement

Forkhestra currently looks for `forge/chains.json` in the working directory. When running from a different project:

```bash
cd /other/project
forkhestra --chain build-and-pr
# Error: No forge/chains.json found
```

Users must either:
1. Copy `chains.json` to every project
2. Always run from claude-forge with `--cwd`

Neither is ergonomic for a workflow tool meant to be used across projects.

## Design

### Compiled Config Binary

Create a binary `forge-config` that bundles configurations at compile time:

```bash
forge-config chains      # outputs chains.json content
forge-config agents      # lists available compiled agents
forge-config path        # outputs claude-forge directory path
```

Since `bin/` is in PATH, this binary is available system-wide.

### Forkhestra Fallback Resolution

Update forkhestra to resolve chains.json in order:

1. Local `./forge/chains.json` (project-specific override)
2. `forge-config chains` output (global shared config)
3. Error if neither found

This allows:
- Projects to define their own chains (local override)
- Fallback to shared chains from claude-forge
- Zero config needed for most projects

### Usage Examples

```bash
# From any directory - uses global chains
cd /some/other/project
forkhestra --chain build-and-pr -p "Implement the feature"

# Project with local override
cd /project-with-custom-chains
forkhestra --chain my-custom-chain  # uses local chains.json

# Explicit config source (future enhancement)
forkhestra --config global --chain build-and-pr
forkhestra --config local --chain my-chain
```

### Config Binary Commands

| Command | Output | Use Case |
|---------|--------|----------|
| `forge-config chains` | chains.json content | Forkhestra chain resolution |
| `forge-config agents` | List of compiled agent names | Agent discovery |
| `forge-config path` | Claude-forge install path | Debugging, tooling |
| `forge-config version` | Version info | Debugging |

## Implementation Plan

### Task 1: Create forge-config Binary

**File:** `agents/util/forge-config.ts`

```typescript
#!/usr/bin/env -S bun run

import chains from "../../forge/chains.json" with { type: "json" };

const command = process.argv[2];

switch (command) {
  case "chains":
    console.log(JSON.stringify(chains, null, 2));
    break;
  case "agents":
    // List bin/ contents
    break;
  case "path":
    // Output resolved path to claude-forge
    break;
  default:
    console.error("Usage: forge-config <chains|agents|path>");
    process.exit(1);
}
```

**Acceptance Criteria:**
- [ ] `forge-config chains` outputs valid JSON
- [ ] `forge-config agents` lists all compiled agents
- [ ] `forge-config path` outputs absolute path
- [ ] `forge-config` (no args) shows usage
- [ ] Unknown commands show error
- [ ] Compiles to standalone binary
- [ ] Works from any directory

### Task 2: Update Forkhestra Config Resolution

**File:** `forkhestra/lib/config.ts`

Add fallback resolution:

```typescript
export async function loadConfig(cwd: string): Promise<ForkhestraConfig | null> {
  // 1. Try local config
  const localPath = join(cwd, "forge", "chains.json");
  if (existsSync(localPath)) {
    return JSON.parse(await readFile(localPath, "utf-8"));
  }

  // 2. Try forge-config binary
  try {
    const result = await $`forge-config chains`.quiet();
    return JSON.parse(result.stdout.toString());
  } catch {
    // forge-config not available
  }

  return null;
}
```

**Acceptance Criteria:**
- [ ] Local config takes precedence
- [ ] Falls back to forge-config when local not found
- [ ] Handles forge-config not in PATH gracefully
- [ ] Error message explains resolution attempts
- [ ] Verbose mode shows which config source was used

### Task 3: Add Agent Discovery

**File:** `agents/util/forge-config.ts`

Implement `agents` command:

```typescript
case "agents":
  const binDir = join(dirname(process.execPath), ".");
  const agents = readdirSync(binDir)
    .filter(f => !f.startsWith("."))
    .sort();
  console.log(agents.join("\n"));
  break;
```

**Acceptance Criteria:**
- [ ] Lists all binaries in bin directory
- [ ] One agent per line
- [ ] Sorted alphabetically
- [ ] Works regardless of current directory

### Task 4: Add Path Resolution

**File:** `agents/util/forge-config.ts`

```typescript
case "path":
  // Resolve from binary location
  const forgePath = resolve(dirname(process.execPath), "..");
  console.log(forgePath);
  break;
```

**Acceptance Criteria:**
- [ ] Outputs absolute path to claude-forge root
- [ ] Works from any directory
- [ ] Path is valid and exists

### Task 5: Update Documentation

**Files:**
- `CLAUDE.md` - Add forge-config section
- `docs/FORKHESTRA.md` - Document config resolution

**Acceptance Criteria:**
- [ ] forge-config commands documented
- [ ] Config resolution order explained
- [ ] Examples for cross-project usage

## Testing Strategy

### Unit Tests
- Config resolution with local file
- Config resolution with forge-config fallback
- Config resolution with neither (error case)

### Integration Tests
- Run forkhestra from directory without local config
- Run forkhestra from directory with local config override
- Verify forge-config outputs valid JSON

### Manual Tests
```bash
# Test from claude-forge (local config)
cd ~/Projects/claude-forge
forkhestra --chain build-and-pr --dry-run

# Test from another project (global fallback)
cd ~/Projects/other-project
forkhestra --chain build-and-pr --dry-run

# Test forge-config directly
forge-config chains | jq .
forge-config agents
forge-config path
```

## Edge Cases

1. **forge-config not compiled**: Clear error message directing user to compile

2. **Corrupted JSON output**: Validate JSON before using, show parse error

3. **bin/ not in PATH**: Document PATH setup in installation instructions

4. **Local config syntax error**: Show local path in error message

5. **Chain exists in global but not local**: Works (fallback used)

6. **Chain exists in local but not global**: Works (local takes precedence)

## Future Considerations

- **Config merging**: Merge local and global configs (local chains + global chains)
- **Environment-specific configs**: `forge-config chains --env production`
- **Remote configs**: Fetch chains from URL
- **Config validation**: `forge-config validate` to check syntax
- **Interactive mode**: `forge-config edit` to modify configs
