-- ============================================================================
-- hrcd-rekap : lalu_lintas.sql — berapa banyak yang ditulis ke database, kapan.
--
-- HANYA MEMBACA. Tidak ada INSERT, UPDATE, DELETE, maupun DDL di berkas ini;
-- ia aman dijalankan kapan saja lewat apply-migration.yml, sama seperti
-- status_migrasi.sql.
--
-- Dipakai untuk menjawab satu pertanyaan: seberapa berat sistem ini dipakai
-- pada hari lomba, dan di jam berapa puncaknya. Yang diukur penulisan ke
-- database — input nilai, kedatangan, keberangkatan, pendaftaran — bukan
-- pembacaan. Pembacaan tidak meninggalkan jejak di sini; angkanya ada di
-- dashboard Supabase dan Cloudflare.
--
-- HANYA ANGKA AGREGAT, TIDAK ADA DATA PRIBADI. Log Actions repo ini terbaca
-- siapa pun sejak repo dibuka publik, jadi tidak satu pun nama regu, nama
-- anggota, nomor WA, atau nama sekolah boleh keluar dari berkas ini. Kalau
-- suatu saat ada yang menambahkan kolom identitas ke salah satu query di
-- bawah, itu menerbitkannya ke publik — bukan sekadar menampilkannya.
--
-- Waktu ditampilkan WIB (Asia/Jakarta), bukan UTC: yang membaca laporan ini
-- mengingat kejadiannya dalam jam lokal.
-- ============================================================================

\pset border 2
\echo ''
\echo '=== 0. Cakupan ==='
select min(changed_at at time zone 'Asia/Jakarta') as paling_awal,
       max(changed_at at time zone 'Asia/Jakarta') as paling_akhir,
       count(*) as total_baris_history
from history;

\echo ''
\echo '=== 1. Penulisan per hari (28-30 Agustus, WIB) ==='
select (changed_at at time zone 'Asia/Jakarta')::date as tanggal,
       count(*) as penulisan,
       count(distinct changed_by) as akun_menulis,
       count(distinct table_name) as tabel_tersentuh
from history
where (changed_at at time zone 'Asia/Jakarta')::date
      between date '2026-08-28' and date '2026-08-30'
group by 1 order by 1;

\echo ''
\echo '=== 2. Penulisan per tabel per hari ==='
select (changed_at at time zone 'Asia/Jakarta')::date as tanggal,
       table_name, action, count(*) as jumlah
from history
where (changed_at at time zone 'Asia/Jakarta')::date
      between date '2026-08-28' and date '2026-08-30'
group by 1, 2, 3
having count(*) > 0
order by 1, 4 desc;

\echo ''
\echo '=== 3. Hari lomba per JAM — di sinilah puncaknya terlihat ==='
select to_char(changed_at at time zone 'Asia/Jakarta', 'YYYY-MM-DD HH24') || ':00' as jam,
       count(*) as penulisan,
       count(*) filter (where table_name = 'nilai_mentah') as input_nilai,
       count(distinct changed_by) as akun_aktif
from history
where (changed_at at time zone 'Asia/Jakarta')::date
      between date '2026-08-28' and date '2026-08-30'
group by 1 order by 1;

\echo ''
\echo '=== 4. Menit tersibuk (10 teratas) — puncak beban tulis sesungguhnya ==='
select to_char(changed_at at time zone 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI') as menit,
       count(*) as penulisan
from history
where (changed_at at time zone 'Asia/Jakarta')::date
      between date '2026-08-28' and date '2026-08-30'
group by 1 order by 2 desc, 1 limit 10;

\echo ''
\echo '=== 5. Sebaran per akun — TANPA nama akun, hanya bentuk sebarannya ==='
select rank() over (order by count(*) desc) as peringkat_akun,
       count(*) as penulisan,
       count(*) filter (where table_name = 'nilai_mentah') as input_nilai,
       min(changed_at at time zone 'Asia/Jakarta')::time(0) as mulai,
       max(changed_at at time zone 'Asia/Jakarta')::time(0) as selesai
from history
where (changed_at at time zone 'Asia/Jakarta')::date
      between date '2026-08-28' and date '2026-08-30'
group by changed_by
order by 2 desc limit 15;

\echo ''
\echo '=== 6. Isi yang dihasilkan hari itu ==='
select
  (select count(*) from nilai_mentah)                                as nilai_tersimpan,
  (select count(*) from regu where nomor_dada is not null)           as regu_bernomor,
  (select count(*) from keberangkatan_regu)                          as regu_berangkat,
  (select count(*) from closing_regu)                                as regu_datang,
  (select count(*) from foto_lembar)                                 as foto_lembar,
  (select count(*) from pendaftaran)                                 as pendaftaran;

\echo ''
\echo ''
\echo '=== 7. Berapa kali satu nilai disunting ulang — sinyal rework di layar ==='
select h.action, count(*) as baris_history
from history h where h.table_name = 'nilai_mentah'
group by 1 order by 2 desc;

\echo ''
\echo '=== 8. Yang ditulis ulang cron tiap 5 menit ==='
-- cache_live_score cuma SATU baris (pkey `tunggal`), jadi yang menarik bukan
-- jumlahnya melainkan besarnya: segitu yang dihitung ulang dan ditulis ulang
-- setiap kali cron jalan, 83 kali pada hari lomba.
select pg_size_pretty(length(data::text)::bigint) as besar_payload,
       jsonb_array_length(data -> 'rekap') as baris_rekap,
       dibuat_pada at time zone 'Asia/Jakarta' as terakhir_disegarkan
from cache_live_score;
