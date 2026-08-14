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
run supabase/migrations/0026_rekap_publik.sql
run supabase/migrations/0027_rekap_penuh.sql
run supabase/migrations/0028_kelengkapan_pos.sql
run supabase/migrations/0029_pesan_rentang.sql
run supabase/migrations/0030_komponen_per_golongan.sql
run supabase/migrations/0031_tolak_komponen_golongan_lain.sql
run supabase/seed.sql
run tests/sql/01_seed_uji.sql
run tests/sql/02_constraints.sql
run tests/sql/03_alur.sql
run tests/sql/04_cetak_kloter.sql
run tests/sql/05_pindah_kloter.sql
run tests/sql/06_koreksi_jam_berangkat.sql
run tests/sql/07_pindah_setelah_berangkat.sql

# 0024 dijalankan DUA KALI, dan itu disengaja.
#
# Ia mengubah DATA edisi, bukan hanya bentuk tabel. Pada giliran pertama
# (di atas, sesuai nomornya) seed.sql belum jalan, jadi belum ada edisi aktif
# dan bagian datanya dilewati — persis seperti yang tertulis di kepalanya.
# Kalau ia hanya dijalankan di sana, seluruh konfigurasi komponen pos tidak
# pernah tersentuh tes sama sekali.
#
# 0025 TIDAK ikut dijalankan ulang. Nama Pos 0 dan Pos 5 sekarang sudah ada di
# seed.sql, jadi tidak ada lagi yang perlu diulang — dan mengulangnya justru
# gagal, karena 0026 sudah menambah kolom ke view yang sama dan Postgres
# menolak menghapus kolom dari view.
#
# Giliran kedua di sini, setelah 02-07 selesai memakai lima komponen contoh
# dari seed.sql. Urutan itu penting: dijalankan lebih awal, komponen contoh
# yang belum berisi nilai akan dibuang dan tes 03 kehilangan bahannya.
#
# Menjalankannya dua kali sekaligus membuktikan migrasinya memang aman
# diulang — yang perlu dipastikan, karena workflow Apply migration bisa saja
# ditekan dua kali dari HP.
run supabase/migrations/0024_komponen_pos.sql
run tests/sql/08_lembar_pos.sql
run tests/sql/09_rekap_publik.sql
# 10 dijalankan di ujung, dan itu perlu: ia membandingkan rekap panitia
# dengan v_poin_pos, v_total_skor, dan v_klasemen, jadi ia butuh database yang
# sudah berisi nilai, keberangkatan, dan closing dari seluruh tes di atasnya.
run tests/sql/10_rekap_penuh.sql
run tests/sql/11_kelengkapan_pos.sql
# 12 butuh komponen Pos 1 yang sebenarnya (kepramukaan_keagamaan,
# rentang 0-20), yang baru ada setelah 0024 dijalankan giliran kedua.
run tests/sql/12_pesan_rentang.sql
# 0032 mengganti SELURUH konfigurasi penilaian satu edisi, dan sengaja
# menolak bekerja bila sudah ada nilai tersimpan. Dijalankan di sini,
# setelah database uji penuh nilai, supaya penolakan itu ikut terbukti —
# dan supaya tes 02-12 tetap memakai konfigurasi yang mereka andalkan.
run supabase/migrations/0032_konfigurasi_xxxvii.sql
run tests/sql/13_komponen_per_golongan.sql

echo "SEMUA TES LULUS"
