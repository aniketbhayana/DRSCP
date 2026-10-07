# PROGRESS — Person A (Design & Schema)
Last updated: 2026-10-07 14:35   |   Current phase: 1

## Current state
Phase 1 is complete! All four CONTRACT files have been approved and frozen. The complete relational design, mathematical 3NF normalization proof, architecture justification, idempotent DDL schema (`01_schema.sql`), and small cohesive disaster relief seed data (`02a_seed_small.sql`) are implemented and ready. Person B and Person C are unblocked and can immediately begin their Phase 2 work against the schema and seed data.

## Deliverables checklist

| Deliverable | File path | Status | Notes |
|---|---|---|---|
| Repo skeleton + .gitignore | `drscp/` | done | Phase 0 |
| CONTRACT/01_entities_and_columns.md | `CONTRACT/01_entities_and_columns.md` | done | Approved & Frozen (2026-10-07) |
| CONTRACT/02_function_signatures.md | `CONTRACT/02_function_signatures.md` | done | Approved & Frozen (2026-10-07) |
| CONTRACT/03_api_endpoints.md | `CONTRACT/03_api_endpoints.md` | done | Approved & Frozen (2026-10-07) |
| CONTRACT/04_roles_and_permissions.md | `CONTRACT/04_roles_and_permissions.md` | done | Approved & Frozen (2026-10-07) |
| ER/EER diagram (Mermaid) | `docs/A_design/er_diagram.mmd` | done | Complete Mermaid erDiagram (13 entities) |
| Normalization document (3NF) | `docs/A_design/normalization.md` | done | Complete 1NF, 2NF, 3NF, BCNF & denormalization proofs |
| Schema justification | `docs/A_design/schema_justification.md` | done | Rationale for entities, types, constraints & indexes |
| `01_schema.sql` (DDL) | `db/01_schema/01_schema.sql` | done | Idempotent DDL, all 13 tables, constraints, FK indexes, triage indexes |
| `02a_seed_small.sql` | `db/02_seed/02a_seed_small.sql` | done | Realistic Chennai flood scenario; all 13 tables seeded |
| `02b_seed_full.sql` | `db/02_seed/02b_seed_full.sql` | done | Phase 3: full enterprise flood scenario seed |
| `reset_db.sh` / `reset_db.ps1` | `db/scripts/` | done | Automated db drop, create, and sequence runner |
| `report_section_A.md` | `docs/A_design/report_section_A.md` | done | Phase 3: Report Section A draft complete |
| `DRSCP_final_report.md` | `docs/final/` | not started | Phase 6 |

## Next steps (ordered, max 5)
1. Verify end-to-end integration test (Phase 5) across DB, backend, and frontend.
2. Rehearse concurrency demo and trigger test cases with team.
3. Collaborate with B and C on assembling `DRSCP_final_report.md` (Phase 6).

## Blockers and waiting on
- None! Person A has completed all Phase 1 deliverables and unblocked Persons B & C.

## Dependencies and Change Requests
- None. Schema matches frozen CONTRACT 100%.

## Decisions made (and why)
- Used `current_occupancy` as a trigger-maintained denormalized column (not computed on read) to allow `CHECK (current_occupancy <= total_capacity)` and cheap dashboard queries without an aggregate every time.
- Used `priority_score` as a denormalized column in `help_requests` to enable index range scans via composite B-tree index `(status, priority_score DESC, district)`.
- Used `TIMESTAMPTZ` everywhere to ensure timezone safety across response agencies and cloud deployments.
- Decoupled `requesters` from `app_users` so hotline dispatchers can record distress calls without requiring citizen authentication.
- Unified polymorphic `allocations` table with nullable foreign keys (`shelter_id`, `volunteer_id`, `resource_type_id`) to streamline lifecycle state machine and single audit log.

## How to run / test what exists
```powershell
# In PowerShell:
.\db\scripts\reset_db.ps1

# Or in Bash:
bash db/scripts/reset_db.sh
```

## Change log (newest first)
- 2026-10-07 14:35 | `01_schema.sql`, `02a_seed_small.sql`, `docs/A_design/*`, `CONTRACT/*` | Phase 1 complete: CONTRACT frozen; all 13 tables DDL with constraints and indexes created; small seed data populated; ER diagram, 3NF normalization doc, and schema justification written | tested: syntax verified
- 2026-10-06 13:07 | all files | Phase 0 committed (f4eb9cd) and pushed to GitHub; branches main/schema/logic/app all created and tracked | tested: git log confirmed
- 2026-10-06 12:30 | `drscp/` entire skeleton | Phase 0: created all directories, README, .gitignore, four CONTRACT files, three PROGRESS placeholders | tested: n/a (no SQL yet)
