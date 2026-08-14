-- ============================================================================
-- hrcd-rekap : isi_edisi.sql — apa yang sebenarnya ada di edisi aktif.
--
-- HANYA MEMBACA. Tidak ada satu pun DELETE, UPDATE, atau INSERT di sini, jadi
-- aman dijalankan kapan saja — termasuk lewat workflow "Apply migration to
-- Supabase", yang memang menjalankan berkas apa pun yang disebut.
--
-- Dibuat saat konfigurasi HRCD XXXVII menolak dipasang karena edisi aktif
-- sudah memuat nilai. Pertanyaannya waktu itu satu: nilai siapa? Menghapus
-- data produksi tanpa tahu asalnya adalah cara paling cepat kehilangan
-- sesuatu yang ternyata bukan sampah.
--
--   psql "$SUPABASE_DB_URL" -f supabase/checks/isi_edisi.sql
-- ============================================================================

\echo '=== EDISI AKTIF ==='
select nomor, name, tanggal_lomba, is_active from edisi where is_active;

\echo ''
\echo '=== POS ==='
select nomor, name, bobot, bayangan,
       (select count(*) from wahana w
        where w.edisi = p.edisi and w.pos = p.nomor) as komponen
from pos p where p.edisi = edisi_aktif() order by nomor;

\echo ''
\echo '=== NILAI MENTAH: dari pos mana, regu mana, siapa yang memasukkan ==='
select w.pos, w.kode, count(*) as baris,
       min(n.created_at) as pertama, max(n.created_at) as terakhir
from nilai_mentah n join wahana w on w.id = n.wahana_id
where w.edisi = edisi_aktif()
group by w.pos, w.kode order by w.pos, w.kode;

\echo ''
\echo '=== REGU yang punya nilai — dari sekolah mana ==='
select distinct r.nomor_dada, r.nama_regu, s.name as sekolah, r.golongan
from nilai_mentah n
join wahana w on w.id = n.wahana_id
join regu r   on r.id = n.regu_id
join pendaftaran d on d.id = r.pendaftaran_id
join sekolah s on s.id = d.sekolah_id
where w.edisi = edisi_aktif()
order by r.nomor_dada;

\echo ''
\echo '=== JEJAK LAIN yang ikut menahan konfigurasi ==='
select 'regu bernomor dada' as apa, count(*) from regu where nomor_dada is not null
union all select 'keberangkatan tercatat', count(*) from keberangkatan_regu
union all select 'closing tercatat',       count(*) from closing_regu
union all select 'sekolah SMOKE TEST',     count(*) from sekolah where name like 'SMOKE TEST%'
union all select 'sekolah UJI',            count(*) from sekolah where name like 'UJI%';
