#!/usr/bin/env bash
# ============================================================================
# hrcd-rekap : status_migrasi_check.sh — menguji PEMERIKSANYA, bukan database.
#
# `supabase/checks/status_migrasi.sql` menjawab "migrasi mana yang isinya sudah
# ada di produksi?" dengan mencari JEJAK tiap migrasi. Sebuah jejak yang salah
# lebih berbahaya daripada tidak ada jejak: ia melapor ADA untuk migrasi yang
# tidak pernah dijalankan, dan pertanyaannya ikut tertutup.
#
# Jadi yang diuji di sini dua arah, bukan satu:
#
#   1. sesudah migrasi N dijalankan, jejak N berbunyi ADA
#   2. SEBELUM migrasi N dijalankan, jejak N berbunyi BELUM
#
# Arah kedua yang biasanya hilang. Tanpa itu, `select true as jejak` lulus.
#
# Caranya: database dibangun dari nol mengikuti urutan tests/run.sh, dan
# pemeriksanya dijalankan sesudah SETIAP migrasi. Untuk tiap nomor dicatat di
# langkah keberapa ia pertama kali berbunyi ADA; kalau bukan di langkahnya
# sendiri, itu jejak yang salah dan skrip ini gagal.
#
# Lambat (beberapa menit) dan karena itu TIDAK ikut tests/run.sh. Jalankan saat
# menambah atau mengubah jejak.
#
#   PSQL=/c/Program\ Files/PostgreSQL/18/bin/psql.exe PGPORT=5432 \
#   PGPASSWORD=... bash tests/status_migrasi_check.sh
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PSQL="${PSQL:-psql}"
DB="${DB:-hrcd_status_check}"
PEMERIKSA="$ROOT/supabase/checks/status_migrasi.sql"
KERJA="$(mktemp -d)"
trap 'rm -rf "$KERJA"' EXIT

"$PSQL" -d postgres -v ON_ERROR_STOP=1 -q \
  -c "drop database if exists $DB;" -c "create database $DB;"

# Urutan tests/run.sh apa adanya: beberapa migrasi menuntut data yang dipasang
# berkas tes sebelumnya (0146 menuntut ada akun berhak live_score).
grep '^run ' "$ROOT/tests/run.sh" | awk '{print $2}' > "$KERJA/urutan.txt"

# Untuk tiap nomor: langkah keberapa ia pertama kali ADA.
: > "$KERJA/pertama.txt"
langkah=0

while read -r berkas; do
  [ -z "$berkas" ] && continue
  "$PSQL" -d "$DB" -v ON_ERROR_STOP=1 -q -f "$ROOT/$berkas" > "$KERJA/log.txt" 2>&1 || {
    echo "GAGAL menjalankan $berkas:"; tail -5 "$KERJA/log.txt"; exit 1; }

  case "$berkas" in
    supabase/migrations/*) ;;
    *) continue ;;
  esac
  langkah="$(basename "$berkas" | cut -c1-4)"

  "$PSQL" -d "$DB" -t -A -F'|' -v ON_ERROR_STOP=1 -f "$PEMERIKSA" \
    > "$KERJA/status.txt" 2>&1 || { echo "pemeriksa gagal di $langkah"; tail -5 "$KERJA/status.txt"; exit 1; }

  # baris bagian 1 berbentuk: nomor|ADA|jejak
  awk -F'|' -v L="$langkah" '$2 == "ADA" && $1 ~ /^[0-9]{4}$/ { print $1, L }' \
    "$KERJA/status.txt" >> "$KERJA/semua_ada.txt"
done < "$KERJA/urutan.txt"

# Pertama kali tiap nomor berbunyi ADA.
sort -k1,1 -k2,2 "$KERJA/semua_ada.txt" | awk '!(seen[$1]++)' > "$KERJA/pertama.txt"

gagal=0
while read -r nomor pertama; do
  if [ "$nomor" != "$pertama" ]; then
    echo "JEJAK SALAH: $nomor sudah berbunyi ADA sejak langkah $pertama"
    gagal=$((gagal + 1))
  fi
done < "$KERJA/pertama.txt"

# Setiap nomor di bagian 1 harus pernah berbunyi ADA.
"$PSQL" -d "$DB" -t -A -F'|' -v ON_ERROR_STOP=1 -f "$PEMERIKSA" > "$KERJA/akhir.txt"
awk -F'|' '$1 ~ /^[0-9]{4}$/ && ($2 == "ADA" || $2 ~ /BELUM/) { print $1, $2 }' \
  "$KERJA/akhir.txt" > "$KERJA/akhir_ringkas.txt"

belum="$(awk '$2 ~ /BELUM/ { print $1 }' "$KERJA/akhir_ringkas.txt" | tr '\n' ' ')"
if [ -n "$belum" ]; then
  echo "BELUM di database yang SEMUA migrasinya dijalankan: $belum"
  gagal=$((gagal + 1))
fi

jumlah="$(wc -l < "$KERJA/pertama.txt" | tr -d ' ')"
if [ "$gagal" -gt 0 ]; then
  echo "GAGAL: $gagal masalah pada jejak."
  exit 1
fi

echo "LULUS: $jumlah jejak, tiap satunya baru berbunyi ADA tepat di migrasinya."
