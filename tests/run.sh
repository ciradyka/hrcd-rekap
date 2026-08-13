#!/usr/bin/env bash
# ============================================================================
# hrcd-rekap : tests/run.sh
# Jalankan seluruh migrasi + seed + tes di database lokal sekali pakai.
#
# Pakai:
#   PSQL=/path/ke/psql PGHOST=127.0.0.1 PGPORT=55432 PGUSER=postgres \
#   PGPASSWORD=... bash tests/run.sh
#
# Database hrcd_test di-drop dan dibuat ulang setiap kali — aman diulang.
# ============================================================================
set -euo pipefail

PSQL="${PSQL:-psql}"
export PGHOST="${PGHOST:-127.0.0.1}" PGPORT="${PGPORT:-55432}" PGUSER="${PGUSER:-postgres}"
DB=hrcd_test
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
run supabase/migrations/0008_cetak_kloter.sql
run supabase/migrations/0009_sisip_kloter.sql
run supabase/migrations/0010_lookup_finish.sql
run supabase/migrations/0011_nomor_dada_manual.sql
run supabase/migrations/0012_rename_audit_columns.sql
run supabase/migrations/0013_nama_kontak.sql
run supabase/migrations/0014_rename_common_columns.sql
run supabase/migrations/0015_v_kwitansi_column.sql
run supabase/seed.sql
run tests/sql/01_seed_uji.sql
run tests/sql/02_constraints.sql
run tests/sql/03_alur.sql
run tests/sql/04_cetak_kloter.sql
run tests/sql/05_pindah_kloter.sql

echo "SEMUA TES LULUS"
