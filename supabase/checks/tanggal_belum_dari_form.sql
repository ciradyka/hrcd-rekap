-- ============================================================================
-- hrcd-rekap : supabase/checks/tanggal_belum_dari_form.sql
--
-- Pendaftaran mana yang tanggalnya MASIH tanggal impor, bukan tanggal form.
-- Hanya MEMBACA — tidak mengubah satu baris pun.
--
-- ---------------------------------------------------------------------------
-- KENAPA PERLU
--
-- 0136 menyamakan `created_at` dengan Timestamp Google Form, dan di produksi
-- ia melaporkan dua nama yang tidak ketemu: `sakura 2` dan `rajawali 2`. Di
-- database uji yang tidak ketemu justru dua nama lain.
--
-- Bedanya masuk akal: dev hanya berisi hasil migrasi, sementara produksi juga
-- menerima pendaftaran lewat form yang hidup DAN suntingan panitia lewat layar
-- Data Peserta. Regu yang sama bisa bernama lain di kedua tempat.
--
-- Yang tidak bisa ditebak dari laptop: nama apa yang dipakai produksi. Berkas
-- ini menanyakannya langsung, lewat apply-migration.yml, tanpa mengubah apa
-- pun — supaya sisa dua regu itu bisa dibetulkan dengan nama yang benar.
--
-- ---------------------------------------------------------------------------
-- CARA MEMBACANYA
--
-- Tanggal impor dikenali dari POLANYA, bukan dari satu jam yang ditulis mati:
-- puluhan pendaftaran dengan `created_at` yang sama persis sampai ke detik
-- hanya mungkin lahir dari satu perintah impor. Pembina tidak mengirim tiga
-- puluh formulir dalam satu detik yang sama.
-- ============================================================================

-- 1. Jam yang dipakai banyak pendaftaran sekaligus — itulah cap impornya.
select 'cap impor yang tersisa' as bagian,
       to_char(created_at at time zone 'Asia/Jakarta', 'DD/MM/YYYY HH24:MI:SS') as jam,
       count(*) as jumlah
from pendaftaran
group by created_at
having count(*) > 3
order by count(*) desc;

-- 2. Regu yang menempel pada cap itu, beserta ketuanya. Ketua yang menentukan
--    baris form mana pasangannya — nama regu sudah berubah, nama ketua tidak.
select 'regu yang tanggalnya belum dari form' as bagian,
       d.kode_pembayaran,
       s.name  as sekolah,
       r.nama_regu,
       r.nama_ketua,
       to_char(d.created_at at time zone 'Asia/Jakarta', 'DD/MM/YYYY HH24:MI') as tanggal
from pendaftaran d
join regu r    on r.pendaftaran_id = d.id and not r.is_cancelled
join sekolah s on s.id = d.sekolah_id
where d.created_at in (
  select created_at from pendaftaran group by created_at having count(*) > 3)
order by s.name, r.nama_regu;
