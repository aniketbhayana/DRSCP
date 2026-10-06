# CONTRACT/02 — Function & Procedure Signatures

> **STATUS: DRAFT – awaiting Day 0 team approval.**
> Owner of implementation: **Person B** (`db/03_functions/`, `db/04_triggers/`).
> After approval, changes require a Change Request in CHANGELOG.md.

---

## How to read this document

Each entry lists:
- **Name** — exact SQL identifier
- **Parameters** — name, type, order (callers MUST pass in this exact order)
- **Returns** — return type or VOID
- **Raises** — SQLSTATE / message when the procedure detects a business-rule violation
- **Who may EXECUTE** — DB role(s); enforced in `06_roles_and_grants.sql`
- **Tables touched** — so the Node backend knows what to expect
- **File** — which SQL file in `db/03_functions/` or `db/04_triggers/`

---

## Functions (read-only, called in SELECT or assignments)

---

### `compute_priority_score`

```
compute_priority_score(
    p_request_id  INT
) RETURNS NUMERIC(8,2)
```

**Purpose:** Calculates a numeric priority score for one help request.

**Formula (approximate — exact weights come from `vulnerability_types.weight`):**

```
score =  SUM(vuln_type.weight for each vulnerability of the requester)
       + LEAST(minutes_since_created / 10, 50)       -- wait-time bonus, capped at 50
       + CASE request_type
             WHEN 'RESCUE'     THEN 40
             WHEN 'MEDICAL'    THEN 35
             WHEN 'EVACUATION' THEN 30
             WHEN 'WATER'      THEN 20
             WHEN 'FOOD'       THEN 15
         END
       + LEAST((household_size - 1) * 2, 20)         -- household factor, capped at 20
```

**Raises:** `'P0002'` with message `'Request not found: <id>'` if `p_request_id` does not exist.

**Who may EXECUTE:** `role_admin`, `role_agency_manager` (called internally by triggers and `sp_recompute_priorities`).

**Tables read:** `help_requests`, `requesters`, `requester_vulnerabilities`, `vulnerability_types`.

**File:** `db/03_functions/03a_priority.sql`

---

### `sp_suggest_shelter`

```
sp_suggest_shelter(
    p_request_id  INT
) RETURNS TABLE(
    shelter_id   INT,
    free_beds    INT,
    district     TEXT
)
```

**Purpose:** Returns shelters (in the same district as the request, if possible, then wider) ordered by most free capacity. Used by the UI to present a recommendation before the agency manager calls `sp_allocate_shelter_bed`.

**Raises:** Nothing (returns empty set if no shelters available).

**Who may EXECUTE:** `role_admin`, `role_agency_manager`.

**Tables read:** `shelters`, `help_requests`.

**File:** `db/03_functions/03c_helpers.sql`

---

## Stored Procedures (write operations — each runs its own transaction internally or within a caller-supplied transaction)

> **Node rule:** caller opens `BEGIN` on a dedicated pool client, calls the procedure, then `COMMIT` or `ROLLBACK`. The client is released in `finally`. This is mandatory so that `SELECT ... FOR UPDATE` row locks are held until commit.

---

### `sp_recompute_priorities`

```
sp_recompute_priorities() RETURNS INT
```

**Purpose:** Calls `compute_priority_score` for every PENDING request and writes the result to `help_requests.priority_score`. Returns the count of rows updated.

**Raises:** Nothing (idempotent batch job).

**Who may EXECUTE:** `role_admin`.

**Tables touched:** `help_requests` (UPDATE).

**File:** `db/03_functions/03a_priority.sql`

---

### `sp_allocate_shelter_bed`

```
sp_allocate_shelter_bed(
    p_request_id    INT,
    p_shelter_id    INT,
    p_beds          INT,
    p_allocated_by  INT   -- app_users.user_id
) RETURNS INT             -- allocation_id of the new row
```

**Purpose:** Atomically reserves `p_beds` beds in `p_shelter_id` for `p_request_id`.

**Steps (in this order to avoid deadlocks):**
1. Lock `help_requests` row (`SELECT ... FOR UPDATE`).
2. Lock `shelters` row (`SELECT ... FOR UPDATE`).
3. Validate: request status = 'PENDING'; shelter status = 'OPEN'; free beds ≥ `p_beds`.
4. INSERT into `allocations`.
5. Trigger handles `shelters.current_occupancy` increment and audit log.

**Raises:**
- `'P0001'` `'Request <id> is not in PENDING status'`
- `'P0001'` `'Shelter <id> does not have enough free beds'`
- `'P0001'` `'Shelter <id> is CLOSED or FULL'`

**Isolation level:** `READ COMMITTED` (default) with `FOR UPDATE` is sufficient.

**Who may EXECUTE:** `role_admin`, `role_agency_manager`.

**Tables touched:** `help_requests` (SELECT FOR UPDATE), `shelters` (SELECT FOR UPDATE), `allocations` (INSERT).

**File:** `db/03_functions/03b_allocation_procedures.sql`

---

### `sp_assign_volunteer`

