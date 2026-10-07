-- =====================================================================================
-- CONTRACT/07 — Complex Queries (Grading Deliverable)
-- STATUS: APPROVED & IMPLEMENTED
-- OWNER: Person C
-- =====================================================================================

-- 1. Identify bottlenecks: Shelters with > 90% occupancy and low stock in ANY critical resource
WITH critical_stock AS (
    SELECT shelter_id
    FROM resource_inventory ri
    JOIN resource_types rt ON ri.resource_type_id = rt.resource_type_id
    WHERE rt.category IN ('FOOD', 'WATER', 'MEDICINE') AND quantity_available <= reorder_threshold
    GROUP BY shelter_id
)
SELECT s.name, s.district, s.total_capacity, s.current_occupancy
FROM shelters s
JOIN critical_stock cs ON s.shelter_id = cs.shelter_id
WHERE s.current_occupancy >= (s.total_capacity * 0.90);

-- 2. Volunteer Utilization Rate by Agency
SELECT 
    a.name AS agency_name,
    COUNT(v.volunteer_id) AS total_volunteers,
    SUM(CASE WHEN v.availability_status = 'ASSIGNED' THEN 1 ELSE 0 END) AS active_volunteers,
    ROUND((SUM(CASE WHEN v.availability_status = 'ASSIGNED' THEN 1 ELSE 0 END)::NUMERIC / NULLIF(COUNT(v.volunteer_id), 0)) * 100, 2) AS utilization_pct
FROM agencies a
LEFT JOIN volunteers v ON a.agency_id = v.agency_id
GROUP BY a.agency_id, a.name
ORDER BY utilization_pct DESC NULLS LAST;

-- 3. Top 3 Most Vulnerable Districts based on cumulative priority score of PENDING requests
SELECT 
    district,
    COUNT(request_id) AS pending_requests,
    SUM(priority_score) AS total_priority_score,
    RANK() OVER(ORDER BY SUM(priority_score) DESC) as vulnerability_rank
FROM help_requests
WHERE status = 'PENDING'
GROUP BY district
LIMIT 3;

-- 4. Allocation completion time analysis (Average hours to complete an allocation by request type)
SELECT 
    hr.request_type,
    COUNT(a.allocation_id) AS completed_allocations,
    ROUND(AVG(EXTRACT(EPOCH FROM (a.completed_at - a.allocated_at))/3600)::NUMERIC, 2) AS avg_hours_to_complete
FROM allocations a
JOIN help_requests hr ON a.request_id = hr.request_id
WHERE a.status = 'COMPLETED'
GROUP BY hr.request_type
ORDER BY avg_hours_to_complete DESC;

-- 5. Resource Burn Rate: Identify resources allocated most frequently in the last 24 hours
SELECT 
    rt.name AS resource_name,
    rt.category,
    SUM(a.quantity) AS total_allocated_24h
FROM allocations a
JOIN resource_types rt ON a.resource_type_id = rt.resource_type_id
WHERE a.allocated_at >= NOW() - INTERVAL '24 hours' AND a.status = 'ACTIVE'
GROUP BY rt.resource_type_id, rt.name, rt.category
ORDER BY total_allocated_24h DESC;

-- 6. Requester Demographics: Count of requests involving each vulnerability type
SELECT 
    vt.name AS vulnerability_type,
    COUNT(DISTINCT hr.request_id) AS total_requests_involved
FROM help_requests hr
JOIN requester_vulnerabilities rv ON hr.requester_id = rv.requester_id
JOIN vulnerability_types vt ON rv.vuln_type_id = vt.vuln_type_id
GROUP BY vt.vuln_type_id, vt.name
ORDER BY total_requests_involved DESC;

-- 7. Audit Trail: Who is the most active allocator?
SELECT 
    u.username,
    u.role,
    COUNT(log.log_id) AS actions_taken
FROM allocation_audit_log log
JOIN app_users u ON log.changed_by = u.user_id
WHERE log.action = 'INSERT' OR log.action = 'STATUS_CHANGE'
GROUP BY u.user_id, u.username, u.role
ORDER BY actions_taken DESC
LIMIT 5;

-- 8. Identify "Orphaned" Requests (PENDING > 48 hours without any active allocations)
SELECT 
    hr.request_id,
    hr.request_type,
    hr.priority_score,
    hr.created_at,
    EXTRACT(DAY FROM NOW() - hr.created_at) AS days_waiting
FROM help_requests hr
LEFT JOIN allocations a ON hr.request_id = a.request_id AND a.status IN ('ACTIVE', 'COMPLETED')
WHERE hr.status = 'PENDING' 
  AND hr.created_at < NOW() - INTERVAL '48 hours'
  AND a.allocation_id IS NULL
ORDER BY hr.priority_score DESC;

