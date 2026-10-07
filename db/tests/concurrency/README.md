# Concurrency Demo — Two-Session Proof

**Owner:** Person B | **File:** `db/tests/concurrency/`

## What this proves

PostgreSQL's `SELECT ... FOR UPDATE` acquires a **row-level lock** that blocks
any other transaction trying to lock the same row. This prevents the classic
*double-booking* problem where two operators simultaneously allocate the last
shelter bed to different people.

---

## Setup

1. Run `reset_db.ps1` (or `.sh`) to start from a clean database.
2. The small seed (`02a_seed_small.sql`) creates Shelter #1 with `total_capacity=10`.
   Before the demo, run this one-off setup to leave exactly 1 free bed:

```sql
BEGIN;
UPDATE shelters SET total_capacity=10, current_occupancy=9 WHERE shelter_id=1;
UPDATE help_requests SET status='PENDING' WHERE request_id IN (1,2);
DELETE FROM allocations WHERE request_id IN (1,2);
COMMIT;
```

---

## Step-by-step demo procedure

Open **two** separate terminal windows. Both connect to the same database:

```bash
# Window 1:
psql -U drscp_admin -d drscp

# Window 2:
psql -U drscp_admin -d drscp
```

Then follow this sequence **exactly** (the timestamps show the interleaving):

| Step | Window 1 (Session 1) | Window 2 (Session 2) |
|------|----------------------|----------------------|
| 1 | `\i db/tests/concurrency/session1.sql` | — |
| 2 | *(script runs up to the PAUSE comment and holds the locks)* | — |
| 3 | — | `\i db/tests/concurrency/session2.sql` |
| 4 | — | *(Session 2 blocks on `SELECT ... FOR UPDATE` on shelters)* |
| 5 | Type `COMMIT;` and press Enter | — |
| 6 | Session 1 committed successfully ✅ | Session 2 unblocks, reads 0 free beds, raises ERROR ❌ |

---

## Expected output

**Session 1 (successful allocation):**
```
=== SESSION 1: Starting transaction and locking request #1 ===
 request_id | status  | priority_score
------------+---------+----------------
          1 | PENDING |          87.00
(1 row)
=== SESSION 1: Locked help_requests row 1. Now locking shelter #1... ===
 shelter_id | total_capacity | current_occupancy | free_beds
------------+----------------+-------------------+-----------
          1 |             10 |                 9 |         1
(1 row)
NOTICE:  Session 1: 1 free bed(s). Proceeding with allocation.
 Session1_allocation_id
------------------------
                      1
(1 row)
COMMIT
=== SESSION 1: COMMITTED. ===
```

**Session 2 (blocked, then fails cleanly):**
```
=== SESSION 2: Starting transaction ===
=== SESSION 2: Locked request #2. Now trying to lock shelter #1... ===
=== (This will BLOCK until Session 1 releases its lock on shelter #1) ===
-- ... (hangs here until Session 1 commits) ...
=== SESSION 2: Unblocked! Checking free beds after Session 1 committed... ===
NOTICE:  Session 2: 0 free bed(s) remaining after Session 1 committed.
ERROR:  Session 2 FAILED cleanly: Shelter 1 has only 0 free bed(s); 1 requested. ERRCODE P0005.
ROLLBACK
```

---

## Why `SELECT ... FOR UPDATE`?

Without `FOR UPDATE`, both sessions could read `current_occupancy = 9` at the
same time, both compute `free_beds = 1`, both insert an allocation, and **two
people get the same last bed** — a classic TOCTOU (time-of-check to time-of-use)
race condition.

`FOR UPDATE` causes the second session to **block** (not fail immediately) until
the first session finishes. Then the second session reads the *updated* value
(0 free beds) and rejects the allocation.

---

## Isolation level

We use the PostgreSQL default: **READ COMMITTED**.

- This is sufficient because `FOR UPDATE` gives us the serialization guarantee
  we need for the specific rows being allocated.
- We do NOT use `SERIALIZABLE` for the whole database because that would
  increase abort rates and complexity on unrelated read queries.

---

## Deadlock avoidance

A deadlock would occur if Session 1 locks rows in order (A, B) while Session 2
locks them in order (B, A) — they each wait for the other indefinitely.

**Our defence:** every allocation procedure in `03b_allocation_procedures.sql`
locks rows in the **same consistent order**:

1. `help_requests` row (by `request_id` ascending)
2. `shelters` / `volunteers` / `resource_inventory` row

Since all sessions always lock in this order, a circular wait is impossible.
PostgreSQL's deadlock detector (which runs every `deadlock_timeout = 1s` by
default) would also catch and break a deadlock if one somehow occurred — the
"loser" transaction gets `ERROR 40P01: deadlock detected` and is rolled back,
leaving the winner to complete.

---

## Files

| File | Purpose |
|------|---------|
| `session1.sql` | Opens transaction, locks rows, pauses for demo, commits |
| `session2.sql` | Opens concurrently, blocks, fails cleanly after Session 1 commits |
| `README.md` | This file — step-by-step instructions and explanation |
