-- =============================================================================
-- DRSCP: 01_schema.sql
-- Owner: Person A (Design & Schema)
-- Description: Idempotent DDL script defining all 13 core relational entities,
--              primary keys, foreign keys, constraints (CHECK, UNIQUE, NOT NULL),
--              and performance indexes for the Disaster Resource & Shelter
--              Coordination Platform.
-- Order: Run FIRST before seed data, functions, triggers, views, and roles.
-- =============================================================================

-- =============================================================================
-- 1. DROP EXISTING OBJECTS (Reverse Dependency Order for Idempotency)
-- =============================================================================
DROP TABLE IF EXISTS stock_alerts CASCADE;
DROP TABLE IF EXISTS allocation_audit_log CASCADE;
DROP TABLE IF EXISTS allocations CASCADE;
DROP TABLE IF EXISTS help_requests CASCADE;
DROP TABLE IF EXISTS app_users CASCADE;
DROP TABLE IF EXISTS volunteers CASCADE;
DROP TABLE IF EXISTS resource_inventory CASCADE;
DROP TABLE IF EXISTS shelters CASCADE;
DROP TABLE IF EXISTS resource_types CASCADE;
DROP TABLE IF EXISTS requester_vulnerabilities CASCADE;
DROP TABLE IF EXISTS requesters CASCADE;
DROP TABLE IF EXISTS vulnerability_types CASCADE;
DROP TABLE IF EXISTS agencies CASCADE;

-- =============================================================================
-- 2. CREATE ENTITIES (Dependency Order)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABLE: agencies
-- Government departments, NGOs, armed forces, and relief coordinators.
-- -----------------------------------------------------------------------------
CREATE TABLE agencies (
    agency_id       SERIAL PRIMARY KEY,
    name            VARCHAR(150) NOT NULL UNIQUE,
    agency_type     VARCHAR(50)  NOT NULL,
    contact_phone   VARCHAR(15)  NOT NULL,
    contact_email   VARCHAR(100) UNIQUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_agencies_type CHECK (agency_type IN ('GOVERNMENT', 'NGO', 'MILITARY', 'PRIVATE'))
);

COMMENT ON TABLE agencies IS 'Organisations operating emergency shelters, distributing resources, or commanding volunteers.';
COMMENT ON COLUMN agencies.agency_type IS 'Permitted types: GOVERNMENT, NGO, MILITARY, PRIVATE.';

-- -----------------------------------------------------------------------------
-- TABLE: vulnerability_types
-- Lookup catalog defining demographic vulnerabilities and scoring weights.
-- -----------------------------------------------------------------------------
CREATE TABLE vulnerability_types (
    vuln_type_id    SERIAL PRIMARY KEY,
    name            VARCHAR(50)   NOT NULL UNIQUE,
    weight          NUMERIC(5,2)  NOT NULL,
    description     TEXT,

    CONSTRAINT chk_vuln_weight CHECK (weight > 0)
);

COMMENT ON TABLE vulnerability_types IS 'Configurable catalog of vulnerability categories with priority scoring weights.';

-- -----------------------------------------------------------------------------
-- TABLE: requesters
-- Citizens requesting disaster relief, evacuation, or sustenance.
-- -----------------------------------------------------------------------------
CREATE TABLE requesters (
    requester_id    SERIAL PRIMARY KEY,
    full_name       VARCHAR(100) NOT NULL,
    phone           VARCHAR(15)  NOT NULL,
    age             INT,
    gender          VARCHAR(10),
    address         TEXT,
    district        VARCHAR(50)  NOT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_requesters_age CHECK (age IS NULL OR (age >= 0 AND age <= 120)),
    CONSTRAINT chk_requesters_gender CHECK (gender IS NULL OR gender IN ('MALE', 'FEMALE', 'OTHER'))
);

COMMENT ON TABLE requesters IS 'Individuals requesting relief or rescue. Decoupled from user logins for rapid intake.';

-- -----------------------------------------------------------------------------
-- TABLE: requester_vulnerabilities
-- M:N junction table mapping individuals to known vulnerabilities.
-- -----------------------------------------------------------------------------
CREATE TABLE requester_vulnerabilities (
    requester_id    INT NOT NULL,
    vuln_type_id    INT NOT NULL,

    CONSTRAINT pk_requester_vulnerabilities PRIMARY KEY (requester_id, vuln_type_id),
    CONSTRAINT fk_req_vuln_requester FOREIGN KEY (requester_id) REFERENCES requesters(requester_id) ON DELETE CASCADE,
    CONSTRAINT fk_req_vuln_type FOREIGN KEY (vuln_type_id) REFERENCES vulnerability_types(vuln_type_id) ON DELETE RESTRICT
);

