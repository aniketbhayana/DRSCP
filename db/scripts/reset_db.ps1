# =============================================================================
# DRSCP: reset_db.ps1 — Drop and recreate the database, run all SQL in order.
# Owner: Person A
# Usage: .\db\scripts\reset_db.ps1
#        Set $env:DB_NAME, $env:DB_USER, $env:DB_HOST, $env:DB_PORT as needed,
#        or edit the defaults below.
# Requires: psql on PATH (PostgreSQL client tools installed).
# =============================================================================

$ErrorActionPreference = "Stop"

$DB_NAME = if ($env:DB_NAME) { $env:DB_NAME } else { "drscp" }
$DB_USER = if ($env:DB_USER) { $env:DB_USER } else { "postgres" }
$DB_HOST = if ($env:DB_HOST) { $env:DB_HOST } else { "localhost" }
$DB_PORT = if ($env:DB_PORT) { $env:DB_PORT } else { "5432" }

# Resolve project root (two levels up from db/scripts/)
$ROOT = (Resolve-Path "$PSScriptRoot\..\..")

function Invoke-Psql {
    param([string]$Database, [string]$File = $null, [string]$Command = $null)
    $args_list = @("-v", "ON_ERROR_STOP=1", "-h", $DB_HOST, "-p", $DB_PORT, "-U", $DB_USER, "-d", $Database)
    if ($File)    { $args_list += @("-f", $File) }
    if ($Command) { $args_list += @("-c", $Command) }
    & psql @args_list
    if ($LASTEXITCODE -ne 0) { throw "psql failed with exit code $LASTEXITCODE" }
}

Write-Host "==> Dropping and recreating database: $DB_NAME"
Invoke-Psql -Database "postgres" -Command "DROP DATABASE IF EXISTS $DB_NAME;"
Invoke-Psql -Database "postgres" -Command "CREATE DATABASE $DB_NAME;"

$files = @(
    "$ROOT\db\01_schema\01_schema.sql",
    "$ROOT\db\02_seed\02a_seed_small.sql",
    "$ROOT\db\03_functions\03a_priority.sql",
    "$ROOT\db\03_functions\03b_allocation_procedures.sql",
    "$ROOT\db\03_functions\03c_helpers.sql",
    "$ROOT\db\04_triggers\04_triggers.sql",
    "$ROOT\db\05_views\05_views.sql",
    "$ROOT\db\06_roles\06_roles_and_grants.sql"
)

foreach ($f in $files) {
    Write-Host "==> Running $([System.IO.Path]::GetFileName($f))"
    Invoke-Psql -Database $DB_NAME -File $f
}

Write-Host ""
Write-Host "✅  Database '$DB_NAME' is ready."
