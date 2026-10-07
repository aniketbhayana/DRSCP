# Triggers Explained — Person B

**File:** `docs/B_logic/triggers_explained.md`
**Owner:** Person B

---

## Why triggers?

In DRSCP, the database is the decision-making layer. Any application — whether
Node, a psql session, or a future mobile app — that INSERTs or UPDATEs
allocations automatically gets:
- Correct shelter occupancy (no manual UPDATE needed)
- Volunteer status synced
- Inventory decremented
- Audit trail written

Triggers guarantee this happens **even if someone bypasses the stored procedures
and writes SQL directly**.

---

## Trigger 1 — `trg_set_updated_at` (BEFORE UPDATE on help_requests)

**What it does:** Sets `updated_at = NOW()` on every UPDATE to `help_requests`.

**Why:** Without it, every caller would have to remember `SET updated_at = NOW()`.
A BEFORE trigger is the right place because we modify `NEW` before the row is
written — no extra UPDATE is needed.

**Expo explanation:** "Every time a request record changes, the database itself
stamps the time. No application code can forget to do it."

---

## Trigger 2 — `trg_block_duplicate_request` (BEFORE INSERT on help_requests)

**What it does:** Calls `fn_is_duplicate_request()`. If the same person already
has an open PENDING or ALLOCATED request of the same type within the last 60
minutes, the INSERT is rejected with SQLSTATE P0010.

**Why:** During a disaster, panicked people often submit the same request
multiple times. Duplicates waste capacity. The 60-minute window is configurable.

**Expo explanation:** "If you accidentally submit the same request twice, the
database catches it and throws a clear error — your second click does nothing."

---

## Trigger 3 — `trg_validate_alloc_before` (BEFORE INSERT OR UPDATE on allocations)

**What it does:**
- Rule A: Rejects any allocation row that has no shelter_id, volunteer_id,
  or resource_type_id. Every allocation must have a clear purpose.
- Rule B: Prevents terminal-state changes — a COMPLETED or CANCELLED allocation
  cannot be changed back to ACTIVE.

**Why:** These are invariants that the application layer cannot enforce reliably
because direct SQL inserts are possible.

**Expo explanation:** "The database enforces that no allocation can be in a
contradictory state — completed work cannot be un-done through the data layer."

---

## Trigger 4 — `trg_sync_occupancy` (AFTER INSERT OR UPDATE OR DELETE on allocations)

**What it does:** After any change to the `allocations` table, recomputes
`shelters.current_occupancy` as the SUM of `beds_allocated` for all ACTIVE
bed-allocations for that shelter.

**Why:** `current_occupancy` is a **denormalized column** (justified in
normalization.md). It is faster to query than a live COUNT(*), but it must be
kept in sync. The trigger is the single source of truth for this sync.

**Expo explanation:** "When a bed is allocated, the shelter's occupied-bed count
goes up by itself. When the allocation is cancelled, it goes back down. The app
never has to compute this — the database handles it."

---

## Trigger 5 — `trg_sync_volunteer_status` (AFTER INSERT OR UPDATE OR DELETE on allocations)

**What it does:** Flips `volunteers.availability_status` between AVAILABLE and
ASSIGNED whenever a volunteer allocation is inserted or completed/cancelled.

**Why:** Same denormalization justification as `current_occupancy`. The UI needs
to quickly filter available volunteers without a correlated subquery.

---

## Trigger 6 — `trg_sync_inventory` (AFTER INSERT OR UPDATE OR DELETE on allocations)

**What it does:** Decrements `resource_inventory.quantity_available` when a
resource allocation is created (ACTIVE). Restores it when the allocation is
COMPLETED or CANCELLED.

**Why:** Inventory is the source of truth. Keeping it live prevents over-allocation
of physical goods.

---

## Trigger 7 — `trg_check_low_stock` (AFTER UPDATE on resource_inventory)

**What it does:** If `quantity_available` drops to or below `reorder_threshold`,
inserts a row into `stock_alerts`. Does NOT insert a duplicate alert if one is
already open for that inventory item.

**Why:** Operations staff need to be notified when stock is running low during
a disaster. A database-level alert means the warning exists even if the UI is
not open.

---

## Trigger 8 — `trg_audit_allocation` (AFTER INSERT OR UPDATE on allocations)

**What it does:** For every INSERT (action = CREATED) and every UPDATE (action =
COMPLETED / CANCELLED / UPDATED), writes a row to `allocation_audit_log` with
old status, new status, the operator's user_id, timestamp, and a JSONB details
blob.

**Why:** Full auditability is a project requirement. Every allocation state change
must be queryable. The JSONB field gives flexibility to store extra context.

**Expo explanation:** "Every single allocation change is logged forever. The audit
viewer shows exactly who did what, and when."

---

## Trigger 9 — `trg_set_priority_on_insert` (AFTER INSERT on help_requests)

**What it does:** Immediately after a new `help_requests` row is saved, calls
`compute_priority_score()` and writes the result back into `priority_score`.

**Why:** Without this, a new request would have `priority_score = NULL` until
someone manually calls `sp_recompute_priorities()`. With this trigger, the ranked
queue is sortable from the very first second.

---

## BEFORE vs AFTER — why each trigger uses what it does

| Trigger | Type | Reason |
|---------|------|--------|
| trg_set_updated_at | BEFORE UPDATE | Modifies `NEW` before the write |
| trg_block_duplicate | BEFORE INSERT | Must abort the INSERT before it happens |
| trg_validate_alloc | BEFORE INSERT/UPDATE | Must abort invalid ops |
| trg_sync_occupancy | AFTER INSERT/UPDATE/DELETE | Needs the committed allocation row to be visible |
| trg_sync_volunteer | AFTER INSERT/UPDATE/DELETE | Same — reads finalized state |
| trg_sync_inventory | AFTER INSERT/UPDATE/DELETE | Same |
| trg_check_low_stock | AFTER UPDATE | Reads the updated quantity |
| trg_audit_allocation | AFTER INSERT/UPDATE | Reads OLD and NEW both present |
| trg_set_priority | AFTER INSERT | Needs request_id to be assigned |
