# PROGRESS — Person C (Queries, Security & App)
Last updated: 2026-10-07 14:30   |   Current phase: 1

## Current state
Phase 0 CONTRACT files reviewed and APPROVED by Person C. No view, role, query, backend, or frontend code written yet. Person C is beginning parallel work (frontend screens with mock data, backend scaffolding, and drafting views/queries SQL).

## Deliverables checklist

| Deliverable | File path | Status | Notes |
|---|---|---|---|
| Review & approve CONTRACT | `CONTRACT/` | done | Approved on 2026-10-07 |
| Views (7 views) | `db/05_views/05_views.sql` | not started | Draft against frozen contract |
| Complex queries (15+) | `db/queries/complex_queries.sql` | not started | |
| Roles & grants SQL | `db/06_roles/06_roles_and_grants.sql` | not started | |
| Role tests | `db/tests/roles/` | not started | |
| Backend (Node/Express) — auth | `backend/src/` | in progress | |
| Backend — request routes | `backend/src/` | not started | |
| Backend — allocation routes | `backend/src/` | not started | |
| Backend — shelter/volunteer/inventory routes | `backend/src/` | not started | |
| Backend — audit route | `backend/src/` | not started | |
| Backend `.env.example` | `backend/.env.example` | done | |
| Frontend — requester screens | `frontend/src/` | not started | |
| Frontend — admin/agency dashboard | `frontend/src/` | not started | |
| Frontend — volunteer screen | `frontend/src/` | not started | |
| Frontend — audit log viewer | `frontend/src/` | not started | |
| Frontend `.env.example` | `frontend/.env.example` | done | |
| `queries_explained.md` | `docs/C_app/queries_explained.md` | not started | |
| `roles_and_security.md` | `docs/C_app/roles_and_security.md` | not started | |
| `app_walkthrough.md` | `docs/C_app/app_walkthrough.md` | not started | |
| `report_section_C.md` | `docs/C_app/report_section_C.md` | not started | |

## Next steps (ordered, max 5)
1. Scaffold Node/Express backend (`package.json`, auth, middleware, routes).
2. Scaffold Vite + React frontend with mock API data & screens.
3. Write `05_views.sql` (7 views).
4. Write `06_roles_and_grants.sql` (roles, grants, RLS).
5. Write `complex_queries.sql` (15+ queries).

## Blockers and waiting on
- **`schema-v1` tag** from Person A (Phase 1 completion to test SQL against live DB).
- **B's functions delivered** (to run backend allocation endpoints end-to-end).

## Dependencies and Change Requests
- None yet.

## Decisions made (and why)
- Approved CONTRACT files on 2026-10-07.
- Decided to build backend routes and frontend UI with mock layer first per Phase 2 workflow guidelines.

## How to run / test what exists
```
# Nothing to run yet.
```

## Change log (newest first)
- 2026-10-06 12:30 | `PROGRESS_C.md` | Phase 0 placeholder created by Person A | tested: n/a
