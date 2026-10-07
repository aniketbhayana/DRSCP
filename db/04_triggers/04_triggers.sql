-- =============================================================================
-- FILE   : db/04_triggers/04_triggers.sql
-- OWNER  : Person B (Logic & Concurrency)
-- PURPOSE: All trigger functions and trigger definitions for DRSCP.
--
-- TRIGGER INVENTORY (in definition order):
--
--   1. trg_set_updated_at          — BEFORE UPDATE on help_requests
--      Auto-sets updated_at = NOW() on every UPDATE.
--
--   2. trg_block_duplicate_request — BEFORE INSERT on help_requests
--      Calls fn_is_duplicate_request(); rejects exact duplicates within 60 min.
--
--   3. trg_validate_alloc_before   — BEFORE INSERT OR UPDATE on allocations
--      Guards against invalid status transitions and ensures allocations reference
--      at least one of shelter_id / volunteer_id / resource_type_id.
--
--   4. trg_sync_occupancy          — AFTER INSERT OR UPDATE OR DELETE on allocations
--      Keeps shelters.current_occupancy in sync with the live allocations table.
--
--   5. trg_sync_volunteer_status   — AFTER INSERT OR UPDATE OR DELETE on allocations
--      Keeps volunteers.availability_status in sync (AVAILABLE <-> ASSIGNED).
--
--   6. trg_sync_inventory          — AFTER INSERT OR UPDATE OR DELETE on allocations
--      Decrements / restores resource_inventory.quantity_available.
--
--   7. trg_check_low_stock         — AFTER UPDATE on resource_inventory
--      Inserts a row into stock_alerts when quantity_available falls below
--      reorder_threshold.
--
--   8. trg_audit_allocation        — AFTER INSERT OR UPDATE on allocations
--      Writes a row to allocation_audit_log for every state change.
--
--   9. trg_set_priority_on_insert  — AFTER INSERT on help_requests
--      Computes and stores priority_score immediately after a new request is saved.
--
-- RUNS AFTER: 01_schema.sql, 02_seed.sql, 03_functions.sql
-- =============================================================================


-- ===========================================================================
-- 1. TRIGGER FUNCTION: fn_set_updated_at
--    BEFORE UPDATE on help_requests
--    Purpose  : Automatically keep updated_at current on every UPDATE.
--    Side effect: sets NEW.updated_at = NOW()
--    Tables touched: help_requests (write)
-- ===========================================================================
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

-- Drop trigger if it already exists (idempotent), then recreate.
DROP TRIGGER IF EXISTS trg_set_updated_at ON help_requests;
CREATE TRIGGER trg_set_updated_at
    BEFORE UPDATE ON help_requests
    FOR EACH ROW
    EXECUTE FUNCTION fn_set_updated_at();

COMMENT ON FUNCTION fn_set_updated_at() IS
'BEFORE UPDATE trigger function: sets updated_at = NOW() automatically.
Attached to help_requests so callers never need to remember to set it.';


-- ===========================================================================
-- 2. TRIGGER FUNCTION: fn_block_duplicate_request
--    BEFORE INSERT on help_requests
--    Purpose  : Detect probable duplicate requests from the same person within
--               the last 60 minutes and prevent them from being saved.
--    Inputs   : NEW (the incoming help_requests row)
--    Side effect: RAISEs an exception (P0010) if a duplicate is found, which
--                 causes the INSERT to be silently rolled back by PostgreSQL.
--    Tables touched: help_requests (read via fn_is_duplicate_request),
--                    requesters (read via fn_is_duplicate_request)
-- ===========================================================================
CREATE OR REPLACE FUNCTION fn_block_duplicate_request()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_phone          VARCHAR(15);
    v_is_duplicate   BOOLEAN;
BEGIN
    -- Fetch the requester's phone for the cross-ID duplicate check.
    SELECT phone INTO v_phone
      FROM requesters
     WHERE requester_id = NEW.requester_id;

    -- Call the helper function (in 03c_helpers.sql).
    v_is_duplicate := fn_is_duplicate_request(
        NEW.requester_id,
        v_phone,
        NEW.request_type,
        60   -- 60-minute window; change here if the team agrees
    );

    IF v_is_duplicate THEN
        RAISE EXCEPTION
            'Duplicate request blocked: requester % already has an open % request within the last 60 minutes.',
            NEW.requester_id, NEW.request_type
            USING ERRCODE = 'P0010';
    END IF;

    RETURN NEW;  -- allow the INSERT to proceed
END;
$$;

