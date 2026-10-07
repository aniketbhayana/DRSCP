# Procedures Explained — Person B

**File:** `docs/B_logic/procedures_explained.md`
**Owner:** Person B

---

## Design principle

Every write operation that can cause a **race condition** (two operators doing the
same thing at the same time) is wrapped in a stored procedure with
`SELECT ... FOR UPDATE`. The Node backend opens a `BEGIN` block on a dedicated
connection, calls the procedure, and `COMMIT`s. If anything goes wrong, it
`ROLLBACK`s. The connection is released in a `finally` block. This is mandatory
— if the connection is shared, the row locks are released prematurely.

---

## compute_priority_score(p_request_id INT) → NUMERIC(8,2)

**Purpose:** Return a numeric priority score for one help request.

**Formula:**
```
score = SUM(vulnerability_weight for each flag on the requester)
      + LEAST(minutes_waiting / 10, 50)
      + request_type_urgency  (RESCUE=40, MEDICAL=35, EVACUATION=30, WATER=20, FOOD=15)
      + LEAST((household_size - 1) × 2, 20)
```

**Table-driven weights:** The vulnerability weights come from the
`vulnerability_types` table, not from hard-coded constants. This means the
evaluator could change "PREGNANT" from weight 30 to weight 40 by running one
UPDATE, and every subsequent call to `compute_priority_score` would use the new
weight — no code change required.

**Expo:** "We don't hard-code who is more important. The weights live in the
database, so a relief coordinator can adjust them for a specific disaster type
without touching any code."

---

## sp_recompute_priorities() → INT

**Purpose:** Bulk-refresh `priority_score` for all PENDING requests. Returns
the count of rows updated.

**When to call:** On-demand (e.g., the agency manager clicks "Refresh Rankings")
or on a schedule. Also useful after changing vulnerability weights.

**Expo:** "If we change the weights table, one function call updates the rankings
for all pending requests immediately."

---

## sp_allocate_shelter_bed(request_id, shelter_id, beds, allocated_by) → INT

**Purpose:** Atomically assign N beds in a shelter to a PENDING request.

**Lock order:**
1. `SELECT ... FOR UPDATE` on `help_requests` row
2. `SELECT ... FOR UPDATE` on `shelters` row

**Checks:**
- Request must be PENDING (raises P0003)
- Shelter must be ACTIVE (raises P0004)
- Free beds = total_capacity − current_occupancy ≥ beds requested (raises P0005)

**Returns:** `allocation_id` of the new row.

**Expo:** "When an operator clicks 'Allocate Bed', the database locks the shelter
row so no one else can take the same bed at the same moment. If the shelter is
full by the time the lock is acquired, the request is rejected with a clear
error."

---

## sp_assign_volunteer(request_id, volunteer_id, allocated_by) → INT

**Purpose:** Assign an AVAILABLE volunteer to a PENDING request.

**Lock order:** `help_requests` first, then `volunteers`.

**Checks:**
- Request PENDING (raises P0003)
- Volunteer AVAILABLE (raises P0006)

**Expo:** "Same concurrency guarantee: if two operators both try to assign the
same volunteer, only one succeeds."

---

## sp_allocate_resource(request_id, inventory_id, quantity, allocated_by) → INT

**Purpose:** Deduct N units of a resource from inventory and link it to a request.

**Lock order:** `help_requests` first, then `resource_inventory`.

**Checks:**
- Request PENDING (raises P0003)
- Inventory exists (raises P0007)
- Stock ≥ quantity (raises P0008)

**Side effect:** The `trg_sync_inventory` trigger decrements
`resource_inventory.quantity_available`. The `trg_check_low_stock` trigger may
create a `stock_alerts` row.

---

## sp_complete_allocation(allocation_id, user_id) → VOID

**Purpose:** Mark an ACTIVE allocation as COMPLETED. Release the resource
(bed, volunteer, or stock) back to the pool.

**How release works:** The AFTER UPDATE trigger `trg_sync_occupancy` /
`trg_sync_volunteer_status` / `trg_sync_inventory` fires automatically — the
procedure does not need to update shelters or volunteers directly.

**Side effect:** If no other ACTIVE allocations exist on the request, the request
is also marked COMPLETED.

---

## sp_cancel_allocation(allocation_id, user_id) → VOID

**Purpose:** Cancel an ACTIVE allocation (e.g., incorrect allocation, request
withdrawn). Releases the resource. If no other ACTIVE allocations remain on the
request, it reverts to PENDING for re-allocation.

**Expo:** "Cancelling a bed allocation automatically frees the bed and puts the
request back in the pending queue — no manual cleanup needed."

---

## sp_suggest_shelter(request_id) → TABLE(shelter_id, shelter_name, free_beds, district, pct_full)

**Purpose:** Return shelters ranked for a given request. Same-district shelters
are ranked first (because moving people locally is faster); then by most free
capacity (load-balancing to avoid crowding one shelter while others sit empty).

**No locks:** This is a read-only recommendation. The actual allocation still
goes through `sp_allocate_shelter_bed` with FOR UPDATE.

**Expo:** "Before an operator allocates a bed, the UI shows a ranked list of
the best shelters. This prevents all operators from always picking the same
shelter and accidentally overloading it."

---

## fn_is_duplicate_request(...) → BOOLEAN

**Purpose:** Check whether a very similar request already exists (same
requester by ID or phone, same request_type, still open, within 60 minutes).

**Called by:** The BEFORE INSERT trigger `trg_block_duplicate_request`.
It is a separate function so it can be unit-tested without inserting a row.

---

## Lock ordering — why it matters

| Procedure | Lock 1 | Lock 2 |
|---|---|---|
| sp_allocate_shelter_bed | help_requests (request_id ASC) | shelters (shelter_id ASC) |
| sp_assign_volunteer | help_requests | volunteers |
| sp_allocate_resource | help_requests | resource_inventory |
| sp_complete_allocation | allocations | — |
| sp_cancel_allocation | allocations | — |

**Rule:** All procedures lock `help_requests` first. A deadlock requires a
circular dependency — A waits for B, B waits for A. Because everyone locks in
the same order, this circle is impossible.
