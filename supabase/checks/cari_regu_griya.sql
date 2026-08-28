-- ============================================================================
-- hrcd-rekap : supabase/checks/cari_regu_griya.sql
--
-- Di mana orang-orang "Griya Wesi Jaya" sebenarnya berada di PRODUKSI.
-- Hanya MEMBACA.
--
-- ---------------------------------------------------------------------------
-- KENAPA BERKAS INI ADA
--
-- Baris 150 jawaban Google Form berbunyi:
--
--   Griya Wesi Jaya · SMK LPS 1 Ciamis · ketua Azka Mugia Bagja
--   anggota: Muhammad Rizky Prasetya, Muhamad Husni Farihi,
--            Fahri Tria Fauzi, Raffa Muhamad Ilham
--
-- Pemilik acara menduga regu itu sudah berganti nama jadi WIRATAMA DARUSSALAM.
-- Dugaan itu SAYA JAWAB "bukan" — dan jawaban itu diambil dari database UJI,
-- lalu disampaikan seolah fakta tentang sistem. Database uji hanya berisi hasil
-- migrasi; produksi juga menerima pendaftaran lewat form yang hidup dan
-- suntingan panitia lewat layar Data Peserta. Nama regu di keduanya bisa
-- berbeda, dan memang berbeda: 0136 melewatkan dua nama yang tidak sama di
-- kedua tempat.
--
-- Yang benar bukan menebak lebih hati-hati, melainkan bertanya ke tempat yang
-- ditanyakan. Berkas ini bertanya ke produksi.
--
-- ---------------------------------------------------------------------------
-- DICARI LEWAT ORANGNYA, BUKAN NAMA REGUNYA
--
-- Nama regu justru hal yang diduga berubah, jadi ia kunci yang paling buruk.
-- Nama ketua dan anggota tidak ikut berubah saat regu diganti nama — itu
-- alasan yang sama yang dipakai 0136 untuk mencocokkan 13 regu yang sudah
-- di-adjust panitia.
-- ============================================================================

select 'cari lewat ketua / anggota' as bagian,
       d.kode_pembayaran,
       s.name      as sekolah,
       r.nama_regu,
       r.golongan,
       r.nama_ketua,
       coalesce(array_to_string(r.anggota, ' | '), '(kosong)') as anggota,
       to_char(d.created_at at time zone 'Asia/Jakarta', 'DD/MM/YYYY HH24:MI') as tanggal
from regu r
join pendaftaran d on d.id = r.pendaftaran_id
join sekolah s     on s.id = d.sekolah_id
where r.nama_ketua ilike '%Azka Mugia%'
   or array_to_string(coalesce(r.anggota, '{}'), ' ') ilike '%Rizky Prasetya%'
   or array_to_string(coalesce(r.anggota, '{}'), ' ') ilike '%Husni Farihi%'
   or array_to_string(coalesce(r.anggota, '{}'), ' ') ilike '%Fahri Tria%'
   or array_to_string(coalesce(r.anggota, '{}'), ' ') ilike '%Raffa Muhamad Ilham%'
order by r.nama_regu;

-- Dan sebaliknya: apa saja yang bernama Wiratama atau Griya, siapa pun
-- ketuanya. Kalau keduanya ada, yang mana yang mana jadi jelas sekaligus.
select 'cari lewat nama regu' as bagian,
       d.kode_pembayaran,
       s.name      as sekolah,
       r.nama_regu,
       r.nama_ketua,
       coalesce(array_to_string(r.anggota, ' | '), '(kosong)') as anggota
from regu r
join pendaftaran d on d.id = r.pendaftaran_id
join sekolah s     on s.id = d.sekolah_id
where r.nama_regu ilike '%wiratama%'
   or r.nama_regu ilike '%griya%'
   or r.nama_regu ilike '%wesi%'
order by r.nama_regu;

-- Sekolahnya sendiri: SMK LPS 1 Ciamis ada atau tidak di produksi.
select 'sekolah LPS' as bagian, id, name, address
from sekolah
where name ilike '%LPS%';
