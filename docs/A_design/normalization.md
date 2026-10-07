# DRSCP: Database Normalization Document (1NF → 2NF → 3NF & BCNF)

**Course:** BCSE302P — Database Systems Lab  
**Track:** T2: Emergency & Disaster Resilience  
**Author:** Person A (Design & Schema Lead)  
**Status:** Approved & Implemented (Phase 1)  

---

## 1. Executive Summary & Methodology

Database normalization is the formal process of structuring a relational database in accordance with a series of normal forms to:
1. **Eliminate data redundancy**, minimizing storage waste and inconsistent copies.
2. **Prevent operational anomalies** (Insertion, Update, and Deletion anomalies).
3. **Enforce relational data integrity** via mathematically verifiable functional dependencies.

In emergency dispatch and disaster response platforms like **DRSCP**, unnormalized schemas lead to fatal failure modes:
- *Update anomaly:* If a shelter's total capacity or contact phone is duplicated across every bed allocation, updating that number during a crisis can leave conflicting figures across rows, causing double-allocation.
- *Deletion anomaly:* If a volunteer's identity and medical qualification are stored only within an allocation row, cancelling an allocation would inadvertently erase the volunteer's record from the registry.
- *Insertion anomaly:* If relief supplies are tied directly to an active incident, warehouse inventory cannot be cataloged before an emergency occurs.

This document formally demonstrates how the DRSCP schema was derived from a Universal Relation (UNF), decomposed through **1NF**, **2NF**, and **3NF**, evaluated under **BCNF**, and where controlled, trigger-guarded denormalizations were deliberately introduced.

---

## 2. Universal Relation & Functional Dependency Notation

Let the Universal Relation $U$ represent the complete collection of attributes in an unnormalized disaster coordination system:

$$U = \{ \text{agency\_id}, \text{agency\_name}, \text{agency\_type}, \text{agency\_phone}, \text{agency\_email}, \text{shelter\_id}, \text{shelter\_name}, \text{shelter\_address}, \text{district}, \text{total\_capacity}, \text{current\_occupancy}, \text{shelter\_status}, \text{resource\_type\_id}, \text{resource\_name}, \text{category}, \text{unit}, \text{inventory\_id}, \text{quantity\_available}, \text{reorder\_threshold}, \text{volunteer\_id}, \text{volunteer\_name}, \text{volunteer\_phone}, \text{skill}, \text{avail\_status}, \text{requester\_id}, \text{requester\_name}, \text{requester\_phone}, \text{age}, \text{gender}, \text{address}, \text{vuln\_types}, \text{request\_id}, \text{request\_type}, \text{req\_status}, \text{priority\_score}, \text{household\_size}, \text{location\_text}, \text{alloc\_id}, \text{beds\_allocated}, \text{quantity\_dispensed}, \text{alloc\_status}, \text{user\_id}, \text{username}, \text{role}, \dots \}$$

### Functional Dependency ($X \rightarrow Y$)
A functional dependency $X \rightarrow Y$ holds over relation $R$ if and only if whenever two tuples agree on attribute set $X$, they must also agree on attribute set $Y$.

---

## 3. First Normal Form (1NF)

### 3.1 Formal Definition
A relation $R$ is in **1NF** if and only if:
1. The domain of each attribute contains only **atomic (indivisible) values**.
2. There are **no repeating groups** or multi-valued attributes (e.g., CSV lists or arrays).
3. Every tuple can be uniquely identified by a primary key.

### 3.2 1NF Violations in Naive Disaster Schemas & DRSCP Decomposition
- **Vulnerabilities Repeating Group:** A citizen frequently possesses multiple conditions (e.g., *Elderly*, *Chronic Illness*, *Wheelchair*). Storing this as `"ELDERLY, CHRONIC_ILLNESS"` inside `requesters.vulnerabilities` violates atomicity.
  - *Decomposition:* Extracted into an associative junction table `requester_vulnerabilities(requester_id, vuln_type_id)` where each row holds exactly one atomic relationship.
