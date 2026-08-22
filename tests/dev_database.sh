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
# Seluruh migrasi, urut nomor, KECUALI yang disebut di LEWATI_DULU. Daftar ini
# pernah berhenti di 0011 sementara migrasinya sudah sampai 0020 — akibatnya
# layar yang dicoba di dev berbicara dengan skema yang tidak pernah ada di
# produksi, dan galatnya baru muncul setelah deploy.
#
# SELURUH GLOB BERJALAN SEBELUM seed.sql, jadi belum ada edisi 37 dan tidak
# satu pun migrasi konfigurasi per edisi menemukan edisi yang ia cari. Yang
# menentukan nasibnya cuma ada tidaknya pagar di dalam migrasinya sendiri:
#
#   0032 0033 0034 0036  punya `if v_edisi is null then ... return`. Mereka
#                        melapor "dilewati" lalu berhenti dengan tenang —
#                        walaupun isinya INSERT dan DELETE.
#   0035 0037 0038 0039  tanpa pagar, tapi isinya UPDATE, jadi tidak mengenai
#                        baris apa pun dan tidak merusak apa pun.
#   0054                 tanpa pagar, UPDATE juga, tapi diamnya BERBUNYI
#                        SEPERTI KEBERHASILAN. Lihat catatannya di bawah.
#   0076                 tanpa pagar dan ia INSERT. `edisi` NULL menabrak
#                        not-null constraint dan skripnya BERHENTI di situ.
#
# Jadi kesembilan yang pertama cukup DIULANG sesudah seed.sql; hanya 0076 yang
# harus DILEWATI dulu, karena cuma ia yang menggagalkan skripnya. Jangan
# menambalnya dengan mengedit 0076 — migrasi yang sudah diterapkan ke produksi
# tidak pernah diedit (final-architecture.md bagian 2).
#
# SYARAT MASUK LEWATI_DULU: migrasinya tidak boleh memuat DDL. 0076 memenuhinya
# — isinya satu blok `do` berisi UPDATE dan INSERT saja. Migrasi yang menambah
# kolom SEKALIGUS mengisi data per edisi tidak boleh dilewati: seluruh migrasi
# sesudahnya akan berjalan di atas tabel yang kolomnya belum ada, persis
# kerusakan yang diceritakan alinea pertama. 0037, 0039 dan 0054 menambah
# kolom, jadi ketiganya diulang dan tidak pernah dilewati.
LEWATI_DULU="0076_bidai_dan_lomba_soal"
ULANG="0032_konfigurasi_xxxvii 0033_nama_pos_xxxvii 0034_nama_pos_final
       0035_tangga_menaksir 0036_kriteria_bidai 0037_petunjuk_kolom
       0038_petunjuk_menaksir 0039_judul_isian 0054_kolom_lomba
       0076_bidai_dan_lomba_soal 0091_intern_golongan
       0093_configure_fifo_capacity"

# Yang dilewati WAJIB ada di ULANG. Kalau tidak, ia tidak dijalankan sama
# sekali — kerusakan yang sama dengan berhenti di 0011, dan sama diamnya.
for m in $LEWATI_DULU; do
  case " $(echo $ULANG) " in
    *" $m "*) ;;
    *) echo "dev_database.sh: $m ada di LEWATI_DULU tapi tidak di ULANG — ia tidak akan pernah dijalankan." >&2
       exit 1 ;;
  esac
done