DROP TRIGGER IF EXISTS trg_block_duplicate_request ON help_requests;
CREATE TRIGGER trg_block_duplicate_request
    BEFORE INSERT ON help_requests
    FOR EACH ROW
    EXECUTE FUNCTION fn_block_duplicate_request();

COMMENT ON FUNCTION fn_block_duplicate_request() IS
'BEFORE INSERT trigger on help_requests. Calls fn_is_duplicate_request() to detect
if the same requester already has an open request of the same type in the last 60 min.
Raises P0010 to block the INSERT if a duplicate is found.';


-- ===========================================================================
-- 3. TRIGGER FUNCTION: fn_validate_alloc_before
--    BEFORE INSERT OR UPDATE on allocations
--    Purpose  : Guard against:
--      a) An allocation row that references none of shelter/volunteer/resource.
--      b) Invalid status transitions (ACTIVE -> ACTIVE is OK; COMPLETED ->
--         ACTIVE is not; CANCELLED -> ACTIVE is not).
--    Side effect: RAISEs an exception to abort invalid operations.
--    Tables touched: allocations (read via OLD/NEW)
-- ===========================================================================
CREATE OR REPLACE FUNCTION fn_validate_alloc_before()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- -----------------------------------------------------------------------
    -- Rule A: Every allocation must reference at least one target.
    -- -----------------------------------------------------------------------
    IF NEW.shelter_id IS NULL AND NEW.volunteer_id IS NULL AND NEW.resource_type_id IS NULL THEN
        RAISE EXCEPTION
            'Invalid allocation: must specify at least one of shelter_id, volunteer_id, or resource_type_id.'
            USING ERRCODE = 'P0011';
    END IF;

    -- -----------------------------------------------------------------------
    -- Rule B: Status transition guard.
    --   Allowed transitions:
    --     (any) -> ACTIVE       during INSERT (new allocation)
    --     ACTIVE -> COMPLETED   (sp_complete_allocation)
    --     ACTIVE -> CANCELLED   (sp_cancel_allocation)
    --   Blocked:
    --     COMPLETED -> anything
    --     CANCELLED  -> anything
    -- -----------------------------------------------------------------------
    IF TG_OP = 'UPDATE' THEN
        IF OLD.status IN ('COMPLETED', 'CANCELLED') THEN
            RAISE EXCEPTION
                'Cannot change allocation % status from % (terminal state).',
                OLD.allocation_id, OLD.status
                USING ERRCODE = 'P0012';
        END IF;

        -- Do not allow going backwards from COMPLETED to ACTIVE.
        IF OLD.status = 'COMPLETED' AND NEW.status = 'ACTIVE' THEN
            RAISE EXCEPTION
                'Invalid status transition: COMPLETED -> ACTIVE on allocation %.',
                OLD.allocation_id
                USING ERRCODE = 'P0012';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_alloc_before ON allocations;
CREATE TRIGGER trg_validate_alloc_before
    BEFORE INSERT OR UPDATE ON allocations
    FOR EACH ROW
    EXECUTE FUNCTION fn_validate_alloc_before();

COMMENT ON FUNCTION fn_validate_alloc_before() IS
'BEFORE INSERT OR UPDATE trigger on allocations.
Rule A: allocation must reference at least one target (shelter/volunteer/resource).
Rule B: terminal-state guard — COMPLETED and CANCELLED rows cannot be changed.
Raises P0011 (no target) or P0012 (invalid transition).';


-- ===========================================================================
-- 4. TRIGGER FUNCTION: fn_sync_occupancy
--    AFTER INSERT OR UPDATE OR DELETE on allocations
--    Purpose  : Keep shelters.current_occupancy always equal to the actual
--               count of beds held by ACTIVE bed-allocations.
--               This is a DENORMALIZED column justified by performance: the
--               normalization document explains that computing it live via COUNT
--               on every request read would be too slow at scale.
--    Side effect: UPDATEs shelters.current_occupancy for the affected shelter.
--    Tables touched: shelters (write)
-- ===========================================================================
CREATE OR REPLACE FUNCTION fn_sync_occupancy()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_shelter_id   INT;
    v_new_occupancy INT;
