---
description: Group file changes by logic scope and commit each group with a single-line message
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git add:*), Bash(git commit:*), Read, Grep, Glob
---

Review every pending file change in the working tree, including untracked files, and determine the logical scope of each change rather than treating files as independent units. Read the diffs closely enough to understand intent: a single scope may span several files, and one file may contain changes that belong to different scopes.

Group the changes into cohesive scopes, where each group contains only changes that serve one logical purpose. Keep refactors, bug fixes, feature work, tests, configuration, and documentation in separate groups unless a change is meaningless without its counterpart.

Commit each group separately, staging only the files (or hunks, when a file spans multiple scopes) that belong to that group. Write a single-line commit message for each commit in the Conventional Commits format `type(scope): summary`, using the imperative mood, lower case after the colon, no trailing period, and a length of 72 characters or less. The message must describe the logical change, not the files touched. Never combine unrelated scopes into one commit and never add a commit body.

Before committing, present the proposed grouping and its commit messages for review, then create the commits in a dependency-safe order once approved. Do not push.
