# CONTRACT/01 — Entities and Columns

> **STATUS: APPROVED & FROZEN (2026-10-07).**
> Any future modifications require a formal Change Request logged in CHANGELOG.md.

---

## Naming conventions

- Table names: **plural snake_case** (`help_requests`, not `HelpRequest`)
- Primary key: `<table_singular>_id` (e.g., `agency_id`)
- Timestamps: always `TIMESTAMPTZ` defaulting to `NOW()`
- Status/type columns: enforced via `CHECK` constraint with an explicit domain list
- Trigger-maintained columns are flagged with ⚙️

---

## Tables

### `agencies`
Represents a government agency, NGO, or relief organisation operating shelters or volunteers.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `agency_id` | `SERIAL` | PK | Auto-increment |
| `name` | `VARCHAR(150)` | NOT NULL, UNIQUE | Organisation name |
| `agency_type` | `VARCHAR(50)` | NOT NULL, CHECK IN ('GOVERNMENT','NGO','MILITARY','PRIVATE') | |
| `contact_phone` | `VARCHAR(15)` | NOT NULL | |
| `contact_email` | `VARCHAR(100)` | UNIQUE | |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() | |

---

### `app_users`
Application login accounts. Each account maps to exactly one person/role.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `user_id` | `SERIAL` | PK | |
| `username` | `VARCHAR(50)` | NOT NULL, UNIQUE | Login username |
| `password_hash` | `TEXT` | NOT NULL | bcrypt hash |
| `role` | `VARCHAR(20)` | NOT NULL, CHECK IN ('ADMIN','AGENCY_MANAGER','VOLUNTEER','REQUESTER') | App-level role |
| `agency_id` | `INT` | FK → agencies(agency_id) NULL | Set for AGENCY_MANAGER |
| `volunteer_id` | `INT` | FK → volunteers(volunteer_id) NULL | Set for VOLUNTEER |
| `requester_id` | `INT` | FK → requesters(requester_id) NULL | Set for REQUESTER |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() | |

---

### `vulnerability_types`
Lookup table of vulnerability categories and their priority-score weights. Table-driven so weights can be adjusted without code changes.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `vuln_type_id` | `SERIAL` | PK | |
| `name` | `VARCHAR(50)` | NOT NULL, UNIQUE | e.g., 'ELDERLY', 'DISABLED' |
| `weight` | `NUMERIC(5,2)` | NOT NULL, CHECK (weight > 0) | Added to priority score |
| `description` | `TEXT` | | Plain-English note |

**Seed values:**

| name | weight |
|---|---|
| ELDERLY (age > 60) | 20 |
| DISABLED | 25 |
| PREGNANT | 30 |
| INFANT (age < 2) | 20 |
| CHRONIC_ILLNESS | 15 |
| UNACCOMPANIED_MINOR | 25 |

---

### `requesters`
People requesting help. Separate from `app_users` so an anonymous walk-in can still be recorded.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `requester_id` | `SERIAL` | PK | |
| `full_name` | `VARCHAR(100)` | NOT NULL | |
| `phone` | `VARCHAR(15)` | NOT NULL | Used for duplicate detection |
| `age` | `INT` | CHECK (age BETWEEN 0 AND 120) NULL | |
| `gender` | `VARCHAR(10)` | CHECK IN ('MALE','FEMALE','OTHER') NULL | |
| `address` | `TEXT` | | |
| `district` | `VARCHAR(50)` | NOT NULL | Tamil Nadu district |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() | |

---

### `requester_vulnerabilities`
M:N junction between requesters and vulnerability types.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `requester_id` | `INT` | NOT NULL, FK → requesters(requester_id) | Part of composite PK |
| `vuln_type_id` | `INT` | NOT NULL, FK → vulnerability_types(vuln_type_id) | Part of composite PK |

**PK:** `(requester_id, vuln_type_id)`

---

### `help_requests`
Core table. One row per request for evacuation, food, water, etc.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `request_id` | `SERIAL` | PK | |
| `requester_id` | `INT` | NOT NULL, FK → requesters(requester_id) | |
| `request_type` | `VARCHAR(20)` | NOT NULL, CHECK IN ('EVACUATION','FOOD','WATER','MEDICAL','RESCUE') | |
| `status` | `VARCHAR(15)` | NOT NULL DEFAULT 'PENDING', CHECK IN ('PENDING','ALLOCATED','COMPLETED','CANCELLED') | |
| `priority_score` | `NUMERIC(8,2)` | DEFAULT 0 | ⚙️ Maintained by `compute_priority_score` / trigger |
| `household_size` | `INT` | NOT NULL DEFAULT 1, CHECK (household_size >= 1) | |
| `location_text` | `TEXT` | NOT NULL | Free-text address |
| `district` | `VARCHAR(50)` | NOT NULL | |
| `description` | `TEXT` | | Additional details |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() | ⚙️ Maintained by trigger |

---

### `shelters`
Physical shelter locations managed by an agency.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `shelter_id` | `SERIAL` | PK | |
| `agency_id` | `INT` | NOT NULL, FK → agencies(agency_id) | |
| `name` | `VARCHAR(150)` | NOT NULL | |
| `address` | `TEXT` | NOT NULL | |
| `district` | `VARCHAR(50)` | NOT NULL | |
| `total_capacity` | `INT` | NOT NULL, CHECK (total_capacity > 0) | |
| `current_occupancy` | `INT` | NOT NULL DEFAULT 0, CHECK (current_occupancy >= 0) | ⚙️ Maintained by trigger |
| `status` | `VARCHAR(15)` | NOT NULL DEFAULT 'OPEN', CHECK IN ('OPEN','FULL','CLOSED') | ⚙️ Updated by trigger when occupancy = capacity |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() | |

