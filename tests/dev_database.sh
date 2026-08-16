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
# Konfigurasi pos edisi 37 (0032-0039) DIJALANKAN ULANG di sini, dan itu
# perlu. Di glob di atas mereka berjalan sebelum seed.sql sempat membuat
# edisi 37, jadi tidak menemukan apa-apa dan diam-diam tidak melakukan apa
# pun — dev lalu memakai konfigurasi pos edisi LAMA (Games, Kostum) sementara
# produksi memakai yang baru (Halang Rintang, PBB, Yel-yel). Perbedaan itu
# tidak menggagalkan apa pun; ia cuma membuat layar yang dicoba di dev
# berbicara tentang pos yang tidak ada di produksi.
#
# 0033 melewati dirinya sendiri kalau edisinya sudah memuat nilai, jadi ini
# harus di ATAS 01_seed_uji.sql maupun pengisi nilai mana pun.
for m in 0032_konfigurasi_xxxvii 0033_nama_pos_xxxvii 0034_nama_pos_final          0035_tangga_menaksir 0036_kriteria_bidai 0037_petunjuk_kolom          0038_petunjuk_menaksir 0039_judul_isian; do
  run "supabase/migrations/$m.sql"
done
# Constraint peran dilonggarkan SEBENTAR. Seed akun uji sengaja memakai nama
# peran lama (meja, operator_pos), karena di tests/run.sh ia berjalan lebih
# dulu lalu 0058 memindahkannya — itulah yang menguji migrasinya terhadap
# database yang sudah berisi. Di sini 0058 sudah lewat di glob, jadi
# constraint barunya menolak nama lama; dipasang kembali oleh 0058 yang
# dijalankan ulang tepat di bawah.
"$PSQL" -d "$DB" -v ON_ERROR_STOP=1 -q -c   "alter table akun_panitia drop constraint akun_panitia_peran_check;
   alter table akun_panitia drop constraint akun_panitia_check;"
run tests/sql/01_seed_uji.sql

# 0058 DIJALANKAN ULANG, dan seed akun di atas sengaja masih memakai nama
# peran LAMA (meja, operator_pos). Alasannya: di tests/run.sh seed berjalan
# lebih dulu lalu 0058 memindahkannya — itu yang menguji migrasinya terhadap
# database yang sudah berisi. Kalau seed diganti memakai nama baru, jalur itu
# hilang dan yang teruji tinggal database kosong.
#
# 0058 sekaligus menulis ulang akun_hak dari paket_peran(), jadi tidak perlu
# langkah pengisi terpisah di sini.
run supabase/migrations/0058_peran_per_pekerjaan.sql

echo "hrcd_dev siap — akun: admin.ciradyka / meja1hrcd37 / pos1hrcd37 (password bebas di dev)"
