-- ============================================================================
-- hrcd-rekap : lihat_sekolah_uji.sql
--
-- MELAPORKAN sekolah sisa pengetesan. TIDAK MENGHAPUS APA PUN.
--
-- ---------------------------------------------------------------------------
-- KENAPA PERLU
--
-- `cleanup_data_uji.sql` sengaja tidak menyentuh `sekolah` — master Asal
-- Sekolah dipakai kembali lintas reset, dan itu benar. Tapi arah sebaliknya
-- tidak pernah diurus: SIMULASI MENAMBAH baris sekolah, dan tidak ada yang
-- membuangnya.
--
--   simulasi_end_to_end.sql  memanggil submit_pendaftaran() belasan kali, dan
--                            fungsi itu melahirkan baris `sekolah` untuk nama
--                            yang belum ada
--   seed_data_uji.sql        memberi sekolah baru alamat
--                            "(data uji - HRCD XXXVI)"
--
-- Endapannya bertambah tiap putaran simulasi, dan semuanya muncul di kotak
-- pilihan Asal Sekolah waktu pembina mendaftar.
--
-- ---------------------------------------------------------------------------
-- KENAPA HANYA MELAPORKAN
--
-- Menghapus baris master tidak bisa diurungkan, dan tidak ada satu aturan pun
-- yang bisa membedakan "sekolah uji" dari "sekolah asli yang kebetulan belum
-- masuk daftar kurasi" tanpa mata manusia. Berkas ini menyiapkan bahannya:
-- tiap kandidat diberi SEBAB, supaya yang memutuskan tidak perlu menebak.
--
-- ---------------------------------------------------------------------------
-- DAFTAR KURASI DIAMBIL DARI 0063
--
-- Migrasi itu memakai tabel SEMENTARA dan membuangnya di akhir, jadi tidak ada
-- jejak di database tentang sekolah mana yang dikurasi. Daftar 188 nama di
-- bawah disalin mesin dari berkas migrasinya, bukan diketik ulang — dua daftar
-- yang diketik terpisah akan berbeda diam-diam.
--
-- Pencocokannya lewat `kunci_sekolah()`, kunci yang JINAK — sama dengan yang
-- dipakai database untuk menyatakan dua baris sekolah yang sama (CLAUDE.md
-- 12.10). Yang agresif (`kunci()` di normalize_sekolah.py) akan melebur dua
-- sekolah berbeda, dan di laporan yang berakhir pada penghapusan itu bukan
-- kesalahan yang bisa diurungkan.
-- ============================================================================

\echo '=== SEKOLAH: RINGKASAN ==='

