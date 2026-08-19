-- ============================================================================
-- hrcd-rekap : cleanup_data_uji.sql
--
-- MENGHAPUS SELURUH DATA PESERTA EDISI AKTIF. Tidak bisa dibatalkan.
--
-- Dijalankan sekali, atas permintaan pemilik, setelah `isi_edisi.sql`
-- membuktikan bahwa seluruh 16 sekolah di produksi memang sisa pengetesan:
-- nama bergenerator ("SMA Tabel 054155", "SMK Uji Produksi", "SMP Uji
-- Deploy") dan alamat isian asal ("ABC", "HEHe", "Jl"), semuanya terdaftar
-- 12-13 Agustus 2026 — jendela pengetesan, sementara lombanya masih dua
-- minggu lagi (29 Agustus 2026) dan pendaftaran belum dibuka.
--
-- JANGAN dijalankan lagi setelah pendaftaran sungguhan dibuka. Berkas ini
-- tidak bisa membedakan sekolah uji dari sekolah asli; ia menghapus
-- SEMUANYA. Yang membedakan hanya orang yang menjalankannya.
--
-- ---------------------------------------------------------------------------
-- JALAN KEDUA: 16 AGUSTUS 2026
--
-- Diminta lagi oleh pemilik, dengan alasan yang sama dan data yang lebih
-- banyak: 55 regu, 24 sekolah, 791 nilai. Data pengganti akan diberikan
-- sesudahnya.
--
-- Dua tabel DITAMBAHKAN ke berkas ini pada kesempatan itu, karena keduanya
-- lahir sesudah jalan pertama: `nilai_terkunci` (0043) dan `foto_lembar`
-- (0047). Keduanya sebenarnya ikut terhapus lewat `on delete cascade` dari
-- regu, jadi tidak ada yang tertinggal — tapi daftar yang tidak menyebutnya
-- tidak bisa MEMBUKTIKAN itu, dan laporan sebelum/sesudah yang melewatkan
-- satu tabel adalah cara paling mudah percaya bahwa sesuatu sudah bersih
-- padahal belum. Ini penyakit yang sama dengan `tests/run.sh` (CLAUDE.md
-- 7.5): daftar yang ditulis tangan tidak ikut tumbuh sendiri.
--
-- Yang TIDAK bisa dijangkau SQL: berkas foto di bucket Storage `lembar`.
-- Menghapus baris `foto_lembar` tidak menghapus gambarnya. Saat ini bucket
-- itu kosong (0 baris), jadi tidak ada yang tertinggal — tapi kalau berkas
-- ini dijalankan lagi setelah ada foto, buckets-nya harus dibersihkan
-- terpisah lewat dashboard Supabase.
--
-- ---------------------------------------------------------------------------
-- JALAN KETIGA: 20 AGUSTUS 2026
--
-- Diminta pemilik menjelang HRCD XXXVII (29 Agustus 2026). Data yang ada saat
-- ini seluruhnya dummy: 54 regu bernama "Alah Siah Boy", "Reconnect Afk",
-- "Disconnect Ngelag" dan sejenisnya, 799 nilai, 24 pendaftaran.
--
-- SATU BARIS DITAMBAHKAN: `kloter.dicetak_pada` dikosongkan. Dua jalan pertama
-- melewatkannya, dan CLAUDE.md 12.4 menyimpan akibatnya — produksi sempat
-- membagi regu mulai dari kloter 17 karena 24 kloter pertama masih bertanda
-- tercetak.
--
-- Sejak 0066 tanda itu TIDAK lagi ikut memilih kloter, jadi pembagian tidak
-- akan meleset seperti dulu. Yang tersisa tetap perlu dibersihkan: layar Cetak
-- Kloter menandai kloter itu "sudah dicetak", jadi panitia bisa melewatinya
-- pada hari yang sebenarnya — dan `pindah_kloter` (0018) ikut melaporkan
-- tujuannya sebagai kloter yang kertasnya sudah beredar.
--
-- BUCKET FOTO KINI BENAR-BENAR BERISI, tidak lagi nol seperti catatan di atas.
-- Selain slip yang sengaja diunggah, ada berkas YATIM dari tiap percobaan
-- unggah per regu yang gagal sebelum migrasi 0080: gambarnya naik ke bucket
-- lebih dulu, barisnya ditolak constraint sesudahnya. SQL tidak bisa
-- menjangkau satu pun di antaranya. Bersihkan bucket `lembar` lewat dashboard
-- Supabase SESUDAH berkas ini dijalankan.
--
-- ---------------------------------------------------------------------------
-- KENAPA HARUS BERSIH SEBELUM KONFIGURASI DIGANTI
--
-- `0033` menolak memasang format XXXVII selama edisi aktif masih memuat satu
-- nilai pun. Nilai yang kehilangan komponen induknya bukan kehilangan angka,
-- melainkan kehilangan arti — dan itu tidak menimbulkan galat apa pun.
--
-- ---------------------------------------------------------------------------
-- YANG TIDAK DIHAPUS, DAN KENAPA
--
--   history          Jejak audit bersifat append-only dan tidak menunjuk
--                    baris lain lewat foreign key. Ia justru merekam
--                    penghapusan ini; membuangnya berarti membuang satu-
--                    satunya catatan bahwa pembersihan pernah terjadi.
--   nomor_dada_stok  Stok nomor fisik adalah konfigurasi, bukan data peserta.
--   akun_panitia     Akun panitia tidak ada hubungannya dengan pendaftaran.
--   pos / wahana     Konfigurasi penilaian; itu urusan 0033.
--
-- Urutannya mengikuti foreign key dari daun ke akar. Dijalankan lewat
-- workflow "Apply migration to Supabase", yang membungkusnya dalam SATU
-- transaksi: kalau ada satu statement gagal, tidak ada yang terhapus.
-- ============================================================================

\echo '=== SEBELUM ==='
select 'sekolah' as tabel, count(*) from sekolah
union all select 'pendaftaran',        count(*) from pendaftaran
union all select 'regu',               count(*) from regu
union all select 'pembayaran',         count(*) from pembayaran
union all select 'nilai_mentah',       count(*) from nilai_mentah
union all select 'keberangkatan_regu', count(*) from keberangkatan_regu
union all select 'closing_regu',       count(*) from closing_regu
union all select 'penempatan_barak',   count(*) from penempatan_barak
union all select 'nomor_dada_pensiun', count(*) from nomor_dada_pensiun
union all select 'nilai_terkunci',     count(*) from nilai_terkunci
union all select 'foto_lembar',        count(*) from foto_lembar
union all select 'kloter berangkat',   count(*) from kloter where jam_berangkat is not null
union all select 'kloter tercetak',   count(*) from kloter where dicetak_pada is not null
order by 1;

-- ---------------------------------------------------------------------------
-- Hapus, dari daun ke akar.
-- ---------------------------------------------------------------------------
delete from nilai_mentah;
-- Keduanya ber-`on delete cascade` dari regu, jadi baris ini tidak wajib.
-- Ditulis tetap: penghapusan yang terlihat di berkas bisa dibaca dan
-- dihitung; penghapusan yang tersembunyi di definisi foreign key hanya
-- bisa dipercaya.
delete from nilai_terkunci;
delete from foto_lembar;
delete from closing_regu;
delete from keberangkatan_regu;
delete from penempatan_barak;
delete from pembayaran;
delete from regu;
delete from pendaftaran;
delete from sekolah;

-- Nomor dada yang dipensiunkan saat menguji penukaran: dikembalikan ke
-- antrean, karena regu yang pernah memakainya sudah tidak ada.
delete from nomor_dada_pensiun;

-- Jam berangkat kloter ikut lahir dari pengetesan. Dibiarkan, garis start
-- akan menganggap seluruh kloter sudah berangkat sebelum ada yang datang.
update kloter set jam_berangkat = null where jam_berangkat is not null;

-- Tanda cetak juga. Layar Cetak Kloter membacanya sebagai "kertasnya sudah
-- beredar", dan kloter yang bertanda dari pengetesan bisa dilewati panitia
-- pada hari yang sebenarnya (CLAUDE.md 12.4).
update kloter set dicetak_pada = null where dicetak_pada is not null;

-- Saklar hari-H dikembalikan ke keadaan sebelum lomba.
update status_acara set
  daftar_ulang_ditutup = false,
  fase_live            = 'pra',
  konfigurasi_terkunci = false;

\echo ''
\echo '=== SESUDAH ==='
select 'sekolah' as tabel, count(*) from sekolah
union all select 'pendaftaran',        count(*) from pendaftaran
union all select 'regu',               count(*) from regu
union all select 'pembayaran',         count(*) from pembayaran
union all select 'nilai_mentah',       count(*) from nilai_mentah
union all select 'keberangkatan_regu', count(*) from keberangkatan_regu
union all select 'closing_regu',       count(*) from closing_regu
union all select 'penempatan_barak',   count(*) from penempatan_barak
union all select 'nomor_dada_pensiun', count(*) from nomor_dada_pensiun
union all select 'nilai_terkunci',     count(*) from nilai_terkunci
union all select 'foto_lembar',        count(*) from foto_lembar
union all select 'kloter berangkat',   count(*) from kloter where jam_berangkat is not null
union all select 'kloter tercetak',   count(*) from kloter where dicetak_pada is not null
order by 1;
