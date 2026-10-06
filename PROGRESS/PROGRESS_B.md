# PROGRESS — Person B (Logic & Concurrency)
Last updated: 2026-10-06 12:30   |   Current phase: 0

## Current state
Phase 0 skeleton created by Person A. No logic or trigger code written yet. Person B should review and approve the CONTRACT (especially `02_function_signatures.md`) before starting any work in Phase 2.

## Deliverables checklist

| Deliverable | File path | Status | Notes |
|---|---|---|---|
| Review & approve CONTRACT | `CONTRACT/` | not started | Blocking Phase 1 |
| Priority function `compute_priority_score` | `db/03_functions/03a_priority.sql` | not started | Needs schema-v1 tag |
| `sp_recompute_priorities` | `db/03_functions/03a_priority.sql` | not started | |
| Duplicate-request guard trigger | `db/04_triggers/04_triggers.sql` | not started | |
| Allocation procedures (5 procs) | `db/03_functions/03b_allocation_procedures.sql` | not started | |
| `sp_suggest_shelter` helper | `db/03_functions/03c_helpers.sql` | not started | |
| Occupancy sync trigger | `db/04_triggers/04_triggers.sql` | not started | |
| Inventory sync trigger | `db/04_triggers/04_triggers.sql` | not started | |
| Audit logging trigger | `db/04_triggers/04_triggers.sql` | not started | |
| BEFORE validation trigger | `db/04_triggers/04_triggers.sql` | not started | |
| Request status auto-update trigger | `db/04_triggers/04_triggers.sql` | not started | |
| Low-stock alert trigger | `db/04_triggers/04_triggers.sql` | not started | |
| Concurrency demo (session1 + session2 + README) | `db/tests/concurrency/` | not started | |
| Trigger tests | `db/tests/triggers/` | not started | |
| `triggers_explained.md` | `docs/B_logic/triggers_explained.md` | not started | |
| `procedures_explained.md` | `docs/B_logic/procedures_explained.md` | not started | |
| `concurrency_demo.md` | `docs/B_logic/concurrency_demo.md` | not started | |
| `report_section_B.md` | `docs/B_logic/report_section_B.md` | not started | |

## Next steps (ordered, max 5)
1. Review CONTRACT files and give approval (or raise Change Requests).
2. Wait for `schema-v1` tag from Person A.
3. Draft trigger/procedure logic on paper while waiting for schema.
4. Implement `compute_priority_score` first (needed by seed and views).
5. Implement allocation procedures with `FOR UPDATE` and explicit lock ordering.

## Blockers and waiting on
- **CONTRACT approval** (all three, since 2026-10-06).
- **`schema-v1` tag** from Person A (Phase 1 completion).

## Dependencies and Change Requests
- None yet.

## Decisions made (and why)
- (none yet)

## How to run / test what exists
```
# Nothing to run yet.
```

## Change log (newest first)
- 2026-10-06 12:30 | `PROGRESS_B.md` | Phase 0 placeholder created by Person A | tested: n/a
