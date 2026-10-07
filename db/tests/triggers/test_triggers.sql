-- =============================================================================
-- FILE   : db/tests/triggers/test_triggers.sql
-- OWNER  : Person B (Logic & Concurrency)
-- PURPOSE: Standalone tests that prove each trigger fires correctly.
--          Run after the full db is loaded (01..06 in order via reset_db).
--
-- HOW TO USE:
--   psql -U drscp_admin -d drscp -f db/tests/triggers/test_triggers.sql
--   Every test that passes prints "PASS". A failure raises an EXCEPTION
--   which stops execution and shows the trigger's error message.
--
-- TESTS IN THIS FILE:
--   T1 — trg_set_updated_at          : updated_at changes on UPDATE
--   T2 — trg_block_duplicate_request : second identical request is rejected
--   T3 — trg_validate_alloc_before   : allocation with no target is rejected
--   T4 — trg_sync_occupancy          : bed allocation syncs shelter occupancy
--   T5 — trg_sync_volunteer_status   : volunteer goes ASSIGNED then AVAILABLE
--   T6 — trg_audit_allocation        : allocation creates an audit log row
--   T7 — trg_set_priority_on_insert  : new request gets a non-null priority_score
--   T8 — trg_check_low_stock         : low inventory creates a stock_alerts row
-- =============================================================================

\echo '============================================================'
\echo ' DRSCP Trigger Test Suite'
\echo '============================================================'

-- ---------------------------------------------------------------------------
-- We wrap ALL tests in a single transaction that we ROLLBACK at the end so
-- tests do not pollute the seed data.
-- ---------------------------------------------------------------------------
BEGIN;

-- ===========================================================================
-- T1: trg_set_updated_at
-- ===========================================================================
\echo 'T1: trg_set_updated_at — updated_at must change on UPDATE'

DO $$
DECLARE
    v_before  TIMESTAMPTZ;
    v_after   TIMESTAMPTZ;
BEGIN
    SELECT updated_at INTO v_before FROM help_requests WHERE request_id = 1;

    -- Small sleep so timestamps differ.
    PERFORM pg_sleep(0.05);

    UPDATE help_requests SET description = description WHERE request_id = 1;

    SELECT updated_at INTO v_after FROM help_requests WHERE request_id = 1;

    IF v_after <= v_before THEN
        RAISE EXCEPTION 'T1 FAIL: updated_at did not change after UPDATE.';
    END IF;
    RAISE NOTICE 'T1 PASS: updated_at changed from % to %', v_before, v_after;
END;
$$;

-- ===========================================================================
-- T2: trg_block_duplicate_request
-- ===========================================================================
\echo 'T2: trg_block_duplicate_request — duplicate within 60 min must be rejected'

DO $$
DECLARE
    v_req_id   INT;
    v_caught   BOOLEAN := FALSE;
    v_err_code TEXT;
BEGIN
    -- Ensure request_id=1 is PENDING (needed for the duplicate check query).
    UPDATE help_requests SET status = 'PENDING' WHERE request_id = 1;

    -- Get the requester and type of request #1.
    SELECT request_id INTO v_req_id FROM help_requests WHERE request_id = 1;

    -- Try to insert a duplicate (same requester_id, same type).
    BEGIN
        INSERT INTO help_requests (
            requester_id, request_type, status, household_size,
            location_text, district, description
        )
        SELECT requester_id, request_type, 'PENDING', household_size,
               location_text, district, 'DUPLICATE TEST'
          FROM help_requests
         WHERE request_id = 1;
    EXCEPTION
        WHEN OTHERS THEN
            v_caught   := TRUE;
            v_err_code := SQLSTATE;
    END;

    IF NOT v_caught THEN
        RAISE EXCEPTION 'T2 FAIL: duplicate request was not blocked.';
    END IF;
    IF v_err_code <> 'P0010' THEN
        RAISE EXCEPTION 'T2 FAIL: wrong SQLSTATE (got %, expected P0010).', v_err_code;
    END IF;
    RAISE NOTICE 'T2 PASS: duplicate request correctly blocked with SQLSTATE P0010.';
END;
$$;

-- ===========================================================================
-- T3: trg_validate_alloc_before — no target
-- ===========================================================================
\echo 'T3: trg_validate_alloc_before — allocation with no target must be rejected'

