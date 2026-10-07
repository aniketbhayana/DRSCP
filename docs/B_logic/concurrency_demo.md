# Concurrency Demo — Explained

**File:** `docs/B_logic/concurrency_demo.md`
**Owner:** Person B

See `db/tests/concurrency/README.md` for the step-by-step execution procedure.
This document explains the *why*.

---

## The problem without FOR UPDATE

Imagine two operators simultaneously trying to allocate the last bed in Shelter 1:

```
Time  Session 1                         Session 2
----  ---------------------------------  ---------------------------------
 T1   BEGIN;                             BEGIN;
 T2   SELECT ... from shelters           SELECT ... from shelters
      WHERE shelter_id=1;               WHERE shelter_id=1;
      → reads free_beds = 1             → reads free_beds = 1  ← stale!
 T3   INSERT INTO allocations ...        INSERT INTO allocations ...
      (request 1, shelter 1, 1 bed)     (request 2, shelter 1, 1 bed)
 T4   COMMIT;                            COMMIT;
```

Result: **two people get the same last bed**. Both transactions saw `free_beds = 1`
and both inserted successfully. This is the classic **TOCTOU** (time of check,
time of use) race condition.

---

## The fix: SELECT ... FOR UPDATE

```
Time  Session 1                         Session 2
----  ---------------------------------  ---------------------------------
 T1   BEGIN;                             BEGIN;
 T2   SELECT ... FOR UPDATE              SELECT ... FOR UPDATE
      WHERE shelter_id=1;               WHERE shelter_id=1;
      → acquires row lock ✅             → BLOCKS (waits for Session 1) 🔒
 T3   INSERT (1 bed), UPDATE occupancy
 T4   COMMIT;                            → Unblocks, reads occupancy = 10
                                          → free_beds = 0 → RAISE EXCEPTION ❌
                                          → ROLLBACK
```

Only one allocation succeeds. The second fails with a clear error.

---

## Why READ COMMITTED (not SERIALIZABLE)?

`SERIALIZABLE` would also work but causes more transaction aborts (serialization
failures) on unrelated read queries, adding overhead and complexity. We only
need the concurrency guarantee for the specific rows being allocated.
`READ COMMITTED` + `FOR UPDATE` gives us exactly that guarantee at minimal cost.

---

## Deadlock avoidance

A deadlock requires two transactions each waiting for something the other holds:
- Session A holds lock on row X, wants row Y.
- Session B holds lock on row Y, wants row X.

Our defence: **consistent lock ordering**. Every allocation procedure always
locks in this order:
1. `help_requests` row
2. `shelters` / `volunteers` / `resource_inventory` row

Since no procedure ever locks a shelter before locking the request, the circular
dependency is structurally impossible.

PostgreSQL also has a deadlock detector (runs every `deadlock_timeout` seconds,
default 1 second). If somehow a deadlock occurred, PostgreSQL would choose one
transaction as the "victim" and cancel it with error `40P01: deadlock detected`.
The Node backend catches this and returns a 409 Conflict to the client.

---

## What the evaluator should see at the expo

1. Two psql windows open side-by-side.
2. Session 1 runs and pauses (holds the lock).
3. Session 2 runs and visibly hangs — the prompt does not return.
4. Session 1 types `COMMIT;` — Session 2 immediately unblocks and prints the
   error: `ERROR: Shelter 1 has only 0 free bed(s); 1 requested.`
5. Query the `allocations` table: only one row exists, proving no double-booking.
