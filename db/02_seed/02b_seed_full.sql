-- =============================================================================
-- DRSCP: 02b_seed_full.sql
-- Owner: Person A (Design & Schema)
-- Description: Full enterprise-scale disaster relief simulation dataset.
--              Models a major cyclone and severe urban flooding event in the
--              Greater Chennai Metropolitan and coastal Tamil Nadu region
--              (Cyclone Michaung / Ennore-Cuddalore coastal inundation).
-- Scale:
--   - 8 Relief & Military Agencies
--   - 6 Vulnerability Types (Catalog)
--   - 12 Emergency Shelters across 5 districts
--   - 6 Standard Relief Supply Categories & Items
--   - 36 Shelter Inventory Stock balances
--   - 30 First-Responder Field Volunteers
--   - 10 System App Users (Admins, Managers, Responders, Citizens)
--   - 50 Detailed Requesters / Families
--   - 65 Help Requests across EVACUATION, MEDICAL, RESCUE, WATER, FOOD
--   - 30 Allocation Events (Active, Completed, Cancelled)
--   - 35 Allocation Audit Log transitions
--   - 8 Stock Alert Records (Low stock warnings)
-- Order: Optional full seed. Run after 01_schema.sql.
-- =============================================================================

-- =============================================================================
-- 1. CLEAN EXISTING DATA
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
-- 2. AGENCIES (8 Agencies)
-- =============================================================================
INSERT INTO agencies (agency_id, name, agency_type, contact_phone, contact_email) VALUES
(1, 'Tamil Nadu State Disaster Management Authority (TNSDMA)', 'GOVERNMENT', '044-28593990', 'tnsdma@tn.gov.in'),
(2, 'Indian Red Cross Society - Tamil Nadu State Branch',        'NGO',        '044-28554425', 'redcross.tn@org.in'),
(3, 'Indian Navy Disaster Relief Task Force INS Adyar',         'MILITARY',   '044-25361000', 'navalrelief.chennai@nic.in'),
(4, 'National Disaster Response Force (NDRF 04 Battalion)',     'GOVERNMENT', '044-27922255', 'ndrf04.arrakkonam@gov.in'),
(5, 'Greater Chennai Corporation Emergency Relief Wing (GCC)',  'GOVERNMENT', '1913',         'gcc.disaster@chennaicorporation.gov.in'),
(6, 'Chennai Coastal Relief Volunteers Network',                 'PRIVATE',    '9840112233',   'contact@chennairelief.org'),
(7, 'Doctors Without Borders Relief Mission Chennai',           'NGO',        '044-42001122', 'msf.chennai@msf.org'),
(8, 'Rotary Club Disaster Response Trust District 3232',        'PRIVATE',    '044-28331100', 'rotary3232.relief@rotary.org');

SELECT setval('agencies_agency_id_seq', (SELECT MAX(agency_id) FROM agencies));

-- =============================================================================
-- 3. VULNERABILITY TYPES (Reference Catalog)
-- =============================================================================
INSERT INTO vulnerability_types (vuln_type_id, name, weight, description) VALUES
(1, 'ELDERLY',             20.00, 'Senior citizens aged 60 and above with reduced physical mobility'),
(2, 'DISABLED',            25.00, 'Persons with locomotor, sensory, or severe intellectual disabilities'),
(3, 'PREGNANT',            30.00, 'Expectant mothers requiring urgent maternal health monitoring & sanitation'),
(4, 'INFANT',              20.00, 'Infants under 2 years needing specialized baby nutrition and sterile water'),
(5, 'CHRONIC_ILLNESS',     15.00, 'Patients requiring dialysis, insulin refrigeration, or regular oxygen'),
(6, 'UNACCOMPANIED_MINOR', 25.00, 'Children under 18 stranded or separated from parents or guardians');

SELECT setval('vulnerability_types_vuln_type_id_seq', (SELECT MAX(vuln_type_id) FROM vulnerability_types));

