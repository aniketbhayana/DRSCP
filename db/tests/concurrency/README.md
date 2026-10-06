# Concurrency Demo — README
**Owner: Person B**

> **Status: PLACEHOLDER** — complete in Phase 2.

## What this demo proves

Two psql sessions simultaneously try to take the LAST bed in a shelter.
Only one succeeds; the other blocks and then fails with a clean error message.
This proves `SELECT ... FOR UPDATE` and the chosen isolation level prevent
double-allocation without deadlocking.

## Prerequisites (fill in Phase 2)

- Postgres running, database loaded with reset_db script.
- Exactly 1 free bed remaining in a specific shelter (set up by setup.sql or via seed).

## Steps (fill in Phase 2)

1. Terminal 1: `psql -d drscp -f session1.sql`
2. Terminal 2 (immediately): `psql -d drscp -f session2.sql`
3. Observe: Session 2 blocks on the FOR UPDATE, then receives an exception.
4. Verify: `SELECT current_occupancy, total_capacity FROM shelters WHERE shelter_id = <id>;`
   — occupancy must equal total_capacity (exactly 1 allocation, not 2).

## Expected output (fill in Phase 2)

```
Session 1: INSERT successful, allocation_id = X
Session 2: ERROR: Shelter <id> does not have enough free beds
```

## Deadlock avoidance note (fill in Phase 2)

All allocation procedures lock rows in consistent order:
  help_requests → shelters (or volunteers, or resource_inventory)
This prevents circular waits. See `03b_allocation_procedures.sql` header comment.
