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
run supabase/migrations/0016_nama_edisi_romawi.sql
run supabase/migrations/0017_koreksi_jam_berangkat.sql
run supabase/migrations/0018_pindah_setelah_berangkat.sql
run supabase/migrations/0019_tukar_nomor_patokan_cetak.sql
run supabase/migrations/0020_nomor_dada_tiga_digit.sql
run supabase/migrations/0021_pos_bayangan.sql
run supabase/migrations/0022_bentuk_bertingkat.sql
run supabase/migrations/0023_lembar_pos.sql
run supabase/migrations/0024_komponen_pos.sql
run supabase/migrations/0025_pos_keberangkatan_kedatangan.sql
run supabase/seed.sql
run tests/sql/01_seed_uji.sql
run tests/sql/02_constraints.sql
run tests/sql/03_alur.sql
run tests/sql/04_cetak_kloter.sql
run tests/sql/05_pindah_kloter.sql
run tests/sql/06_koreksi_jam_berangkat.sql
run tests/sql/07_pindah_setelah_berangkat.sql

# 0024 dan 0025 dijalankan DUA KALI, dan itu disengaja.
#
# Keduanya mengubah DATA edisi, bukan hanya bentuk tabel. Pada giliran pertama
# (di atas, sesuai nomornya) seed.sql belum jalan, jadi belum ada edisi aktif
# dan bagian datanya dilewati — persis seperti yang tertulis di kepala
# masing-masing. Kalau keduanya hanya dijalankan di sana, seluruh konfigurasi
# pos tidak pernah tersentuh tes sama sekali.
#
# Giliran kedua di sini, setelah 02-07 selesai memakai lima komponen contoh
# dari seed.sql. Urutan itu penting: dijalankan lebih awal, komponen contoh
# yang belum berisi nilai akan dibuang dan tes 03 kehilangan bahannya.
#
# Menjalankannya dua kali sekaligus membuktikan migrasinya memang aman
# diulang — yang perlu dipastikan, karena workflow Apply migration bisa saja
# ditekan dua kali dari HP.
run supabase/migrations/0024_komponen_pos.sql
run supabase/migrations/0025_pos_keberangkatan_kedatangan.sql
run tests/sql/08_lembar_pos.sql

echo "SEMUA TES LULUS"