DO $$
DECLARE
    v_caught   BOOLEAN := FALSE;
    v_err_code TEXT;
BEGIN
    BEGIN
        INSERT INTO allocations (
            request_id, shelter_id, volunteer_id, resource_type_id,
            quantity, beds_allocated, status, allocated_by, allocated_at
        ) VALUES (
            1, NULL, NULL, NULL,  -- no shelter, volunteer, or resource
            NULL, NULL, 'ACTIVE', 1, NOW()
        );
    EXCEPTION
        WHEN OTHERS THEN
            v_caught   := TRUE;
            v_err_code := SQLSTATE;
    END;

    IF NOT v_caught THEN
        RAISE EXCEPTION 'T3 FAIL: invalid allocation was not blocked.';
    END IF;
    IF v_err_code <> 'P0011' THEN
        RAISE EXCEPTION 'T3 FAIL: wrong SQLSTATE (got %, expected P0011).', v_err_code;
    END IF;
    RAISE NOTICE 'T3 PASS: no-target allocation correctly blocked with SQLSTATE P0011.';
END;
$$;

-- ===========================================================================
-- T4: trg_sync_occupancy
-- ===========================================================================
\echo 'T4: trg_sync_occupancy — shelter occupancy syncs on bed allocation'

DO $$
DECLARE
    v_occ_before  INT;
    v_occ_after   INT;
    v_alloc_id    INT;
BEGIN
    -- Ensure request #1 is PENDING.
    UPDATE help_requests SET status = 'PENDING' WHERE request_id = 1;

    SELECT current_occupancy INTO v_occ_before
      FROM shelters WHERE shelter_id = 1;

    -- Direct INSERT bypassing the stored procedure (trigger fires regardless).
    INSERT INTO allocations (
        request_id, shelter_id, beds_allocated, status, allocated_by, allocated_at
    ) VALUES (
        1, 1, 2, 'ACTIVE', 1, NOW()
    )
    RETURNING allocation_id INTO v_alloc_id;

    SELECT current_occupancy INTO v_occ_after
      FROM shelters WHERE shelter_id = 1;

    IF v_occ_after <> v_occ_before + 2 THEN
        RAISE EXCEPTION 'T4 FAIL: expected occupancy = %, got % (trigger did not sync).',
                         v_occ_before + 2, v_occ_after;
    END IF;
    RAISE NOTICE 'T4 PASS: occupancy went from % to % (delta = 2).', v_occ_before, v_occ_after;

    -- Cleanup: cancel the allocation and verify occupancy reverts.
    UPDATE allocations SET status = 'CANCELLED', completed_at = NOW()
     WHERE allocation_id = v_alloc_id;

    SELECT current_occupancy INTO v_occ_after
      FROM shelters WHERE shelter_id = 1;

    IF v_occ_after <> v_occ_before THEN
        RAISE EXCEPTION 'T4 FAIL (revert): expected occupancy = %, got %.', v_occ_before, v_occ_after;
    END IF;
    RAISE NOTICE 'T4 PASS (revert): occupancy correctly reverted to % on CANCEL.', v_occ_before;
END;
$$;

-- ===========================================================================
-- T5: trg_sync_volunteer_status
-- ===========================================================================
\echo 'T5: trg_sync_volunteer_status — volunteer status AVAILABLE -> ASSIGNED -> AVAILABLE'

DO $$
DECLARE
    v_vol_status  VARCHAR(20);
    v_alloc_id    INT;
BEGIN
    -- Ensure volunteer #1 is AVAILABLE and request #1 is PENDING.
    UPDATE volunteers     SET availability_status = 'AVAILABLE' WHERE volunteer_id = 1;
    UPDATE help_requests  SET status              = 'PENDING'   WHERE request_id   = 1;

    -- Assign.
    INSERT INTO allocations (
        request_id, volunteer_id, status, allocated_by, allocated_at
    ) VALUES (1, 1, 'ACTIVE', 1, NOW())
    RETURNING allocation_id INTO v_alloc_id;

    SELECT availability_status INTO v_vol_status FROM volunteers WHERE volunteer_id = 1;
    IF v_vol_status <> 'ASSIGNED' THEN
        RAISE EXCEPTION 'T5 FAIL: expected ASSIGNED, got % after INSERT.', v_vol_status;
    END IF;
    RAISE NOTICE 'T5 PASS (assign): volunteer status = ASSIGNED.';

    -- Complete.
    UPDATE allocations SET status = 'COMPLETED', completed_at = NOW()
     WHERE allocation_id = v_alloc_id;

    SELECT availability_status INTO v_vol_status FROM volunteers WHERE volunteer_id = 1;
    IF v_vol_status <> 'AVAILABLE' THEN
        RAISE EXCEPTION 'T5 FAIL: expected AVAILABLE after COMPLETE, got %.', v_vol_status;
    END IF;
    RAISE NOTICE 'T5 PASS (complete): volunteer status = AVAILABLE.';