- **Relief Allocations Multiplexing:** A help request may receive multiple items (e.g., water, shelter, medicine). Rather than storing comma-delimited allocations on `help_requests`, each allocation event is modeled as a distinct tuple in `allocations`.
- **Attribute Atomicity:** Names, timestamps, contact numbers, and geographic districts are maintained as scalar atomic data types (`VARCHAR`, `INT`, `TIMESTAMPTZ`, `NUMERIC`).

**Conclusion:** All 13 tables in DRSCP strictly satisfy **1NF**.

---

## 4. Second Normal Form (2NF)

### 4.1 Formal Definition
A relation $R$ is in **2NF** if and only if:
1. It is in **1NF**.
2. Every non-prime attribute is **fully functionally dependent** on the entire candidate key (i.e., no partial dependencies on any proper subset of a composite candidate key).

### 4.2 Analysis of Relations with Composite Keys
In DRSCP, only one table possesses a composite primary key:
- **`requester_vulnerabilities`**:
  - Primary Key: $\{\text{requester\_id}, \text{vuln\_type\_id}\}$
  - Prime attributes: $\{\text{requester\_id}, \text{vuln\_type\_id}\}$
  - Non-prime attributes: None ($\emptyset$).
  - *Proof:* Because there are zero non-prime attributes, partial dependency is mathematically impossible. Thus, `requester_vulnerabilities` is in 2NF.

### 4.3 Relations with Single-Attribute Primary Keys
All remaining 12 tables in DRSCP have single-column primary keys (`agency_id`, `shelter_id`, `volunteer_id`, `request_id`, `allocation_id`, etc.):
- By mathematical definition, a proper subset of a single-attribute key is the empty set ($\emptyset$), which cannot functionally determine any attribute.
- Therefore, partial dependency cannot exist in any relation with a single-attribute candidate key.

**Conclusion:** All 13 tables in DRSCP strictly satisfy **2NF**.

---

## 5. Third Normal Form (3NF)

### 5.1 Formal Definition
A relation $R$ is in **3NF** if and only if:
1. It is in **2NF**.
2. For every non-trivial functional dependency $X \rightarrow A$ in $R$, at least one of the following conditions holds:
   - $X$ is a **superkey** of $R$, OR
   - $A$ is a **prime attribute** (part of a candidate key).

Equivalently, there are **no transitive dependencies** of non-prime attributes on any candidate key ($PK \rightarrow Y \rightarrow A$, where $A$ is non-prime and $Y$ is not a candidate key).

### 5.2 Table-by-Table Functional Dependencies & Proof

#### 1. `agencies`
- **Candidate Keys:** $\{\text{agency\_id}\}$, $\{\text{name}\}$, $\{\text{contact\_email}\}$
- **Primary Key:** `agency_id`
- **Functional Dependencies:**
  - $\text{agency\_id} \rightarrow \{\text{name}, \text{agency\_type}, \text{contact\_phone}, \text{contact\_email}, \text{created\_at}\}$
  - $\text{name} \rightarrow \{\text{agency\_id}, \text{agency\_type}, \text{contact\_phone}, \text{contact\_email}, \text{created\_at}\}$
  - $\text{contact\_email} \rightarrow \{\text{agency\_id}, \text{name}, \text{agency\_type}, \text{contact\_phone}, \text{created\_at}\}$
- *3NF Proof:* For all FDs, the left-hand side is a superkey. No transitive dependencies. **Satisfies 3NF.**

#### 2. `vulnerability_types`
- **Candidate Keys:** $\{\text{vuln\_type\_id}\}$, $\{\text{name}\}$
- **Primary Key:** `vuln_type_id`
- **Functional Dependencies:**
  - $\text{vuln\_type\_id} \rightarrow \{\text{name}, \text{weight}, \text{description}\}$
  - $\text{name} \rightarrow \{\text{vuln\_type\_id}, \text{weight}, \text{description}\}$
