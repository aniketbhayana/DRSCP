# DRSCP: Architectural Schema Justification & Design Decisions

**Course:** BCSE302P — Database Systems Lab  
**Track:** T2: Emergency & Disaster Resilience  
**Author:** Person A (Design & Schema Lead)  
**Status:** Approved & Implemented (Phase 1)  

---

## 1. Architectural Philosophy: The Database as the Active Layer

In modern web development, teams often treat PostgreSQL as a passive object store, delegating business rules, concurrency management, and state invariants to application-layer code (Express/Node.js). In disaster coordination, this architecture introduces race conditions, phantom allocations, and catastrophic data corruption when multiple dispatchers operate concurrently under intermittent connectivity.

**DRSCP establishes PostgreSQL as the active decision-making layer:**
- Relational integrity is guaranteed at the engine level through foreign keys, domain `CHECK` constraints, and unique constraints.
- Concurrency invariants (e.g., zero shelter over-capacity, zero negative inventory) are enforced by database triggers and atomic transactions, not backend `if` statements.
- The Node.js and React layers serve as a thin, reactive presentation interface.

---

## 2. Entity Architecture & Boundary Decoupling

### 2.1 Decoupling `requesters` from `app_users`
- **Design Choice:** Requesters seeking help are stored in a separate `requesters` table rather than directly inside `app_users`.
- **Justification:**
  1. *Crisis Usability:* In an active flood or cyclone, victims calling a hotline (1070/1077) or arriving at a rescue camp do not possess smartphones, internet access, or email accounts. Forcing victims to create an `app_user` with password hashes would break emergency intake.
  2. *Operator Intake:* Relief call-center volunteers log requests on behalf of anonymous or walk-in citizens.
  3. *Optional Authentication:* If a citizen later wants to track their status online via mobile phone verification, an `app_users` record can link to their existing `requester_id` via a nullable foreign key (`fk_users_requester`).

### 2.2 Unified Polymorphic `allocations` Table
- **Design Choice:** A single unified `allocations` table with nullable foreign keys (`shelter_id`, `volunteer_id`, `resource_type_id`) instead of three disparate tables (`shelter_allocations`, `volunteer_allocations`, `resource_allocations`).
- **Justification:**
  1. *Unified Dispatch Lifecycle:* Regardless of whether an allocation represents a shelter bed, a dispatched boat rescue volunteer, or a crate of drinking water, every allocation undergoes an identical operational state machine (`ACTIVE` $\rightarrow$ `COMPLETED` or `CANCELLED`).
  2. *Single Immutable Audit Log:* Centralizes the event stream in `allocation_audit_log(allocation_id)`, allowing a single view of all relief activities.
  3. *API & UI Uniformity:* Person C's backend and frontend can implement uniform allocation status management endpoints (`PUT /api/allocations/:id/status`) without tripartite boilerplate.
  4. *Procedural Enforcement:* Business rules (such as ensuring at least one target resource/shelter/volunteer is populated) are strictly verified in stored procedures and trigger logic.

### 2.3 Table-Driven Vulnerability Scoring (`vulnerability_types`)
- **Design Choice:** Storing vulnerability definitions and triage weights in a relational catalog (`vulnerability_types`) rather than hardcoding constants in SQL functions or application code.
- **Justification:**
  - Disaster conditions vary dynamically. If a disease outbreak occurs, the disaster authority can insert `CHOLERA_SYMPTOMATIC` with weight `35.00` directly into the database without recompiling backend code or rewriting SQL functions.

---

## 3. Data Type Decisions & Rationale

| Column / Category | Chosen Data Type | Alternative Rejected | Justification |
|---|---|---|---|
| All Timestamps | `TIMESTAMPTZ` | `TIMESTAMP` (without TZ) | Relief coordinators, military units, and cloud servers may operate across different server time configurations. `TIMESTAMPTZ` normalizes all timestamps to UTC internally while preserving timezone context upon retrieval. |
| Priority Scores & Weights | `NUMERIC(8,2)` / `NUMERIC(5,2)` | `FLOAT` / `REAL` | Floating-point types suffer from IEEE-754 precision inaccuracies, which can introduce non-deterministic sort behavior in tight triage queues. `NUMERIC` guarantees fixed-point mathematical precision. |
| Audit Payloads | `JSONB` | `TEXT` / Plain Columns | `JSONB` allows flexible, structured storage of diverse event details (e.g., beds allocated, GPS coordinates, volunteer notes, cancellation motives) without requiring continuous schema migrations. `JSONB` also supports GIN indexing if future deep querying is needed. |
| Primary Keys | `SERIAL` (32-bit INT) | `UUID` / `BIGSERIAL` | For a localized disaster platform managing up to several million records, 4-byte integers conserve substantial index page cache space compared to 16-byte UUIDs, optimizing B-tree index traversals and join latency. |
| Categorical Enums | `VARCHAR(n)` + `CHECK (col IN (...))` | `CREATE TYPE ... AS ENUM` | PostgreSQL native enums require non-transactional DDL to alter, pollute global catalogs, and complicate dump/restore workflows. `VARCHAR` with `CHECK` constraints provides strict type safety, portability, and clean introspectability. |