BEGIN
    -- Determine which shelter we need to resync.
    -- On DELETE, OLD is the removed row; on INSERT/UPDATE, NEW has the shelter.
    IF TG_OP = 'DELETE' THEN
        v_shelter_id := OLD.shelter_id;
    ELSE
        v_shelter_id := NEW.shelter_id;
        -- If shelter changed on UPDATE, also resync the OLD shelter.
        IF TG_OP = 'UPDATE' AND OLD.shelter_id IS NOT NULL
                              AND OLD.shelter_id <> NEW.shelter_id THEN
            UPDATE shelters
               SET current_occupancy = (
                       SELECT COALESCE(SUM(a.beds_allocated), 0)
                         FROM allocations a
                        WHERE a.shelter_id = OLD.shelter_id
                          AND a.status = 'ACTIVE'
                          AND a.beds_allocated IS NOT NULL
                   )
             WHERE shelter_id = OLD.shelter_id;
        END IF;
    END IF;

    -- Skip if this allocation has no shelter (volunteer or resource allocation).
    IF v_shelter_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Recompute the live occupancy from the allocations table (source of truth).
    SELECT COALESCE(SUM(a.beds_allocated), 0)
      INTO v_new_occupancy
      FROM allocations a
     WHERE a.shelter_id = v_shelter_id
       AND a.status = 'ACTIVE'
       AND a.beds_allocated > 0;

    UPDATE shelters
       SET current_occupancy = v_new_occupancy,
           status = CASE
                      WHEN status = 'CLOSED' THEN 'CLOSED'
                      WHEN v_new_occupancy >= total_capacity THEN 'FULL'
                      ELSE 'OPEN'
                    END
     WHERE shelter_id = v_shelter_id;

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_occupancy ON allocations;
CREATE TRIGGER trg_sync_occupancy
    AFTER INSERT OR UPDATE OR DELETE ON allocations
    FOR EACH ROW
    EXECUTE FUNCTION fn_sync_occupancy();

COMMENT ON FUNCTION fn_sync_occupancy() IS
'AFTER INSERT/UPDATE/DELETE trigger on allocations.
Recomputes shelters.current_occupancy as the SUM of beds_allocated of ACTIVE
bed-allocations for the affected shelter. Also updates shelter status to FULL when
capacity is reached and back to OPEN when beds free up.
No action taken for volunteer or resource allocations without beds.';


-- ===========================================================================
-- 5. TRIGGER FUNCTION: fn_sync_volunteer_status
--    AFTER INSERT OR UPDATE OR DELETE on allocations
--    Purpose  : Keep volunteers.availability_status in sync.
--      - New ACTIVE volunteer allocation  -> ASSIGNED
--      - Allocation changes to COMPLETED or CANCELLED -> AVAILABLE
--    Tables touched: volunteers (write)
-- ===========================================================================
CREATE OR REPLACE FUNCTION fn_sync_volunteer_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_volunteer_id  INT;
BEGIN
    -- Determine the volunteer involved.
    IF TG_OP = 'DELETE' THEN
        v_volunteer_id := OLD.volunteer_id;
    ELSE
        v_volunteer_id := NEW.volunteer_id;
    END IF;

    -- Skip if this is not a volunteer allocation.
    IF v_volunteer_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    IF TG_OP = 'INSERT' AND NEW.status = 'ACTIVE' THEN
        -- New assignment: mark volunteer as ASSIGNED.
        UPDATE volunteers
           SET availability_status = 'ASSIGNED'
         WHERE volunteer_id = v_volunteer_id;

    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.status IN ('COMPLETED', 'CANCELLED') THEN
            -- Check if there are any other ACTIVE volunteer allocations for this person.
            -- Only free them up if all their assignments are done.
            IF NOT EXISTS (
                SELECT 1 FROM allocations
                 WHERE volunteer_id = v_volunteer_id
                   AND status = 'ACTIVE'
                   AND allocation_id <> NEW.allocation_id
            ) THEN
                UPDATE volunteers
                   SET availability_status = 'AVAILABLE'
                 WHERE volunteer_id = v_volunteer_id;
            END IF;
        END IF;

    ELSIF TG_OP = 'DELETE' THEN
        -- Row deleted: free volunteer if no other active assignments.
        IF NOT EXISTS (
            SELECT 1 FROM allocations
             WHERE volunteer_id = v_volunteer_id
               AND status = 'ACTIVE'
        ) THEN
            UPDATE volunteers
               SET availability_status = 'AVAILABLE'
             WHERE volunteer_id = v_volunteer_id;
        END IF;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_volunteer_status ON allocations;
CREATE TRIGGER trg_sync_volunteer_status
    AFTER INSERT OR UPDATE OR DELETE ON allocations
    FOR EACH ROW
    EXECUTE FUNCTION fn_sync_volunteer_status();

COMMENT ON FUNCTION fn_sync_volunteer_status() IS
'AFTER INSERT/UPDATE/DELETE trigger on allocations.
Sets volunteers.availability_status = ASSIGNED on new ACTIVE volunteer allocation.
Reverts to AVAILABLE when the allocation is COMPLETED or CANCELLED (only if no
other ACTIVE allocations exist for this volunteer).';