END;
$$;

-- ===========================================================================
-- T6: trg_audit_allocation
-- ===========================================================================
\echo 'T6: trg_audit_allocation — INSERT creates an audit log row'

DO $$
DECLARE
    v_alloc_id    INT;
    v_log_count   INT;
BEGIN
    UPDATE help_requests SET status = 'PENDING' WHERE request_id = 1;

    INSERT INTO allocations (
        request_id, shelter_id, beds_allocated, status, allocated_by, allocated_at
    ) VALUES (1, 1, 1, 'ACTIVE', 1, NOW())
    RETURNING allocation_id INTO v_alloc_id;

    SELECT COUNT(*) INTO v_log_count
      FROM allocation_audit_log
     WHERE allocation_id = v_alloc_id AND action = 'CREATED';

    IF v_log_count <> 1 THEN
        RAISE EXCEPTION 'T6 FAIL: expected 1 audit row, got %.', v_log_count;
    END IF;
    RAISE NOTICE 'T6 PASS: 1 CREATED audit row found for allocation %.', v_alloc_id;
END;
$$;

-- ===========================================================================
-- T7: trg_set_priority_on_insert
-- ===========================================================================
\echo 'T7: trg_set_priority_on_insert — new request gets a non-null priority_score'

DO $$
DECLARE
    v_new_id    INT;
    v_score     NUMERIC(8,2);
BEGIN
    -- Insert a brand-new request.
    INSERT INTO help_requests (
        requester_id, request_type, status, household_size,
        location_text, district, description
    ) VALUES (
        1, 'FOOD', 'PENDING', 3,
        'Test Location', 'Test District', 'Trigger T7 test'
    )
    RETURNING request_id INTO v_new_id;

    SELECT priority_score INTO v_score FROM help_requests WHERE request_id = v_new_id;

    IF v_score IS NULL OR v_score <= 0 THEN
        RAISE EXCEPTION 'T7 FAIL: priority_score is % for new request %.', v_score, v_new_id;
    END IF;
    RAISE NOTICE 'T7 PASS: priority_score = % set automatically for request %.', v_score, v_new_id;
END;
$$;

-- ===========================================================================
-- T8: trg_check_low_stock
-- ===========================================================================
\echo 'T8: trg_check_low_stock — low inventory creates a stock_alerts row'

DO $$
DECLARE
    v_inv_id      INT;
    v_threshold   INT := 5;
    v_alert_count INT;
BEGIN
    -- Use inventory_id=1 (or the first available one).
    SELECT inventory_id INTO v_inv_id FROM resource_inventory LIMIT 1;

    -- Ensure no existing open alert for this inventory.
    UPDATE stock_alerts SET resolved = TRUE WHERE inventory_id = v_inv_id AND resolved = FALSE;

    -- Drop quantity to just below threshold.
    UPDATE resource_inventory
       SET quantity_available = v_threshold - 1,
           reorder_threshold  = v_threshold,
           last_updated       = NOW()
     WHERE inventory_id = v_inv_id;

    SELECT COUNT(*) INTO v_alert_count
      FROM stock_alerts
     WHERE inventory_id = v_inv_id AND resolved = FALSE;

    IF v_alert_count < 1 THEN
        RAISE EXCEPTION 'T8 FAIL: expected a stock_alerts row, found %.', v_alert_count;
    END IF;
    RAISE NOTICE 'T8 PASS: stock_alerts row created for inventory_id %.', v_inv_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- All tests done — rollback to leave database clean.
-- ---------------------------------------------------------------------------
ROLLBACK;

\echo '============================================================'
\echo ' All trigger tests completed. Transaction rolled back.'
\echo ' (No data was permanently changed.)'
\echo '============================================================'
