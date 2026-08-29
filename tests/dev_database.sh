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
# SYARAT MASUK LEWATI_DULU, dan bunyinya lebih tepat begini: migrasi yang
# dilewati tidak boleh meninggalkan SESUATU YANG DIPAKAI migrasi sesudahnya.
#
# Versi pertama syarat ini berbunyi "tidak boleh memuat DDL", dan itu terlalu
# lebar. Yang benar-benar merusak kolom atau tabel yang belum ada saat migrasi
# berikutnya membacanya — 0037, 0039 dan 0054 menambah kolom, jadi ketiganya
# diulang dan tidak pernah dilewati. Sebuah `create or replace function` yang
# tidak dipanggil siapa pun di antara dua titik itu TIDAK merusak apa pun: yang
# ada sementara versi lamanya, dan pengulangannya memasang versi barunya.
#
# Yang wajib diperiksa sebelum menambah nama ke daftar ini, satu per satu:
#
#   1. Apa yang ditinggalkannya — kolom/tabel (JANGAN dilewati) atau fungsi,
#      view, komentar (boleh, kalau syarat 2 terpenuhi)?
#   2. Adakah migrasi SESUDAHNYA sampai seed.sql yang memakainya? Cari
#      namanya di supabase/migrations dengan nomor lebih besar.
#
# 0076 : satu blok `do` berisi UPDATE dan INSERT saja, tanpa DDL.
# 0118 : `create or replace function perkiraan_berangkat_kloter` + dua
#        `comment on`. Diperiksa 28 Agustus 2026 — yang menyebutnya sesudah
#        0118 cuma 0119, dan itu pun cuma di dalam KOMENTAR ("sudah
#        digantikan 0118"), bukan pemanggilan. Jadi tidak ada yang membacanya
#        di antara dua titik itu.
#
# KENAPA 0118 HARUS DITUNDA. Blok penutupnya bukan sekadar `raise notice`
# melainkan dua `assert` atas jam berangkat kloter pertama dan terakhir. Di
# sini tabel `edisi` masih KOSONG, jadi ketiga nilainya NULL, `assert NULL`
# gagal, dan skripnya berhenti di situ — seluruh migrasi 0119-0130 tidak
# pernah dijalankan. Itulah yang membuat dev server tidak bisa dipakai sama
# sekali sejak 0118 mendarat, dan kenapa layar Meja Pembayaran yang rusak
# 28 Agustus 2026 baru ketahuan oleh petugas di lapangan: tidak ada satu pun
# cara membuka layarnya di laptop.
# 0129 dan 0130 ditunda karena alasan ketiga lagi, dan ia yang paling sunyi:
# keduanya memakai `edisi_aktif()`. Di glob nilainya NULL, jadi
#   'HRCD' || edisi_aktif() || '-' || ...
# seluruhnya jadi NULL — dan `exit when not exists (... = NULL)` langsung
# keluar pada putaran pertama, karena perbandingan dengan NULL tidak pernah
# benar. Yang menghentikan skripnya bukan logika kodenya melainkan
# not-null constraint kolom kode_pembayaran, beberapa baris sesudahnya.
#
# Keduanya tidak meninggalkan DDL yang dipakai siapa pun: tabel sementaranya
# dibuang sendiri di ujung berkasnya, dan sisanya INSERT dan UPDATE.
LEWATI_DULU="0076_bidai_dan_lomba_soal 0118_jeda_kloter_maksimal
             0129_impor_pendaftaran_xxxvii 0130_bukti_transfer_link_drive
             0131_impor_pendaftaran_xxxvii_susulan
             0132_impor_pendaftaran_xxxvii_lanjutan
             0133_kelas_organisasi_regu 0134_kelas_organisasi_tanpa_simbol
             0137_riwayat_pendaftaran 0138_riwayat_pelaku_kosong
             0146_cache_live_score 0147_waktu_nol_pos_2"
ULANG="0032_konfigurasi_xxxvii 0033_nama_pos_xxxvii 0034_nama_pos_final
       0035_tangga_menaksir 0036_kriteria_bidai 0037_petunjuk_kolom
       0038_petunjuk_menaksir 0039_judul_isian 0054_kolom_lomba
       0076_bidai_dan_lomba_soal 0091_intern_golongan
       0093_configure_fifo_capacity 0105_expand_kloter_capacity
       0118_jeda_kloter_maksimal"

