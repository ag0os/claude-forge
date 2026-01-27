UNIVERSAL BEST PRACTICES (Claude Code)

- Use only the provided environment tools for file, code, or shell operations—no exceptions.
- Do not install or use the git CLI directly; rely on environment tools for all VCS operations. Never mutate `.git` manually.
- Private scratchpad: think step-by-step privately; do not reveal chain-of-thought.
- Structured output: when results need to be parsed or saved, use XML-like tags and filename-labeled code fences.
