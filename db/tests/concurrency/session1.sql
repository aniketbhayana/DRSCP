-- =============================================================================
-- FILE   : db/tests/concurrency/session1.sql
-- OWNER  : Person B (Logic & Concurrency)
-- PURPOSE: One half of the two-session concurrency demo.
--          Run this in psql Window 1 SIMULTANEOUSLY with session2.sql in
--          psql Window 2. See README.md for the step-by-step procedure.
--
-- SCENARIO: Shelter #1 has exactly 1 free bed. Both sessions try to allocate
--           that last bed. Only one should succeed; the other should fail with
--           a clear "insufficient free beds" error.
--
-- PREREQUISITE: The demo schema must be loaded and shelter #1 must have
--               exactly 1 free bed. Run the setup block first.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- SETUP (run once before both sessions, or use reset_db to start fresh)
-- ---------------------------------------------------------------------------
-- This block sets shelter_id=1 to have total_capacity=10, current_occupancy=9
-- so there is exactly 1 free bed. We also ensure request_id=1 and request_id=2
-- are both PENDING.
-- Run ONLY in one window (Session 1) before starting the demo.
-- ---------------------------------------------------------------------------
-- BEGIN;
-- UPDATE shelters SET total_capacity=10, current_occupancy=9 WHERE shelter_id=1;
-- UPDATE help_requests SET status='PENDING' WHERE request_id IN (1,2);
-- DELETE FROM allocations WHERE request_id IN (1,2);
-- COMMIT;
-- ---------------------------------------------------------------------------

\echo '=== SESSION 1: Starting transaction and locking request #1 ==='

BEGIN;
-- Isolation level READ COMMITTED is the PostgreSQL default.
-- FOR UPDATE on help_requests row #1 acquires a row-level lock.
-- Session 2 will block here until Session 1 commits or rolls back.
SELECT request_id, status, priority_score
  FROM help_requests
 WHERE request_id = 1
   FOR UPDATE;

\echo '=== SESSION 1: Locked help_requests row 1. Now locking shelter #1... ==='
\echo '=== (Session 2 is probably blocked on its FOR UPDATE right now)      ==='

-- Lock the shelter row in the same order as the procedure (request first, then shelter).
SELECT shelter_id, total_capacity, current_occupancy,
       (total_capacity - current_occupancy) AS free_beds
  FROM shelters
 WHERE shelter_id = 1
   FOR UPDATE;

\echo '=== SESSION 1: Locked shelter #1. Checking free beds... ==='

-- Simulate what sp_allocate_shelter_bed does internally:
DO $$
DECLARE
    v_free  INT;
BEGIN
    SELECT total_capacity - current_occupancy
      INTO v_free
      FROM shelters
     WHERE shelter_id = 1;

    IF v_free < 1 THEN
        RAISE EXCEPTION 'Session 1: No free beds — this should not happen in a clean demo.';
    END IF;

    RAISE NOTICE 'Session 1: % free bed(s). Proceeding with allocation.', v_free;
END;
$$;

-- Insert the allocation row (mimics sp_allocate_shelter_bed body).
INSERT INTO allocations (request_id, shelter_id, beds_allocated, status, allocated_by, allocated_at)
VALUES (1, 1, 1, 'ACTIVE', 1, NOW())
RETURNING allocation_id AS "Session1_allocation_id";

-- Update request status.
UPDATE help_requests SET status = 'ALLOCATED', updated_at = NOW() WHERE request_id = 1;

\echo '=== SESSION 1: About to COMMIT. Session 2 will now unblock and fail. ==='
\echo '=== (Pause here in the demo; run COMMIT; after Session 2 is visibly blocked) ==='

COMMIT;

\echo '=== SESSION 1: COMMITTED. Session 2 should now see 0 free beds and raise an error. ==='