# Yang dilewati WAJIB dijalankan lagi di suatu tempat. Kalau tidak, ia tidak
# dijalankan sama sekali — kerusakan yang sama dengan berhenti di 0011, dan
# sama diamnya.
#
# Ada DUA cara menjalankannya lagi, dan pagar ini menerima keduanya:
#   * masuk daftar ULANG, yang diputar tepat sesudah seed.sql, atau
#   * satu baris `run supabase/migrations/<nama>.sql` tersendiri di bawah,
#     untuk yang harus PALING AKHIR — 0129 dan 0130 begitu, karena keduanya
#     membawa data operasional dan tidak boleh terbaca langkah sesudahnya.
#
# Versi pertama pagar ini hanya memeriksa ULANG, jadi ia menolak cara kedua
# walau migrasinya benar-benar dijalankan sepuluh baris kemudian.
for m in $LEWATI_DULU; do
  diulang=""
  case " $(echo $ULANG) " in *" $m "*) diulang="ya" ;; esac
  grep -q "^run supabase/migrations/$m[.]sql$" "$0" && diulang="ya"
  if [ -z "$diulang" ]; then
    echo "dev_database.sh: $m ada di LEWATI_DULU tapi tidak pernah dijalankan lagi — tambahkan ke ULANG atau beri baris run sendiri." >&2
    exit 1
  fi
done

