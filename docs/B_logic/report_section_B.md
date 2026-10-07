# Report Section B — Logic and Concurrency

**Person B** | BCSE302P DRSCP | Phase 3 draft

---

## What was built

Person B owns the entire logic layer of DRSCP: the functions, stored procedures,
triggers, and the two-session concurrency demonstration.

### Files delivered

| File | Purpose |
|------|---------|
| `db/03_functions/03a_priority.sql` | `compute_priority_score` + `sp_recompute_priorities` |
| `db/03_functions/03b_allocation_procedures.sql` | 5 allocation procedures with FOR UPDATE |
| `db/03_functions/03c_helpers.sql` | `sp_suggest_shelter`, `fn_is_duplicate_request` |
| `db/04_triggers/04_triggers.sql` | 9 trigger functions + 9 trigger definitions |
| `db/tests/concurrency/session1.sql` | Session 1 of the two-session demo |
| `db/tests/concurrency/session2.sql` | Session 2 of the two-session demo |
| `db/tests/concurrency/README.md` | Step-by-step demo instructions |
| `db/tests/triggers/test_triggers.sql` | 8 trigger tests (all rollback cleanly) |

---

## Design decisions

### 1. Table-driven priority weights

The vulnerability weights (ELDERLY=20, PREGNANT=30, etc.) live in the
`vulnerability_types` table, not in code. This means the team or evaluator
can adjust priorities with a single UPDATE without recompiling or redeploying
anything. The formula is documented in `03a_priority.sql` and the CONTRACT.

### 2. FOR UPDATE over SERIALIZABLE isolation

`SELECT ... FOR UPDATE` acquires a row-level lock on exactly the rows being
allocated. This prevents double-booking with minimal overhead. A full
`SERIALIZABLE` isolation level would prevent more anomalies but causes more
transaction aborts on unrelated read queries. We chose the more surgical approach.

### 3. Consistent lock ordering

Every procedure locks `help_requests` before locking `shelters`, `volunteers`,
or `resource_inventory`. This eliminates the possibility of a deadlock from a
circular lock dependency.

### 4. Trigger-maintained denormalized columns

`shelters.current_occupancy` and `volunteers.availability_status` are
denormalized columns maintained by triggers. The normalization document
(Person A) justifies this: computing them live via COUNT on every read would
be expensive at scale, and triggers guarantee they are always correct.

### 5. Triggers separated from procedures

Triggers fire regardless of how the database is written — even raw INSERT
statements via psql. This means the audit log, occupancy sync, and inventory
sync work whether the change came through the stored procedure or not.

---

## The SQL I'm most proud of

The two-phase locking inside `sp_allocate_shelter_bed`:

```sql
-- Phase 1: lock the request row
SELECT status INTO v_request_status
  FROM help_requests WHERE request_id = p_request_id FOR UPDATE;

-- Phase 2: lock the shelter row (after verifying the request)
SELECT total_capacity, current_occupancy, status
  INTO v_shelter_total, v_shelter_current, v_shelter_status
  FROM shelters WHERE shelter_id = p_shelter_id FOR UPDATE;

-- Only now do we check and insert — safe from race conditions.
v_free_beds := v_shelter_total - v_shelter_current;
IF p_beds > v_free_beds THEN
    RAISE EXCEPTION 'Shelter % has only % free bed(s); % requested.', ...;
END IF;
```

This pattern is directly explainable: "we lock first, then check, then act —
in that order, always the same order, to prevent both double-booking and
deadlocks."

---

## SDG alignment

- **SDG 11 (Sustainable Cities):** The priority queue ensures vulnerable people
  (elderly, disabled, pregnant) are served first during urban disasters.
- **SDG 3 (Good Health):** Medical and rescue requests score highest; the audit
  trail ensures accountability for health-related resource allocation.

---

## Test results

All 8 trigger tests in `db/tests/triggers/test_triggers.sql` passed when run
against the small seed database. The concurrency demo was verified manually
with two psql sessions showing Session 2 blocking and then failing cleanly.

*(Screenshots to be added in Phase 5 integration testing.)*
