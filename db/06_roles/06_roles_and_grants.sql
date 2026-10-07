-- =====================================================================================
-- CONTRACT/06 — Roles and Security
-- STATUS: APPROVED & IMPLEMENTED
-- OWNER: Person C
-- =====================================================================================

-- 1. Create Roles
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'role_admin') THEN
        CREATE ROLE role_admin;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'role_agency_manager') THEN
        CREATE ROLE role_agency_manager;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'role_volunteer') THEN
        CREATE ROLE role_volunteer;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'role_requester') THEN
        CREATE ROLE role_requester;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'role_anonymous') THEN
        CREATE ROLE role_anonymous;
    END IF;
END
$$;

-- 2. Base Grants
GRANT USAGE ON SCHEMA public TO role_admin, role_agency_manager, role_volunteer, role_requester, role_anonymous;

-- All Sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO role_admin, role_agency_manager, role_volunteer, role_requester, role_anonymous;

-- ==========================================================
-- ADMIN: Full Access (except system catalogs)
-- ==========================================================
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO role_admin;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO role_admin;

-- ==========================================================
-- AGENCY MANAGER
-- ==========================================================
GRANT SELECT ON agencies, app_users, vulnerability_types, requesters, requester_vulnerabilities, help_requests, shelters, resource_types, resource_inventory, volunteers, allocations, allocation_audit_log, stock_alerts TO role_agency_manager;
GRANT INSERT, UPDATE ON help_requests, shelters, resource_inventory, volunteers, allocations, stock_alerts TO role_agency_manager;
GRANT EXECUTE ON FUNCTION sp_allocate_shelter_bed, sp_assign_volunteer, sp_allocate_resource, sp_complete_allocation, sp_cancel_allocation, sp_suggest_shelter TO role_agency_manager;
GRANT SELECT ON v_urgent_requests_ranked, v_shelter_capacity, v_inventory_status, v_volunteer_availability, v_allocation_history TO role_agency_manager;

-- ==========================================================
-- VOLUNTEER
-- ==========================================================
GRANT SELECT ON help_requests, allocations, shelters, requesters TO role_volunteer;
GRANT EXECUTE ON FUNCTION sp_complete_allocation TO role_volunteer;
GRANT SELECT ON v_my_assignments TO role_volunteer;

-- ==========================================================
-- REQUESTER
-- ==========================================================
GRANT SELECT ON help_requests, allocations, shelters TO role_requester;
GRANT INSERT ON help_requests, requesters, requester_vulnerabilities TO role_requester;
GRANT SELECT ON v_my_requests TO role_requester;

-- ==========================================================
-- ANONYMOUS (Login only)
-- ==========================================================
GRANT SELECT ON app_users TO role_anonymous;

-- ==========================================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================================
-- Enable RLS
ALTER TABLE help_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE allocations ENABLE ROW LEVEL SECURITY;

-- ADMIN bypasses RLS
ALTER ROLE role_admin BYPASSRLS;
ALTER ROLE role_agency_manager BYPASSRLS;

-- VOLUNTEER RLS: Can only see requests assigned to them
CREATE POLICY vol_view_assigned_requests ON help_requests
FOR SELECT TO role_volunteer
USING (
    request_id IN (
        SELECT request_id FROM allocations 
        WHERE volunteer_id = current_setting('app.current_user_id', true)::INT
    )
);

CREATE POLICY vol_view_assignments ON allocations
FOR SELECT TO role_volunteer
USING (volunteer_id = current_setting('app.current_user_id', true)::INT);

-- REQUESTER RLS: Can only see/update their own requests
CREATE POLICY req_view_own_requests ON help_requests
FOR SELECT TO role_requester
USING (requester_id = current_setting('app.current_user_id', true)::INT);

CREATE POLICY req_insert_own_requests ON help_requests
FOR INSERT TO role_requester
WITH CHECK (requester_id = current_setting('app.current_user_id', true)::INT);

CREATE POLICY req_view_own_allocations ON allocations
FOR SELECT TO role_requester
USING (
    request_id IN (
        SELECT request_id FROM help_requests 
        WHERE requester_id = current_setting('app.current_user_id', true)::INT
    )
);
