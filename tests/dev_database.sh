#!/usr/bin/env bash
# ============================================================================
# hrcd-rekap : tests/dev_database.sh — siapkan database hrcd_dev untuk dev server.
# Sama seperti run.sh tapi TANPA data tes 02/03 — database bersih berisi
# konfigurasi edisi + akun uji, siap dipakai layar.
#   PSQL=/path/ke/psql PGPASSWORD=... bash tests/dev_database.sh
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
# Seluruh migrasi, urut nomor, tanpa dilewat satu pun. Daftar ini pernah
# berhenti di 0011 sementara migrasinya sudah sampai 0020 — akibatnya layar
# yang dicoba di dev berbicara dengan skema yang tidak pernah ada di
# produksi, dan galatnya baru muncul setelah deploy.
for m in "$ROOT"/supabase/migrations/*.sql; do
  run "supabase/migrations/$(basename "$m")"
done
run supabase/seed.sql
# Konfigurasi pos butuh edisinya sudah ada — lihat catatan panjang yang sama
# di tests/run.sh.
run supabase/migrations/0024_komponen_pos.sql
run tests/sql/01_seed_uji.sql

# Akun uji lahir SESUDAH 0057 dijalankan di atas, jadi INSERT pengisi hak
# di dalam migrasi itu tidak kebagian satu baris pun — di tests/run.sh
# urutannya kebalikannya dan tidak kelihatan. Diisi di sini dengan
# paket_peran() yang SAMA, supaya dev dan produksi tidak pernah memakai
# dua daftar hak yang berbeda.
"$PSQL" -d "$DB" -v ON_ERROR_STOP=1 -q -c "
  insert into akun_hak (user_id, fitur)
  select a.user_id, f from akun_panitia a, unnest(paket_peran(a.peran)) f
  on conflict do nothing;"

echo "hrcd_dev siap — akun: admin.ciradyka / meja1hrcd37 / pos1hrcd37 (password bebas di dev)"