-- ===========================================================================
-- 6. TRIGGER FUNCTION: fn_sync_inventory
--    AFTER INSERT OR UPDATE OR DELETE on allocations
--    Purpose  : Keep resource_inventory.quantity_available correct.
--      - INSERT (ACTIVE resource alloc) -> decrement by quantity
--      - UPDATE to COMPLETED/CANCELLED  -> restore quantity (return stock)
--      - DELETE                         -> restore quantity
--    Tables touched: resource_inventory (write)
-- ===========================================================================
CREATE OR REPLACE FUNCTION fn_sync_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only act on resource allocations.
    IF TG_OP = 'INSERT' THEN
        IF NEW.resource_type_id IS NULL THEN
            RETURN NEW;
        END IF;
        IF NEW.status = 'ACTIVE' THEN
            UPDATE resource_inventory
               SET quantity_available = quantity_available - COALESCE(NEW.quantity, 0),
                   last_updated       = NOW()
             WHERE resource_type_id = NEW.resource_type_id
               AND (
                   (NEW.shelter_id IS NOT NULL AND shelter_id = NEW.shelter_id)
                   OR (NEW.shelter_id IS NULL AND shelter_id = (
                       SELECT ri.shelter_id
                         FROM resource_inventory ri
                        WHERE ri.resource_type_id = NEW.resource_type_id
                        LIMIT 1
                   ))
               );
        END IF;

    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.resource_type_id IS NULL THEN
            RETURN NEW;
        END IF;
        -- Restore stock when an allocation ends.
        IF OLD.status = 'ACTIVE' AND NEW.status IN ('COMPLETED', 'CANCELLED') THEN
            UPDATE resource_inventory
               SET quantity_available = quantity_available + COALESCE(OLD.quantity, 0),
                   last_updated       = NOW()
             WHERE resource_type_id = OLD.resource_type_id
               AND (
                   (OLD.shelter_id IS NOT NULL AND shelter_id = OLD.shelter_id)
                   OR (OLD.shelter_id IS NULL AND shelter_id = (
                       SELECT ri.shelter_id
                         FROM resource_inventory ri
                        WHERE ri.resource_type_id = OLD.resource_type_id
                        LIMIT 1
                   ))
               );
        END IF;

    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.resource_type_id IS NULL OR OLD.status <> 'ACTIVE' THEN
            RETURN OLD;
        END IF;
        UPDATE resource_inventory
           SET quantity_available = quantity_available + COALESCE(OLD.quantity, 0),
               last_updated       = NOW()
         WHERE resource_type_id = OLD.resource_type_id
           AND (
               (OLD.shelter_id IS NOT NULL AND shelter_id = OLD.shelter_id)
               OR (OLD.shelter_id IS NULL AND shelter_id = (
                   SELECT ri.shelter_id
                     FROM resource_inventory ri
                    WHERE ri.resource_type_id = OLD.resource_type_id
                    LIMIT 1
               ))
           );
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- NOTE TO PERSON A: When schema is finalized, if sp_allocate_resource stores
-- the inventory_id directly in the allocations row, replace the sub-select
-- with a direct lookup on inventory_id for accuracy. Raise CR if needed.

DROP TRIGGER IF EXISTS trg_sync_inventory ON allocations;
CREATE TRIGGER trg_sync_inventory
    AFTER INSERT OR UPDATE OR DELETE ON allocations
    FOR EACH ROW
    EXECUTE FUNCTION fn_sync_inventory();

COMMENT ON FUNCTION fn_sync_inventory() IS
'AFTER INSERT/UPDATE/DELETE trigger on allocations.
Decrements resource_inventory.quantity_available on new ACTIVE resource allocation.
Restores quantity on COMPLETED or CANCELLED. The low-stock alert is handled by
a separate trigger (trg_check_low_stock) on resource_inventory itself.';


