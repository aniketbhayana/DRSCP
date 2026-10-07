-- =============================================================================
-- DRSCP: 02a_seed_small.sql
-- Owner: Person A (Design & Schema)
-- Description: Small, realistic seed dataset based on Chennai & Tamil Nadu
--              disaster relief scenario (Cyclone Michaung response).
--              Seeds all 13 tables with coherent relational integrity.
--              Trigger-maintained columns (current_occupancy, quantity_available,
--              priority_score, volunteer availability_status) are pre-calculated
--              by hand so early testing before Phase 2 triggers are active is 100% valid.
-- Order: Run SECOND, immediately after 01_schema.sql.
-- =============================================================================

-- =============================================================================
-- 1. CLEAN EXISTING DATA (Safe re-seed)
-- =============================================================================
TRUNCATE TABLE
    stock_alerts,
    allocation_audit_log,
    allocations,
    help_requests,
    app_users,
    volunteers,
    resource_inventory,
    shelters,
    resource_types,
    requester_vulnerabilities,
    requesters,
    vulnerability_types,
    agencies
RESTART IDENTITY CASCADE;

-- =============================================================================
-- 2. AGENCIES
-- =============================================================================
INSERT INTO agencies (agency_id, name, agency_type, contact_phone, contact_email) VALUES
(1, 'Tamil Nadu State Disaster Management Authority (TNSDMA)', 'GOVERNMENT', '044-28593990', 'tnsdma@tn.gov.in'),
(2, 'Indian Red Cross Society - Chennai Disaster Wing',       'NGO',        '044-28554425', 'redcross.chennai@org.in'),
(3, 'Indian Navy Disaster Response Task Force INS Adyar',      'MILITARY',   '044-25361000', 'navalrelief.chennai@nic.in'),
(4, 'Chennai Coastal Relief Volunteers NGO',                  'PRIVATE',    '9840112233',   'contact@chennairelief.org');

SELECT setval('agencies_agency_id_seq', (SELECT MAX(agency_id) FROM agencies));

-- =============================================================================
-- 3. VULNERABILITY TYPES (Reference Catalog & Weights)
-- =============================================================================
INSERT INTO vulnerability_types (vuln_type_id, name, weight, description) VALUES
(1, 'ELDERLY',             20.00, 'Senior citizens aged 60 and above with reduced mobility'),
(2, 'DISABLED',            25.00, 'Persons with locomotor or intellectual disabilities'),
(3, 'PREGNANT',            30.00, 'Expectant mothers requiring maternal health monitoring'),
(4, 'INFANT',              20.00, 'Children under 2 years of age requiring special formula & care'),
(5, 'CHRONIC_ILLNESS',     15.00, 'Patients dependent on dialysis, oxygen, or regular medication'),
(6, 'UNACCOMPANIED_MINOR', 25.00, 'Children under 18 separated from parents or guardians');

SELECT setval('vulnerability_types_vuln_type_id_seq', (SELECT MAX(vuln_type_id) FROM vulnerability_types));

-- =============================================================================
-- 4. REQUESTERS (Citizens Seeking Relief)
-- =============================================================================
INSERT INTO requesters (requester_id, full_name, phone, age, gender, address, district) VALUES
(1, 'Kavitha Raman',       '9840123456', 32, 'FEMALE', '14 Lake View Road, Velachery',             'Chennai'),
(2, 'Murugan Selvam',      '9841234567', 67, 'MALE',   '28 Canal Bank Road, Saidapet',             'Chennai'),
(3, 'Anandhi Natarajan',   '9842345678', 29, 'FEMALE', '102 2nd Cross, Pallikaranai',             'Chengalpattu'),
(4, 'Senthil Kumar',       '9843456789', 45, 'MALE',   '5 GST Road, Tambaram',                     'Chengalpattu'),
(5, 'Fathima Begum',       '9844567890', 71, 'FEMALE', '8 Bharathi Street, Royapettah',            'Chennai'),
(6, 'Venkatesh Rao',       '9845678901', 38, 'MALE',   '19 Mudichur Road, West Tambaram',          'Chengalpattu'),
(7, 'Deepa Krishnan',      '9846789012', 26, 'FEMALE', '44 Beach Road, Thiruvanmiyur',             'Chennai'),
(8, 'Ramesh Babu',         '9847890123', 52, 'MALE',   '12 Madipakkam Main Road, Madipakkam',      'Chennai');

SELECT setval('requesters_requester_id_seq', (SELECT MAX(requester_id) FROM requesters));

