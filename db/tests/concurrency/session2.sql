-- =============================================================================
-- FILE   : db/tests/concurrency/session2.sql
-- OWNER  : Person B (Logic & Concurrency)
-- PURPOSE: The second half of the two-session concurrency demo.
--          Run this in psql Window 2 SIMULTANEOUSLY with session1.sql.
--          See README.md for the exact step-by-step procedure.
--
-- EXPECTED OUTCOME:
--   1. This session starts a transaction and tries to lock request #2 (OK).
--   2. It then tries to lock shelter #1 — and BLOCKS because Session 1
--      already holds a FOR UPDATE lock on it.
--   3. When Session 1 COMMITs, this session unblocks.
--   4. It now sees current_occupancy = total_capacity (0 free beds).
--   5. It raises "insufficient free beds" and rolls back.
--   The INSERT in Session 2 is never committed — bed double-booking is prevented.
-- =============================================================================

\echo '=== SESSION 2: Starting transaction ==='

BEGIN;

-- Lock help_requests row #2 (this is a different row from Session 1 so no block here).
SELECT request_id, status
  FROM help_requests
 WHERE request_id = 2
   FOR UPDATE;

\echo '=== SESSION 2: Locked request #2. Now trying to lock shelter #1... ==='
\echo '=== (This will BLOCK until Session 1 releases its lock on shelter #1) ==='

-- This SELECT will BLOCK here until Session 1 commits.
SELECT shelter_id, total_capacity, current_occupancy,
       (total_capacity - current_occupancy) AS free_beds
  FROM shelters
 WHERE shelter_id = 1
   FOR UPDATE;

\echo '=== SESSION 2: Unblocked! Checking free beds after Session 1 committed... ==='

-- After Session 1 commits, the trigger fn_sync_occupancy has already updated
-- current_occupancy to 10. So free_beds = 0.
DO $$
DECLARE
    v_free  INT;
BEGIN
    SELECT total_capacity - current_occupancy
      INTO v_free
      FROM shelters
     WHERE shelter_id = 1;

    RAISE NOTICE 'Session 2: % free bed(s) remaining after Session 1 committed.', v_free;

    IF v_free < 1 THEN
        RAISE EXCEPTION
            'Session 2 FAILED cleanly: Shelter 1 has only % free bed(s); 1 requested. ERRCODE P0005.',
            v_free
            USING ERRCODE = 'P0005';
    END IF;

    RAISE NOTICE 'Session 2: Unexpected — there are still free beds. Demo state may be incorrect.';
END;
$$;

-- This line is reached only if the DO block above did NOT raise an exception.
-- In a correct demo, we expect to never reach here.
\echo '=== SESSION 2: WARNING — reached INSERT; expected failure. Check demo setup. ==='
INSERT INTO allocations (request_id, shelter_id, beds_allocated, status, allocated_by, allocated_at)
VALUES (2, 1, 1, 'ACTIVE', 1, NOW());

COMMIT;
