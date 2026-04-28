# ADR-0086: Checkbox Task Extraction and Deadline Syntax

**Date:** 2026-04-26
**Status:** Accepted

## Context

Users create action items as GFM checkboxes inside notes. There is no way to view all tasks
across the vault in one place. We need to extract checkboxes at parse time and expose them
via a dedicated IPC command.

## Decision

- Add `vault/tasks.rs` for checkbox parsing. Keep `VaultEntry` lean: only add `task_count: u32`
  (badge display). Full task list is fetched on demand via `get_vault_tasks`.
- Parse all three deadline syntaxes for interoperability:
  - `due:YYYY-MM-DD` (canonical — plain ASCII, grep-friendly)
  - `@YYYY-MM-DD`
  - `📅YYYY-MM-DD` (Obsidian Tasks compat)
- Deadline token is stripped from `CheckboxTask.text` after extraction.
- Code blocks (fenced with ``` or ~~~) are skipped during checkbox scanning.
- Sort order: open tasks first, then deadline ascending (no deadline last), then note path + line.

## Alternatives Considered

- **Embed full task list in `VaultEntry`:** Rejected — bloats cache and serialization for every
  list_vault call even when the task view is not open.
- **Single deadline syntax only:** Rejected — parsing all three costs nothing and avoids
  friction for users migrating from Obsidian.

## Consequences

- Cache version bumped from 13 to 14 (forces full rescan on upgrade).
- `taskCount` on VaultEntry enables future badge display in note list without re-fetching all tasks.
- Frontend task view uses `get_vault_tasks` on mount (same pattern as `get_vault_pulse`).