for m in "$ROOT"/supabase/migrations/*.sql; do
  nama="$(basename "$m")"
  case " $LEWATI_DULU " in *" ${nama%.sql} "*) echo "-- (ditunda) $nama"; continue ;; esac
  run "supabase/migrations/$nama"
done
run supabase/seed.sql
# Konfigurasi pos butuh edisinya sudah ada — lihat catatan panjang yang sama
# di tests/run.sh.
run supabase/migrations/0024_komponen_pos.sql
# Konfigurasi pos edisi 37 DIJALANKAN ULANG di sini, dan itu perlu. Di glob di
# atas mereka berjalan sebelum seed.sql sempat membuat edisi 37, jadi tidak
# menemukan apa-apa — dev lalu memakai konfigurasi pos edisi LAMA (Games,
# Kostum) sementara produksi memakai yang baru (Halang Rintang, PBB, Yel-yel).
# Perbedaan itu tidak menggagalkan apa pun; ia cuma membuat layar yang dicoba
# di dev berbicara tentang pos yang tidak ada di produksi.
#
# 0054 ADA DI DAFTAR INI KARENA KETIADAANNYA TIDAK PERNAH BERSUARA. Ia mengisi
# kolom `lomba` — tingkat ketiga di CLAUDE.md bagian 11 — untuk baris ber-kode
# `bidai_`, `kim_`, `pbb_`, `yel_`. Di glob ia berjalan saat `wahana` masih
# kosong, jadi nol baris, lalu melapor "tidak ada komponen berkelompok di edisi
# aktif": kalimat yang terbaca seperti keterangan yang benar tentang edisi ini,
# bukan seperti kegagalan. Akibatnya di dev seluruh `lomba` NULL,
# `coalesce(lomba, name)` di kelompokLomba() memecah tiap kriteria jadi lomba
# tersendiri, dan blangko Pos 3 tercetak 8 lembar (seharusnya 3), Pos 4 empat
# lembar (seharusnya 1), Pos 5 empat lembar (seharusnya 1) — persis kerusakan
# yang 0054 dibuat untuk menghapus.
#
# Urutan di dalam ULANG mengikat di tiga tempat:
#   * 0033 melewati dirinya sendiri kalau edisinya sudah memuat nilai, jadi
#     seluruh blok ini harus di ATAS 01_seed_uji.sql maupun pengisi nilai mana
#     pun.
#   * 0054 harus SESUDAH 0036, karena 0036 yang membuat baris bidai dan 0054
#     hanya mengisi baris yang `lomba`-nya masih kosong.
#   * 0076 harus SESUDAH 0054, supaya pemeriksaan bagian A-nya
#     (`where lomba = 'Pembidaian'`) menemukan kelima barisnya dan jumlah 100
#     itu benar-benar diperiksa. Tanpa 0054 ia melapor "Pembidaian tidak ada di
#     database ini" dan penjaganya diam.
#   * 0091 harus SESUDAH 0076 agar lima komponen Soal Tulis yang disalin untuk
#     Intern sudah ada. 0093 lalu menyiapkan 60 kloter setelah edisi aktif lahir.
for m in $ULANG; do
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

# 0075 IKUT DIJALANKAN ULANG, karena 0058 di atas MEMBATALKANNYA. 0058 memasang
# ulang `akun_panitia_peran_check` dan `paket_peran()` dalam versi SEBELUM peran
# kelima ada, jadi menjalankannya paling akhir mengembalikan database ke keadaan
# pra-0075: `koordinator_pos` ditolak constraint, dan
# `paket_peran('koordinator_pos')` mengembalikan array KOSONG — akunnya tidak
# punya satu centang pun dan `boleh()` menutup semua layar (CLAUDE.md 13.1-13.2).
# tests/run.sh tidak kena: di sana 0058 berjalan sebelum 0075, urut nomor.
#
# 0075 aman diulang: `drop constraint if exists` lalu pasang lagi,
# `create or replace`, dan blok penutupnya hanya membaca. Pagar dua arah yang
# ia periksa — `(peran = 'juri_pos') = (pos is not null)` — baru saja dipasang
# kembali oleh 0058 satu baris di atas.
run supabase/migrations/0075_koordinator_pos.sql

echo "hrcd_dev siap — akun: admin.ciradyka / meja1hrcd37 / pos1hrcd37 (password bebas di dev)"
