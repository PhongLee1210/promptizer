---
name: serena-engineering
description: Use Serena for persistent project memory and semantic code intelligence. Apply when exploring an existing codebase, implementing or refactoring features, debugging, understanding dependencies, or maintaining reusable project knowledge.
---

Use Serena as the primary tool for understanding project structure, navigating code, making precise modifications, and maintaining persistent project knowledge. Work autonomously: choose the appropriate tools and workflow based on task complexity. Prioritize existing conventions, minimal changes, correctness, and maintainability.

## WHEN TO USE

- Starting or resuming work on an existing project.
- Understanding architecture, business logic, or unfamiliar code.
- Finding symbols, implementations, and dependencies.
- Implementing features or modifying existing functionality.
- Refactoring code or debugging complex issues.
- Discovering architectural decisions, conventions, or reusable knowledge.
- Maintaining or correcting existing Serena memories.

## HOW TO USE

### 1. Understand

- Inspect available project memories before making assumptions.
- Read relevant memories, starting with `core` or referenced entry points when available.
- Check onboarding status and perform onboarding when necessary.
- Identify task scope and relevant project conventions.

### 2. Explore

- Prefer Serena's semantic tools for symbol discovery, references, implementations, and code structure.
- Follow dependencies and inspect related implementations before changing behavior.
- Read only the code relevant to the task.
- Verify memory assumptions against the current codebase.

### 3. Implement

- Follow existing architecture, naming conventions, and established patterns.
- Prefer symbol-aware operations for targeted code modifications and refactoring.
- Use symbol renaming tools for code-wide renames when appropriate.
- Use regular file editing for changes better suited to text-based operations.
- Keep changes focused and avoid unnecessary abstractions or unrelated modifications.

### 4. Verify

- Inspect diagnostics and resolve relevant errors.
- Run appropriate tests, linting, type checks, or build commands.
- Review the final diff for unintended changes and regressions.
- Never treat successful editing or diagnostics as proof that functionality works.

### 5. Maintain Memory

- Create memories only for stable, non-obvious project knowledge that avoids costly rediscovery.
- Never mention internal documentation (docs, specs, plans, `AGENTS.md`) or planning (roadmap, status, progress, next steps, future work).
- Prefer updating existing memories over creating duplicates.
- Delete outdated or wrong lines instead of archiving them.
- Update memories when important architecture, conventions, or technical decisions change.

#### Organizing memories

- Keep the set minimal: `core` plus a few focused memories, flat by default.
- `core` is the entry point: a few stable invariants plus `mem:` references saying when to read each memory.
- Group into topic folders (`topic/name`) only when a topic needs several memories.
- Use short, descriptive names for what a memory covers, such as `tech_stack`.
- Write dense, terse bullets. Memories do not say when to read them; the referring memory does.
- Use `rename_memory` for renames so `mem:` references stay valid, and run `serena memories check` after moves or deletions.
- Merge or delete memories that overlap, shrink to a line or two, or stop being true.

## CHECK LIST

- [ ] Have I checked relevant existing memories?
- [ ] Do I understand the affected code and its dependencies?
- [ ] Have I verified assumptions against the actual implementation?
- [ ] Am I following existing project conventions?
- [ ] Are my changes focused and maintainable?
- [ ] Have I used semantic tools where they provide an advantage?
- [ ] Have I checked diagnostics and run relevant tests?
- [ ] Have I reviewed the final changes?
- [ ] Is there genuinely useful knowledge worth saving or updating?
- [ ] Are memories accurate, concise, project-scoped, and free from duplication, docs references, and planning?

**Core principle:** Understand before modifying. Use semantic intelligence for precision, tests for correctness, and persistent memory to eliminate repeated discovery. Let the task determine the workflow rather than following unnecessary fixed tool sequences.