-- ===========================================================================
-- 7. TRIGGER FUNCTION: fn_check_low_stock
--    AFTER UPDATE on resource_inventory
--    Purpose  : If quantity_available falls below reorder_threshold, insert
--               a row in stock_alerts (if one is not already open for this
--               inventory item).
--    Tables touched: stock_alerts (write)
-- ===========================================================================
CREATE OR REPLACE FUNCTION fn_check_low_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only fire when quantity has dropped (not risen).
    IF NEW.quantity_available < OLD.quantity_available
       AND NEW.quantity_available <= NEW.reorder_threshold THEN

        -- Avoid inserting duplicate alerts for the same inventory item.
        IF NOT EXISTS (
            SELECT 1 FROM stock_alerts
             WHERE inventory_id = NEW.inventory_id
               AND resolved = FALSE
        ) THEN
            INSERT INTO stock_alerts (inventory_id, message, created_at, resolved)
            VALUES (
                NEW.inventory_id,
                FORMAT(
                    'LOW STOCK: inventory_id=%s has %s unit(s) remaining (threshold: %s).',
                    NEW.inventory_id,
                    NEW.quantity_available,
                    NEW.reorder_threshold
                ),
                NOW(),
                FALSE
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_low_stock ON resource_inventory;
CREATE TRIGGER trg_check_low_stock
    AFTER UPDATE ON resource_inventory
    FOR EACH ROW
    EXECUTE FUNCTION fn_check_low_stock();

COMMENT ON FUNCTION fn_check_low_stock() IS
'AFTER UPDATE trigger on resource_inventory.
Inserts a stock_alerts row when quantity_available drops to or below reorder_threshold.
Skips if an unresolved alert already exists for that inventory item.';


-- ===========================================================================
-- 8. TRIGGER FUNCTION: fn_audit_allocation
--    AFTER INSERT OR UPDATE on allocations
--    Purpose  : Write a row to allocation_audit_log for every state change
--               so that the full history of every allocation is queryable.
--    Tables touched: allocation_audit_log (write)
-- ===========================================================================
CREATE OR REPLACE FUNCTION fn_audit_allocation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_old_status  VARCHAR(20);
    v_new_status  VARCHAR(20);
    v_action      VARCHAR(20);
    v_details     JSONB;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_old_status := NULL;
        v_new_status := NEW.status;
        v_action     := 'CREATED';
        v_details    := jsonb_build_object(
                            'shelter_id',      NEW.shelter_id,
                            'volunteer_id',    NEW.volunteer_id,
                            'resource_type_id',NEW.resource_type_id,
                            'quantity',        NEW.quantity,
                            'beds_allocated',  NEW.beds_allocated
                        );
    ELSIF TG_OP = 'UPDATE' THEN
        v_old_status := OLD.status;
        v_new_status := NEW.status;
        v_action     := CASE NEW.status
                            WHEN 'COMPLETED' THEN 'COMPLETED'
                            WHEN 'CANCELLED' THEN 'CANCELLED'
                            ELSE 'UPDATED'
                        END;
        v_details    := jsonb_build_object(
                            'old_status', OLD.status,
                            'new_status', NEW.status,
                            'completed_at', NEW.completed_at
                        );
    END IF;

    INSERT INTO allocation_audit_log (
        allocation_id,
        action,
        old_status,
        new_status,
        changed_by,
        changed_at,
        details
    ) VALUES (
        NEW.allocation_id,
        v_action,
        v_old_status,
        v_new_status,
        NEW.allocated_by,   -- the user who last touched this allocation
        NOW(),
        v_details
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_allocation ON allocations;
CREATE TRIGGER trg_audit_allocation
    AFTER INSERT OR UPDATE ON allocations
    FOR EACH ROW
    EXECUTE FUNCTION fn_audit_allocation();

COMMENT ON FUNCTION fn_audit_allocation() IS
'AFTER INSERT OR UPDATE trigger on allocations.
Writes a row to allocation_audit_log for every state change (CREATED, COMPLETED,
CANCELLED, UPDATED). Stores old/new status and JSONB details. Full audit trail
is queryable via the v_allocation_history view (Person C).';


-- ===========================================================================
-- 9. TRIGGER FUNCTION: fn_set_priority_on_insert
--    AFTER INSERT on help_requests
--    Purpose  : Compute and store priority_score the moment a new help request
--               is created, so the ranked queue is immediately sortable.
--    Tables touched: help_requests (write — UPDATE priority_score)
-- ===========================================================================
CREATE OR REPLACE FUNCTION fn_set_priority_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_score  NUMERIC(8,2);
BEGIN
    -- compute_priority_score is in 03a_priority.sql (must run before this file).
    v_score := compute_priority_score(NEW.request_id);

    UPDATE help_requests
       SET priority_score = v_score
     WHERE request_id = NEW.request_id;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_priority_on_insert ON help_requests;
CREATE TRIGGER trg_set_priority_on_insert
    AFTER INSERT ON help_requests
    FOR EACH ROW
    EXECUTE FUNCTION fn_set_priority_on_insert();

COMMENT ON FUNCTION fn_set_priority_on_insert() IS
'AFTER INSERT trigger on help_requests.
Immediately calls compute_priority_score() and writes the result into
help_requests.priority_score so the ranked urgent queue is sortable from the
first moment the request exists. Depends on 03a_priority.sql being loaded first.';
