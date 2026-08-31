#!/usr/bin/env bash
# ============================================================================
# hrcd-rekap : tests/dev/bentuk_lomba_check.sh
# Menguji PENJAGANYA, bukan databasenya — dari DUA arah.
#
# tests/dev/bentuk_lomba_produksi.sql lulus pada 1 September 2026, dan itu
# tidak membuktikan apa pun sendirian: `select true` juga lulus. Yang perlu
# dibuktikan arah keduanya — bahwa ia MENOLAK saat bentuk lombanya memang
# salah. Tanpa itu penjaganya bisa jadi hijau selamanya sambil tidak memeriksa
# apa-apa, persis kerusakan yang CLAUDE.md 13.3 dan 7.8 jelaskan panjang lebar.
#
# Kerusakannya disuntikkan DI DALAM TRANSAKSI lalu dibatalkan, jadi database
# dev tidak berubah sedikit pun.
#
#   PSQL=/path/ke/psql PGPORT=5433 PGPASSWORD=... bash tests/dev/bentuk_lomba_check.sh
# ============================================================================
set -euo pipefail

PSQL="${PSQL:-psql}"
export PGHOST="${PGHOST:-127.0.0.1}" PGPORT="${PGPORT:-55432}" PGUSER="${PGUSER:-postgres}"
DB="${PGDATABASE:-hrcd_dev}"
cd "$(dirname "$0")/../.."

lulus=0
gagal=0

# Kerusakan yang harus DITOLAK, satu per satu. Tiap baris: keterangan lalu SQL
# yang merusaknya.
uji_tolak() {
  local nama="$1" rusak="$2"
  if "$PSQL" -d "$DB" -v ON_ERROR_STOP=1 -q >/dev/null 2>&1 <<SQL
begin;
$rusak
\i tests/dev/bentuk_lomba_produksi.sql
rollback;
SQL
  then
    echo "  GAGAL  $nama — penjaganya DIAM" >&2
    gagal=$((gagal + 1))
  else
    echo "  ok     $nama ditolak"
    lulus=$((lulus + 1))
  fi
}

echo "bentuk_lomba_produksi.sql, dua arah:"

# --- arah 1: database yang BENAR harus lulus -------------------------------
if "$PSQL" -d "$DB" -v ON_ERROR_STOP=1 -q -f tests/dev/bentuk_lomba_produksi.sql >/dev/null 2>&1; then
  echo "  ok     database dev apa adanya lulus"
  lulus=$((lulus + 1))
else
  echo "  GAGAL  database dev apa adanya DITOLAK — jalankan tests/dev_database.sh" >&2
  gagal=$((gagal + 1))
fi

# --- arah 2: tiap kerusakan harus ditolak ----------------------------------
uji_tolak "KIM disatukan lagi jadi satu lomba" \
  "update wahana set lomba = 'KIM' where edisi = edisi_aktif() and kode like 'kim%';"

uji_tolak "Kim Lihat dan Kim Cium berbagi satu kunci foto" \
  "update wahana set kode_lomba = 'kim' where edisi = edisi_aktif() and kode like 'kim%';"

uji_tolak "satu kriteria Pembidaian hilang" \
  "delete from nilai_mentah n using wahana w where w.id = n.wahana_id and w.kode = 'bidai_kerapihan';
   delete from wahana where edisi = edisi_aktif() and kode = 'bidai_kerapihan';"

uji_tolak "satu kriteria PBB hilang" \
  "delete from nilai_mentah n using wahana w where w.id = n.wahana_id and w.kode like 'pbb_%' and w.kode = (select min(kode) from wahana where edisi = edisi_aktif() and kode like 'pbb_%');
   delete from wahana where edisi = edisi_aktif() and kode = (select min(kode) from wahana where edisi = edisi_aktif() and kode like 'pbb_%');"

uji_tolak "Yel-Yel kehilangan satu kriteria" \
  "delete from nilai_mentah n using wahana w where w.id = n.wahana_id and w.kode = (select min(kode) from wahana where edisi = edisi_aktif() and kode like 'yel_%');
   delete from wahana where edisi = edisi_aktif() and kode = (select min(kode) from wahana where edisi = edisi_aktif() and kode like 'yel_%');"

echo
if [ "$gagal" -gt 0 ]; then
  echo "$gagal dari $((lulus + gagal)) pemeriksaan GAGAL." >&2
  exit 1
fi
echo "SEMUA LULUS ($lulus pemeriksaan)."