-- 9. Shelter Load Balancing: Suggesting shelters in the same district with > 20% capacity available
SELECT 
    s1.name AS crowded_shelter,
    s1.district,
    s2.name AS suggested_alternative,
    s2.total_capacity - s2.current_occupancy AS alternative_free_beds
FROM shelters s1
JOIN shelters s2 ON s1.district = s2.district AND s1.shelter_id != s2.shelter_id
WHERE s1.current_occupancy >= (s1.total_capacity * 0.95)
  AND s2.current_occupancy <= (s2.total_capacity * 0.80);

-- 10. Volunteer skill coverage gap (Requests vs Available Volunteers by implicitly matched skills)
WITH required_skills AS (
    SELECT 
        CASE 
            WHEN request_type = 'MEDICAL' THEN 'MEDICAL'
            WHEN request_type = 'RESCUE' THEN 'RESCUE'
            WHEN request_type IN ('FOOD', 'WATER') THEN 'LOGISTICS'
            ELSE 'GENERAL'
        END AS skill_needed,
        COUNT(*) AS request_count
    FROM help_requests
    WHERE status = 'PENDING'
    GROUP BY 1
),
available_vols AS (
    SELECT skill, COUNT(*) AS vol_count
    FROM volunteers
    WHERE availability_status = 'AVAILABLE'
    GROUP BY skill
)
SELECT 
    r.skill_needed,
    r.request_count,
    COALESCE(v.vol_count, 0) AS available_volunteers,
    (r.request_count - COALESCE(v.vol_count, 0)) AS deficit
FROM required_skills r
LEFT JOIN available_vols v ON r.skill_needed = v.skill
ORDER BY deficit DESC;

-- 11. Find the requester who has made the highest number of distinct requests
SELECT 
    r.full_name,
    r.phone,
    COUNT(hr.request_id) AS total_requests
FROM requesters r
JOIN help_requests hr ON r.requester_id = hr.requester_id
GROUP BY r.requester_id, r.full_name, r.phone
HAVING COUNT(hr.request_id) > 1
ORDER BY total_requests DESC;

-- 12. Rolling sum of daily help requests over the last 7 days
WITH dates AS (
    SELECT generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day')::DATE AS d
),
daily_counts AS (
    SELECT DATE(created_at) AS request_date, COUNT(*) as count
    FROM help_requests
    WHERE created_at >= CURRENT_DATE - INTERVAL '6 days'
    GROUP BY DATE(created_at)
)
SELECT 
    d.d AS date,
    COALESCE(c.count, 0) AS daily_requests,
    SUM(COALESCE(c.count, 0)) OVER(ORDER BY d.d) AS rolling_total
FROM dates d
LEFT JOIN daily_counts c ON d.d = c.request_date
ORDER BY d.d;

-- 13. Detect potential duplicate requests (same phone, same district, same type, created within 24h)
SELECT 
    r1.request_id AS req1,
    r2.request_id AS req2,
    req.full_name,
    req.phone,
    r1.request_type,
    r1.created_at
FROM help_requests r1
JOIN help_requests r2 ON r1.requester_id = r2.requester_id 
    AND r1.request_type = r2.request_type 
    AND r1.request_id < r2.request_id
JOIN requesters req ON r1.requester_id = req.requester_id
WHERE r2.created_at - r1.created_at < INTERVAL '24 hours';

-- 14. Rank agencies by their efficiency (number of completed allocations vs active allocations)
SELECT 
    a.name AS agency_name,
    COUNT(alloc.allocation_id) FILTER (WHERE alloc.status = 'COMPLETED') AS completed,
    COUNT(alloc.allocation_id) FILTER (WHERE alloc.status = 'ACTIVE') AS active,
    ROUND((COUNT(alloc.allocation_id) FILTER (WHERE alloc.status = 'COMPLETED')::NUMERIC / 
    NULLIF(COUNT(alloc.allocation_id), 0)) * 100, 2) AS completion_rate
FROM agencies a
JOIN app_users u ON a.agency_id = u.agency_id
JOIN allocations alloc ON u.user_id = alloc.allocated_by
GROUP BY a.agency_id, a.name
ORDER BY completion_rate DESC NULLS LAST;

-- 15. The "God View": Materialized summary of system health
SELECT
    (SELECT COUNT(*) FROM help_requests WHERE status = 'PENDING') AS total_pending_requests,
    (SELECT COUNT(*) FROM shelters WHERE current_occupancy >= total_capacity) AS full_shelters,
    (SELECT COUNT(*) FROM volunteers WHERE availability_status = 'AVAILABLE') AS available_volunteers,
    (SELECT COUNT(*) FROM stock_alerts WHERE resolved = FALSE) AS active_stock_alerts;
