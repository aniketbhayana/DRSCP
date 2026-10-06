# Normalization Document — DRSCP
**Owner: Person A | Status: PLACEHOLDER — Phase 1**

Content to write here:
1. Functional dependencies for each table
2. 1NF proof (atomic values, no repeating groups)
3. 2NF proof (no partial dependencies on composite PKs)
4. 3NF proof (no transitive dependencies)
5. Justified denormalization:
   - `shelters.current_occupancy` — trigger-maintained, avoids aggregate on every dashboard query; guarded by CHECK constraint
   - `help_requests.priority_score` — recomputed by trigger or batch procedure; needed for indexed sort in the urgent-queue view