-- TANPA `on commit drop`: psql menjalankan tiap pernyataan sebagai transaksi
-- sendiri, jadi tabelnya akan hilang sebelum baris pertama sempat masuk.
-- Tabel sementara tetap lenyap sendiri saat sesi psql-nya ditutup.
drop table if exists kurasi_nama;
create temporary table kurasi_nama (nama text primary key);
insert into kurasi_nama (nama) values
  ('MA Agrowisata Shaleha'),
  ('MA Al-Azhar Kota Banjar'),
  ('MA Al-Hasan'),
  ('MA Al-Ishlah'),
  ('MA Al-Kautsar'),
  ('MA Al-Ma''''sum Malausma'),
  ('MA Assalimiyah'),
  ('MA BKMU Cikijing'),
  ('MA Darul Huda'),
  ('MA El-Bas'),
  ('MA Ibadul Ghafur'),
  ('MA Nurul Huda'),
  ('MA PERSIS Sindangkasih'),
  ('MA PUI Cijantung'),
  ('MA Terpadu Ar-Rahman'),
  ('MA YPI Rijalul Hikam'),
  ('MAN 1 Kota Tasikmalaya'),
  ('MAN 1 Kuningan'),
  ('MAN 1 Sukabumi'),
  ('MAN 2 Ciamis'),
  ('MAN 3 Ciamis'),
  ('MAN 3 Tasikmalaya'),
  ('MAN 4 Bantul Yogyakarta'),
  ('MAN 4 Jakarta'),
  ('MAN 5 Ciamis'),
  ('MAN 6 Ciamis'),
  ('MAN 6 Tasikmalaya'),
  ('MAN Darussalam'),
  ('MTs Al-Fadliliyah Darussalam'),
  ('MTs Al-Hasan Banjarsari'),
  ('MTs Al-Huda Sadananya'),
  ('MTs Al-Iqna Cisaga'),
  ('MTs Al-Istiqomah Kiarapayung'),
  ('MTs Ar-Rahman'),
  ('MTs Assalamiyah'),
  ('MTs At-Tabiyah'),
  ('MTs El-Bas'),
  ('MTs Harapan Baru'),
  ('MTs PUI Cijantung'),
  ('MTs Rancah'),
  ('MTs Rijalul Hikam'),
  ('MTs Rijalul Ulum'),
  ('MTs Serba Bakti Suryalaya'),
  ('MTsN 2 Banjar'),
  ('MTsN 2 Ciamis'),
  ('MTsN 5 Ciamis'),
  ('MTsN 9 Tasikmalaya'),
  ('MTsN Rajadesa'),
  ('SMA 1 Sindangkasih'),
  ('SMA Al Hasan Banjarsari'),
  ('SMA Al Irsyad Al Islamiyyah'),
  ('SMA Al-Muttaqin'),
  ('SMA Binaul Ummah'),
  ('SMA IT Al-Falah'),
  ('SMA Informatika Ciamis'),
  ('SMA Islam Ainurrafiq'),
  ('SMA Islam Nurul Fikri'),
  ('SMA Kesatrian 1 Semarang'),
  ('SMA Plus Assyfa'),
  ('SMA Plus Darussalam'),
  ('SMA Plus Ibnu Sina'),
  ('SMA Terpadu Ar-Risalah'),
  ('SMA Terpadu Cikanyere'),
  ('SMA Terpadu Dampasan'),
  ('SMA Terpadu Riyadlul Ulum'),
  ('SMA YRM Cihawar'),
  ('SMA Yadika Sumedang'),
  ('SMAN 1 Banjar'),
  ('SMAN 1 Banjarsari'),
  ('SMAN 1 Baregbeg'),
  ('SMAN 1 Cantigi'),
  ('SMAN 1 Ciamis'),
  ('SMAN 1 Cihaurbeuti'),
  ('SMAN 1 Cimaragas'),
  ('SMAN 1 Cineam'),
  ('SMAN 1 Cirebon'),
  ('SMAN 1 Cisaga'),
  ('SMAN 1 Kandanghaur'),
  ('SMAN 1 Kawali'),
  ('SMAN 1 Larangan'),
  ('SMAN 1 Lohbener'),
  ('SMAN 1 Maja'),
  ('SMAN 1 Majenang'),
  ('SMAN 1 Mangunjaya'),
  ('SMAN 1 Pamanukan'),
  ('SMAN 1 Pamarican'),
  ('SMAN 1 Panawangan'),
  ('SMAN 1 Parigi'),
  ('SMAN 1 Rancah'),
  ('SMAN 1 Sukadana'),
  ('SMAN 18 Garut'),
  ('SMAN 2 Banjarsari'),
  ('SMAN 2 Ciamis'),
  ('SMAN 3 Banjar'),
  ('SMAN 3 Ciamis'),
  ('SMAN 6 Depok'),
  ('SMAN 9 Tasikmalaya'),
  ('SMK Adi Sanggoro'),
  ('SMK Al Ihsan Pamarican'),
  ('SMK Al-Istiqomah Rancah'),
  ('SMK Bangkit Indonesia Talaga'),
  ('SMK Bhakti Kencana Banjar'),
  ('SMK Bhakti Kencana Ciamis'),
  ('SMK Bina Putera Nusantara Tasikmalaya'),
  ('SMK Darul Ilmi Panawangan'),
  ('SMK Galuh Rahayu'),
  ('SMK Informatika Citra Bangsa Panawangan'),
  ('SMK Karya Nasional Sindangkasih'),
  ('SMK Kehutanan Negeri Kadipaten'),
  ('SMK Ma''''arif NU Ciamis'),
  ('SMK Maarif Sabilunnajat Rancah'),
  ('SMK Miftahussalam'),
  ('SMK PGRI Cikoneng'),
  ('SMK PGRI Jatibarang'),
  ('SMK Siliwangi AMS Banjarsari'),
  ('SMK Taruna Indramayu'),
  ('SMK Telematika Indramayu'),
  ('SMK Terpadu Al Hasan Ciamis'),
  ('SMK YAPIIM Indramayu'),
  ('SMKN 1 Banjar'),
  ('SMKN 1 Binangun Kabupaten Cilacap'),
  ('SMKN 1 Ciamis'),
  ('SMKN 1 Cijulang'),
  ('SMKN 1 Cipaku'),
  ('SMKN 1 Gabuswetan'),
  ('SMKN 1 Japara'),
  ('SMKN 1 Kawali'),
  ('SMKN 1 Lemahabang'),
  ('SMKN 1 Losarang'),
  ('SMKN 1 Malausma'),
  ('SMKN 1 Padaherang'),
  ('SMKN 1 Rajadesa'),
  ('SMKN 1 Rancah'),
  ('SMKN 1 Sukra'),
  ('SMKN 1 Terisi'),
  ('SMKN 1 Widasari'),
  ('SMKN 2 Banjar'),
  ('SMKN 2 Ciamis'),
  ('SMKN 2 Indramayu'),
  ('SMKN 2 Kuningan'),
  ('SMKN 3 Banjar'),
  ('SMKN 3 Kuningan'),
  ('SMKN 3 Tasikmalaya'),
  ('SMKN Manonjaya'),
  ('SMP Al Irsyad Al Islamiyyah Purwokerto'),
  ('SMP BP Plus Ma''''arif NU Ciamis'),
  ('SMP IT Al Fawaz'),
  ('SMP IT Nurul Huda Margajaya'),
  ('SMP Islam Ainurrafiq'),
  ('SMP Islam Bahrul Ulum'),
  ('SMP Islam Terpadu Nurul Huda Kedungjajang'),
  ('SMP PUI Kawalu'),
  ('SMP SMA Islam Al-Ishlah bs'),
  ('SMP Terpadu Al Hasan Ciamis'),
  ('SMP Terpadu Ar-Risalah'),
  ('SMP Terpadu Dampasan'),
  ('SMP Terpadu Riyadlul Ulum Waddawah'),
  ('SMPN 1 Banjar'),
  ('SMPN 1 Banjarsari'),
  ('SMPN 1 Baregbeg'),
  ('SMPN 1 Ciamis'),
  ('SMPN 1 Cijeungjing'),
  ('SMPN 1 Cikoneng'),
  ('SMPN 1 Cimaragas'),
  ('SMPN 1 Cipaku'),
  ('SMPN 1 Cisaga'),
  ('SMPN 1 Karangpawitan Garut'),
  ('SMPN 1 Lelea'),
  ('SMPN 1 Lumbung'),
  ('SMPN 1 Padaherang'),
  ('SMPN 1 Purwadadi'),
  ('SMPN 1 Rajadesa'),
  ('SMPN 1 Sukamantri'),
  ('SMPN 2 Banjar'),
  ('SMPN 2 Baregbeg'),
  ('SMPN 2 Ciamis'),
  ('SMPN 2 Cijeungjing'),
  ('SMPN 2 Cilacap'),
  ('SMPN 2 Cipaku'),
  ('SMPN 2 Garut'),
  ('SMPN 2 Panawangan'),
  ('SMPN 2 Sukadana'),
  ('SMPN 3 Ciamis'),
  ('SMPN 3 Rajadesa'),
  ('SMPN 5 Banjar'),
  ('SMPN 6 Banjarsari'),
  ('SMPN 6 Ciamis'),
  ('SMPN 7 Banjar');

drop view if exists sekolah_nilai;
create temporary view sekolah_nilai as
select
  s.id,
  s.name,
  s.address,
  s.created_at,
  exists (select 1 from pendaftaran d where d.sekolah_id = s.id) as dirujuk,
  exists (select 1 from kurasi_nama k
           where kunci_sekolah(k.nama) = kunci_sekolah(s.name))   as di_kurasi,
  -- Penanda yang ditinggalkan alat uji itu sendiri; lihat kepala berkas.
  (s.address in ('ABC', 'HEHe', 'Jl')
   or s.address like '(data uji%'
   or s.name like 'SMA Tabel %'
   or s.name like 'SMOKE TEST%'
   or s.name like 'UJI KONKUREN%'
   or s.name ilike '% uji %'
   or s.name ilike 'SMP Uji%'
   or s.name ilike 'SMK Uji%')                                    as tanda_uji
from sekolah s;

select
  count(*)                                        as total,
  count(*) filter (where di_kurasi)               as di_kurasi,
  count(*) filter (where not di_kurasi)           as luar_kurasi,
  count(*) filter (where tanda_uji)               as bertanda_uji,
  count(*) filter (where dirujuk)                 as masih_dirujuk
from sekolah_nilai;

\echo ''
\echo '=== KANDIDAT SAPU (tidak dirujuk pendaftaran mana pun) ==='
\echo 'TIDAK ADA yang dihapus berkas ini.'
\echo ''

select
  s.name                                       as nama,
  left(s.address, 46)                          as alamat,
  to_char(s.created_at, 'DD Mon YYYY')         as dibuat,
  case
    when s.tanda_uji and not s.di_kurasi then 'bertanda uji'
    when s.tanda_uji and s.di_kurasi     then 'bertanda uji TAPI ada di kurasi'
    else                                      'di luar daftar kurasi'
  end                                          as sebab
from sekolah_nilai s
where not s.dirujuk
  and (s.tanda_uji or not s.di_kurasi)
order by (not s.tanda_uji), s.created_at, s.name;

\echo ''
\echo '=== MASIH DIRUJUK PENDAFTARAN (tidak bisa dihapus sebelum data operasional dibersihkan) ==='

select
  s.name                               as nama,
  left(s.address, 46)                  as alamat,
  (select count(*) from pendaftaran d where d.sekolah_id = s.id) as pendaftaran
from sekolah_nilai s
where s.dirujuk and (s.tanda_uji or not s.di_kurasi)
order by s.name;
