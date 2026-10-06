#!/usr/bin/env bash
# =============================================================================
# DRSCP: reset_db.sh — Drop and recreate the database, run all SQL in order.
# Owner: Person A
# Usage: bash db/scripts/reset_db.sh
#        Set DB_NAME, DB_USER, DB_HOST, DB_PORT via environment or edit below.
# =============================================================================

set -e  # Exit on first error

DB_NAME="${DB_NAME:-drscp}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
PSQL="psql -v ON_ERROR_STOP=1 -h $DB_HOST -p $DB_PORT -U $DB_USER"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

echo "==> Dropping and recreating database: $DB_NAME"
$PSQL -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;"
$PSQL -d postgres -c "CREATE DATABASE $DB_NAME;"

echo "==> Running 01_schema.sql"
$PSQL -d $DB_NAME -f "$ROOT/db/01_schema/01_schema.sql"

echo "==> Running 02a_seed_small.sql"
$PSQL -d $DB_NAME -f "$ROOT/db/02_seed/02a_seed_small.sql"

echo "==> Running 03a_priority.sql"
$PSQL -d $DB_NAME -f "$ROOT/db/03_functions/03a_priority.sql"

echo "==> Running 03b_allocation_procedures.sql"
$PSQL -d $DB_NAME -f "$ROOT/db/03_functions/03b_allocation_procedures.sql"

echo "==> Running 03c_helpers.sql"
$PSQL -d $DB_NAME -f "$ROOT/db/03_functions/03c_helpers.sql"

echo "==> Running 04_triggers.sql"
$PSQL -d $DB_NAME -f "$ROOT/db/04_triggers/04_triggers.sql"

echo "==> Running 05_views.sql"
$PSQL -d $DB_NAME -f "$ROOT/db/05_views/05_views.sql"

echo "==> Running 06_roles_and_grants.sql"
$PSQL -d $DB_NAME -f "$ROOT/db/06_roles/06_roles_and_grants.sql"

echo ""
echo "✅  Database '$DB_NAME' is ready."
