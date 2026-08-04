#!/usr/bin/env bash
# ============================================================================
# hrcd-rekap : tests/dev_db.sh — siapkan database hrcd_dev untuk dev server.
# Sama seperti run.sh tapi TANPA data tes 02/03 — database bersih berisi
# konfigurasi edisi + akun uji, siap dipakai layar.
#   PSQL=/path/ke/psql PGPASSWORD=... bash tests/dev_db.sh
# ============================================================================
set -euo pipefail

PSQL="${PSQL:-psql}"
export PGHOST="${PGHOST:-127.0.0.1}" PGPORT="${PGPORT:-55432}" PGUSER="${PGUSER:-postgres}"
DB=hrcd_dev
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

"$PSQL" -d postgres -v ON_ERROR_STOP=1 -q \
  -c "drop database if exists $DB;" \
  -c "create database $DB;"

run() { echo "-- $1"; "$PSQL" -d "$DB" -v ON_ERROR_STOP=1 -q -f "$ROOT/$1"; }

run tests/sql/00_harness.sql
run supabase/migrations/0001_schema.sql
run supabase/migrations/0002_functions.sql
run supabase/migrations/0003_rls.sql
run supabase/migrations/0004_rpcs.sql
run supabase/migrations/0005_views.sql
run supabase/migrations/0006_idempotensi.sql
run supabase/migrations/0007_kunci_daftar_ulang.sql
run supabase/seed.sql
run tests/sql/01_seed_uji.sql

echo "hrcd_dev siap — akun: admin.ciradyka / meja1hrcd37 / pos1hrcd37 (password bebas di dev)"
