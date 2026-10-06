# PROGRESS — Person A (Design & Schema)
Last updated: 2026-10-06 12:30   |   Current phase: 0

## Current state
Phase 0 is complete. The repo skeleton, .gitignore, README, all four CONTRACT files, and all three PROGRESS placeholder files have been created. No SQL or application code has been written yet. Waiting for Person B and Person C to review and approve the CONTRACT before Phase 1 begins.

## Deliverables checklist

| Deliverable | File path | Status | Notes |
|---|---|---|---|
| Repo skeleton + .gitignore | `drscp/` | done | Phase 0 |
| CONTRACT/01_entities_and_columns.md | `CONTRACT/01_entities_and_columns.md` | done | Awaiting team approval |
| CONTRACT/02_function_signatures.md | `CONTRACT/02_function_signatures.md` | done | Awaiting team approval |
| CONTRACT/03_api_endpoints.md | `CONTRACT/03_api_endpoints.md` | done | Awaiting team approval |
| CONTRACT/04_roles_and_permissions.md | `CONTRACT/04_roles_and_permissions.md` | done | Awaiting team approval |
| ER/EER diagram (Mermaid + PNG) | `docs/A_design/er_diagram.mmd` | not started | Phase 1 |
| Normalization document (3NF) | `docs/A_design/normalization.md` | not started | Phase 1 |
| Schema justification | `docs/A_design/schema_justification.md` | not started | Phase 1 |
| `01_schema.sql` (DDL) | `db/01_schema/01_schema.sql` | not started | Phase 1 — blocking B & C |
| `02a_seed_small.sql` | `db/02_seed/02a_seed_small.sql` | not started | Phase 1 — blocking B & C |
| `02b_seed_full.sql` | `db/02_seed/02b_seed_full.sql` | not started | Phase 2-3 |
| `reset_db.sh` / `reset_db.ps1` | `db/scripts/` | not started | Phase 1 |
| `report_section_A.md` | `docs/A_design/report_section_A.md` | not started | Phase 3 |
| `DRSCP_final_report.md` | `docs/final/` | not started | Phase 6 |

## Next steps (ordered, max 5)
1. Get team approval on all four CONTRACT files (share with B and C).
2. Begin `er_diagram.mmd` (Mermaid erDiagram covering all 13 tables).
3. Write `normalization.md` (functional dependencies + 1NF→2NF→3NF proof).
4. Write `01_schema.sql` (idempotent DDL with all constraints and indexes).
5. Write `02a_seed_small.sql` (small seed so B and C can start testing).

## Blockers and waiting on
- **Team approval** of CONTRACT files (B and C, since 2026-10-06).

## Dependencies and Change Requests
- None yet.

## Decisions made (and why)
- Used `current_occupancy` as a trigger-maintained denormalized column (not computed on read) to allow `CHECK (current_occupancy <= total_capacity)` and cheap dashboard queries without an aggregate every time.
- Used `priority_score` as a denormalized column in `help_requests` for the same reason — the ranked view needs a single sortable column.
- Chose `TIMESTAMPTZ` everywhere (not `TIMESTAMP`) to be timezone-safe during a real disaster scenario where responders may be in different zones.
- Numbered SQL files 01–06 so `reset_db` can run them in dependency order on a fresh DB.

## How to run / test what exists
```powershell
# Nothing to run yet — schema not written.
# To verify skeleton only:
Get-ChildItem -Recurse C:\Users\Aniket Bhayana\.gemini\antigravity-ide\scratch\drscp | Select-Object FullName
```

## Change log (newest first)
- 2026-10-06 13:07 | all files | Phase 0 committed (f4eb9cd) and pushed to GitHub; branches main/schema/logic/app all created and tracked | tested: git log confirmed
- 2026-10-06 12:30 | `drscp/` entire skeleton | Phase 0: created all directories, README, .gitignore, four CONTRACT files, three PROGRESS placeholders | tested: n/a (no SQL yet)