COMMENT ON TABLE requester_vulnerabilities IS 'Associative entity capturing multiple vulnerabilities per requester for triage scoring.';

-- -----------------------------------------------------------------------------
-- TABLE: resource_types
-- Catalog of relief items (rations, water, medicine, emergency gear).
-- -----------------------------------------------------------------------------
CREATE TABLE resource_types (
    resource_type_id SERIAL PRIMARY KEY,
    name             VARCHAR(100) NOT NULL UNIQUE,
    category         VARCHAR(50)  NOT NULL,
    unit             VARCHAR(20)  NOT NULL,

    CONSTRAINT chk_resource_category CHECK (category IN ('FOOD', 'WATER', 'MEDICINE', 'EQUIPMENT', 'CLOTHING', 'OTHER'))
);

COMMENT ON TABLE resource_types IS 'Standard catalog of relief supply types and units of measurement.';

-- -----------------------------------------------------------------------------
-- TABLE: shelters
-- Designated physical emergency refuge facilities operated by agencies.
-- -----------------------------------------------------------------------------
CREATE TABLE shelters (
    shelter_id        SERIAL PRIMARY KEY,
    agency_id         INT          NOT NULL,
    name              VARCHAR(150) NOT NULL,
    address           TEXT         NOT NULL,
    district          VARCHAR(50)  NOT NULL,
    total_capacity    INT          NOT NULL,
    current_occupancy INT          NOT NULL DEFAULT 0,
    status            VARCHAR(15)  NOT NULL DEFAULT 'OPEN',
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_shelters_agency FOREIGN KEY (agency_id) REFERENCES agencies(agency_id) ON DELETE RESTRICT,
    CONSTRAINT chk_shelters_capacity CHECK (total_capacity > 0),
    CONSTRAINT chk_shelters_occupancy_non_negative CHECK (current_occupancy >= 0),
    CONSTRAINT chk_shelters_occupancy_limit CHECK (current_occupancy <= total_capacity),
    CONSTRAINT chk_shelters_status CHECK (status IN ('OPEN', 'FULL', 'CLOSED'))
);

COMMENT ON TABLE shelters IS 'Physical relief centers. current_occupancy is denormalized and maintained by triggers.';

-- -----------------------------------------------------------------------------
-- TABLE: resource_inventory
-- On-hand stockpile balances of relief materials per shelter location.
-- -----------------------------------------------------------------------------
CREATE TABLE resource_inventory (
    inventory_id       SERIAL PRIMARY KEY,
    shelter_id         INT         NOT NULL,
    resource_type_id   INT         NOT NULL,
    quantity_available INT         NOT NULL DEFAULT 0,
    reorder_threshold  INT         NOT NULL DEFAULT 10,
    last_updated       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_shelter_resource UNIQUE (shelter_id, resource_type_id),
    CONSTRAINT fk_inventory_shelter FOREIGN KEY (shelter_id) REFERENCES shelters(shelter_id) ON DELETE CASCADE,
    CONSTRAINT fk_inventory_resource FOREIGN KEY (resource_type_id) REFERENCES resource_types(resource_type_id) ON DELETE RESTRICT,
    CONSTRAINT chk_inventory_qty_non_negative CHECK (quantity_available >= 0),
    CONSTRAINT chk_inventory_threshold CHECK (reorder_threshold >= 0)
);

COMMENT ON TABLE resource_inventory IS 'Current stock levels per shelter. quantity_available is maintained via transaction procedures and triggers.';

-- -----------------------------------------------------------------------------
-- TABLE: volunteers
-- First responders and relief workers assigned to agencies.
-- -----------------------------------------------------------------------------
CREATE TABLE volunteers (
    volunteer_id        SERIAL PRIMARY KEY,
    agency_id           INT          NOT NULL,
    full_name           VARCHAR(100) NOT NULL,
    phone               VARCHAR(15)  NOT NULL,
    skill               VARCHAR(50),
    availability_status VARCHAR(15)  NOT NULL DEFAULT 'AVAILABLE',
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_volunteers_agency FOREIGN KEY (agency_id) REFERENCES agencies(agency_id) ON DELETE RESTRICT,
    CONSTRAINT chk_volunteers_skill CHECK (skill IS NULL OR skill IN ('MEDICAL', 'RESCUE', 'LOGISTICS', 'COOKING', 'DRIVING', 'GENERAL')),
    CONSTRAINT chk_volunteers_status CHECK (availability_status IN ('AVAILABLE', 'ASSIGNED', 'INACTIVE'))
);