**Constraint:** `CHECK (current_occupancy <= total_capacity)`

---

### `resource_types`
Lookup of all resource categories (food packets, water cans, medicine kits, etc.).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `resource_type_id` | `SERIAL` | PK | |
| `name` | `VARCHAR(100)` | NOT NULL, UNIQUE | e.g., 'FOOD_PACKET' |
| `category` | `VARCHAR(50)` | NOT NULL, CHECK IN ('FOOD','WATER','MEDICINE','EQUIPMENT','CLOTHING','OTHER') | |
| `unit` | `VARCHAR(20)` | NOT NULL | e.g., 'packets', 'litres', 'kits' |

---

### `resource_inventory`
Stock of a particular resource type at a particular shelter.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `inventory_id` | `SERIAL` | PK | |
| `shelter_id` | `INT` | NOT NULL, FK → shelters(shelter_id) | |
| `resource_type_id` | `INT` | NOT NULL, FK → resource_types(resource_type_id) | |
| `quantity_available` | `INT` | NOT NULL DEFAULT 0, CHECK (quantity_available >= 0) | ⚙️ Maintained by trigger |
| `reorder_threshold` | `INT` | NOT NULL DEFAULT 10 | Triggers stock alert when breached |
| `last_updated` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() | ⚙️ Maintained by trigger |

**UNIQUE:** `(shelter_id, resource_type_id)`

---

### `volunteers`
Individual volunteers associated with an agency.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `volunteer_id` | `SERIAL` | PK | |
| `agency_id` | `INT` | NOT NULL, FK → agencies(agency_id) | |
| `full_name` | `VARCHAR(100)` | NOT NULL | |
| `phone` | `VARCHAR(15)` | NOT NULL | |
| `skill` | `VARCHAR(50)` | CHECK IN ('MEDICAL','RESCUE','LOGISTICS','COOKING','DRIVING','GENERAL') NULL | |
| `availability_status` | `VARCHAR(15)` | NOT NULL DEFAULT 'AVAILABLE', CHECK IN ('AVAILABLE','ASSIGNED','INACTIVE') | ⚙️ Updated by trigger on assignment |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() | |

---

### `allocations`
Links a help request to a shelter bed, a volunteer, or a resource allocation. One row per allocation event.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `allocation_id` | `SERIAL` | PK | |
| `request_id` | `INT` | NOT NULL, FK → help_requests(request_id) | |
| `shelter_id` | `INT` | FK → shelters(shelter_id) NULL | Set for bed allocations |
| `volunteer_id` | `INT` | FK → volunteers(volunteer_id) NULL | Set for volunteer assignments |
| `resource_type_id` | `INT` | FK → resource_types(resource_type_id) NULL | Set for resource allocations |
| `quantity` | `INT` | DEFAULT 0 | Resource quantity allocated |
| `beds_allocated` | `INT` | DEFAULT 0 | Beds reserved in this allocation |
| `status` | `VARCHAR(15)` | NOT NULL DEFAULT 'ACTIVE', CHECK IN ('ACTIVE','COMPLETED','CANCELLED') | |
| `allocated_by` | `INT` | NOT NULL, FK → app_users(user_id) | Who performed the allocation |
| `allocated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() | |
| `completed_at` | `TIMESTAMPTZ` | | Set when COMPLETED or CANCELLED |

**CHECK:** At least one of `shelter_id`, `volunteer_id`, `resource_type_id` must be non-NULL (enforced in stored procedure, not DDL, for clarity).

---

### `allocation_audit_log`
Immutable record of every status change on an allocation row.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `log_id` | `SERIAL` | PK | |
| `allocation_id` | `INT` | NOT NULL, FK → allocations(allocation_id) | |
| `action` | `VARCHAR(30)` | NOT NULL | e.g., 'INSERT', 'STATUS_CHANGE', 'CANCEL' |
| `old_status` | `VARCHAR(15)` | | NULL on INSERT |
| `new_status` | `VARCHAR(15)` | NOT NULL | |
| `changed_by` | `INT` | FK → app_users(user_id) NULL | NULL for system triggers |
| `changed_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() | |
| `details` | `JSONB` | | Extra context (e.g., beds freed, volunteer name) |

---

### `stock_alerts`
One row per low-stock event; resolved manually or via restock trigger.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `alert_id` | `SERIAL` | PK | |
| `inventory_id` | `INT` | NOT NULL, FK → resource_inventory(inventory_id) | |
| `message` | `TEXT` | NOT NULL | |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() | |
| `resolved` | `BOOLEAN` | NOT NULL DEFAULT FALSE | |

---

## Entity relationships summary

```
agencies ──< shelters ──< resource_inventory >── resource_types
agencies ──< volunteers
requesters ──< help_requests ──< allocations >── shelters
                                  allocations >── volunteers
                                  allocations >── resource_types
requesters ──< requester_vulnerabilities >── vulnerability_types
allocations ──< allocation_audit_log
resource_inventory ──< stock_alerts
app_users >── agencies / volunteers / requesters (optional FK)
```
