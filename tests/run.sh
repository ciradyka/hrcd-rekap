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
# 0040 membetulkan regresi daftar_ulang_batch (kloter tercetak tetap dipilih).
# Dijalankan SEBELUM 04, karena bagian 4.4b menguji perbaikannya.
run supabase/migrations/0040_daftar_ulang_hormati_kloter_tercetak.sql
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
# 0033 menggantikan 0032 (Pos 1 = Kepramukaan); 0034 membetulkan dua nama
# terakhir. Keduanya ikut dijalankan supaya berkasnya tetap teruji, walau
# di database uji 0033 menolak memasang data — persis seperti 0032.
run supabase/migrations/0033_nama_pos_xxxvii.sql
run supabase/migrations/0034_nama_pos_final.sql
run tests/sql/13_komponen_per_golongan.sql
# 0035 hanya membetulkan satu tangga poin, jadi TIDAK dipagari "belum ada
# nilai" seperti tiga berkas di atasnya — di database uji ia berjalan sungguhan
# dan tidak mengenai apa pun, karena `menaksir` memang tidak ada di sini.
run supabase/migrations/0035_tangga_menaksir.sql
run tests/sql/14_tangga_menaksir.sql
# 0036 dijalankan di sini supaya penolakannya ikut terbukti — di database uji
# pos 3 bukan P3K, jadi ia harus diam. Tes 15 memanggil berkas yang sama dua
# kali lagi lewat \ir, dengan Pos 3 palsu yang dibangunnya sendiri.
run supabase/migrations/0036_kriteria_bidai.sql
run tests/sql/15_kriteria_bidai.sql
# 0037 menambah kolom `petunjuk` dan melebarkan rentang Menaksir. Kolomnya
# dipakai seluruh tes di bawahnya lewat v_lembar_pos, jadi ia harus sudah
# terpasang sebelum 16 berjalan.
run supabase/migrations/0037_petunjuk_kolom.sql
run tests/sql/16_kosong_bukan_nol.sql
# 0038 hanya mengganti bunyi satu petunjuk kolom. Dijalankan supaya berkasnya
# tetap teruji; di database uji `menaksir` tidak ada, jadi ia melapor dilewati.
run supabase/migrations/0038_petunjuk_menaksir.sql
# 0039 menambah kolom `judul_isian`. Dijalankan supaya berkasnya teruji; di
# database uji `menaksir` tidak ada, jadi UPDATE-nya melapor dilewati.
run supabase/migrations/0039_judul_isian.sql

# 0041 mengubah kapan nomor lama dipensiunkan. Dijalankan di akhir supaya tes
# 04 dan 05 masih memakai perilaku lama saat mereka berjalan — keduanya tidak
# menyentuh tukar_nomor_dada, tapi urutan yang jelas lebih murah daripada
# menelusuri kenapa satu tes berubah arti.
run supabase/migrations/0041_tukar_nomor_tanpa_pensiun.sql
run tests/sql/17_tukar_nomor_tanpa_pensiun.sql
# 0042 membuka riwayat perubahan NILAI (dan hanya nilai) untuk petugas pos.
run supabase/migrations/0042_riwayat_nilai.sql
run tests/sql/18_riwayat_nilai.sql
# 0043 memasang gembok, 0044 menyalakannya di kedua jalur tulis. Dijalankan
# di akhir supaya tes 02-18 memakai nilai yang belum tergembok.
run supabase/migrations/0043_kunci_nilai.sql
run supabase/migrations/0044_gembok_di_jalur_tulis.sql
run supabase/migrations/0045_pos_boleh_buka_gembok.sql
run supabase/migrations/0046_gembok_dua_lubang.sql
run tests/sql/19_kunci_nilai.sql

