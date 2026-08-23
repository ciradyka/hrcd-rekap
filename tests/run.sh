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
# 0068 memberi tombol Publish Live Score satu RPC. Tesnya menjaga PINTUNYA,
# bukan tombolnya: tombol di layar cuma menyembunyikan diri, RPC-nya yang
# harus menolak — ia bisa dipanggil langsung dari devtools.
run supabase/migrations/0068_atur_fase_live.sql
run tests/sql/34_atur_fase_live.sql
# 0069 memperbaiki "UPDATE requires a WHERE clause" (pengaman safeupdate
# Supabase, tidak ada di database uji — jadi tes 34 lulus sementara tombolnya
# gagal di produksi) dan membuka rincian Live Score untuk semua panitia.
run supabase/migrations/0069_publish_dan_detail_panitia.sql
run tests/sql/35_detail_live_score_panitia.sql
# 0070 membuka SATU kolom fase ke anon supaya saklar di layar panitia berlaku
# seketika di halaman peserta. Tesnya menjaga yang paling mudah bocor: view
# itu tidak boleh membawa kolom lain dari status_acara.
run supabase/migrations/0070_fase_live_publik.sql
run tests/sql/36_fase_live_publik.sql
# 0071 mengubah angka di halaman peserta jadi jumlah MENDAFTAR, bukan lunas.
run supabase/migrations/0071_ringkas_publik_terdaftar.sql
# 0072 menambah centang per komponen dan nilai (hanya saat fase penuh) ke
# v_progres_publik, supaya halaman peserta bisa menggambar tabel yang sama
# bentuknya dengan layar panitia.
run supabase/migrations/0072_progres_komponen_publik.sql
# 0073 mengganti nama satu sekolah. Ikut dijalankan supaya berkasnya tetap
# teruji; di database uji ia memang tidak menemukan apa pun.
run supabase/migrations/0073_nama_al_azhar_citangkolo.sql
# 0074 membuka foto borongan: `foto_lembar.regu_id` boleh NULL, penautan
# nomor dada menyusul lewat `tautkan_foto`. Tes 37 yang menjaga bahwa foto
# yang belum tertaut tetap TERLIHAT — dengan `join` biasa ia lenyap dari
# v_foto_lembar tanpa satu pun galat.
run supabase/migrations/0074_foto_jawaban.sql
run tests/sql/37_foto_jawaban.sql
# 0075 menambah peran kelima `koordinator_pos` - juri pos TANPA pos, jadi
# pos_saya() NULL dan kelima pos terbuka. Tes 38 menjaga rantai itu:
# namanya diterima, posnya DITOLAK, dan juri pos biasa tetap terkunci.
run supabase/migrations/0075_koordinator_pos.sql
run tests/sql/38_koordinator_pos.sql
# 0076 mengubah bobot Pembidaian dan menambah lima lomba soal. Di database
# uji Pembidaian tidak ada (seed-nya generik), jadi bagian A melewati diri
# sendiri; bagian B tetap berjalan dan itulah yang diuji tes 39.
run supabase/migrations/0076_bidai_dan_lomba_soal.sql
run tests/sql/39_lomba_soal.sql
# 0077 membuat 'mengganti peran mengisi ulang centangnya' benar-benar
# terjadi - selama ini kalimat itu cuma ada di layar. Tes 40 menjaga
# akibatnya: sesudah turun dari admin, akunnya TIDAK lagi memegang akun
# dan pengaturan.
run supabase/migrations/0077_peran_mengisi_ulang_centang.sql
run tests/sql/40_peran_mengisi_ulang_centang.sql
# 0078 menyamakan nama akun seperti Gmail: titik tidak menjadikannya akun
# lain. Tes 41 menjaga BATASNYA — hanya titik dan besar-kecil huruf; `-`
# dan `_` tetap membedakan dua orang.
run supabase/migrations/0078_kunci_akun.sql
run tests/sql/41_kunci_akun.sql
# 0079 membekukan kunci lomba yang dipakai foto. Sebelumnya kunci itu
# DITURUNKAN dari nama tiap kali dibaca, jadi mengganti nama lomba memutus
# seluruh foto yang sudah diunggah untuknya — tanpa galat dan tanpa satu pun
# layar merah. Tes 42 menjaga yang tidak bersuara itu: namanya diganti, dan
# kuncinya harus DIAM.
run supabase/migrations/0079_kode_lomba_stabil.sql
run tests/sql/42_kode_lomba_stabil.sql
# 0080 menyalakan kembali unggah foto PER REGU. 0074 menambah constraint
# foto_lembar_taut_utuh tapi tidak memberi tahu penulis lamanya, jadi
# catat_foto_lembar menyisipkan regu_id tanpa cara_taut dan SETIAP unggahan
# per regu ditolak — sementara tes 37 tetap hijau karena ia cuma memanggil
# dua fungsi yang 0074 tulis sendiri. Tes 43 memanggil penulis lama itu.
run supabase/migrations/0080_catat_foto_lembar_taut.sql
run tests/sql/43_catat_foto_lembar_taut.sql
# 0081 memberi jalan MENGHAPUS satu foto slip. Foto adalah bukti, dan bukti
# yang hilang tidak menimbulkan galat apa pun — jadi yang dijaga tes 44 bukan
# "bisa dihapus", melainkan alasannya wajib, alasannya benar-benar tercatat
# sebelum barisnya hilang, dan juri pos tidak menjangkau pos lain.
run supabase/migrations/0081_hapus_foto_lembar.sql
run tests/sql/44_hapus_foto_lembar.sql
# 0082 membuat pesan "di luar rentang" menyebut KOMPONEN mana yang ditolak.
# Satu baris lembar pos punya tiga sampai lima kotak berdampingan dengan
# rentang berbeda-beda; kalimat tanpa nama kolom membuat petugas menebak, dan
# tebakan yang salah menimpa angka yang sudah benar. Tes 12 dan 03 tetap
# menjaga bentuk lamanya di titik sejarahnya masing-masing — mereka berjalan
# jauh di atas sini, saat fungsinya masih versi 0031.
run supabase/migrations/0082_pesan_rentang_menyebut_komponen.sql
run tests/sql/45_pesan_rentang_komponen.sql
# 0083 menyetel tanggal lomba yang sebenarnya: 29 Agustus 2026. Sampai sini
# database uji masih memakai tanggal contoh dari seed (2027-02-21), dan itu
# memang benar — tes 03-05 mematok jam berangkat pada hari itu, dan run.sh
# memutar ulang sejarahnya. Karena itu berkas ini di UJUNG, bukan di dekat
# seed. Tes 46 menjaga hasilnya, termasuk yang keluar dari v_keberangkatan.
run supabase/migrations/0083_tanggal_lomba_29_agustus_2026.sql
run tests/sql/46_tanggal_lomba.sql
# 0084 menurunkan biaya pendaftaran jadi Rp 175.000 per regu. Tanpa tes
# sendiri, dan itu disengaja: harga yang salah tidak diam — ia tercetak di
# form pendaftaran dan verifikasi_pembayaran menolak nominal yang tidak pas
# dengan galat yang menyebut kedua angkanya. Alasan lengkapnya di kepala
# berkasnya. Dijalankan di sini supaya pemeriksaan di dalamnya ikut terbukti.
run supabase/migrations/0084_biaya_175_ribu.sql
# 0085 membuat Menaksir dinilai dari TAKSIRAN peserta: yang diketik angka
# yang ditulis peserta, dan mesin skor yang menghitung selisihnya terhadap
# jawaban benar. Poin tidak pernah disimpan — ia diturunkan saat dibaca —
# jadi hitungan yang salah tidak menimbulkan galat apa pun, cuma angka
# yang masuk akal di kolom yang memang berisi angka. Tes 47 menjaga
# keempat sisinya, termasuk bahwa Pos 2 yang memakai `bertingkat` tanpa
# jawaban benar tidak ikut berubah.
run supabase/migrations/0085_menaksir_dari_taksiran.sql
# 0086 memindahkan taksiran ke SENTIMETER bulat. `nilai_mentah_bulat` (0059)
# menolak semua pecahan, dan kepalanya sendiri sudah menuliskan jalan
# keluarnya: simpan satuan terkecil yang bulat, persis seperti `detik`.
# Dijalankan SEBELUM tes 47 supaya yang diperiksa keadaan akhirnya.
run supabase/migrations/0086_menaksir_sentimeter.sql
run tests/sql/47_menaksir_dari_taksiran.sql
# 0087 memisahkan Kim Lihat dan Kim Cium jadi DUA lomba. `lomba` cuma satu
# kolom teks, dan mengisinya kembali tidak menimbulkan galat apa pun — ia
# hanya menggabungkan keduanya lagi di blangko, kolom foto, dan Live Score
# sekaligus. Tes 48 menjaga ketiganya, termasuk bahwa poinnya tidak ikut
# bergeser.
run supabase/migrations/0087_kim_dua_lomba.sql
run tests/sql/48_kim_dua_lomba.sql
# 0088 mencegah pengacakan nomor dada terlambat mengisi slot kosong di kloter
# yang sudah berangkat. Kloter tercetak tetap boleh dipilih; tes 49 membuat
# persis keadaan produksi: kloter 1-10 sudah jalan dan kloter 11 masih menunggu.
run supabase/migrations/0088_daftar_ulang_lewati_kloter_berangkat.sql
run tests/sql/49_daftar_ulang_lewati_kloter_berangkat.sql
# 0089 mengganti blok lama 10 menit -> 10 poin menjadi setiap satu menit
# selisih mutlak -> satu poin. Tes 50 menekan target tepat serta kedua arah:
# terlalu cepat dan terlambat harus dihukum sama.
run supabase/migrations/0089_penalti_waktu_per_menit.sql
run tests/sql/50_penalti_waktu_per_menit.sql
# 0090 adalah reset data production yang disengaja sebelum lomba sebenarnya:
# hapus seluruh jam berangkat, ceklis, dan baris closing, tetapi pertahankan
# kontrak, nomor dada, kloter, dan nilai. Ditaruh paling akhir karena seluruh
# tes alur sebelumnya memang membutuhkan data waktu.
run supabase/migrations/0090_reset_event_times.sql
run tests/sql/51_reset_event_times.sql
# 0091 menambah Intern PA/PI sebagai klasemen tersendiri. Keduanya hanya
# dinilai dari lima Soal Tulis dan ketepatan waktu, bukan lomba lapangan.
run supabase/migrations/0091_intern_golongan.sql
run tests/sql/52_intern_golongan.sql
# 0092 mengganti penyebaran sekolah per dua kloter dengan FIFO berkategori:
# otomatis 5 Eksternal + 3 Intern, manual tanpa batas, 300+50 regu dalam 60
# kloter yang perkiraannya dibagi rata sepanjang 07:00-10:00.
run supabase/migrations/0092_fifo_kloter_eksternal_intern.sql
run supabase/migrations/0093_configure_fifo_capacity.sql
run tests/sql/53_fifo_kloter_eksternal_intern.sql
# Timestamp cetak adalah catatan cetak terakhir, bukan gembok. Kloter berisi
# boleh ditandai lagi dan timestamp-nya harus maju; kloter kosong tetap lewat.
run supabase/migrations/0094_kloter_bisa_dicetak_ulang.sql
run tests/sql/54_kloter_bisa_dicetak_ulang.sql
# Layar Input Nilai Pos dan klasemen menghitung poin sendiri-sendiri, jadi
# keduanya bisa menyimpang tanpa satu galat pun — dan 0091 memang membangun
# ulang v_lembar_pos tanpa `jawaban_benar`, jadi Menaksir bernilai 0 di layar
# juri sementara klasemen memberi angka penuh. 0095 mengembalikannya; tes 56
# membandingkan kedua jalur baris per baris supaya rebuild berikutnya yang lupa
# jatuh di sini. Nomornya di atas 55 tetapi jalannya SEBELUM 55, karena cleanup
# mengosongkan nilai yang justru dibandingkannya.
run supabase/migrations/0095_lembar_pos_jawaban_benar.sql
run tests/sql/56_lembar_pos_sama_dengan_klasemen.sql
# Reset data operasional harus mempertahankan seluruh master Asal Sekolah.
# Ditaruh paling akhir karena cleanup memang mengosongkan pendaftaran, regu,
# nilai, dan data operasional lain yang dipakai tes sebelumnya.
run tests/sql/55_cleanup_preserves_schools.sql

echo "SEMUA TES LULUS"
