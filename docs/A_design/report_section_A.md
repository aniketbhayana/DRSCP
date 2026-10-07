# Report Section A — Design and Schema

**Person A** | BCSE302P Database Systems Lab | DRSCP Project  
**Track:** T2: Emergency & Disaster Resilience / Evacuation & Rescue Coordination  

---

## 1. What Was Built & Files Delivered

Person A owns the entire database foundation, conceptual/logical data architecture, normalization proofs, schema DDL, constraint engineering, indexing strategies, and disaster scenario seed datasets.

### Deliverables Summary

| File | Purpose | Normalization / Invariant Role |
|------|---------|--------------------------------|
| `CONTRACT/01_entities_and_columns.md` | Frozen data contract across the 3-person team | Single source of truth for all 13 tables & column types |
| `docs/A_design/er_diagram.mmd` | Mermaid ER/EER diagram | Visualizes cardinalities, PK/FKs, and trigger-maintained attributes |
| `docs/A_design/normalization.md` | Mathematical 3NF & BCNF proof | Formal functional dependency decomposition & denormalization guards |
| `docs/A_design/schema_justification.md` | Architectural justification | Deep-dive into design decisions, types, constraints, and indexes |
| `db/01_schema/01_schema.sql` | Idempotent PostgreSQL DDL | Drops & creates all 13 tables, PKs, FKs, CHECKs, and B-Tree indexes |
| `db/02_seed/02a_seed_small.sql` | Small cohesive seed dataset | Chennai Cyclone Michaung scenario (pre-calculated trigger columns) |
| `db/02_seed/02b_seed_full.sql` | Full enterprise stress dataset | 8 agencies, 12 shelters, 60+ volunteers, 100+ requests |
| `db/scripts/reset_db.ps1` & `.sh` | Automated DB provisioning runner | Drops, recreates, and executes all 8 SQL files in strict order |

---

## 2. Conceptual and Relational Data Architecture

### 2.1 The 13 Core Entities
DRSCP coordinates three mission-critical relief workflows: **people seeking rescue**, **physical shelter capacity**, and **tactical resource distribution**.

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

### 2.2 Key Structural Decisions
1. **Decoupling `requesters` from `app_users`:**  
   During an active flood or cyclone, victims calling emergency hotlines (e.g., 1070/1077) or arriving at a rescue camp do not possess smartphones or accounts. Call operators log distress requests directly into `requesters`. Citizens who later register can optionally link their profile via `app_users.requester_id`.
2. **Unified Polymorphic `allocations` Table:**  
   Instead of fragmenting the database into three separate tables (`shelter_allocations`, `volunteer_dispatches`, `supply_grants`), DRSCP unifies them into a single `allocations` entity with nullable FKs (`shelter_id`, `volunteer_id`, `resource_type_id`). This unifies the lifecycle state machine (`ACTIVE` $\rightarrow$ `COMPLETED` / `CANCELLED`) and channels all transitions into a single append-only audit ledger (`allocation_audit_log`).
3. **Table-Driven Vulnerability Matrix (`vulnerability_types`):**  
   Demographic triage weights (e.g., PREGNANT=30, DISABLED=25, ELDERLY=20) are stored in a lookup relation rather than hard-coded into SQL functions, allowing disaster authorities to adapt priorities in real-time.

---

## 3. Normalization Walkthrough (1NF → 2NF → 3NF & BCNF)

The schema was systematically derived and decomposed:

- **1NF Compliance:**  
  - Eliminates repeating groups: citizen vulnerabilities are not stored as comma-separated text or arrays; they are decomposed into the associative entity `requester_vulnerabilities(requester_id, vuln_type_id)`.
  - All attributes have atomic domains (`VARCHAR`, `INT`, `TIMESTAMPTZ`, `NUMERIC`).
- **2NF Compliance:**  
  - In all 12 single-column PK tables, partial dependency on a proper subset of candidate keys is impossible.
  - In the only composite PK table, `requester_vulnerabilities(requester_id, vuln_type_id)`, all attributes are prime, making partial functional dependencies mathematically impossible.
- **3NF & BCNF Compliance:**  
  - For every non-trivial functional dependency $X \rightarrow Y$, $X$ is a candidate superkey.
  - No transitive dependencies exist (e.g., agency contact phone is not duplicated inside `shelters`; only `agency_id` is referenced).

### Controlled Denormalization & Engine-Level Guardrails
DRSCP deliberately denormalizes two columns for operational speed:
1. **`shelters.current_occupancy`:**  
   - *Why:* Computing `SUM(beds_allocated) FROM allocations WHERE status = 'ACTIVE'` across high-frequency dashboard queries creates high CPU overhead. Holding the balance as a column allows instant reads.
   - *Engine Guard:* Enforces the hard relational invariant:
     ```sql
     CONSTRAINT chk_shelters_occupancy_limit CHECK (current_occupancy <= total_capacity)
     ```
   - Maintained automatically by Person B's trigger `trg_sync_occupancy`.
2. **`help_requests.priority_score`:**  
   - *Why:* Computing scores dynamically joining 4 tables prevents B-Tree index scans. Denormalizing it enables index-range scans:
     ```sql
     CREATE INDEX idx_help_requests_triage ON help_requests(status, priority_score DESC, district);
     ```

---

## 4. Constraint Engineering & Invariants

All data integrity rules are enforced directly within PostgreSQL:
- **Capacity Boundaries:** `CHECK (total_capacity > 0)`, `CHECK (current_occupancy >= 0)`.
- **Zero Negative Inventory:** `CHECK (quantity_available >= 0)` on `resource_inventory`.
- **Sensible Demographics:** `CHECK (age BETWEEN 0 AND 120)` on `requesters`.
- **Household Limits:** `CHECK (household_size >= 1)` on `help_requests`.
- **Domain Whitelists:** Explicit `CHECK (col IN (...))` constraints for statuses, roles, and categories.

---

## 5. Performance Indexing Strategy

1. **Foreign Key Indexes:**  
   PostgreSQL does not index foreign keys by default. We created explicit B-Tree indexes on every FK column (`idx_alloc_request`, `idx_alloc_shelter`, `idx_inventory_shelter`, etc.) to eliminate full table sequential scans during multi-table joins and cascading foreign key integrity checks.
2. **Composite Triage Index:**  
   `idx_help_requests_triage` ON `help_requests(status, priority_score DESC, district)` reduces dispatch queue retrieval from $O(N \log N)$ disk sort to $O(\log N)$ index scan.
3. **Partial Index for System Alerts:**  
   `CREATE INDEX idx_stock_alerts_unresolved ON stock_alerts(resolved) WHERE resolved = FALSE;`  
   Indexes only open alerts, keeping the index small and resident in cache as resolved alerts grow over time.

---

## 6. Seed Data Design (Realistic Chennai Relief Scenario)

Both seed datasets emulate Cyclone Michaung emergency operations across Chennai, Chengalpattu, and Kanchipuram:
- Seed records in `02a_seed_small.sql` have hand-calculated values for trigger-maintained columns (`current_occupancy = 7` at Velachery camp for requests #1 and #8; priority scores calculated via the exact formula).
- This ensures early development testing was 100% valid even before Person B's triggers were loaded.
