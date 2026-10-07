-- =============================================================================
-- FILE   : db/03_functions/03a_priority.sql
-- OWNER  : Person B (Logic & Concurrency)
-- PURPOSE: Priority score calculation for help requests.
--
--   compute_priority_score(p_request_id INT) RETURNS NUMERIC(8,2)
--     Reads vulnerability weights from the lookup table (table-driven, NOT
--     hard-coded) and combines them with wait-time, request-type urgency, and
--     household-size factors to produce a numeric priority score.
--     Higher score = higher urgency.
--
--   sp_recompute_priorities() RETURNS INT
--     Refreshes priority_score for every PENDING request and returns the count
--     of rows updated. Call on-demand or nightly.
--
-- TABLES READ  : help_requests, requesters, requester_vulnerabilities,
--                vulnerability_types
-- TABLES WRITE : help_requests.priority_score (via sp_recompute_priorities)
-- RUNS AFTER   : 01_schema.sql, 02_seed.sql
-- =============================================================================


-- ===========================================================================
-- FUNCTION: compute_priority_score
-- ===========================================================================
--
-- FORMULA (all weights come from the vulnerability_types lookup table):
--
--   score = SUM(vuln_type.weight  for each vulnerability of this requester)
--         + LEAST(minutes_waiting / 10, 50)       -- wait-time bonus, cap 50
--         + CASE request_type                      -- urgency constant
--               WHEN 'RESCUE'     THEN 40
--               WHEN 'MEDICAL'    THEN 35
--               WHEN 'EVACUATION' THEN 30
--               WHEN 'WATER'      THEN 20
--               WHEN 'FOOD'       THEN 15
--           END
--         + LEAST((household_size - 1) * 2, 20)   -- household factor, cap 20
--
-- EXAMPLE:
--   PREGNANT (30) + DISABLED (25) + waited 60 min (6) + RESCUE (40)
--   + household 5 (8) = 109 total.
--
-- RAISES: P0002 'Request not found: <id>' if p_request_id does not exist.
-- WHO MAY EXECUTE: role_admin, role_agency_manager
--                 (also called internally by triggers and sp_recompute_priorities)
-- ===========================================================================
CREATE OR REPLACE FUNCTION compute_priority_score(
    p_request_id  INT
)
RETURNS NUMERIC(8,2)
LANGUAGE plpgsql
STABLE          -- same inputs give same result within one transaction
SECURITY DEFINER
AS $$
DECLARE
    v_requester_id    INT;
    v_request_type    VARCHAR(20);
    v_household_size  INT;
    v_created_at      TIMESTAMPTZ;

    v_vuln_score      NUMERIC(8,2) := 0;
    v_wait_score      NUMERIC(8,2);
    v_type_score      NUMERIC(8,2);
    v_household_score NUMERIC(8,2);
    v_minutes_waited  NUMERIC;
BEGIN
    -- -----------------------------------------------------------------------
    -- Step 1: Load the request row. Raise P0002 if not found.
    -- -----------------------------------------------------------------------
    SELECT hr.requester_id,
           hr.request_type,
           hr.household_size,
           hr.created_at
      INTO v_requester_id,
           v_request_type,
           v_household_size,
           v_created_at
      FROM help_requests hr
     WHERE hr.request_id = p_request_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found: %', p_request_id
              USING ERRCODE = 'P0002';
    END IF;

    -- -----------------------------------------------------------------------
    -- Step 2: Vulnerability score.
    --   JOIN requester_vulnerabilities → vulnerability_types to get each weight.
    --   COALESCE handles the case where the requester has no vulnerability flags.
    -- -----------------------------------------------------------------------
    SELECT COALESCE(SUM(vt.weight), 0)
      INTO v_vuln_score
      FROM requester_vulnerabilities rv
      JOIN vulnerability_types vt ON vt.vuln_type_id = rv.vuln_type_id
     WHERE rv.requester_id = v_requester_id;

    -- -----------------------------------------------------------------------
    -- Step 3: Wait-time bonus.
    --   1 point per 10 minutes waiting, hard-capped at 50 so very old
    --   low-priority requests do not leapfrog new critical ones purely due
    --   to age.
    -- -----------------------------------------------------------------------
    v_minutes_waited := EXTRACT(EPOCH FROM (NOW() - v_created_at)) / 60.0;
    v_wait_score     := LEAST(v_minutes_waited / 10.0, 50.0);

    -- -----------------------------------------------------------------------
    -- Step 4: Request-type urgency (fixed urgency levels per CONTRACT).
    -- -----------------------------------------------------------------------
    v_type_score := CASE v_request_type
                        WHEN 'RESCUE'     THEN 40.0
                        WHEN 'MEDICAL'    THEN 35.0
                        WHEN 'EVACUATION' THEN 30.0
                        WHEN 'WATER'      THEN 20.0
                        WHEN 'FOOD'       THEN 15.0
                        ELSE 10.0  -- defensive fallback for any future type
                    END;

    -- -----------------------------------------------------------------------
    -- Step 5: Household-size factor.
    --   Extra 2 points per additional person (beyond 1), capped at 20.
    --   A household of 1 contributes 0; a household of 11+ contributes 20.
    -- -----------------------------------------------------------------------
    v_household_score := LEAST((COALESCE(v_household_size, 1) - 1) * 2.0, 20.0);

    -- -----------------------------------------------------------------------
    -- Step 6: Sum all four components and return.
    -- -----------------------------------------------------------------------
    RETURN ROUND(v_vuln_score + v_wait_score + v_type_score + v_household_score, 2);
END;
$$;

COMMENT ON FUNCTION compute_priority_score(INT) IS
'Returns a numeric priority score for a help request.
Score = SUM(vuln weights) + wait_bonus(cap 50) + type_urgency + household(cap 20).
Vulnerability weights are read from the vulnerability_types table (table-driven).
Raises ERRCODE P0002 if the request_id does not exist.';


-- ===========================================================================
-- FUNCTION: sp_recompute_priorities
-- ===========================================================================
-- Iterates over every PENDING help request in primary-key order (to avoid
-- potential deadlocks if called concurrently), recomputes the priority score,
-- and writes it back to help_requests.priority_score.
--
-- Returns the number of rows updated.
--
-- USAGE (from psql or Node):
--   SELECT sp_recompute_priorities();
--
-- WHO MAY EXECUTE: role_admin, role_agency_manager
-- TABLES TOUCHED : help_requests (read + write)
-- ===========================================================================
CREATE OR REPLACE FUNCTION sp_recompute_priorities()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_req    RECORD;
    v_count  INT := 0;
    v_score  NUMERIC(8,2);
BEGIN
    -- Iterate over PENDING requests in request_id order.
    -- Consistent ordering is important: if two sessions ever call this
    -- concurrently, they will attempt to lock rows in the same order, which
    -- prevents a deadlock (both would block on the first contested row, then
    -- one proceeds after the other commits).
    FOR v_req IN
        SELECT request_id
          FROM help_requests
         WHERE status = 'PENDING'
         ORDER BY request_id
    LOOP
        v_score := compute_priority_score(v_req.request_id);

        UPDATE help_requests
           SET priority_score = v_score,
               updated_at     = NOW()
         WHERE request_id = v_req.request_id;

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

COMMENT ON FUNCTION sp_recompute_priorities() IS
'Bulk-refresh priority_score for all PENDING help requests.
Calls compute_priority_score() for each one in primary-key order to avoid deadlocks.
Returns the count of rows updated. Safe to call on-demand or on a schedule.';
