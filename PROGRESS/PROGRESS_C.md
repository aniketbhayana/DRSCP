# PROGRESS — Person C (Queries, Security & App)
Last updated: 2026-10-06 12:30   |   Current phase: 0

## Current state
Phase 0 skeleton created by Person A. No view, role, query, backend, or frontend code written yet. Person C should review and approve the CONTRACT (especially `03_api_endpoints.md` and `04_roles_and_permissions.md`) before starting any work.

## Deliverables checklist

| Deliverable | File path | Status | Notes |
|---|---|---|---|
| Review & approve CONTRACT | `CONTRACT/` | not started | Blocking Phase 1 |
| Views (7 views) | `db/05_views/05_views.sql` | not started | Needs schema-v1 tag |
| Complex queries (15+) | `db/queries/complex_queries.sql` | not started | |
| Roles & grants SQL | `db/06_roles/06_roles_and_grants.sql` | not started | |
| Role tests | `db/tests/roles/` | not started | |
| Backend (Node/Express) — auth | `backend/src/` | not started | |
| Backend — request routes | `backend/src/` | not started | |
| Backend — allocation routes | `backend/src/` | not started | |
| Backend — shelter/volunteer/inventory routes | `backend/src/` | not started | |
| Backend — audit route | `backend/src/` | not started | |
| Backend `.env.example` | `backend/.env.example` | not started | |
| Frontend — requester screens | `frontend/src/` | not started | Can start with mock API |
| Frontend — admin/agency dashboard | `frontend/src/` | not started | |
| Frontend — volunteer screen | `frontend/src/` | not started | |
| Frontend — audit log viewer | `frontend/src/` | not started | |
| Frontend `.env.example` | `frontend/.env.example` | not started | |
| `queries_explained.md` | `docs/C_app/queries_explained.md` | not started | |
| `roles_and_security.md` | `docs/C_app/roles_and_security.md` | not started | |
| `app_walkthrough.md` | `docs/C_app/app_walkthrough.md` | not started | |
| `report_section_C.md` | `docs/C_app/report_section_C.md` | not started | |

## Next steps (ordered, max 5)
1. Review CONTRACT files and give approval (or raise Change Requests).
2. Wait for `schema-v1` tag from Person A.
3. While waiting: build React screens using mock API responses.
4. Write views SQL as soon as schema is tagged.
5. Write roles and grants SQL (depends on B's function names being final).

## Blockers and waiting on
- **CONTRACT approval** (all three, since 2026-10-06).
- **`schema-v1` tag** from Person A (Phase 1 completion).
- **B's function names finalised** (needed for GRANT EXECUTE in `06_roles_and_grants.sql`).

## Dependencies and Change Requests
- None yet.

## Decisions made (and why)
- (none yet)

## How to run / test what exists
```
# Nothing to run yet.
```

## Change log (newest first)
- 2026-10-06 12:30 | `PROGRESS_C.md` | Phase 0 placeholder created by Person A | tested: n/a
