# CONTRACT/03 — API Endpoints

> **STATUS: DRAFT – awaiting Day 0 team approval.**
> Owner of implementation: **Person C** (`backend/`).
> After approval, changes require a Change Request in CHANGELOG.md.

---

## Base URL

`http://localhost:5000/api`  (configurable via `backend/.env → PORT`)

## Auth

- `POST /api/auth/login` returns a **JWT** (24-hour expiry).
- All other endpoints require `Authorization: Bearer <token>`.
- The middleware extracts `user_id` and `role` from the token and attaches to `req.user`.

## Role abbreviations used below

| Abbrev | DB role | App role value |
|---|---|---|
| ADM | role_admin | 'ADMIN' |
| AGM | role_agency_manager | 'AGENCY_MANAGER' |
| VOL | role_volunteer | 'VOLUNTEER' |
| REQ | role_requester | 'REQUESTER' |

---

## Authentication

### `POST /api/auth/login`
| Field | Value |
|---|---|
| Auth required | No |
| Request body | `{ "username": string, "password": string }` |
| Response 200 | `{ "token": "<jwt>", "user": { "user_id", "username", "role" } }` |
| Response 401 | `{ "error": "Invalid credentials" }` |
| DB call | Direct query: `SELECT * FROM app_users WHERE username = $1` |

---

## Requests

### `POST /api/requests`
| Field | Value |
|---|---|
| Auth required | Yes |
| Allowed roles | REQ, ADM, AGM |
| Request body | `{ "requester_id": int, "request_type": string, "household_size": int, "location_text": string, "district": string, "description": string }` |
| Response 201 | `{ "request_id": int, "priority_score": number, "status": "PENDING" }` |
| DB call | INSERT into `help_requests`; call `compute_priority_score(request_id)` |
| Notes | Duplicate-request guard trigger fires on INSERT |

### `GET /api/requests`
| Field | Value |
|---|---|
| Allowed roles | ADM, AGM |
| Query params | `?status=PENDING&district=Chennai&limit=50&offset=0` |
| Response 200 | Array of request rows (with requester name, vulnerability flags) |
| DB call | Query `help_requests` with joins to `requesters` |

### `GET /api/requests/urgent`
| Field | Value |
|---|---|
| Allowed roles | ADM, AGM |
| Response 200 | Array from view `v_urgent_requests_ranked` (top 50 PENDING by priority) |
| DB call | `SELECT * FROM v_urgent_requests_ranked LIMIT 50` |

### `GET /api/requests/:id`
| Field | Value |
|---|---|
| Allowed roles | ADM, AGM; REQ (own request only) |
| Response 200 | Full request row with allocations |
| Response 404 | `{ "error": "Not found" }` |

### `PATCH /api/requests/:id/cancel`
| Field | Value |
|---|---|
| Allowed roles | ADM, AGM |
| Request body | `{}` |
| Response 200 | `{ "status": "CANCELLED" }` |
| DB call | UPDATE `help_requests` status → CANCELLED |

---

## Allocations

### `POST /api/allocations/bed`
| Field | Value |
|---|---|
| Allowed roles | ADM, AGM |
| Request body | `{ "request_id": int, "shelter_id": int, "beds": int }` |
| Response 201 | `{ "allocation_id": int }` |
| Response 409 | `{ "error": "<procedure error message>" }` |
| DB call | `SELECT sp_allocate_shelter_bed($1,$2,$3,$4)` inside `BEGIN/COMMIT` |

### `POST /api/allocations/volunteer`
| Field | Value |
|---|---|
| Allowed roles | ADM, AGM |
| Request body | `{ "request_id": int, "volunteer_id": int }` |
| Response 201 | `{ "allocation_id": int }` |
| DB call | `SELECT sp_assign_volunteer($1,$2,$3)` inside `BEGIN/COMMIT` |

### `POST /api/allocations/resource`
| Field | Value |
|---|---|
| Allowed roles | ADM, AGM |
| Request body | `{ "request_id": int, "inventory_id": int, "quantity": int }` |
| Response 201 | `{ "allocation_id": int }` |
| DB call | `SELECT sp_allocate_resource($1,$2,$3,$4)` inside `BEGIN/COMMIT` |

### `POST /api/allocations/:id/complete`
| Field | Value |
|---|---|
| Allowed roles | ADM, AGM, VOL (own) |
| Response 200 | `{ "status": "COMPLETED" }` |
| DB call | `SELECT sp_complete_allocation($1,$2)` |

### `POST /api/allocations/:id/cancel`
| Field | Value |
|---|---|
| Allowed roles | ADM, AGM |
| Response 200 | `{ "status": "CANCELLED" }` |
| DB call | `SELECT sp_cancel_allocation($1,$2)` |

---

## Shelters

### `GET /api/shelters`
| Field | Value |
|---|---|
| Allowed roles | ADM, AGM |
| Query params | `?district=Chennai` |
| Response 200 | Array from view `v_shelter_capacity` |

### `GET /api/shelters/suggest`
| Field | Value |
|---|---|
| Allowed roles | ADM, AGM |
| Query params | `?request_id=<int>` |
| Response 200 | Rows from `sp_suggest_shelter($1)` |

---

## Volunteers

### `GET /api/volunteers`
| Field | Value |
|---|---|
| Allowed roles | ADM, AGM |
| Query params | `?status=AVAILABLE&skill=MEDICAL` |
| Response 200 | Array from view `v_volunteer_availability` |

### `GET /api/volunteers/me`
| Field | Value |
|---|---|
| Allowed roles | VOL |
| Response 200 | Allocations assigned to the logged-in volunteer |

---

## Inventory

### `GET /api/inventory`
| Field | Value |
|---|---|
| Allowed roles | ADM, AGM |
| Response 200 | Array from view `v_inventory_status` (with low-stock flag) |

---

## Audit

### `GET /api/audit`
| Field | Value |
|---|---|
| Allowed roles | ADM |
| Query params | `?allocation_id=<int>&from=<ISO>&to=<ISO>` |
| Response 200 | Rows from view `v_allocation_history` |

---

## Error format (all endpoints)

```json
{ "error": "<human-readable message>", "code": "<optional PG SQLSTATE>" }
```

HTTP status mapping:
| PostgreSQL SQLSTATE / condition | HTTP status |
|---|---|
| `P0001` (RAISE EXCEPTION in procedure) | 409 Conflict |
| `23505` unique violation | 409 Conflict |
| `23503` FK violation | 400 Bad Request |
| `42501` insufficient privilege | 403 Forbidden |
| Not found (0 rows) | 404 Not Found |
| Anything else | 500 Internal Server Error |