- *3NF Proof:* Left-hand sides are superkeys. No transitive dependencies. **Satisfies 3NF.**

#### 3. `requesters`
- **Candidate Key:** $\{\text{requester\_id}\}$
- **Primary Key:** `requester_id`
- **Functional Dependencies:**
  - $\text{requester\_id} \rightarrow \{\text{full\_name}, \text{phone}, \text{age}, \text{gender}, \text{address}, \text{district}, \text{created\_at}\}$
- *3NF Proof:* The LHS is the primary key. Attributes like `district` are independent descriptive properties of the citizen's residential zone, not determined by phone or name. **Satisfies 3NF.**

#### 4. `requester_vulnerabilities`
- **Candidate Key:** $\{\text{requester\_id}, \text{vuln\_type\_id}\}$
- **Primary Key:** $(\text{requester\_id}, \text{vuln\_type\_id})$
- **Functional Dependencies:**
  - $\{\text{requester\_id}, \text{vuln\_type\_id}\} \rightarrow \emptyset$
- *3NF Proof:* All attributes are prime. **Satisfies 3NF.**

#### 5. `resource_types`
- **Candidate Keys:** $\{\text{resource\_type\_id}\}$, $\{\text{name}\}$
- **Primary Key:** `resource_type_id`
- **Functional Dependencies:**
  - $\text{resource\_type\_id} \rightarrow \{\text{name}, \text{category}, \text{unit}\}$
  - $\text{name} \rightarrow \{\text{resource\_type\_id}, \text{category}, \text{unit}\}$
- *3NF Proof:* The LHS is a superkey. Category does not determine unit (e.g. food can be in packets or kg). **Satisfies 3NF.**

#### 6. `shelters`
- **Candidate Key:** $\{\text{shelter\_id}\}$
- **Primary Key:** `shelter_id`
- **Functional Dependencies:**
  - $\text{shelter\_id} \rightarrow \{\text{agency\_id}, \text{name}, \text{address}, \text{district}, \text{total\_capacity}, \text{created\_at}\}$
- *Note on Denormalization:* `current_occupancy` and `status` are discussed in Section 7.
- *3NF Proof:* Agency details (`agency_name`, `contact_phone`) are not duplicated here; only the foreign key `agency_id` is present. No transitive dependencies like $\text{shelter\_id} \rightarrow \text{agency\_id} \rightarrow \text{agency\_phone}$ exist in the table. **Satisfies 3NF.**

#### 7. `resource_inventory`
- **Candidate Keys:** $\{\text{inventory\_id}\}$, $\{\text{shelter\_id}, \text{resource\_type\_id}\}$
- **Primary Key:** `inventory_id`
- **Functional Dependencies:**
  - $\text{inventory\_id} \rightarrow \{\text{shelter\_id}, \text{resource\_type\_id}, \text{quantity\_available}, \text{reorder\_threshold}, \text{last\_updated}\}$
  - $\{\text{shelter\_id}, \text{resource\_type\_id}\} \rightarrow \{\text{inventory\_id}, \text{quantity\_available}, \text{reorder\_threshold}, \text{last\_updated}\}$
- *3NF Proof:* Both LHS sets are superkeys. Stock is specific to the shelter and resource pair. **Satisfies 3NF.**

#### 8. `volunteers`
- **Candidate Key:** $\{\text{volunteer\_id}\}$
- **Primary Key:** `volunteer_id`
- **Functional Dependencies:**
  - $\text{volunteer\_id} \rightarrow \{\text{agency\_id}, \text{full\_name}, \text{phone}, \text{skill}, \text{created\_at}\}$
- *3NF Proof:* LHS is superkey. Agency contact attributes reside in `agencies`. **Satisfies 3NF.**