-- =============================================================================
-- 5. REQUESTER VULNERABILITIES (M:N Associations)
-- =============================================================================
INSERT INTO requester_vulnerabilities (requester_id, vuln_type_id) VALUES
(1, 3), -- Kavitha: PREGNANT (30)
(2, 1), -- Murugan: ELDERLY (20)
(2, 5), -- Murugan: CHRONIC_ILLNESS (15) -> total vuln: 35
(3, 4), -- Anandhi: INFANT (20)
(4, 2), -- Senthil: DISABLED (25)
(5, 1), -- Fathima: ELDERLY (20)
(7, 3), -- Deepa: PREGNANT (30)
(7, 4), -- Deepa: INFANT (20) -> total vuln: 50
(8, 5); -- Ramesh: CHRONIC_ILLNESS (15)

-- =============================================================================
-- 6. RESOURCE TYPES (Standard Catalog)
-- =============================================================================
INSERT INTO resource_types (resource_type_id, name, category, unit) VALUES
(1, 'Drinking Water Can (20L)',     'WATER',     'cans'),
(2, 'Ready-to-Eat Food Ration Pack', 'FOOD',      'packets'),
(3, 'Emergency First-Aid Medical Kit','MEDICINE',  'kits'),
(4, 'Inflatable Life Raft',         'EQUIPMENT', 'units'),
(5, 'Thermal Blankets & Mats Pack',  'CLOTHING',  'packs'),
(6, 'Infant Nutrition & Milk Formula','FOOD',      'packs');

SELECT setval('resource_types_resource_type_id_seq', (SELECT MAX(resource_type_id) FROM resource_types));

-- =============================================================================
-- 7. SHELTERS
-- (Note: current_occupancy is pre-computed from active bed allocations below)
-- Shelter 1 (Velachery) has 7 beds allocated (3 for req 1 + 4 for req 8)
-- =============================================================================
INSERT INTO shelters (shelter_id, agency_id, name, address, district, total_capacity, current_occupancy, status) VALUES
(1, 1, 'Velachery Higher Secondary Relief Camp', 'Velachery Main Road, Chennai',        'Chennai',      150, 7, 'OPEN'),
(2, 1, 'East Tambaram Community Relief Hall',    'Gandhi Road, East Tambaram',           'Chengalpattu', 200, 0, 'OPEN'),
(3, 2, 'St. Thomas Mount Medical Relief Pavilion','Mount-Poonamallee High Road, Chennai','Chennai',       80, 0, 'OPEN'),
(4, 1, 'Saidapet Government Arts College Camp',  'Anna Salai, Saidapet, Chennai',        'Chennai',      120, 0, 'OPEN');

SELECT setval('shelters_shelter_id_seq', (SELECT MAX(shelter_id) FROM shelters));

-- =============================================================================
-- 8. RESOURCE INVENTORY (Stock per Shelter)
-- =============================================================================
INSERT INTO resource_inventory (inventory_id, shelter_id, resource_type_id, quantity_available, reorder_threshold) VALUES
(1, 1, 1, 120, 30),  -- Shelter 1: Water
(2, 1, 2, 450, 100), -- Shelter 1: Food
(3, 1, 3, 15,  10),  -- Shelter 1: Medicine
(4, 2, 1, 200, 40),  -- Shelter 2: Water
(5, 2, 2, 600, 100), -- Shelter 2: Food
(6, 2, 5, 80,  25),  -- Shelter 2: Blankets
(7, 3, 1, 25,  30),  -- Shelter 3: Water (BELOW REORDER THRESHOLD -> alert)
(8, 3, 2, 180, 50),  -- Shelter 3: Food
(9, 3, 3, 8,   10),  -- Shelter 3: Medicine (BELOW REORDER THRESHOLD -> alert)
(10, 4, 1, 150, 35), -- Shelter 4: Water
(11, 4, 2, 345, 80), -- Shelter 4: Food (350 initial - 5 allocated = 345 available)
(12, 4, 4, 12,  5);  -- Shelter 4: Rafts

SELECT setval('resource_inventory_inventory_id_seq', (SELECT MAX(inventory_id) FROM resource_inventory));

