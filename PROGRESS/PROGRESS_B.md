# PROGRESS - Person B (Logic & Concurrency)
Last updated: 2026-10-07 14:49   |   Current phase: 2

## Current state (one paragraph)
All Person B deliverables are written as draft SQL and documentation files on the `logic` branch, consistent with the CONTRACT. The files use the exact table and column names from `CONTRACT/01_entities_and_columns.md` and the exact function signatures from `CONTRACT/02_function_signatures.md`. The code is marked "draft" because `db/01_schema/01_schema.sql` (Person A) is still a placeholder — the SQL cannot be tested against a real database until the schema is delivered and tagged `schema-v1`. Once that happens, move to Phase 3 (run against real DB, fix any name mismatches, test).

## Deliverables checklist

| Deliverable | File path | Status | Notes |
|---|---|---|---|
| Review & approve CONTRACT | `CONTRACT/` | done | Approved as-is; no changes needed |
| Priority function `compute_priority_score` | `db/03_functions/03a_priority.sql` | done | Awaiting schema to test |
| `sp_recompute_priorities` | `db/03_functions/03a_priority.sql` | done | Same |
| Duplicate-request guard function | `db/03_functions/03c_helpers.sql` | done | `fn_is_duplicate_request` |
| Duplicate-request guard trigger | `db/04_triggers/04_triggers.sql` | done | `trg_block_duplicate_request` |
| Allocation procedures (5 procs) | `db/03_functions/03b_allocation_procedures.sql` | done | All 5 written with FOR UPDATE |
| `sp_suggest_shelter` helper | `db/03_functions/03c_helpers.sql` | done | Returns ranked shelters |
| Occupancy sync trigger | `db/04_triggers/04_triggers.sql` | done | `trg_sync_occupancy` |
| Inventory sync trigger | `db/04_triggers/04_triggers.sql` | done | `trg_sync_inventory` |
| Volunteer status sync trigger | `db/04_triggers/04_triggers.sql` | done | `trg_sync_volunteer_status` |
| Audit logging trigger | `db/04_triggers/04_triggers.sql` | done | `trg_audit_allocation` |
| BEFORE validation trigger | `db/04_triggers/04_triggers.sql` | done | `trg_validate_alloc_before` |
| Priority-on-insert trigger | `db/04_triggers/04_triggers.sql` | done | `trg_set_priority_on_insert` |
| updated_at trigger | `db/04_triggers/04_triggers.sql` | done | `trg_set_updated_at` |
| Low-stock alert trigger | `db/04_triggers/04_triggers.sql` | done | `trg_check_low_stock` |
| Concurrency demo session1 | `db/tests/concurrency/session1.sql` | done | Needs real DB to run |
| Concurrency demo session2 | `db/tests/concurrency/session2.sql` | done | |
| Concurrency demo README | `db/tests/concurrency/README.md` | done | |
| Trigger test suite | `db/tests/triggers/test_triggers.sql` | done | 8 tests, all rollback |
| `triggers_explained.md` | `docs/B_logic/triggers_explained.md` | done | |
| `procedures_explained.md` | `docs/B_logic/procedures_explained.md` | done | |
| `concurrency_demo.md` | `docs/B_logic/concurrency_demo.md` | done | |
| `report_section_B.md` | `docs/B_logic/report_section_B.md` | done | Draft, screenshots TBD |

## Next steps (ordered, max 5)
1. Wait for Person A to deliver `schema-v1` tag (`db/01_schema/01_schema.sql` + `02a_seed_small.sql`).
2. Run `reset_db.ps1` and execute files 01-04 in order against a real PostgreSQL 15 instance.
3. Fix any name mismatches between trigger/procedure code and actual schema columns.
4. Run `db/tests/triggers/test_triggers.sql` and record output.
5. Run two-session concurrency demo and record terminal output for report.

## Blockers and waiting on
- **BLOCKED on schema-v1** (Person A) — cannot test SQL against a real database.
  Since: 2026-10-07.

## Dependencies and Change Requests
- None open. All column and function names used are from the CONTRACT.
- NOTE to Person C: `sp_allocate_resource` currently identifies inventory via
  `resource_type_id` inside the trigger (see comment in `trg_sync_inventory`).
  If Person A adds a direct `inventory_id` FK column to `allocations`, raise a
  CR so B can update the trigger's sub-select to use it directly.

## Decisions made (and why)
- **READ COMMITTED + FOR UPDATE** (not SERIALIZABLE): Surgical locking on only
  the rows being allocated; avoids serialization-failure overhead on read queries.
- **Table-driven vulnerability weights**: Weights live in `vulnerability_types`,
  not hard-coded in the function. Changing a weight requires one UPDATE, not
  a code deployment.
- **Consistent lock order** (help_requests → shelter/volunteer/inventory): Eliminates
  deadlock possibility by making circular waits structurally impossible.
- **Trigger-maintained denormalized columns** (`current_occupancy`,
  `availability_status`): Justified by query performance; triggers ensure correctness
  even if someone bypasses stored procedures.
- **60-minute duplicate detection window**: Conservative; can be changed in the
  trigger call to `fn_is_duplicate_request` without touching the function itself.

## How to run / test what exists
```powershell
# After schema-v1 is tagged and available:
cd C:\Users\Pranav\.gemini\antigravity-ide\scratch\DRSCP
.\db\scripts\reset_db.ps1

# Run trigger tests (standalone, uses BEGIN/ROLLBACK):
psql -U drscp_admin -d drscp -f db/tests/triggers/test_triggers.sql

# Run concurrency demo (two windows):
# Window 1: psql -U drscp_admin -d drscp -f db/tests/concurrency/session1.sql
# Window 2: psql -U drscp_admin -d drscp -f db/tests/concurrency/session2.sql
```

## Change log (newest first)
- 2026-10-07 14:49 | All B-owned files | Phase 2 draft: wrote all 03*, 04*, concurrency tests, trigger tests, docs | not tested (schema not yet available)
- 2026-10-06 12:30 | PROGRESS_B.md | Phase 0 skeleton created by Person A; everything not started
