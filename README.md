# DRSCP — Disaster Resource & Shelter Coordination Platform

**Course:** BCSE302P – Database Systems Lab (Societal Digital Innovation Project)
**Track:** T2 – Emergency & Disaster Resilience / Evacuation & Rescue Coordination
**SDGs:** SDG 11 (Sustainable Cities) · SDG 3 (Good Health & Well-being)

---

## Team

| Person | Role | Branch |
|--------|------|--------|
| Person A | Design & Schema | `schema` |
| Person B | Logic & Concurrency | `logic` |
| Person C | Queries, Security & App | `app` |

---

## Quick start (after full integration)

```bash
# 1. Create database and run all SQL files in order
bash db/scripts/reset_db.sh          # Linux/macOS
# or
.\db\scripts\reset_db.ps1            # Windows PowerShell

# 2. Start backend
cd backend && cp .env.example .env   # fill in DB creds
npm install && npm run dev

# 3. Start frontend
cd frontend && cp .env.example .env
npm install && npm run dev
```

## Repository layout

See `CONTRACT/01_entities_and_columns.md` for the full schema.
See `docs/final/DRSCP_final_report.md` for the complete project report (assembled in Phase 6).

## Phase plan

| Phase | Description | Owner |
|-------|-------------|-------|
| 0 | Contract + skeleton | All |
| 1 | Schema freeze | A |
| 2 | Logic & app (parallel) | B + C |
| 3 | Individual completion | All |
| 4 | Merge to main | All |
| 5 | Integration test | All |
| 6 | Docs + expo prep | All |

---

*Last edited by: Person A (Phase 0 skeleton)*