-- =============================================================================
-- 9. VOLUNTEERS
-- (Note: availability_status pre-computed from active allocations below)
-- =============================================================================
INSERT INTO volunteers (volunteer_id, agency_id, full_name, phone, skill, availability_status) VALUES
(1, 1, 'Karthik Raja',         '9711001122', 'RESCUE',    'ASSIGNED'),   -- Assigned to request 3
(2, 1, 'Priya Sundaram',       '9711001123', 'MEDICAL',   'AVAILABLE'),
(3, 1, 'Dinesh Kumar',         '9711001124', 'LOGISTICS', 'AVAILABLE'),
(4, 2, 'Dr. Harish Varma',     '9711001125', 'MEDICAL',   'ASSIGNED'),   -- Assigned to request 2
(5, 2, 'Meenakshi Iyer',       '9711001126', 'GENERAL',   'AVAILABLE'),
(6, 3, 'Cmdr. Rajesh Nair',    '9711001127', 'RESCUE',    'AVAILABLE'),
(7, 3, 'Sub-Lt. Amit Sharma',  '9711001128', 'DRIVING',   'AVAILABLE'),
(8, 4, 'Saravanan M',          '9711001129', 'RESCUE',    'AVAILABLE');

SELECT setval('volunteers_volunteer_id_seq', (SELECT MAX(volunteer_id) FROM volunteers));