# --------------------------------------------------------------------------
# 0047-0053. Ketujuhnya SEMPAT TIDAK ADA di berkas ini, dan itu berarti CI
# hijau selama berhari-hari tanpa pernah menjalankan satu pun di antaranya —
# termasuk tes 20, 21, dan 22 yang ditulis bersamanya. Yang menemukannya
# akhirnya bukan CI, melainkan produksi: 0053 gagal di sana dengan "column
# e.aktif does not exist", galat yang seharusnya muncul di sini lebih dulu.
#
# Daftar ini ditulis tangan, jadi migrasi baru TIDAK otomatis teruji. Setiap
# berkas baru di supabase/migrations/ harus ditambahkan di sini pada commit
# yang sama.
# --------------------------------------------------------------------------
run supabase/migrations/0047_foto_lembar.sql
run tests/sql/20_foto_lembar.sql
run supabase/migrations/0048_live_skor_peserta.sql
run supabase/migrations/0049_pratinjau_live_admin.sql
run supabase/migrations/0050_rename_live_score.sql
# 0051 melarang nama regu kembar; dijalankan sesudah tes lain supaya mereka
# masih bebas memakai nama apa pun.
run supabase/migrations/0051_nama_regu_unik.sql
run tests/sql/21_nama_regu_unik.sql
# Fixture tes memakai nama berangka ("Regu A01", "Ketua A1"), jadi 0052 akan
# menolaknya. Dibersihkan dengan skrip yang SAMA PERSIS dengan yang dipakai
# produksi — sekalian membuktikan skrip itu sendiri bekerja.
run supabase/checks/hapus_angka_nama_uji.sql
run supabase/migrations/0052_nama_tanpa_angka.sql
run tests/sql/22_nama_tanpa_angka.sql
run supabase/migrations/0053_perkiraan_berangkat.sql
run supabase/migrations/0054_kolom_lomba.sql
run supabase/migrations/0055_kemajuan_hari.sql
run supabase/migrations/0056_perkiraan_zona_wib.sql
run tests/sql/23_perkiraan_zona_wib.sql
# 0057 memindahkan hak akses dari kolom `peran` ke tabel `akun_hak`. Tesnya
# menguji lebih dulu bahwa TIDAK ADA akun yang berubah aksesnya — itu
# syarat migrasi ini boleh dipasang di tengah edisi.
run supabase/migrations/0057_hak_akses.sql
run tests/sql/24_hak_akses.sql
# 0058 mengganti nama peran dan MENULIS ULANG hak tiap akun. Tesnya menjaga
# yang paling mahal kalau bocor: nilai peran lama harus benar-benar ditolak
# database, bukan sekadar tidak dipakai lagi.
run supabase/migrations/0058_peran_per_pekerjaan.sql
run tests/sql/25_peran_per_pekerjaan.sql
# 0059 menolak nilai mentah pecahan. Tesnya membuktikan penolakannya datang
# dari DATABASE, bukan dari kotak isian — import massal dan tempel dari
# spreadsheet tidak lewat kotak itu sama sekali.
run supabase/migrations/0059_nilai_mentah_bulat.sql
run tests/sql/26_nilai_mentah_bulat.sql
# 0060 menghitung kelengkapan per golongan. Sebelumnya Pos 1 terjebak di 0%
# sepanjang hari, karena penyebutnya seluruh komponen pos (6) sementara satu
# regu hanya mengisi tiga — Tebak Simpul ada empat versi, satu per golongan.
run supabase/migrations/0060_kelengkapan_per_golongan.sql
run tests/sql/27_kelengkapan_per_golongan.sql
# 0061 melebur baris sekolah kembar dan memindahkan kuncinya dari
# (name, address) ke nama saja. Tesnya menjaga dua arah sekaligus: alamat
# berbeda tidak lagi melahirkan baris baru, DAN dua sekolah yang memang
# berbeda tetap boleh berdampingan — kebutuhan asli yang membuat 0001 memakai
# alamat sebagai pembeda.
run supabase/migrations/0061_sekolah_satu_baris.sql
# 0062 membakukan enam nama yang luput dari 0061 dan memperluas
# kunci_sekolah() ke huruf status Dapodik. Dijalankan SEBELUM tes 28, karena
# tes itu menguji kunci versi terbaru — dan 0062 harus membuang index-nya
# dulu sebelum mengganti fungsinya, kalau tidak index-nya tertinggal memakai
# rumus lama dan diam-diam meloloskan baris kembar.
run supabase/migrations/0062_sekolah_nama_dapodik.sql
run tests/sql/28_sekolah_satu_baris.sql
# 0063 memasang 188 sekolah kurasi. Dijalankan SESUDAH tes 28, karena tes itu
# menghitung selisih baris sekolah dan 188 baris baru akan menenggelamkannya.
# Tes 29 menjaga yang bisa rusak tanpa suara: dua nama yang melebur jadi satu
# baris, dan id sekolah yang berpindah saat migrasinya dijalankan dua kali.
run supabase/migrations/0063_sekolah_daftar_kurasi.sql
run tests/sql/29_sekolah_daftar_kurasi.sql
# 0064 memindahkan SELURUH penjaga dari peran() ke boleh(). Tesnya menjalankan
# panggilan yang sama persis dua kali dan hanya mengubah satu baris akun_hak —
# kalau pesan galatnya tidak berubah, centang di layar Akun bukan pagar.
run supabase/migrations/0064_hak_akses_mengikat.sql
run tests/sql/30_hak_akses_mengikat.sql
# 0065 menutup lubang pemeriksaan 0064: VIEW bukan policy dan bukan fungsi,
# jadi enam view lolos tanpa disebut — dua di antaranya BOCOR, menampilkan
# lembar seluruh pos ke juri pos mana pun. Sekalian N+1 di v_rekap_penuh.
run supabase/migrations/0065_view_hak_dan_rekap.sql
run tests/sql/31_view_hak.sql
# 0066 membuang larangan menambah regu ke kloter tercetak/berangkat. Tesnya
# menekan ketiga pagar lamanya dari sisi berbeda — trigger lewat UPDATE
# langsung, dua syarat lewat pemilihan kloter — dan sekaligus memastikan
# KAPASITAS tidak ikut terbuka.
run supabase/migrations/0066_kloter_boleh_ditambah.sql
run tests/sql/32_kloter_boleh_ditambah.sql
# 0067 membuka Live Score untuk semua peran yang mencentangnya. Tesnya
# memeriksa dari kursi masing-masing — bukan memindai nama peran seperti tes
# 31, yang justru meloloskan `peran() = 'admin'` — dan sekaligus menahan
# isolasi pos supaya tidak ikut terbuka demi mengisi papan skor.
run supabase/migrations/0067_live_score_semua_peran.sql
run tests/sql/33_live_score_semua_peran.sql

echo "SEMUA TES LULUS"