COMMENT ON TABLE volunteers IS 'Volunteers available for tactical deployment and distribution.';

-- -----------------------------------------------------------------------------
-- TABLE: app_users
-- System credentials and role-based identity mapping.
-- -----------------------------------------------------------------------------
CREATE TABLE app_users (
    user_id       SERIAL PRIMARY KEY,
    username      VARCHAR(50) NOT NULL UNIQUE,
    password_hash TEXT        NOT NULL,
    role          VARCHAR(20) NOT NULL,
    agency_id     INT,
    volunteer_id  INT,
    requester_id  INT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_users_agency FOREIGN KEY (agency_id) REFERENCES agencies(agency_id) ON DELETE SET NULL,
    CONSTRAINT fk_users_volunteer FOREIGN KEY (volunteer_id) REFERENCES volunteers(volunteer_id) ON DELETE SET NULL,
    CONSTRAINT fk_users_requester FOREIGN KEY (requester_id) REFERENCES requesters(requester_id) ON DELETE SET NULL,
    CONSTRAINT chk_users_role CHECK (role IN ('ADMIN', 'AGENCY_MANAGER', 'VOLUNTEER', 'REQUESTER'))
);

COMMENT ON TABLE app_users IS 'Authentication and RBAC records mapped to operational entities.';

-- -----------------------------------------------------------------------------
-- TABLE: help_requests
-- Citizen aid requests requiring dispatch and fulfillment.
-- -----------------------------------------------------------------------------
CREATE TABLE help_requests (
    request_id     SERIAL PRIMARY KEY,
    requester_id   INT          NOT NULL,
    request_type   VARCHAR(20)  NOT NULL,
    status         VARCHAR(15)  NOT NULL DEFAULT 'PENDING',
    priority_score NUMERIC(8,2) NOT NULL DEFAULT 0.00,
    household_size INT          NOT NULL DEFAULT 1,
    location_text  TEXT         NOT NULL,
    district       VARCHAR(50)  NOT NULL,
    description    TEXT,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_requests_requester FOREIGN KEY (requester_id) REFERENCES requesters(requester_id) ON DELETE RESTRICT,
    CONSTRAINT chk_requests_type CHECK (request_type IN ('EVACUATION', 'FOOD', 'WATER', 'MEDICAL', 'RESCUE')),
    CONSTRAINT chk_requests_status CHECK (status IN ('PENDING', 'ALLOCATED', 'COMPLETED', 'CANCELLED')),
    CONSTRAINT chk_requests_household CHECK (household_size >= 1),
    CONSTRAINT chk_requests_priority CHECK (priority_score >= 0)
);

COMMENT ON TABLE help_requests IS 'Triage dispatch queue. priority_score denormalized and maintained by stored procedure/trigger.';

-- -----------------------------------------------------------------------------
-- TABLE: allocations
-- Assignment of shelter beds, field volunteers, or emergency supplies to requests.
-- -----------------------------------------------------------------------------
CREATE TABLE allocations (
    allocation_id    SERIAL PRIMARY KEY,
    request_id       INT         NOT NULL,
    shelter_id       INT,
    volunteer_id     INT,
    resource_type_id INT,
    quantity         INT         NOT NULL DEFAULT 0,
    beds_allocated   INT         NOT NULL DEFAULT 0,
    status           VARCHAR(15) NOT NULL DEFAULT 'ACTIVE',
    allocated_by     INT         NOT NULL,
    allocated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at     TIMESTAMPTZ,

    CONSTRAINT fk_alloc_request FOREIGN KEY (request_id) REFERENCES help_requests(request_id) ON DELETE RESTRICT,
    CONSTRAINT fk_alloc_shelter FOREIGN KEY (shelter_id) REFERENCES shelters(shelter_id) ON DELETE RESTRICT,
    CONSTRAINT fk_alloc_volunteer FOREIGN KEY (volunteer_id) REFERENCES volunteers(volunteer_id) ON DELETE SET NULL,
    CONSTRAINT fk_alloc_resource FOREIGN KEY (resource_type_id) REFERENCES resource_types(resource_type_id) ON DELETE RESTRICT,
    CONSTRAINT fk_alloc_user FOREIGN KEY (allocated_by) REFERENCES app_users(user_id) ON DELETE RESTRICT,
    CONSTRAINT chk_alloc_status CHECK (status IN ('ACTIVE', 'COMPLETED', 'CANCELLED')),
    CONSTRAINT chk_alloc_quantity CHECK (quantity >= 0),
    CONSTRAINT chk_alloc_beds CHECK (beds_allocated >= 0)
);