for m in "$ROOT"/supabase/migrations/*.sql; do
  nama="$(basename "$m")"
  # `$(echo ...)` MELIPAT baris barunya jadi spasi, dan itu bukan gaya
  # penulisan. Pola di bawah menuntut SPASI di kedua sisi nama; kalau
  # LEWATI_DULU ditulis dua baris, yang di ujung baris pertama diapit spasi
  # dan BARIS BARU, jadi ia tidak pernah cocok dan migrasinya tetap
  # dijalankan di sini — diam-diam, karena tidak ada yang melaporkan
  # kegagalan mencocokkan. Pemeriksa ULANG di atas sudah memakai bentuk ini;
  # yang di sini tertinggal sampai daftarnya benar-benar jadi dua baris.
  case " $(echo $LEWATI_DULU) " in *" ${nama%.sql} "*) echo "-- (ditunda) $nama"; continue ;; esac
  run "supabase/migrations/$nama"
done
run supabase/seed.sql

# KONFIGURASI PENALTI DIKEMBALIKAN KE BAWAAN KOLOM, dan tanpa ini database dev
# memakai aturan penalti yang sudah dua kali diganti.
#
# seed.sql menulis konfig_penalti apa adanya seperti saat edisi 37 dibuat:
# blok 10 menit, 10 poin per blok, -100 tanpa jam datang. Di produksi angka itu
# benar sesaat, lalu 0089 menjadikannya 1 menit -> 1 poin dan 0143 menjadikan
# potongan tanpa jam datang 0 — keduanya berjalan di atas database yang barisnya
# sudah ada, jadi keduanya menemukan baris itu dan membetulkannya.
#
# Di sini urutannya terbalik. Seluruh migrasi berjalan di glob SEBELUM seed.sql
# membuat edisi 37, jadi 0089 dan 0143 tidak menemukan satu baris pun untuk
# diperbaiki — 0089 malah mengatakannya dengan tenang lewat notice "data
# dilewati" — lalu seed.sql menulis angka lamanya, dan tidak ada lagi yang
# lewat sesudahnya. Assert penutup 0143 pun tidak menangkapnya, karena saat ia
# berjalan barisnya memang belum ada. Akibatnya layar yang dicoba di laptop
# menghitung penalti dengan aturan yang tidak dipakai siapa pun, tanpa sepatah
# galat (CLAUDE.md pasal 17.6).
#
# TIDAK bisa dibereskan dengan menaruh 0089 dan 0143 di ULANG. 0089 sendiri
# aman, tapi 0143 juga membuat ulang view v_klasemen dan fungsi
# simpan_kejuaraan_manual — dan keduanya sudah diganti migrasi yang lebih muda
# (0144, 0145, 0152, 0153). Menjalankannya ulang di ujung daftar akan
# MENGEMBALIKAN keempatnya ke versi lama; itu jebakan yang sama dengan yang
# ditulis di CLAUDE.md pasal 7.8.
#
# Yang dipakai di bawah karena itu BUKAN angka. `set kolom = default` membaca
# default kolomnya sendiri, dan default itulah yang dipasang 0089 dan 0143 —
# bagian migrasi yang memang berhasil berjalan di glob, karena ia tidak
# memerlukan satu baris pun. Jadi tidak ada satu angka penalti pun yang ditulis
# dua kali di repo ini: migrasinya tetap satu-satunya tempat angka itu hidup.
# Migrasi penalti berikutnya cukup memindahkan default kolomnya seperti 0089
# dan 0143 — kebiasaan yang memang sudah ditulis di kepala 0089 — dan langkah
# ini ikut benar dengan sendirinya.
"$PSQL" -d "$DB" -v ON_ERROR_STOP=1 -q -c "
  do \$blok\$
  declare
    n integer;
    v konfig_penalti%rowtype;
  begin
    update konfig_penalti
    set blok_menit                 = default,
        penalti_per_blok           = default,
        penalti_tanpa_checkout     = default,
        penalti_per_anggota_hilang = default,
        nilai_pos_terlewat         = default
    where edisi = edisi_aktif();

    -- Yang diperiksa cuma bahwa barisnya KENA. Nilainya sendiri tidak
    -- diperiksa terhadap angka mana pun: sesudah 'set = default' ia sama
    -- dengan default kolomnya menurut definisi, dan menuliskan angka yang
    -- diharapkan di sini justru mengembalikan salinan kedua yang langkah ini
    -- dibuat untuk menghilangkan. Nol baris berarti belum ada edisi aktif -
    -- dan itu berarti seluruh skrip ini berjalan di urutan yang salah.
    get diagnostics n = row_count;
    assert n = 1,
           format('dev_database.sh: %s baris konfig_penalti tersentuh, seharusnya 1', n);

    select * into v from konfig_penalti where edisi = edisi_aktif();
    raise notice 'konfig_penalti edisi %: blok % menit -> % poin, tanpa jam datang %, anggota hilang %.',
                 v.edisi, v.blok_menit, v.penalti_per_blok,
                 v.penalti_tanpa_checkout, v.penalti_per_anggota_hilang;
  end;
  \$blok\$;"
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
#     Intern sudah ada. 0093 menyiapkan 60 kloter setelah edisi aktif lahir;
#     0105 menambah headroom-nya menjadi 75, dan ia HARUS ikut diulang di
#     sini: di glob ia berjalan sebelum edisi aktif lahir, jadi
#     `select kloter_maks from edisi where is_active` tidak menemukan apa
#     pun dan nol kloter dibuat — tanpa sepatah galat. Akibatnya dev
#     berhenti di 60 kloter sementara produksi punya 75, dan layar yang
#     dicoba di laptop memakai papan kloter yang tidak ada di lapangan.
#     Urutannya sesudah 0093 dan sebelum 0118, sama dengan nomornya di
#     tests/run.sh: 0093 membuat 60, 0105 menaikkannya jadi 75, lalu
#     assert 0118 memeriksa sebaran jamnya atas jumlah yang benar.
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

# 0129 dan 0130 PALING AKHIR, sama seperti di tests/run.sh, dan alasannya
# sama: keduanya satu-satunya migrasi yang membawa DATA OPERASIONAL. Di
# tengah daftar, seratus pendaftaran itu ikut terbaca langkah sesudahnya —
# dan 01_seed_uji.sql membuat regu dengan nama karangan yang bisa menabrak
# `regu_nama_unik`, indeks yang berlaku SELURUH edisi.
#
# Keduanya sengaja IKUT di dev, bukan dilewati begitu saja: layar Meja
# Pembayaran yang berisi empat baris uji tidak menunjukkan apa pun tentang
# layar yang berisi seratus, dan justru di layar seratus baris itulah
# kerusakan 28 Agustus 2026 terlihat.
run supabase/migrations/0129_impor_pendaftaran_xxxvii.sql
run supabase/migrations/0130_bukti_transfer_link_drive.sql
run supabase/migrations/0131_impor_pendaftaran_xxxvii_susulan.sql
run supabase/migrations/0132_impor_pendaftaran_xxxvii_lanjutan.sql
# 0133 dan 0134 memberi regu kolom kelas/organisasi lalu mempersempit
# bentuknya. Keduanya MENGIRIM pendaftaran uji lewat submit_pendaftaran dan
# menghapusnya lagi, jadi keduanya menuntut edisi aktif sudah ada — sebab
# yang sama dengan keempat migrasi impor di atasnya.
run supabase/migrations/0133_kelas_organisasi_regu.sql
run supabase/migrations/0134_kelas_organisasi_tanpa_simbol.sql
# 0137 dan 0138 sebab yang SAMA PERSIS dengan 0133/0134 di atas: pagar
# penutupnya mengirim satu pendaftaran lewat submit_pendaftaran lalu
# menghapusnya lagi. Tanpa edisi aktif, `'HRCD' || edisi_aktif() || '-' || ...`
# jadi NULL dan kode_pembayaran menabrak not-null constraint — skripnya
# berhenti persis di situ, dan sejak 0137 mendarat TIDAK ADA cara membuka satu
# layar pun di laptop (CLAUDE.md 17.6).
#
# Keduanya cuma meninggalkan `create or replace view v_riwayat_pendaftaran`
# beserta grant dan comment-nya. Yang membacanya sesudah 0137 sampai ujung
# daftar cuma 0138, dan 0138 ikut ditunda ke sini — urutannya tetap 0137 lalu
# 0138, sama dengan nomornya.
run supabase/migrations/0137_riwayat_pendaftaran.sql
run supabase/migrations/0138_riwayat_pelaku_kosong.sql

# 0146 dan 0147 ditunda ke ujung karena keduanya diakhiri
# `select segarkan_cache_live_score()`, dan fungsi itu memilih satu akun
# aktif pemegang hak live_score untuk menempati kursinya. Di glob belum ada
# satu akun pun, jadi ia melempar 'Tidak ada akun aktif dengan hak
# live_score' dan skripnya BERHENTI di situ — 0148 sampai 0152 tidak pernah
# jalan, dan layar Kejuaraan di laptop memakai aturan lama tanpa ada yang
# memberi tahu (CLAUDE.md 17.6).
#
# 0147 punya alasan kedua untuk ada di sini: ia memasang tingkat nol pada
# komponen waktu Pos 2 `where edisi = edisi_aktif()`. Di glob edisi aktif
# belum lahir, jadi nol baris tersentuh dan ia cuma memberi notice
# 'dilewati' — kalimat yang terbaca seperti keterangan, bukan kegagalan.
# Urutannya 0146 lalu 0147, sama dengan nomornya: 0147 memanggil fungsi yang
# baru dibuat 0146.
run supabase/migrations/0146_cache_live_score.sql
run supabase/migrations/0147_waktu_nol_pos_2.sql

# 0154 DIJALANKAN ULANG PALING AKHIR, karena ia membetulkan baris `sekolah`
# yang baru lahir di 0129-0132. Di glob ia berjalan jauh sebelum keempat
# migrasi impor itu, jadi tidak menemukan satu baris pun untuk dilebur maupun
# dibakukan — dan dev lalu memakai tabel sekolah yang masih memuat nama
# ketikan pembina beserta belasan alamat kosong, sementara produksi sudah
# bersih. Aman diulang: peleburannya melewati pasangan yang tidak ada, dan
# pembakuannya menyaring `where name = <nama lama>`.
run supabase/migrations/0154_sekolah_alamat_xxxvii.sql
run supabase/migrations/0155_sekolah_kode_pos.sql
run supabase/migrations/0156_smk_lps_satu_dan_dua.sql
run supabase/migrations/0157_direktori_sekolah_ciamis.sql

echo "hrcd_dev siap — akun: admin.ciradyka / meja1hrcd37 / pos1hrcd37 (password bebas di dev)"