#### 9. `app_users`
- **Candidate Keys:** $\{\text{user\_id}\}$, $\{\text{username}\}$
- **Primary Key:** `user_id`
- **Functional Dependencies:**
  - $\text{user\_id} \rightarrow \{\text{username}, \text{password\_hash}, \text{role}, \text{agency\_id}, \text{volunteer\_id}, \text{requester\_id}, \text{created\_at}\}$
  - $\text{username} \rightarrow \{\text{user\_id}, \text{password\_hash}, \text{role}, \text{agency\_id}, \text{volunteer\_id}, \text{requester\_id}, \text{created\_at}\}$
- *3NF Proof:* Both LHS sets are candidate superkeys. **Satisfies 3NF.**

#### 10. `help_requests`
- **Candidate Key:** $\{\text{request\_id}\}$
- **Primary Key:** `request_id`
- **Functional Dependencies:**
  - $\text{request\_id} \rightarrow \{\text{requester\_id}, \text{request\_type}, \text{status}, \text{household\_size}, \text{location\_text}, \text{district}, \text{description}, \text{created\_at}, \text{updated\_at}\}$
- *Note on Denormalization:* `priority_score` is discussed in Section 7.
- *3NF Proof:* Citizen demographics remain in `requesters(requester_id)`. **Satisfies 3NF.**

#### 11. `allocations`
- **Candidate Key:** $\{\text{allocation\_id}\}$
- **Primary Key:** `allocation_id`
- **Functional Dependencies:**
  - $\text{allocation\_id} \rightarrow \{\text{request\_id}, \text{shelter\_id}, \text{volunteer\_id}, \text{resource\_type\_id}, \text{quantity}, \text{beds\_allocated}, \text{status}, \text{allocated\_by}, \text{allocated\_at}, \text{completed\_at}\}$
- *3NF Proof:* LHS is candidate superkey. Target entity details are referenced strictly by foreign keys. **Satisfies 3NF.**

#### 12. `allocation_audit_log`
- **Candidate Key:** $\{\text{log\_id}\}$
- **Primary Key:** `log_id`
- **Functional Dependencies:**
  - $\text{log\_id} \rightarrow \{\text{allocation\_id}, \text{action}, \text{old\_status}, \text{new\_status}, \text{changed\_by}, \text{changed\_at}, \text{details}\}$
- *3NF Proof:* Append-only historical ledger where each log sequence is uniquely identified by `log_id`. **Satisfies 3NF.**

#### 13. `stock_alerts`
- **Candidate Key:** $\{\text{alert\_id}\}$
- **Primary Key:** `alert_id`
- **Functional Dependencies:**
  - $\text{alert\_id} \rightarrow \{\text{inventory\_id}, \text{message}, \text{created\_at}, \text{resolved}\}$
- *3NF Proof:* LHS is candidate superkey. Inventory stock details reside in `resource_inventory`. **Satisfies 3NF.**

---

## 6. Boyce-Codd Normal Form (BCNF) Analysis

A relation $R$ is in **BCNF** if for every non-trivial functional dependency $X \rightarrow Y$, $X$ is a **superkey**.

- In all DRSCP tables, every determinant ($X$) in every functional dependency is either the Primary Key or an Alternate Candidate Key (`UNIQUE` column).
- There are no overlapping candidate keys with non-prime determinants.
- **Result:** The normalized foundation of DRSCP is in **BCNF**.

---

## 7. Justified, Controlled Denormalizations

In real-world emergency management systems, strictly theoretical 3NF/BCNF designs can introduce prohibitive I/O and locking overhead during life-critical search queries. DRSCP introduces exactly **two controlled denormalizations**, both strictly guarded by database-layer constraints and automated trigger logic:

### 7.1 `shelters.current_occupancy` and `shelters.status`
- **Theoretical 3NF Approach:** Compute on read using:
  $$\text{current\_occupancy} = \sum_{\text{alloc}} \text{beds\_allocated} \quad (\text{WHERE } \text{status} = \text{'ACTIVE'} \land \text{shelter\_id} = s)$$
