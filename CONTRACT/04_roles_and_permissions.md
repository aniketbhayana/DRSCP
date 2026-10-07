# CONTRACT/04 — Roles and Permissions

> **STATUS: APPROVED & FROZEN (2026-10-07).**
> Owner of implementation: **Person C** (`db/06_roles/06_roles_and_grants.sql`).
> Any future modifications require a formal Change Request logged in CHANGELOG.md.

---

## PostgreSQL roles defined

| DB Role | Maps to app `role` | Description |
|---|---|---|
| `role_admin` | ADMIN | Full access; disaster coordinator |
| `role_agency_manager` | AGENCY_MANAGER | Manages shelters and volunteers for their agency |
| `role_volunteer` | VOLUNTEER | Sees and marks own assignments |
| `role_requester` | REQUESTER | Submits requests and views own status |

> The Node backend connects as a single superuser for admin actions **only during startup** (running migrations). Runtime queries run as these roles using `SET LOCAL ROLE` inside the transaction, or by assigning role-specific connection pool users.

---

## Permissions matrix

Legend: ✅ allowed · ❌ denied · 🔒 Row-Level Security (own rows only)

### Tables

| Table | role_admin | role_agency_manager | role_volunteer | role_requester |
|---|---|---|---|---|
| `agencies` | SELECT, INSERT, UPDATE, DELETE | SELECT | SELECT | ❌ |
| `app_users` | SELECT, INSERT, UPDATE, DELETE | SELECT (own agency) | SELECT (self) | SELECT (self) |
| `vulnerability_types` | ALL | SELECT | SELECT | SELECT |
| `requesters` | ALL | SELECT, INSERT, UPDATE | SELECT | SELECT 🔒 INSERT |
| `requester_vulnerabilities` | ALL | SELECT, INSERT | ❌ | SELECT 🔒 |
| `help_requests` | ALL | SELECT, INSERT, UPDATE | SELECT | SELECT 🔒 INSERT |
| `shelters` | ALL | SELECT, UPDATE | SELECT | SELECT |
| `resource_types` | ALL | SELECT | SELECT | ❌ |
| `resource_inventory` | ALL | SELECT | SELECT | ❌ |
| `volunteers` | ALL | SELECT, UPDATE (own agency) | SELECT 🔒 UPDATE (self) | ❌ |
| `allocations` | ALL | SELECT, INSERT, UPDATE | SELECT 🔒 UPDATE (own) | SELECT 🔒 |
| `allocation_audit_log` | SELECT | SELECT | ❌ | ❌ |
| `stock_alerts` | ALL | SELECT, UPDATE | ❌ | ❌ |

---

### Views

| View | role_admin | role_agency_manager | role_volunteer | role_requester |
|---|---|---|---|---|
| `v_urgent_requests_ranked` | SELECT | SELECT | ❌ | ❌ |
| `v_shelter_capacity` | SELECT | SELECT | SELECT | ❌ |
| `v_inventory_status` | SELECT | SELECT | ❌ | ❌ |
| `v_volunteer_availability` | SELECT | SELECT | ❌ | ❌ |
| `v_allocation_history` | SELECT | SELECT | ❌ | ❌ |
| `v_my_assignments` | SELECT | SELECT | SELECT 🔒 | ❌ |
| `v_my_requests` | SELECT | SELECT | ❌ | SELECT 🔒 |

---

### Functions and Procedures (EXECUTE privilege)

| Function / Procedure | role_admin | role_agency_manager | role_volunteer | role_requester |
|---|---|---|---|---|
| `compute_priority_score` | ✅ | ✅ | ❌ | ❌ |
| `sp_recompute_priorities` | ✅ | ❌ | ❌ | ❌ |
| `sp_allocate_shelter_bed` | ✅ | ✅ | ❌ | ❌ |
| `sp_assign_volunteer` | ✅ | ✅ | ❌ | ❌ |
| `sp_allocate_resource` | ✅ | ✅ | ❌ | ❌ |
| `sp_complete_allocation` | ✅ | ✅ | ✅ (own) | ❌ |
| `sp_cancel_allocation` | ✅ | ✅ | ❌ | ❌ |
| `sp_suggest_shelter` | ✅ | ✅ | ❌ | ❌ |

---

## Row-Level Security (RLS) policies

To be implemented in `06_roles_and_grants.sql` using `CREATE POLICY ... USING (...)`.

| Table | Policy name | Role | Condition |
|---|---|---|---|
| `help_requests` | `req_own_requests` | role_requester | `requester_id = current_setting('app.current_requester_id')::int` |
| `allocations` | `vol_own_allocations` | role_volunteer | `volunteer_id = current_setting('app.current_volunteer_id')::int` |
| `requesters` | `req_own_profile` | role_requester | `requester_id = current_setting('app.current_requester_id')::int` |

> The Node middleware must call `SET LOCAL app.current_requester_id = $1` (or volunteer_id) inside the transaction so Postgres can evaluate the policy. This is part of the session-variable handshake between the app and the DB.

---

## Privilege principle

**Least privilege:** Each role has exactly the rights it needs. The agency manager can never see other agencies' private data. Volunteers cannot read the full audit log. Requesters cannot see other requesters' records. Admins have full access for coordination and oversight.
