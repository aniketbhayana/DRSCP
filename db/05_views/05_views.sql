-- =====================================================================================
-- CONTRACT/05 — Database Views
-- STATUS: APPROVED & IMPLEMENTED
-- OWNER: Person C
-- =====================================================================================

-- 1. v_urgent_requests_ranked
-- Shows top priority PENDING requests with requester details.
CREATE OR REPLACE VIEW v_urgent_requests_ranked AS
SELECT 
    hr.request_id,
    hr.requester_id,
    r.full_name AS requester_name,
    r.phone AS requester_phone,
    r.district AS requester_district,
    hr.request_type,
    hr.status,
    hr.priority_score,
    hr.household_size,
    hr.location_text,
    hr.created_at
FROM help_requests hr
JOIN requesters r ON hr.requester_id = r.requester_id
WHERE hr.status = 'PENDING'
ORDER BY hr.priority_score DESC, hr.created_at ASC;

-- 2. v_shelter_capacity
-- Overview of shelter occupancy vs total capacity
CREATE OR REPLACE VIEW v_shelter_capacity AS
SELECT 
    s.shelter_id,
    s.name AS shelter_name,
    a.name AS agency_name,
    s.district,
    s.total_capacity,
    s.current_occupancy,
    (s.total_capacity - s.current_occupancy) AS available_beds,
    s.status
FROM shelters s
JOIN agencies a ON s.agency_id = a.agency_id
ORDER BY s.district, s.name;

-- 3. v_inventory_status
-- Current resource inventory at all shelters with low stock flags
CREATE OR REPLACE VIEW v_inventory_status AS
SELECT 
    ri.inventory_id,
    s.name AS shelter_name,
    s.district,
    rt.name AS resource_name,
    rt.category,
    ri.quantity_available,
    rt.unit,
    ri.reorder_threshold,
    (ri.quantity_available <= ri.reorder_threshold) AS is_low_stock,
    ri.last_updated
FROM resource_inventory ri
JOIN shelters s ON ri.shelter_id = s.shelter_id
JOIN resource_types rt ON ri.resource_type_id = rt.resource_type_id
ORDER BY is_low_stock DESC, ri.quantity_available ASC;

-- 4. v_volunteer_availability
-- Active volunteers mapped to their skills and agencies
CREATE OR REPLACE VIEW v_volunteer_availability AS
SELECT 
    v.volunteer_id,
    v.full_name,
    v.phone,
    v.skill,
    v.availability_status,
    a.name AS agency_name,
    v.created_at
FROM volunteers v
JOIN agencies a ON v.agency_id = a.agency_id
WHERE v.availability_status != 'INACTIVE'
ORDER BY v.availability_status, v.full_name;

-- 5. v_allocation_history
-- Full audit log of all allocation events
CREATE OR REPLACE VIEW v_allocation_history AS
SELECT 
    log.log_id,
    log.allocation_id,
    hr.request_type,
    log.action,
    log.old_status,
    log.new_status,
    u.username AS changed_by_user,
    log.changed_at,
    log.details
FROM allocation_audit_log log
JOIN allocations alloc ON log.allocation_id = alloc.allocation_id
JOIN help_requests hr ON alloc.request_id = hr.request_id
LEFT JOIN app_users u ON log.changed_by = u.user_id
ORDER BY log.changed_at DESC;

-- 6. v_my_assignments
-- Allocations mapped to the assigned volunteer
CREATE OR REPLACE VIEW v_my_assignments AS
SELECT 
    alloc.allocation_id,
    alloc.volunteer_id,
    hr.request_type,
    hr.location_text,
    hr.status AS request_status,
    alloc.status AS allocation_status,
    alloc.allocated_at
FROM allocations alloc
JOIN help_requests hr ON alloc.request_id = hr.request_id
WHERE alloc.volunteer_id IS NOT NULL;

-- 7. v_my_requests
-- Requests mapped to the requesting user
CREATE OR REPLACE VIEW v_my_requests AS
SELECT 
    hr.request_id,
    hr.requester_id,
    hr.request_type,
    hr.status,
    hr.priority_score,
    hr.created_at
FROM help_requests hr;