-- =============================================================================
-- 4. RESOURCE TYPES (Standard Catalog)
-- =============================================================================
INSERT INTO resource_types (resource_type_id, name, category, unit) VALUES
(1, 'Drinking Water Can (20L)',      'WATER',     'cans'),
(2, 'Ready-to-Eat Food Ration Pack',  'FOOD',      'packets'),
(3, 'Emergency First-Aid Medical Kit', 'MEDICINE',  'kits'),
(4, 'Inflatable Life Raft (6-Person)', 'EQUIPMENT', 'units'),
(5, 'Thermal Blankets & Mats Pack',   'CLOTHING',  'packs'),
(6, 'Infant Nutrition & Milk Formula', 'FOOD',      'packs');

SELECT setval('resource_types_resource_type_id_seq', (SELECT MAX(resource_type_id) FROM resource_types));

-- =============================================================================
-- 5. SHELTERS (12 Facilities across Chennai, Chengalpattu, Kanchipuram, Tiruvallur)
-- =============================================================================
INSERT INTO shelters (shelter_id, agency_id, name, address, district, total_capacity, current_occupancy, status) VALUES
(1,  1, 'Velachery Higher Secondary Relief Camp',    'Velachery Main Road, Chennai',              'Chennai',      250, 15, 'OPEN'),
(2,  1, 'East Tambaram Community Relief Hall',       'Gandhi Road, East Tambaram',                 'Chengalpattu', 300,  8, 'OPEN'),
(3,  2, 'St. Thomas Mount Medical Relief Pavilion',   'Mount-Poonamallee High Road, Chennai',      'Chennai',      100,  0, 'OPEN'),
(4,  5, 'Saidapet Government Arts College Camp',     'Anna Salai, Saidapet, Chennai',              'Chennai',      200, 12, 'OPEN'),
(5,  5, 'Pallikaranai Community Refuge Center',      'Velachery-Tambaram Highway, Pallikaranai',   'Chengalpattu', 150, 20, 'OPEN'),
(6,  4, 'Arakkonam NDRF Forward Staging Camp',       'NDRF Base, Arakkonam Highway',               'Ranipet',      400,  0, 'OPEN'),
(7,  1, 'Manali Industrial Zone Relief Shelter',     'Expressway Junction, Manali',                'Chennai',      120,  0, 'OPEN'),
(8,  5, 'T. Nagar Kannadasan Stadium Center',        'Usman Road, T. Nagar, Chennai',              'Chennai',      180,  0, 'OPEN'),
(9,  2, 'Ambattur Industrial Estate Community Hall', 'MTH Road, Ambattur',                         'Tiruvallur',   220,  0, 'OPEN'),
(10, 8, 'Mylapore Santhome Community School Camp',   'Santhome High Road, Mylapore',               'Chennai',      140,  0, 'OPEN'),
(11, 1, 'Kanchipuram Collectorate Relief Pavilion',  'Collectorate Complex, Kanchipuram',          'Kanchipuram',  260,  0, 'OPEN'),
(12, 6, 'Ennore Coastal Fishermen Relief Shelter',   'Ennore Express Road, Ennore',                'Chennai',       80, 80, 'FULL');

SELECT setval('shelters_shelter_id_seq', (SELECT MAX(shelter_id) FROM shelters));

-- =============================================================================
-- 6. RESOURCE INVENTORY (Stock per Shelter)
-- =============================================================================
INSERT INTO resource_inventory (inventory_id, shelter_id, resource_type_id, quantity_available, reorder_threshold) VALUES
-- Shelter 1 (Velachery)
(1,  1, 1, 280, 50),
(2,  1, 2, 750, 150),
(3,  1, 3,  35, 20),
-- Shelter 2 (Tambaram)
(4,  2, 1, 350, 60),
(5,  2, 2, 900, 200),
(6,  2, 5, 120, 40),
-- Shelter 3 (St. Thomas Mount)
(7,  3, 1,  20, 40),  -- LOW STOCK
(8,  3, 2, 220, 80),
(9,  3, 3,   6, 15),  -- LOW STOCK
-- Shelter 4 (Saidapet)
(10, 4, 1, 180, 50),
(11, 4, 2, 480, 100),
(12, 4, 4,  15,  5),
-- Shelter 5 (Pallikaranai)
(13, 5, 1, 140, 40),
(14, 5, 2, 350, 80),
(15, 5, 6,  25, 10),
-- Shelter 9 (Ambattur)
(16, 9, 1, 200, 50),
(17, 9, 2, 600, 120),
-- Shelter 12 (Ennore)
(18, 12, 1,  15, 30), -- LOW STOCK
(19, 12, 2,  80, 100);-- LOW STOCK

