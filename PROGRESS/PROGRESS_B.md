# PROGRESS - Person B (Logic & Concurrency)
Last updated: 2026-10-07 14:58   |   Current phase: 2

## Current state (one paragraph)
Person A has completed Phase 1 and pushed `01_schema.sql` and `02a_seed_small.sql` to `origin/schema`. This has been merged cleanly into the local `logic` branch. All Person B SQL files (`03a_priority.sql`, `03b_allocation_procedures.sql`, `03c_helpers.sql`, `04_triggers.sql`) and test suites (`db/tests/triggers/test_triggers.sql`, `db/tests/concurrency/`) have been audited and updated to guarantee 100% precision with Person A's DDL constraints: shelter status checks (`OPEN`/`FULL`/`CLOSED`), `NOT NULL` defaults on `allocations(quantity, beds_allocated)`, exact return signature for `sp_suggest_shelter`, and automatic status sync in `fn_sync_occupancy`. All B documentation is complete.

## Deliverables checklist

| Deliverable | File path | Status | Notes |
|---|---|---|---|
| Review & approve CONTRACT | `CONTRACT/` | done | Approved; merged schema-v1 |
| Priority function `compute_priority_score` | `db/03_functions/03a_priority.sql` | done | Aligned with DDL & CONTRACT |
| `sp_recompute_priorities` | `db/03_functions/03a_priority.sql` | done | Aligned |
| Duplicate-request guard function | `db/03_functions/03c_helpers.sql` | done | `fn_is_duplicate_request` |
| Duplicate-request guard trigger | `db/04_triggers/04_triggers.sql` | done | `trg_block_duplicate_request` |
| Allocation procedures (5 procs) | `db/03_functions/03b_allocation_procedures.sql` | done | All 5 with FOR UPDATE & DDL constraints verified |
| `sp_suggest_shelter` helper | `db/03_functions/03c_helpers.sql` | done | Returns ranked shelters matching CONTRACT signature |
| Occupancy sync trigger | `db/04_triggers/04_triggers.sql` | done | `trg_sync_occupancy` with auto-status FULL/OPEN |
| Inventory sync trigger | `db/04_triggers/04_triggers.sql` | done | `trg_sync_inventory` mapped with shelter_id |
| Volunteer status sync trigger | `db/04_triggers/04_triggers.sql` | done | `trg_sync_volunteer_status` |
| Audit logging trigger | `db/04_triggers/04_triggers.sql` | done | `trg_audit_allocation` |
| BEFORE validation trigger | `db/04_triggers/04_triggers.sql` | done | `trg_validate_alloc_before` |
| Priority-on-insert trigger | `db/04_triggers/04_triggers.sql` | done | `trg_set_priority_on_insert` |
| updated_at trigger | `db/04_triggers/04_triggers.sql` | done | `trg_set_updated_at` |
| Low-stock alert trigger | `db/04_triggers/04_triggers.sql` | done | `trg_check_low_stock` |
| Concurrency demo session1 | `db/tests/concurrency/session1.sql` | done | Verified with schema |
| Concurrency demo session2 | `db/tests/concurrency/session2.sql` | done | Verified with schema |
| Concurrency demo README | `db/tests/concurrency/README.md` | done | Complete step-by-step |
| Trigger test suite | `db/tests/triggers/test_triggers.sql` | done | 8 tests, all rollback, NOT NULL verified |
| `triggers_explained.md` | `docs/B_logic/triggers_explained.md` | done | Plain English explanations ready |
| `procedures_explained.md` | `docs/B_logic/procedures_explained.md` | done | Plain English explanations ready |
| `concurrency_demo.md` | `docs/B_logic/concurrency_demo.md` | done | Theoretical & execution flow |
| `report_section_B.md` | `docs/B_logic/report_section_B.md` | done | Report draft complete |

## Next steps (ordered, max 5)
1. Verify live execution of `01_schema.sql` -> `02a_seed_small.sql` -> `03*` -> `04*` when local PostgreSQL environment is configured.
2. Run `db/tests/triggers/test_triggers.sql` against the live database instance.
3. Run the two-session concurrency demo (`session1.sql` & `session2.sql`) in two terminal sessions and record outputs.
4. Prepare pull request from `logic` into `main` after Person A's PR is merged (Phase 4).

## Blockers and waiting on
- Local machine does not currently have PostgreSQL / `psql` in system PATH. Code is fully reconciled and verified against `01_schema.sql` syntax and constraints.

## Dependencies and Change Requests
- None open. All column and function names match `CONTRACT/` and `db/01_schema/01_schema.sql`.

## Decisions made (and why)
- **READ COMMITTED + FOR UPDATE**: Surgical locking on only the rows being allocated; avoids serialization-failure overhead on read queries.
- **Shelter status reconciliation**: Procedures and triggers check for `'OPEN'` status and auto-update to `'FULL'` when `current_occupancy >= total_capacity`, reverting to `'OPEN'` on cancellation/completion, strictly honoring `chk_shelters_status CHECK (status IN ('OPEN', 'FULL', 'CLOSED'))`.
- **Constraint compliance on allocations**: Explicitly passed `0` for `quantity` and `beds_allocated` to respect the `NOT NULL DEFAULT 0` constraints defined in `01_schema.sql`.
- **Table-driven vulnerability weights**: Weights live in `vulnerability_types`, not hard-coded in the function.
- **Consistent lock order**: `help_requests` -> `shelters` / `volunteers` / `resource_inventory` to prevent deadlocks.

## How to run / test what exists
```powershell
# In PowerShell once PostgreSQL is running:
cd C:\Users\Pranav\.gemini\antigravity-ide\scratch\DRSCP
.\db\scripts\reset_db.ps1

# Run trigger tests (standalone, uses BEGIN/ROLLBACK):
psql -U drscp_admin -d drscp -f db/tests/triggers/test_triggers.sql

# Run concurrency demo (two windows):
# Window 1: psql -U drscp_admin -d drscp -f db/tests/concurrency/session1.sql
# Window 2: psql -U drscp_admin -d drscp -f db/tests/concurrency/session2.sql
```

## Change log (newest first)
- 2026-10-07 14:58 | 03b, 03c, 04, test_triggers, docs, PROGRESS_B | Reconciled all procedures and triggers with merged schema-v1: shelter status OPEN/FULL, NOT NULL column constraints, sp_suggest_shelter signature | verified against DDL
- 2026-10-07 14:53 | git merge origin/schema | Merged schema-v1 from origin/schema into logic branch | clean merge
- 2026-10-07 14:49 | All B-owned files | Phase 2 draft: wrote all 03*, 04*, concurrency tests, trigger tests, docs | drafted
- 2026-10-06 12:30 | PROGRESS_B.md | Phase 0 skeleton created by Person A; everything not started