-- =============================================================================
-- 10. APP USERS
-- Password hash corresponds to 'password123' across all seeded demo accounts
-- =============================================================================
INSERT INTO app_users (user_id, username, password_hash, role, agency_id, volunteer_id, requester_id) VALUES
(1, 'admin_chennai',   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'ADMIN',          NULL, NULL, NULL),
(2, 'manager_tnsdma',  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'AGENCY_MANAGER', 1,    NULL, NULL),
(3, 'manager_redcross','$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'AGENCY_MANAGER', 2,    NULL, NULL),
(4, 'vol_karthik',     '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'VOLUNTEER',       1,    1,    NULL),
(5, 'req_kavitha',     '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'REQUESTER',       NULL, NULL, 1);

SELECT setval('app_users_user_id_seq', (SELECT MAX(user_id) FROM app_users));

-- =============================================================================
-- 11. HELP REQUESTS
-- Pre-computed priority_score according to formula in CONTRACT/02:
--   score = vuln_weights + request_type_bonus + household_factor (wait_bonus = 0 at t=0)
--   Req 1: 30(preg) + 30(evac) + (3-1)*2 = 64.00
--   Req 2: 35(elder+chron) + 35(med) + (2-1)*2 = 72.00
--   Req 3: 20(infant) + 40(rescue) + (4-1)*2 = 66.00
--   Req 4: 25(disabled) + 20(water) + (5-1)*2 = 53.00
--   Req 5: 20(elder) + 15(food) + 0 = 35.00
--   Req 6: 0(vuln) + 15(food) + (2-1)*2 = 17.00
--   Req 7: 50(preg+infant) + 40(rescue) + (3-1)*2 = 94.00 (Highest Priority!)
--   Req 8: 15(chron) + 30(evac) + (4-1)*2 = 51.00
-- =============================================================================
INSERT INTO help_requests (request_id, requester_id, request_type, status, priority_score, household_size, location_text, district, description) VALUES
(1, 1, 'EVACUATION', 'ALLOCATED', 64.00, 3, '14 Lake View Road, Velachery',        'Chennai',      'Water entered ground floor, pregnant mother and elderly parents need shelter transport'),
(2, 2, 'MEDICAL',    'ALLOCATED', 72.00, 2, '28 Canal Bank Road, Saidapet',        'Chennai',      'Elderly diabetic patient with open wound, needs doctor and sterile dressing'),
(3, 3, 'RESCUE',     'ALLOCATED', 66.00, 4, '102 2nd Cross, Pallikaranai',        'Chengalpattu', 'Flood water rising above waist level, 8-month infant in family, immediate boat rescue needed'),
(4, 4, 'WATER',      'PENDING',   53.00, 5, '5 GST Road, Tambaram',                'Chengalpattu', 'Drinking water pipelines contaminated, family with wheelchair member stranded'),
(5, 5, 'FOOD',       'COMPLETED', 35.00, 1, '8 Bharathi Street, Royapettah',       'Chennai',      'Elderly woman living alone, no electricity or gas cooking supply for 2 days'),
(6, 6, 'FOOD',       'PENDING',   17.00, 2, '19 Mudichur Road, West Tambaram',     'Chengalpattu', 'Grocery stores flooded in locality, family needs ready-to-eat dry rations'),
(7, 7, 'RESCUE',     'PENDING',   94.00, 3, '44 Beach Road, Thiruvanmiyur',        'Chennai',      'Critical: collapsed wall trap, heavily pregnant woman and toddler needing immediate extraction'),
(8, 8, 'EVACUATION', 'ALLOCATED', 51.00, 4, '12 Madipakkam Main Road, Madipakkam', 'Chennai',      'Ground floor submerged in 4 feet water, family needs relocation to designated shelter');

SELECT setval('help_requests_request_id_seq', (SELECT MAX(request_id) FROM help_requests));

-- =============================================================================
-- 12. ALLOCATIONS
-- Active and fulfilled assignments connecting requests to resources/shelters/volunteers
-- =============================================================================
INSERT INTO allocations (allocation_id, request_id, shelter_id, volunteer_id, resource_type_id, quantity, beds_allocated, status, allocated_by, allocated_at, completed_at) VALUES
-- Alloc 1: Bed allocation for Kavitha (req 1) at Velachery Shelter (3 beds)
(1, 1, 1, NULL, NULL, 0, 3, 'ACTIVE',    2, NOW() - INTERVAL '2 hours', NULL),

-- Alloc 2: Medical volunteer dispatch for Murugan (req 2) -> Dr. Harish Varma (vol 4)
(2, 2, NULL, 4, NULL, 0, 0, 'ACTIVE',    2, NOW() - INTERVAL '90 minutes', NULL),

-- Alloc 3: Rescue volunteer dispatch for Anandhi (req 3) -> Karthik Raja (vol 1)
(3, 3, NULL, 1, NULL, 0, 0, 'ACTIVE',    2, NOW() - INTERVAL '1 hour', NULL),

-- Alloc 4: Food distribution for Fathima (req 5) from Saidapet Shelter -> 5 food packets
(4, 5, 4, NULL, 2, 5, 0, 'COMPLETED', 2, NOW() - INTERVAL '4 hours', NOW() - INTERVAL '1 hour'),

-- Alloc 5: Bed allocation for Ramesh (req 8) at Velachery Shelter (4 beds)
(5, 8, 1, NULL, NULL, 0, 4, 'ACTIVE',    2, NOW() - INTERVAL '30 minutes', NULL);

SELECT setval('allocations_allocation_id_seq', (SELECT MAX(allocation_id) FROM allocations));

-- =============================================================================
-- 13. ALLOCATION AUDIT LOG
-- Append-only audit entries documenting allocation events
-- =============================================================================
INSERT INTO allocation_audit_log (log_id, allocation_id, action, old_status, new_status, changed_by, changed_at, details) VALUES
(1, 1, 'INSERT',        NULL,     'ACTIVE',    2, NOW() - INTERVAL '2 hours',    '{"reason": "Reserved 3 beds at Velachery Relief Camp"}'),
(2, 2, 'INSERT',        NULL,     'ACTIVE',    2, NOW() - INTERVAL '90 minutes', '{"reason": "Dispatched Dr. Harish Varma for emergency wound care"}'),
(3, 3, 'INSERT',        NULL,     'ACTIVE',    2, NOW() - INTERVAL '1 hour',     '{"reason": "Dispatched rescue specialist Karthik Raja with rescue boat"}'),
(4, 4, 'INSERT',        NULL,     'ACTIVE',    2, NOW() - INTERVAL '4 hours',    '{"reason": "Dispatched 5 food ration packets from Saidapet"}'),
(5, 4, 'STATUS_CHANGE', 'ACTIVE', 'COMPLETED', 2, NOW() - INTERVAL '1 hour',     '{"reason": "Rations delivered by field relief agent"}'),
(6, 5, 'INSERT',        NULL,     'ACTIVE',    2, NOW() - INTERVAL '30 minutes', '{"reason": "Reserved 4 beds at Velachery Relief Camp"}');

SELECT setval('allocation_audit_log_log_id_seq', (SELECT MAX(log_id) FROM allocation_audit_log));

-- =============================================================================
-- 14. STOCK ALERTS
-- Alerts reflecting low inventory thresholds at Shelter 3 (St. Thomas Mount)
-- =============================================================================
INSERT INTO stock_alerts (alert_id, inventory_id, message, created_at, resolved) VALUES
(1, 7, 'LOW STOCK ALERT: Drinking Water Can (20L) at St. Thomas Mount is at 25 cans (Threshold: 30 cans). Replenishment required.', NOW() - INTERVAL '3 hours', FALSE),
(2, 9, 'LOW STOCK ALERT: Emergency First-Aid Medical Kit at St. Thomas Mount is at 8 kits (Threshold: 10 kits). Critical medicine replenishment required.', NOW() - INTERVAL '2 hours', FALSE);

SELECT setval('stock_alerts_alert_id_seq', (SELECT MAX(alert_id) FROM stock_alerts));
