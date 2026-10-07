-- =============================================================================
-- FILE   : db/03_functions/03b_allocation_procedures.sql
-- OWNER  : Person B (Logic & Concurrency)
-- PURPOSE: Stored procedures for every allocation action.
--
--   Each procedure uses SELECT ... FOR UPDATE to acquire row-level locks and
--   enforces consistent lock ordering (help_requests first, then shelters or
--   volunteers or resource_inventory) to prevent deadlocks.
--
--   The Node backend MUST:
--     1. Acquire a dedicated pool client.
--     2. Issue BEGIN before calling the procedure.
--     3. Call the procedure inside the transaction.
--     4. COMMIT on success, ROLLBACK on exception.
--     5. Release the client in a finally block.
--   This is mandatory so that FOR UPDATE locks are held until the transaction ends.
--
-- PROCEDURES:
--   sp_allocate_shelter_bed(p_request_id, p_shelter_id, p_beds, p_allocated_by)
--     RETURNS INT (allocation_id)
--   sp_assign_volunteer(p_request_id, p_volunteer_id, p_allocated_by)
--     RETURNS INT (allocation_id)
--   sp_allocate_resource(p_request_id, p_inventory_id, p_quantity, p_allocated_by)
--     RETURNS INT (allocation_id)
--   sp_complete_allocation(p_allocation_id, p_user_id) RETURNS VOID
--   sp_cancel_allocation(p_allocation_id, p_user_id)   RETURNS VOID
--
-- TABLES TOUCHED: help_requests, shelters, volunteers, resource_inventory,
--                 allocations, allocation_audit_log, stock_alerts
-- RUNS AFTER    : 01_schema.sql, 02_seed.sql, 03a_priority.sql
-- =============================================================================