```
sp_assign_volunteer(
    p_request_id    INT,
    p_volunteer_id  INT,
    p_allocated_by  INT
) RETURNS INT             -- allocation_id
```

**Purpose:** Assigns a volunteer to a request. Lock order: `help_requests` → `volunteers`.

**Raises:**
- `'P0001'` `'Volunteer <id> is not AVAILABLE'`
- `'P0001'` `'Request <id> is not in PENDING status'`

**Who may EXECUTE:** `role_admin`, `role_agency_manager`.

**Tables touched:** `help_requests` (FOR UPDATE), `volunteers` (FOR UPDATE), `allocations` (INSERT).

**File:** `db/03_functions/03b_allocation_procedures.sql`

---

### `sp_allocate_resource`

```
sp_allocate_resource(
    p_request_id    INT,
    p_inventory_id  INT,
    p_quantity      INT,
    p_allocated_by  INT
) RETURNS INT             -- allocation_id
```

**Purpose:** Decrements `resource_inventory.quantity_available` by `p_quantity` and creates an allocation row. Lock order: `help_requests` → `resource_inventory`.

**Raises:**
- `'P0001'` `'Insufficient stock in inventory <id>: requested <q>, available <a>'`
- `'P0001'` `'Request <id> is not in PENDING status'`

**Who may EXECUTE:** `role_admin`, `role_agency_manager`.

**Tables touched:** `help_requests` (FOR UPDATE), `resource_inventory` (FOR UPDATE), `allocations` (INSERT).

**File:** `db/03_functions/03b_allocation_procedures.sql`

---

### `sp_complete_allocation`

```
sp_complete_allocation(
    p_allocation_id  INT,
    p_user_id        INT
) RETURNS VOID
```

**Purpose:** Marks allocation as COMPLETED. Trigger fires to restore beds/stock/volunteer slot and update request status to COMPLETED.

**Raises:**
- `'P0001'` `'Allocation <id> is not ACTIVE'`

**Who may EXECUTE:** `role_admin`, `role_agency_manager`, `role_volunteer` (own allocations only — enforced via RLS in `06_roles_and_grants.sql`).

**Tables touched:** `allocations` (UPDATE), triggers update `shelters`, `resource_inventory`, `volunteers`, `allocation_audit_log`.

**File:** `db/03_functions/03b_allocation_procedures.sql`

---

### `sp_cancel_allocation`

```
sp_cancel_allocation(
    p_allocation_id  INT,
    p_user_id        INT
) RETURNS VOID
```

**Purpose:** Cancels an ACTIVE allocation and releases the resource (beds freed, stock restored, volunteer set back to AVAILABLE).

**Raises:**
- `'P0001'` `'Allocation <id> is not ACTIVE'`

**Who may EXECUTE:** `role_admin`, `role_agency_manager`.

**Tables touched:** `allocations` (UPDATE), triggers restore `shelters`, `resource_inventory`, `volunteers`, `allocation_audit_log`.

**File:** `db/03_functions/03b_allocation_procedures.sql`

---

## Duplicate-request guard

```
fn_check_duplicate_request()  -- TRIGGER FUNCTION, not callable directly
```

**Purpose:** BEFORE INSERT trigger on `help_requests`. Blocks insertion if the same `requester_id` (or same `phone` via join to `requesters`) has a PENDING or ALLOCATED request of the same `request_type` created within the last **6 hours**.

**Raises:** `'P0001'` `'Duplicate request detected: request <existing_id> already open for this requester and type'`

**File:** `db/04_triggers/04_triggers.sql`

---

## Trigger functions (not directly callable)

These are used internally by triggers defined in `04_triggers.sql`:

| Trigger function | Event | Purpose |
|---|---|---|
| `fn_sync_shelter_occupancy()` | AFTER INSERT/UPDATE/DELETE on `allocations` | Recalculates `shelters.current_occupancy` from live allocation data; updates `shelters.status` |
| `fn_sync_inventory()` | AFTER INSERT/UPDATE/DELETE on `allocations` | Adjusts `resource_inventory.quantity_available`; fires stock alert if below threshold |
| `fn_sync_volunteer_status()` | AFTER INSERT/UPDATE/DELETE on `allocations` | Sets `volunteers.availability_status` to ASSIGNED or AVAILABLE |
| `fn_audit_allocation()` | AFTER INSERT/UPDATE on `allocations` | Appends row to `allocation_audit_log` |
| `fn_validate_allocation()` | BEFORE INSERT/UPDATE on `allocations` | Checks capacity, stock, valid status transitions |
| `fn_check_duplicate_request()` | BEFORE INSERT on `help_requests` | Blocks duplicate requests |
| `fn_update_request_status()` | AFTER INSERT/UPDATE on `allocations` | Moves `help_requests.status` from PENDING → ALLOCATED → COMPLETED |
| `fn_set_updated_at()` | BEFORE UPDATE on `help_requests` | Sets `updated_at = NOW()` |
| `fn_flag_low_stock()` | AFTER UPDATE on `resource_inventory` | Inserts `stock_alerts` row when quantity falls below threshold |