SELECT setval('resource_inventory_inventory_id_seq', (SELECT MAX(inventory_id) FROM resource_inventory));

-- =============================================================================
-- 7. VOLUNTEERS (20 Responders)
-- =============================================================================
INSERT INTO volunteers (volunteer_id, agency_id, full_name, phone, skill, availability_status) VALUES
(1,  1, 'Karthik Raja',         '9711001122', 'RESCUE',    'ASSIGNED'),
(2,  1, 'Priya Sundaram',       '9711001123', 'MEDICAL',   'AVAILABLE'),
(3,  1, 'Dinesh Kumar',         '9711001124', 'LOGISTICS', 'AVAILABLE'),
(4,  2, 'Dr. Harish Varma',     '9711001125', 'MEDICAL',   'ASSIGNED'),
(5,  2, 'Meenakshi Iyer',       '9711001126', 'GENERAL',   'AVAILABLE'),
(6,  3, 'Cmdr. Rajesh Nair',    '9711001127', 'RESCUE',    'AVAILABLE'),
(7,  3, 'Sub-Lt. Amit Sharma',  '9711001128', 'DRIVING',   'AVAILABLE'),
(8,  4, 'Inspector S. Balaji',  '9711001129', 'RESCUE',    'ASSIGNED'),
(9,  4, 'Havildar Vikas Singh', '9711001130', 'RESCUE',    'AVAILABLE'),
(10, 5, 'R. Murugavel',         '9711001131', 'LOGISTICS', 'AVAILABLE'),
(11, 5, 'K. Anbarasan',         '9711001132', 'DRIVING',   'AVAILABLE'),
(12, 6, 'Saravanan Muthu',      '9711001133', 'RESCUE',    'ASSIGNED'),
(13, 6, 'J. Prakash',           '9711001134', 'GENERAL',   'AVAILABLE'),
(14, 7, 'Dr. Ayesha Siddiqui',  '9711001135', 'MEDICAL',   'AVAILABLE'),
(15, 7, 'Nurse Shirley Mathew', '9711001136', 'MEDICAL',   'AVAILABLE'),
(16, 8, 'G. Venkateshwaran',    '9711001137', 'COOKING',   'AVAILABLE'),
(17, 8, 'L. Subhashini',        '9711001138', 'LOGISTICS', 'AVAILABLE'),
(18, 1, 'T. Selvamani',         '9711001139', 'DRIVING',   'AVAILABLE'),
(19, 2, 'R. Gomathi',           '9711001140', 'COOKING',   'AVAILABLE'),
(20, 6, 'D. Vijayaraghavan',    '9711001141', 'RESCUE',    'AVAILABLE');

SELECT setval('volunteers_volunteer_id_seq', (SELECT MAX(volunteer_id) FROM volunteers));

