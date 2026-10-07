-- =============================================================================
-- FILE   : db/03_functions/03c_helpers.sql
-- OWNER  : Person B (Logic & Concurrency)
-- PURPOSE: Helper functions — shelter suggestion and duplicate-request detection.
--
--   sp_suggest_shelter(p_request_id INT)
--     Returns shelters ranked by free capacity, preferring the same district
--     as the request. Used by the UI to present a recommendation before the
--     agency manager calls sp_allocate_shelter_bed.
--
--   fn_is_duplicate_request(p_requester_id INT, p_request_type TEXT, p_window_minutes INT)
--     Returns TRUE if a very similar request already exists within the time window.
--     Called by the BEFORE INSERT trigger on help_requests (see 04_triggers.sql).
--
-- TABLES READ  : shelters, help_requests, requesters
-- RUNS AFTER   : 01_schema.sql, 02_seed.sql
-- =============================================================================


-- ===========================================================================
-- FUNCTION: sp_suggest_shelter
-- ===========================================================================
-- Returns shelters ordered by free capacity (total_capacity - current_occupancy),
-- with shelters in the same district as the help request ranked first.
--
-- Logic:
--   Priority 1 — same district, most free beds first.
--   Priority 2 — any other district, most free beds first.
--   Only ACTIVE shelters with at least 1 free bed are returned.
--
-- Returns empty set if no suitable shelter exists (Node should handle gracefully).
--
-- WHO MAY EXECUTE: role_admin, role_agency_manager
-- ===========================================================================
CREATE OR REPLACE FUNCTION sp_suggest_shelter(
    p_request_id  INT
)
RETURNS TABLE (
    shelter_id   INT,
    shelter_name VARCHAR(150),
    free_beds    INT,
    district     TEXT,
    pct_full     NUMERIC(5,1)  -- percentage of total capacity currently occupied
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    v_request_district  VARCHAR(100);
BEGIN
    -- -----------------------------------------------------------------------
    -- Step 1: Look up the district of the incoming request.
    -- -----------------------------------------------------------------------
    SELECT hr.district
      INTO v_request_district
      FROM help_requests hr
     WHERE hr.request_id = p_request_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found: %', p_request_id
              USING ERRCODE = 'P0002';
    END IF;

    -- -----------------------------------------------------------------------
    -- Step 2: Return shelters ordered by:
    --   a) Same district first (CASE gives 0 for same, 1 for others)
    --   b) Then by free beds DESC (most available first)
    -- -----------------------------------------------------------------------
    RETURN QUERY
    SELECT s.shelter_id::INT,
           s.name,
           (s.total_capacity - s.current_occupancy)::INT    AS free_beds,
           s.district::TEXT,
           ROUND(s.current_occupancy * 100.0 / NULLIF(s.total_capacity, 0), 1) AS pct_full
      FROM shelters s
     WHERE s.status = 'ACTIVE'
       AND (s.total_capacity - s.current_occupancy) > 0   -- at least one free bed
     ORDER BY
           CASE WHEN LOWER(s.district) = LOWER(v_request_district) THEN 0 ELSE 1 END,
           (s.total_capacity - s.current_occupancy) DESC;
END;
$$;

COMMENT ON FUNCTION sp_suggest_shelter(INT) IS
'Returns ACTIVE shelters with free beds ordered by same-district preference then
by most-free-beds (load balancing). Does NOT lock any rows — just a recommendation.
The actual allocation goes through sp_allocate_shelter_bed with FOR UPDATE.';


-- ===========================================================================
-- FUNCTION: fn_is_duplicate_request
-- ===========================================================================
-- Returns TRUE if a recent PENDING or ALLOCATED request exists from the same
-- requester (same requester_id OR same phone), of the same request_type,
-- within the last p_window_minutes minutes.
--
-- Called by the BEFORE INSERT trigger trg_block_duplicate_request in
-- 04_triggers.sql. Separated into its own function so it can be unit-tested
-- independently (see db/tests/triggers/).
--
-- Parameters:
--   p_requester_id    — the requester's ID (to check requester_id match)
--   p_phone           — the requester's phone (to catch same-person different-ID)
--   p_request_type    — e.g., 'RESCUE', 'FOOD'
--   p_window_minutes  — look-back window in minutes (default 60 in the trigger)
--
-- Returns: BOOLEAN (TRUE = is a duplicate; the trigger will RAISE EXCEPTION)
-- ===========================================================================
CREATE OR REPLACE FUNCTION fn_is_duplicate_request(
    p_requester_id    INT,
    p_phone           VARCHAR(15),
    p_request_type    VARCHAR(20),
    p_window_minutes  INT DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    v_dup_count  INT;
BEGIN
    SELECT COUNT(*)
      INTO v_dup_count
      FROM help_requests hr
      JOIN requesters r ON r.requester_id = hr.requester_id
     WHERE (
               hr.requester_id = p_requester_id     -- same requester by ID
               OR r.phone      = p_phone             -- same phone (catches cross-ID dups)
           )
       AND hr.request_type = p_request_type          -- same type
       AND hr.status IN ('PENDING', 'ALLOCATED')     -- still open
       AND hr.created_at >= (NOW() - (p_window_minutes || ' minutes')::INTERVAL);

    RETURN v_dup_count > 0;
END;
$$;

COMMENT ON FUNCTION fn_is_duplicate_request(INT,VARCHAR,VARCHAR,INT) IS
'Returns TRUE if the same requester (by ID or phone) already has an open
PENDING/ALLOCATED request of the same type within the last p_window_minutes minutes.
Called by the BEFORE INSERT trigger trg_block_duplicate_request on help_requests.';