COMMENT ON TABLE allocations IS 'Commitment of relief resources, shelter spaces, or responders to a help request.';

-- -----------------------------------------------------------------------------
-- TABLE: allocation_audit_log
-- Immutable append-only audit trail capturing lifecycle transitions of allocations.
-- -----------------------------------------------------------------------------
CREATE TABLE allocation_audit_log (
    log_id        SERIAL PRIMARY KEY,
    allocation_id INT         NOT NULL,
    action        VARCHAR(30) NOT NULL,
    old_status    VARCHAR(15),
    new_status    VARCHAR(15) NOT NULL,
    changed_by    INT,
    changed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    details       JSONB,

    CONSTRAINT fk_audit_allocation FOREIGN KEY (allocation_id) REFERENCES allocations(allocation_id) ON DELETE CASCADE,
    CONSTRAINT fk_audit_user FOREIGN KEY (changed_by) REFERENCES app_users(user_id) ON DELETE SET NULL
);

COMMENT ON TABLE allocation_audit_log IS 'Append-only audit ledger of allocation status updates and trigger events.';

-- -----------------------------------------------------------------------------
-- TABLE: stock_alerts
-- Notifications logged when inventory dips below minimum safety thresholds.
-- -----------------------------------------------------------------------------
CREATE TABLE stock_alerts (
    alert_id      SERIAL PRIMARY KEY,
    inventory_id  INT         NOT NULL,
    message       TEXT        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved      BOOLEAN     NOT NULL DEFAULT FALSE,

    CONSTRAINT fk_alerts_inventory FOREIGN KEY (inventory_id) REFERENCES resource_inventory(inventory_id) ON DELETE CASCADE
);

COMMENT ON TABLE stock_alerts IS 'Automatic replenishment warning records generated when stockpile dips below threshold.';

-- =============================================================================
-- 3. PERFORMANCE & CONSTRAINT INDEXES
-- =============================================================================

-- Foreign key indexes (eliminates full table scans on joins and FK cascades)
CREATE INDEX idx_shelters_agency_id          ON shelters(agency_id);
CREATE INDEX idx_inventory_shelter           ON resource_inventory(shelter_id);
CREATE INDEX idx_inventory_resource          ON resource_inventory(resource_type_id);
CREATE INDEX idx_volunteers_agency           ON volunteers(agency_id);
CREATE INDEX idx_volunteers_availability     ON volunteers(availability_status);
CREATE INDEX idx_users_agency                ON app_users(agency_id);
CREATE INDEX idx_users_volunteer             ON app_users(volunteer_id);
CREATE INDEX idx_users_requester             ON app_users(requester_id);
CREATE INDEX idx_requests_requester          ON help_requests(requester_id);
CREATE INDEX idx_alloc_request               ON allocations(request_id);
CREATE INDEX idx_alloc_shelter               ON allocations(shelter_id);
CREATE INDEX idx_alloc_volunteer             ON allocations(volunteer_id);
CREATE INDEX idx_alloc_resource              ON allocations(resource_type_id);
CREATE INDEX idx_alloc_user                  ON allocations(allocated_by);
CREATE INDEX idx_audit_allocation            ON allocation_audit_log(allocation_id);
CREATE INDEX idx_audit_changed_at            ON allocation_audit_log(changed_at DESC);
CREATE INDEX idx_alerts_inventory            ON stock_alerts(inventory_id);

-- Operational indexes for triage queue queries and geo-filtering
CREATE INDEX idx_help_requests_triage        ON help_requests(status, priority_score DESC, district);
CREATE INDEX idx_help_requests_created       ON help_requests(created_at DESC);
CREATE INDEX idx_shelters_district_status    ON shelters(district, status);
CREATE INDEX idx_requesters_phone            ON requesters(phone);
CREATE INDEX idx_stock_alerts_unresolved     ON stock_alerts(resolved) WHERE resolved = FALSE;