- **Why Denormalized:**
  1. *Dashboard Query Latency:* During a flood crisis, hundreds of citizens and response teams concurrently query shelter availability (`WHERE status = 'OPEN'`). Computing a full dynamic aggregate across thousands of historical allocation rows on every page refresh saturates CPU and database connections.
  2. *Hard Relational Invariant Enforcement:* A database `CHECK` constraint cannot contain a subquery. By holding `current_occupancy` as an explicit column, PostgreSQL can enforce the hard invariant:
     ```sql
     CONSTRAINT chk_shelters_occupancy_limit CHECK (current_occupancy <= total_capacity)
     ```
  3. *Concurrency Control:* Allows atomic row-level locking (`SELECT ... FOR UPDATE` on `shelters`) during bed booking without table-level locking on `allocations`.
- **Integrity Safeguard:**
  - Updated *exclusively* via database triggers on `allocations` (`INSERT`, `UPDATE of status`, `DELETE`).
  - Automatic status flip to `'FULL'` when $\text{current\_occupancy} = \text{total\_capacity}$.

### 7.2 `help_requests.priority_score`
- **Theoretical 3NF Approach:** Calculate dynamically during query execution by joining `help_requests` with `requester_vulnerabilities` and `vulnerability_types`.
- **Why Denormalized:**
  1. *Queue Triage Indexing:* The emergency triage queue must display incoming requests ordered by urgency:
     ```sql
     SELECT * FROM help_requests WHERE status = 'PENDING' ORDER BY priority_score DESC, created_at ASC;
     ```
     Dynamically computing scores prevents the query planner from using an index-range scan, forcing a full table scan and in-memory sort ($O(N \log N)$) on every poll.
  2. *Composite Index Utilization:* Storing `priority_score` enables the high-speed composite B-Tree index:
     ```sql
     CREATE INDEX idx_help_requests_triage ON help_requests(status, priority_score DESC, district);
     ```
- **Integrity Safeguard:**
  - Maintained by deterministic stored procedure `compute_priority_score(p_request_id)` and triggers on request submission and vulnerability updates.

---

## 8. Summary Table of Normal Forms

| Table | Candidate Keys | Normal Form | Intentional Denormalization | Guard Mechanism |
|---|---|---|---|---|
| `agencies` | `agency_id`, `name`, `contact_email` | 3NF / BCNF | None | Primary / Unique Keys |
| `vulnerability_types` | `vuln_type_id`, `name` | 3NF / BCNF | None | Primary / Unique Keys |
| `requesters` | `requester_id` | 3NF / BCNF | None | Primary Key |
| `requester_vulnerabilities` | `(requester_id, vuln_type_id)` | 3NF / BCNF | None | Composite Primary Key |
| `resource_types` | `resource_type_id`, `name` | 3NF / BCNF | None | Primary / Unique Keys |
| `shelters` | `shelter_id` | Controlled 3NF | `current_occupancy`, `status` | Trigger + `CHECK (occupancy <= capacity)` |
| `resource_inventory` | `inventory_id`, `(shelter_id, resource_type_id)` | Controlled 3NF | `quantity_available` | Trigger + `CHECK (qty >= 0)` |
| `volunteers` | `volunteer_id` | Controlled 3NF | `availability_status` | Trigger on Allocation |
| `app_users` | `user_id`, `username` | 3NF / BCNF | None | Primary / Unique Keys |
| `help_requests` | `request_id` | Controlled 3NF | `priority_score` | Trigger + Composite Index |
| `allocations` | `allocation_id` | 3NF / BCNF | None | Primary Key |
| `allocation_audit_log` | `log_id` | 3NF / BCNF | None | Primary Key |
| `stock_alerts` | `alert_id` | 3NF / BCNF | None | Primary Key |