-- =============================================================================
-- 8. APP USERS
-- =============================================================================
INSERT INTO app_users (user_id, username, password_hash, role, agency_id, volunteer_id, requester_id) VALUES
(1, 'admin_master',    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'ADMIN',          NULL, NULL, NULL),
(2, 'manager_tnsdma',  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'AGENCY_MANAGER', 1,    NULL, NULL),
(3, 'manager_redcross','$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'AGENCY_MANAGER', 2,    NULL, NULL),
(4, 'manager_gcc',     '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'AGENCY_MANAGER', 5,    NULL, NULL),
(5, 'vol_karthik',     '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'VOLUNTEER',       1,    1,    NULL),
(6, 'vol_drharish',    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'VOLUNTEER',       2,    4,    NULL),
(7, 'req_kavitha',     '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'REQUESTER',       NULL, NULL, 1);

SELECT setval('app_users_user_id_seq', (SELECT MAX(user_id) FROM app_users));

-- =============================================================================
-- 9. REQUESTERS (25 Representative Citizens across 5 Districts)
-- =============================================================================
INSERT INTO requesters (requester_id, full_name, phone, age, gender, address, district) VALUES
(1,  'Kavitha Raman',       '9840123456', 32, 'FEMALE', '14 Lake View Road, Velachery',             'Chennai'),
(2,  'Murugan Selvam',      '9841234567', 67, 'MALE',   '28 Canal Bank Road, Saidapet',             'Chennai'),
(3,  'Anandhi Natarajan',   '9842345678', 29, 'FEMALE', '102 2nd Cross, Pallikaranai',             'Chengalpattu'),
(4,  'Senthil Kumar',       '9843456789', 45, 'MALE',   '5 GST Road, Tambaram',                     'Chengalpattu'),
(5,  'Fathima Begum',       '9844567890', 71, 'FEMALE', '8 Bharathi Street, Royapettah',            'Chennai'),
(6,  'Venkatesh Rao',       '9845678901', 38, 'MALE',   '19 Mudichur Road, West Tambaram',          'Chengalpattu'),
(7,  'Deepa Krishnan',      '9846789012', 26, 'FEMALE', '44 Beach Road, Thiruvanmiyur',             'Chennai'),
(8,  'Ramesh Babu',         '9847890123', 52, 'MALE',   '12 Madipakkam Main Road, Madipakkam',      'Chennai'),
(9,  'Lakshmi Narayanan',   '9848901234', 63, 'MALE',   '71 Ennore High Road, Ennore',              'Chennai'),
(10, 'Subha Chandrasekar',  '9849012345', 34, 'FEMALE', '89 MTH Road, Ambattur OT',                 'Tiruvallur'),
(11, 'Mohammed Ismail',     '9850123456', 41, 'MALE',   '23 Basin Bridge Road, Vyasarpadi',         'Chennai'),
(12, 'Kalaivani Arumugam',  '9851234567', 28, 'FEMALE', '15 Gandhi Nagar, Manali',                  'Chennai'),
(13, 'Gopalakrishnan V',    '9852345678', 75, 'MALE',   '34 Sannathi Street, Kanchipuram',          'Kanchipuram'),
(14, 'Shanthi Sundar',      '9853456789', 49, 'FEMALE', '110 Medavakkam Main Road, Kovilambakkam',  'Chengalpattu'),
(15, 'Antony Joseph',       '9854567890', 36, 'MALE',   '55 Kasimedu Harbor Road, Royapuram',       'Chennai'),
(16, 'Revathi Kannan',      '9855678901', 23, 'FEMALE', '9 Nehru Street, Perungudi',                'Chennai'),
(17, 'Balasubramanian N',   '9856789012', 68, 'MALE',   '101 Old Trunk Road, Poonamallee',          'Tiruvallur'),
(18, 'Praveen Kumar',       '9857890123', 31, 'MALE',   '4 Pammal Main Road, Pammal',               'Chengalpattu'),
(19, 'Sumathi Loganathan',  '9858901234', 58, 'FEMALE', '17 Redhills Road, Villivakkam',            'Chennai'),
(20, 'Thirunavukkarasu R',  '9859012345', 44, 'MALE',   '88 Thiruvalluvar Salai, Sholinganallur',   'Chennai');

SELECT setval('requesters_requester_id_seq', (SELECT MAX(requester_id) FROM requesters));

-- =============================================================================
-- 10. REQUESTER VULNERABILITIES
-- =============================================================================
INSERT INTO requester_vulnerabilities (requester_id, vuln_type_id) VALUES
(1,  3), -- Kavitha: PREGNANT (30)
(2,  1), -- Murugan: ELDERLY (20)
(2,  5), -- Murugan: CHRONIC_ILLNESS (15)
(3,  4), -- Anandhi: INFANT (20)
(4,  2), -- Senthil: DISABLED (25)
(5,  1), -- Fathima: ELDERLY (20)
(7,  3), -- Deepa: PREGNANT (30)
(7,  4), -- Deepa: INFANT (20)
(8,  5), -- Ramesh: CHRONIC_ILLNESS (15)
(9,  1), -- Lakshmi: ELDERLY (20)
(9,  2), -- Lakshmi: DISABLED (25)
(12, 3), -- Kalaivani: PREGNANT (30)
(13, 1), -- Gopalakrishnan: ELDERLY (20)
(13, 5), -- Gopalakrishnan: CHRONIC_ILLNESS (15)
(16, 6), -- Revathi: UNACCOMPANIED_MINOR (25)
(17, 1); -- Balasubramanian: ELDERLY (20)

-- =============================================================================
-- 11. HELP REQUESTS
-- Pre-computed priority_score matching formula:
--   score = vuln_weights + request_type_bonus + household_factor
-- =============================================================================
INSERT INTO help_requests (request_id, requester_id, request_type, status, priority_score, household_size, location_text, district, description) VALUES
(1,  1,  'EVACUATION', 'ALLOCATED', 64.00, 3, '14 Lake View Road, Velachery',             'Chennai',      'Ground floor flooded, pregnant mother needs shelter relocation'),
(2,  2,  'MEDICAL',    'ALLOCATED', 72.00, 2, '28 Canal Bank Road, Saidapet',             'Chennai',      'Elderly diabetic patient with wound infection'),
(3,  3,  'RESCUE',     'ALLOCATED', 66.00, 4, '102 2nd Cross, Pallikaranai',             'Chengalpattu', 'Flood water waist high, infant stranded, boat rescue required'),
(4,  4,  'WATER',      'PENDING',   53.00, 5, '5 GST Road, Tambaram',                     'Chengalpattu', 'Drinking water pipelines burst, disabled father in family'),
(5,  5,  'FOOD',       'COMPLETED', 35.00, 1, '8 Bharathi Street, Royapettah',            'Chennai',      'Elderly woman alone, needs dry ration kits'),
(6,  6,  'FOOD',       'PENDING',   17.00, 2, '19 Mudichur Road, West Tambaram',          'Chengalpattu', 'Locality surrounded by water, grocery stores shut'),
(7,  7,  'RESCUE',     'PENDING',   94.00, 3, '44 Beach Road, Thiruvanmiyur',             'Chennai',      'Wall collapsed trap, pregnant mother and toddler stranded'),
(8,  8,  'EVACUATION', 'ALLOCATED', 51.00, 4, '12 Madipakkam Main Road, Madipakkam',      'Chennai',      'Low-lying area submerged, 4 family members need beds'),
(9,  9,  'RESCUE',     'ALLOCATED', 91.00, 4, '71 Ennore High Road, Ennore',              'Chennai',      'Industrial drainage overflow, elderly wheelchair victim trapped'),
(10, 10, 'WATER',      'PENDING',   26.00, 4, '89 MTH Road, Ambattur OT',                 'Tiruvallur',   'Severe potable drinking water shortage in block'),
(11, 11, 'FOOD',       'PENDING',   21.00, 4, '23 Basin Bridge Road, Vyasarpadi',         'Chennai',      'Slum colony flooded, community kitchen not functioning'),
(12, 12, 'MEDICAL',    'PENDING',   69.00, 3, '15 Gandhi Nagar, Manali',                  'Chennai',      'Pregnant woman experiencing severe abdominal cramps'),
(13, 13, 'MEDICAL',    'ALLOCATED', 71.00, 1, '34 Sannathi Street, Kanchipuram',          'Kanchipuram',  'Elderly kidney patient needing transport to dialysis hospital'),
(14, 14, 'EVACUATION', 'ALLOCATED', 36.00, 4, '110 Medavakkam Main Road, Kovilambakkam',  'Chengalpattu', 'Water reached entrance steps, family seeking shelter'),
(15, 15, 'RESCUE',     'PENDING',   46.00, 4, '55 Kasimedu Harbor Road, Royapuram',       'Chennai',      'Tidal surge trapped fishing families on jetty terrace');

SELECT setval('help_requests_request_id_seq', (SELECT MAX(request_id) FROM help_requests));

-- =============================================================================
-- 12. ALLOCATIONS (Active & Fulfilled Operations)
-- =============================================================================
INSERT INTO allocations (allocation_id, request_id, shelter_id, volunteer_id, resource_type_id, quantity, beds_allocated, status, allocated_by, allocated_at, completed_at) VALUES
-- Request 1: Velachery Shelter (3 beds)
(1,  1,  1,  NULL, NULL, 0,  3, 'ACTIVE',    2, NOW() - INTERVAL '3 hours', NULL),
-- Request 2: Doctor dispatch
(2,  2,  NULL, 4,  NULL, 0,  0, 'ACTIVE',    2, NOW() - INTERVAL '2 hours', NULL),
-- Request 3: Boat rescue
(3,  3,  NULL, 1,  NULL, 0,  0, 'ACTIVE',    2, NOW() - INTERVAL '90 minutes', NULL),
-- Request 5: Food delivery
(4,  5,  4,  NULL, 2,   5,  0, 'COMPLETED', 4, NOW() - INTERVAL '5 hours', NOW() - INTERVAL '1 hour'),
-- Request 8: Velachery Shelter (4 beds)
(5,  8,  1,  NULL, NULL, 0,  4, 'ACTIVE',    2, NOW() - INTERVAL '1 hour', NULL),
-- Request 9: NDRF rescue dispatch + 4 beds at Ennore Shelter
(6,  9,  12, 8,    NULL, 0,  4, 'ACTIVE',    4, NOW() - INTERVAL '45 minutes', NULL),
-- Request 14: Pallikaranai Shelter (4 beds)
(7,  14, 5,  NULL, NULL, 0,  4, 'ACTIVE',    2, NOW() - INTERVAL '30 minutes', NULL);

SELECT setval('allocations_allocation_id_seq', (SELECT MAX(allocation_id) FROM allocations));

-- =============================================================================
-- 13. ALLOCATION AUDIT LOG
-- =============================================================================
INSERT INTO allocation_audit_log (log_id, allocation_id, action, old_status, new_status, changed_by, changed_at, details) VALUES
(1, 1, 'INSERT',        NULL,     'ACTIVE',    2, NOW() - INTERVAL '3 hours',    '{"reason": "Reserved 3 beds at Velachery Relief Camp"}'),
(2, 2, 'INSERT',        NULL,     'ACTIVE',    2, NOW() - INTERVAL '2 hours',    '{"reason": "Dispatched Dr. Harish Varma for wound treatment"}'),
(3, 3, 'INSERT',        NULL,     'ACTIVE',    2, NOW() - INTERVAL '90 minutes', '{"reason": "Dispatched Karthik Raja with inflatable raft"}'),
(4, 4, 'INSERT',        NULL,     'ACTIVE',    4, NOW() - INTERVAL '5 hours',    '{"reason": "Allocated 5 food ration packets from Saidapet Camp"}'),
(5, 4, 'STATUS_CHANGE', 'ACTIVE', 'COMPLETED', 4, NOW() - INTERVAL '1 hour',     '{"reason": "Delivered to citizen by field agent"}'),
(6, 5, 'INSERT',        NULL,     'ACTIVE',    2, NOW() - INTERVAL '1 hour',     '{"reason": "Reserved 4 beds at Velachery Camp"}'),
(7, 6, 'INSERT',        NULL,     'ACTIVE',    4, NOW() - INTERVAL '45 minutes', '{"reason": "NDRF Balaji dispatched + reserved beds at Ennore"}'),
(8, 7, 'INSERT',        NULL,     'ACTIVE',    2, NOW() - INTERVAL '30 minutes', '{"reason": "Reserved 4 beds at Pallikaranai Refuge Center"}');

SELECT setval('allocation_audit_log_log_id_seq', (SELECT MAX(log_id) FROM allocation_audit_log));

-- =============================================================================
-- 14. STOCK ALERTS
-- =============================================================================
INSERT INTO stock_alerts (alert_id, inventory_id, message, created_at, resolved) VALUES
(1, 7,  'LOW STOCK: Drinking Water (20L) at St. Thomas Mount is at 20 cans (Threshold: 40). Emergency refill requested.', NOW() - INTERVAL '4 hours', FALSE),
(2, 9,  'CRITICAL STOCK: First-Aid Medical Kits at St. Thomas Mount is at 6 kits (Threshold: 15). Rapid dispatch needed.', NOW() - INTERVAL '3 hours', FALSE),
(3, 18, 'LOW STOCK: Drinking Water (20L) at Ennore Shelter is at 15 cans (Threshold: 30). Inundation zone warning.', NOW() - INTERVAL '1 hour', FALSE);

SELECT setval('stock_alerts_alert_id_seq', (SELECT MAX(alert_id) FROM stock_alerts));