---

## 4. Foreign Key Constraints & Referential Action Policies

The referential integrity strategy enforces strict defensive policies:

1. **`ON DELETE RESTRICT` (Default for Core Entities):**
   - Applied to `shelters(agency_id)`, `volunteers(agency_id)`, `help_requests(requester_id)`, `allocations(request_id)`, `allocations(shelter_id)`.
   - *Rationale:* An agency, shelter, or citizen record with active historical allocations or open requests must NEVER be deleted inadvertently. Deletion must be actively blocked by the engine until dependents are properly resolved.

2. **`ON DELETE CASCADE` (Tightly-Coupled Child Entities):**
   - Applied to `requester_vulnerabilities(requester_id)`: Vulnerability tags have no independent semantic meaning if the citizen record is purged.
   - Applied to `resource_inventory(shelter_id)`: Inventory records are inextricably bound to the physical shelter facility.
   - Applied to `allocation_audit_log(allocation_id)` and `stock_alerts(inventory_id)`: Historical audit entries belong strictly to their parent allocation or inventory balance.

3. **`ON DELETE SET NULL` (Decoupled User Identity Links):**
   - Applied to `app_users(agency_id)`, `app_users(volunteer_id)`, `app_users(requester_id)`, and `allocations(volunteer_id)`.
   - *Rationale:* If a user account is deactivated or deleted, operational history must remain intact. If a volunteer is unlinked, the allocation record remains for auditing purposes with `volunteer_id = NULL`.

---

## 5. Domain Invariant `CHECK` Constraints

To ensure zero corrupted data enters the database, DRSCP defines declarative `CHECK` constraints on all critical operational columns:

```sql
-- 1. Shelters: Capacity must be strictly positive, occupancy non-negative and bounded
CONSTRAINT chk_shelters_capacity CHECK (total_capacity > 0)
CONSTRAINT chk_shelters_occupancy_non_negative CHECK (current_occupancy >= 0)
CONSTRAINT chk_shelters_occupancy_limit CHECK (current_occupancy <= total_capacity)

-- 2. Inventory: Zero negative inventory invariant
CONSTRAINT chk_inventory_qty_non_negative CHECK (quantity_available >= 0)
CONSTRAINT chk_inventory_threshold CHECK (reorder_threshold >= 0)

-- 3. Help Requests: Household size and non-negative priority score
CONSTRAINT chk_requests_household CHECK (household_size >= 1)
CONSTRAINT chk_requests_priority CHECK (priority_score >= 0)

-- 4. Allocations: Quantities must be non-negative
CONSTRAINT chk_alloc_quantity CHECK (quantity >= 0)
CONSTRAINT chk_alloc_beds CHECK (beds_allocated >= 0)

-- 5. Demographics: Reasonable human age range
CONSTRAINT chk_requesters_age CHECK (age IS NULL OR (age >= 0 AND age <= 120))
```

---

## 6. Performance Indexing Strategy

In PostgreSQL, primary keys are automatically indexed with unique B-Trees. However, foreign keys are not automatically indexed by default. Missing foreign key indexes causes full table sequential scans whenever tables are joined or parent rows are checked for referential integrity.

### 6.1 Foreign Key Join Indexes
The following explicit B-tree indexes are created to optimize join queries and cascading referential integrity checks:
- `idx_shelters_agency_id` on `shelters(agency_id)`
- `idx_inventory_shelter` on `resource_inventory(shelter_id)`
- `idx_inventory_resource` on `resource_inventory(resource_type_id)`
- `idx_volunteers_agency` on `volunteers(agency_id)`
- `idx_requests_requester` on `help_requests(requester_id)`
- `idx_alloc_request` on `allocations(request_id)`
- `idx_alloc_shelter` on `allocations(shelter_id)`
- `idx_alloc_volunteer` on `allocations(volunteer_id)`
- `idx_alloc_resource` on `allocations(resource_type_id)`
- `idx_audit_allocation` on `allocation_audit_log(allocation_id)`

### 6.2 Composite & Operational Workload Indexes
- **`idx_help_requests_triage` ON `help_requests(status, priority_score DESC, district)`:**
  - *Query Pattern:* `SELECT * FROM help_requests WHERE status = 'PENDING' AND district = 'Chennai' ORDER BY priority_score DESC;`
  - *Performance Impact:* Transforms an $O(N \log N)$ disk sort into an instant index range scan, providing sub-millisecond dispatch responsiveness.
- **`idx_shelters_district_status` ON `shelters(district, status)`:**
  - *Query Pattern:* Real-time public citizen lookup of available shelters by geographical district.
- **`idx_requesters_phone` ON `requesters(phone)`:**
  - *Query Pattern:* Emergency hotline call deduplication lookup to prevent duplicate request logging.
- **`idx_stock_alerts_unresolved` ON `stock_alerts(resolved) WHERE resolved = FALSE`:**
  - *Partial Index:* Only indexes active, unresolved alerts. Because resolved alerts accumulate over time while active alerts remain few, this partial index maintains an ultra-compact footprint completely resident in L1/L2 cache.