-- ===========================================================================
-- PROCEDURE: sp_allocate_shelter_bed
-- ===========================================================================
-- Allocates one or more beds in a shelter to a pending help request.
--
-- Lock order (MUST be kept consistent to prevent deadlocks):
--   1. Lock help_requests row    (request_id, ascending)
--   2. Lock shelters row         (shelter_id, ascending)
--
-- RAISES:
--   P0003 — request not found or not in PENDING status
--   P0004 — shelter not found or not ACTIVE
--   P0005 — shelter has insufficient free beds
--
-- RETURNS: allocation_id (INT) of the new allocations row.
-- WHO MAY EXECUTE: role_admin, role_agency_manager
-- ===========================================================================
CREATE OR REPLACE FUNCTION sp_allocate_shelter_bed(
    p_request_id    INT,
    p_shelter_id    INT,
    p_beds          INT,
    p_allocated_by  INT   -- app_users.user_id of the operator performing this
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_shelter_total     INT;
    v_shelter_current   INT;
    v_shelter_status    VARCHAR(20);
    v_request_status    VARCHAR(20);
    v_free_beds         INT;
    v_allocation_id     INT;
    v_priority          NUMERIC(8,2);
BEGIN
    -- -----------------------------------------------------------------------
    -- Step 1: Lock the help_request row first (consistent lock ordering).
    --   We use NOWAIT-free locking here — if blocked, the caller's BEGIN/COMMIT
    --   context will eventually get the lock. The two-session concurrency demo
    --   shows Session 2 blocking here until Session 1 commits.
    -- -----------------------------------------------------------------------
    SELECT status
      INTO v_request_status
      FROM help_requests
     WHERE request_id = p_request_id
       FOR UPDATE;   -- row-level lock; blocks concurrent allocations to this request

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found: %', p_request_id
              USING ERRCODE = 'P0003';
    END IF;

    IF v_request_status <> 'PENDING' THEN
        RAISE EXCEPTION 'Request % is not PENDING (current status: %)',
                         p_request_id, v_request_status
              USING ERRCODE = 'P0003';
    END IF;

    -- -----------------------------------------------------------------------
    -- Step 2: Lock the shelter row second (consistent ordering after request).
    -- -----------------------------------------------------------------------
    SELECT total_capacity, current_occupancy, status
      INTO v_shelter_total, v_shelter_current, v_shelter_status
      FROM shelters
     WHERE shelter_id = p_shelter_id
       FOR UPDATE;   -- prevents concurrent sp_allocate_shelter_bed from
                     -- reading stale current_occupancy

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Shelter not found: %', p_shelter_id
              USING ERRCODE = 'P0004';
    END IF;

    IF v_shelter_status <> 'OPEN' THEN
        RAISE EXCEPTION 'Shelter % is not OPEN (status: %)',
                         p_shelter_id, v_shelter_status
              USING ERRCODE = 'P0004';
    END IF;

    -- -----------------------------------------------------------------------
    -- Step 3: Capacity check.
    -- -----------------------------------------------------------------------
    v_free_beds := v_shelter_total - v_shelter_current;

    IF p_beds > v_free_beds THEN
        RAISE EXCEPTION 'Shelter % has only % free bed(s); % requested.',
                         p_shelter_id, v_free_beds, p_beds
              USING ERRCODE = 'P0005';
    END IF;

    IF p_beds < 1 THEN
        RAISE EXCEPTION 'beds_requested must be at least 1 (got %).',
                         p_beds
              USING ERRCODE = 'P0005';
    END IF;

    -- -----------------------------------------------------------------------
    -- Step 4: Recompute priority score for the final allocation record.
    -- -----------------------------------------------------------------------
    v_priority := compute_priority_score(p_request_id);

    -- -----------------------------------------------------------------------
    -- Step 5: Insert the allocation row.
    --   The AFTER INSERT trigger on allocations (trg_sync_occupancy) will
    --   update shelters.current_occupancy automatically — do NOT update it here.
    --   The AFTER INSERT trigger on allocations (trg_audit_allocation) will
    --   write an audit log row automatically.
    -- -----------------------------------------------------------------------
    INSERT INTO allocations (
        request_id,
        shelter_id,
        volunteer_id,
        resource_type_id,
        quantity,
        beds_allocated,
        status,
        allocated_by,
        allocated_at
    ) VALUES (
        p_request_id,
        p_shelter_id,
        NULL,          -- no volunteer in a bed allocation
        NULL,          -- no resource in a bed allocation
        0,             -- quantity is NOT NULL (default 0)
        p_beds,
        'ACTIVE',
        p_allocated_by,
        NOW()
    )
    RETURNING allocation_id INTO v_allocation_id;

    -- -----------------------------------------------------------------------
    -- Step 6: Update the request status to ALLOCATED.
    --   The AFTER UPDATE trigger on help_requests (trg_request_status_update)
    --   will also set updated_at automatically.
    -- -----------------------------------------------------------------------
    UPDATE help_requests
       SET status         = 'ALLOCATED',
           priority_score = v_priority,
           updated_at     = NOW()
     WHERE request_id = p_request_id;

    RETURN v_allocation_id;
END;
$$;

COMMENT ON FUNCTION sp_allocate_shelter_bed(INT,INT,INT,INT) IS
'Allocates beds in a shelter to a PENDING request using SELECT...FOR UPDATE.
Lock order: help_requests first, then shelters (prevents deadlocks).
Raises P0003 (bad request), P0004 (bad shelter), P0005 (over capacity).
Returns the new allocation_id. Triggers handle occupancy sync and audit logging.';


-- ===========================================================================
-- PROCEDURE: sp_assign_volunteer
-- ===========================================================================
-- Assigns an AVAILABLE volunteer to a PENDING help request.
--
-- Lock order:
--   1. Lock help_requests row
--   2. Lock volunteers row
--
-- RAISES:
--   P0003 — request not found or not PENDING
--   P0006 — volunteer not found or not AVAILABLE
--
-- RETURNS: allocation_id (INT)
-- WHO MAY EXECUTE: role_admin, role_agency_manager
-- ===========================================================================
CREATE OR REPLACE FUNCTION sp_assign_volunteer(
    p_request_id    INT,
    p_volunteer_id  INT,
    p_allocated_by  INT
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_request_status   VARCHAR(20);
    v_vol_avail        VARCHAR(20);
    v_allocation_id    INT;
BEGIN
    -- -----------------------------------------------------------------------
    -- Step 1: Lock the help_requests row first.
    -- -----------------------------------------------------------------------
    SELECT status
      INTO v_request_status
      FROM help_requests
     WHERE request_id = p_request_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found: %', p_request_id
              USING ERRCODE = 'P0003';
    END IF;

    IF v_request_status <> 'PENDING' THEN
        RAISE EXCEPTION 'Request % is not PENDING (current status: %)',
                         p_request_id, v_request_status
              USING ERRCODE = 'P0003';
    END IF;

    -- -----------------------------------------------------------------------
    -- Step 2: Lock the volunteers row second.
    -- -----------------------------------------------------------------------
    SELECT availability_status
      INTO v_vol_avail
      FROM volunteers
     WHERE volunteer_id = p_volunteer_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Volunteer not found: %', p_volunteer_id
              USING ERRCODE = 'P0006';
    END IF;

    IF v_vol_avail <> 'AVAILABLE' THEN
        RAISE EXCEPTION 'Volunteer % is not AVAILABLE (status: %)',
                         p_volunteer_id, v_vol_avail
              USING ERRCODE = 'P0006';
    END IF;

    -- -----------------------------------------------------------------------
    -- Step 3: Insert the allocation row.
    -- -----------------------------------------------------------------------
    INSERT INTO allocations (
        request_id,
        shelter_id,
        volunteer_id,
        resource_type_id,
        quantity,
        beds_allocated,
        status,
        allocated_by,
        allocated_at
    ) VALUES (
        p_request_id,
        NULL,
        p_volunteer_id,
        NULL,
        0,             -- quantity is NOT NULL (default 0)
        0,             -- beds_allocated is NOT NULL (default 0)
        'ACTIVE',
        p_allocated_by,
        NOW()
    )
    RETURNING allocation_id INTO v_allocation_id;

    -- -----------------------------------------------------------------------
    -- Step 4: Mark the volunteer as ASSIGNED.
    --   The trigger trg_sync_volunteer_status handles this automatically via
    --   AFTER INSERT on allocations — see 04_triggers.sql.
    -- -----------------------------------------------------------------------

    -- -----------------------------------------------------------------------
    -- Step 5: Update the request status.
    -- -----------------------------------------------------------------------
    UPDATE help_requests
       SET status     = 'ALLOCATED',
           updated_at = NOW()
     WHERE request_id = p_request_id;

    RETURN v_allocation_id;
END;
$$;

COMMENT ON FUNCTION sp_assign_volunteer(INT,INT,INT) IS
'Assigns an AVAILABLE volunteer to a PENDING request using SELECT...FOR UPDATE.
Lock order: help_requests first, then volunteers (prevents deadlocks).
Raises P0003 (bad request), P0006 (volunteer not available).
Triggers handle volunteer status sync and audit logging.';


-- ===========================================================================
-- PROCEDURE: sp_allocate_resource
-- ===========================================================================
-- Allocates a quantity of a resource (from resource_inventory) to a request.
--
-- Lock order:
--   1. Lock help_requests row
--   2. Lock resource_inventory row
--
-- RAISES:
--   P0003 — request not found or not PENDING
--   P0007 — inventory record not found
--   P0008 — insufficient stock
--
-- RETURNS: allocation_id (INT)
-- WHO MAY EXECUTE: role_admin, role_agency_manager
-- ===========================================================================
CREATE OR REPLACE FUNCTION sp_allocate_resource(
    p_request_id    INT,
    p_inventory_id  INT,
    p_quantity      INT,
    p_allocated_by  INT
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_request_status    VARCHAR(20);
    v_qty_available     INT;
    v_resource_type_id  INT;
    v_shelter_id        INT;
    v_allocation_id     INT;
BEGIN
    IF p_quantity < 1 THEN
        RAISE EXCEPTION 'quantity must be at least 1 (got %)', p_quantity
              USING ERRCODE = 'P0008';
    END IF;

    -- -----------------------------------------------------------------------
    -- Step 1: Lock help_requests row first (consistent ordering).
    -- -----------------------------------------------------------------------
    SELECT status
      INTO v_request_status
      FROM help_requests
     WHERE request_id = p_request_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found: %', p_request_id
              USING ERRCODE = 'P0003';
    END IF;

    IF v_request_status <> 'PENDING' THEN
        RAISE EXCEPTION 'Request % is not PENDING (current status: %)',
                         p_request_id, v_request_status
              USING ERRCODE = 'P0003';
    END IF;

    -- -----------------------------------------------------------------------
    -- Step 2: Lock resource_inventory row second.
    -- -----------------------------------------------------------------------
    SELECT quantity_available, resource_type_id, shelter_id
      INTO v_qty_available, v_resource_type_id, v_shelter_id
      FROM resource_inventory
     WHERE inventory_id = p_inventory_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Inventory record not found: %', p_inventory_id
              USING ERRCODE = 'P0007';
    END IF;

    IF p_quantity > v_qty_available THEN
        RAISE EXCEPTION 'Inventory % has only % unit(s) available; % requested.',
                         p_inventory_id, v_qty_available, p_quantity
              USING ERRCODE = 'P0008';
    END IF;

    -- -----------------------------------------------------------------------
    -- Step 3: Insert allocation row.
    --   The AFTER INSERT trigger trg_sync_inventory will decrement
    --   resource_inventory.quantity_available automatically.
    --   The AFTER INSERT trigger trg_check_low_stock will raise a stock_alerts
    --   row if stock falls below reorder_threshold.
    -- -----------------------------------------------------------------------
    INSERT INTO allocations (
        request_id,
        shelter_id,
        volunteer_id,
        resource_type_id,
        quantity,
        beds_allocated,
        status,
        allocated_by,
        allocated_at
    ) VALUES (
        p_request_id,
        v_shelter_id,
        NULL,
        v_resource_type_id,
        p_quantity,
        0,             -- beds_allocated is NOT NULL (default 0)
        'ACTIVE',
        p_allocated_by,
        NOW()
    )
    RETURNING allocation_id INTO v_allocation_id;

    -- -----------------------------------------------------------------------
    -- Step 4: Update the request status.
    -- -----------------------------------------------------------------------
    UPDATE help_requests
       SET status     = 'ALLOCATED',
           updated_at = NOW()
     WHERE request_id = p_request_id;

    RETURN v_allocation_id;
END;
$$;

COMMENT ON FUNCTION sp_allocate_resource(INT,INT,INT,INT) IS
'Allocates a quantity of a resource to a PENDING request using SELECT...FOR UPDATE.
Lock order: help_requests first, then resource_inventory (prevents deadlocks).
Raises P0003 (bad request), P0007 (no inventory), P0008 (insufficient stock).
Triggers handle inventory decrement, low-stock alerts, and audit logging.';


-- ===========================================================================
-- PROCEDURE: sp_complete_allocation
-- ===========================================================================
-- Marks an ACTIVE allocation as COMPLETED.
-- Releases the shelter bed, volunteer, or resource back to the pool.
-- The AFTER UPDATE trigger on allocations handles the reverse sync automatically.
--
-- RAISES:
--   P0009 — allocation not found or not ACTIVE
--
-- WHO MAY EXECUTE: role_admin, role_agency_manager, role_volunteer
--                 (volunteer may only complete their own — enforced by Node middleware)
-- ===========================================================================
CREATE OR REPLACE FUNCTION sp_complete_allocation(
    p_allocation_id  INT,
    p_user_id        INT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_alloc_status    VARCHAR(20);
    v_request_id      INT;
BEGIN
    -- -----------------------------------------------------------------------
    -- Step 1: Lock and validate the allocation row.
    -- -----------------------------------------------------------------------
    SELECT status, request_id
      INTO v_alloc_status, v_request_id
      FROM allocations
     WHERE allocation_id = p_allocation_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Allocation not found: %', p_allocation_id
              USING ERRCODE = 'P0009';
    END IF;

    IF v_alloc_status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'Allocation % is not ACTIVE (status: %)',
                         p_allocation_id, v_alloc_status
              USING ERRCODE = 'P0009';
    END IF;

    -- -----------------------------------------------------------------------
    -- Step 2: Update allocation status.
    --   The AFTER UPDATE trigger trg_sync_on_alloc_change will:
    --     - Decrement shelters.current_occupancy (for bed allocations)
    --     - Set volunteers.availability_status = 'AVAILABLE' (for volunteer allocs)
    --     - Restore resource_inventory.quantity_available (for resource allocs)
    --   The AFTER UPDATE trigger trg_audit_allocation will write an audit row.
    -- -----------------------------------------------------------------------
    UPDATE allocations
       SET status       = 'COMPLETED',
           completed_at = NOW()
     WHERE allocation_id = p_allocation_id;

    -- -----------------------------------------------------------------------
    -- Step 3: If this is the last ACTIVE allocation on the request, mark
    --         the request as COMPLETED too.
    -- -----------------------------------------------------------------------
    UPDATE help_requests
       SET status     = 'COMPLETED',
           updated_at = NOW()
     WHERE request_id = v_request_id
       AND NOT EXISTS (
           SELECT 1
             FROM allocations a2
            WHERE a2.request_id = v_request_id
              AND a2.status = 'ACTIVE'
       );
END;
$$;

COMMENT ON FUNCTION sp_complete_allocation(INT,INT) IS
'Marks an ACTIVE allocation as COMPLETED. Triggers handle the reverse sync
(freeing shelter beds, volunteer status, inventory). If no other ACTIVE allocations
remain for the request, the request is also marked COMPLETED.
Raises P0009 if allocation is not found or not ACTIVE.';


-- ===========================================================================
-- PROCEDURE: sp_cancel_allocation
-- ===========================================================================
-- Cancels an ACTIVE allocation (e.g., requester no longer needs help, or
-- resource was erroneously allocated).
-- Releases the shelter bed, volunteer, or resource back to the pool.
-- The AFTER UPDATE trigger handles the reverse sync automatically.
--
-- RAISES:
--   P0009 — allocation not found or not ACTIVE
--
-- WHO MAY EXECUTE: role_admin, role_agency_manager
-- ===========================================================================
CREATE OR REPLACE FUNCTION sp_cancel_allocation(
    p_allocation_id  INT,
    p_user_id        INT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_alloc_status  VARCHAR(20);
    v_request_id    INT;
BEGIN
    -- -----------------------------------------------------------------------
    -- Step 1: Lock and validate the allocation row.
    -- -----------------------------------------------------------------------
    SELECT status, request_id
      INTO v_alloc_status, v_request_id
      FROM allocations
     WHERE allocation_id = p_allocation_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Allocation not found: %', p_allocation_id
              USING ERRCODE = 'P0009';
    END IF;

    IF v_alloc_status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'Allocation % cannot be cancelled (status: %)',
                         p_allocation_id, v_alloc_status
              USING ERRCODE = 'P0009';
    END IF;

    -- -----------------------------------------------------------------------
    -- Step 2: Mark allocation as CANCELLED.
    --   Triggers handle reverse sync and audit logging.
    -- -----------------------------------------------------------------------
    UPDATE allocations
       SET status       = 'CANCELLED',
           completed_at = NOW()
     WHERE allocation_id = p_allocation_id;

    -- -----------------------------------------------------------------------
    -- Step 3: If no other ACTIVE allocations remain, revert the request to
    --         PENDING so it can be re-allocated.
    -- -----------------------------------------------------------------------
    UPDATE help_requests
       SET status     = 'PENDING',
           updated_at = NOW()
     WHERE request_id = v_request_id
       AND status = 'ALLOCATED'
       AND NOT EXISTS (
           SELECT 1
             FROM allocations a2
            WHERE a2.request_id = v_request_id
              AND a2.status = 'ACTIVE'
       );
END;
$$;

COMMENT ON FUNCTION sp_cancel_allocation(INT,INT) IS
'Cancels an ACTIVE allocation. Triggers handle reverse sync (freeing bed/volunteer/stock)
and write an audit row. If no ACTIVE allocations remain on the request, the request
reverts to PENDING so it can be re-allocated. Raises P0009 if not found or not ACTIVE.';
