-- ============================================================================
-- hrcd-rekap : supabase/checks/lomba_per_pos.sql
-- Lomba apa saja yang ADA di produksi, per pos. MEMBACA SAJA.
--
-- KENAPA PERLU DIPERIKSA, BUKAN DIBACA DARI KODE
--
-- Pengelompokan lomba tidak ada di kode; ia DATA — `wahana.lomba` dan
-- `wahana.kode_lomba`. Dua migrasi mengubahnya (0076 mengelompokkan Pembidaian,
-- 0087 memisahkan KIM jadi dua), dan keduanya UPDATE tanpa jejak: kalau salah
-- satu tidak pernah dijalankan, atau dijalankan dengan urutan yang salah,
-- tidak ada satu pun galat yang muncul. Yang terlihat cuma layar yang
-- mengelompokkan lomba dengan cara yang tidak diharapkan siapa pun.
--
-- Itu BUKAN kemungkinan teoretis. `tests/dev_database.sh` menjalankan 0076
-- SESUDAH seed, yaitu sesudah 0087 — jadi di database dev, 0076 memasang
-- kembali `lomba = 'KIM'` yang baru saja dikosongkan 0087, dan KIM tergambar
-- sebagai SATU lomba. Produksi menjalankan migrasi berurutan dan seharusnya
-- tidak begitu; berkas ini yang membuktikannya, alih-alih menduganya.
--
-- Jalankan lewat apply-migration.yml. Tidak mengubah apa pun.
-- ============================================================================

\echo '=== 0. Versi server ==='
select version();

\echo ''
\echo '=== 1. Lomba per pos, beserta kunci tetap dan jumlah kriterianya ==='
-- Penyatuannya sama dengan kelompokLomba() di layar: coalesce(lomba, name).
-- KRITERIA DIHITUNG DARI NAMA BERBEDA, bukan jumlah baris: satu penilaian yang
-- ditawarkan ke beberapa golongan menempati beberapa baris wahana
-- (CLAUDE.md 11.9), jadi menghitung barisnya akan melaporkan Logika
-- berkriteria dua.
select pos,
       coalesce(lomba, name)                   as lomba,
       count(distinct name)                    as kriteria,
       count(*)                                as baris_wahana,
       string_agg(distinct coalesce(kode_lomba, '(kosong)'), ', ') as kunci_foto
from wahana
where edisi = edisi_aktif()
group by pos, coalesce(lomba, name)
order by pos, 2;

\echo ''
\echo '=== 2. KIM: dua lomba (benar) atau satu (0087 tidak berlaku)? ==='
select case
         when count(*) filter (where coalesce(lomba, name) = 'KIM') > 0
           then 'SATU LOMBA — 0087 TIDAK BERLAKU di sini'
         else 'DUA LOMBA — 0087 berlaku'
       end as keadaan_kim,
       string_agg(kode || ' -> lomba=' || coalesce(lomba, '(kosong)')
                       || ', kunci=' || coalesce(kode_lomba, '(kosong)'),
                  '; ' order by sort_order)
from wahana
where edisi = edisi_aktif() and kode like 'kim%';

\echo ''
\echo '=== 3. Pembidaian: lima kriteria satu lomba (benar)? ==='
select count(*) as komponen_bidai,
       count(distinct coalesce(lomba, name)) as jadi_berapa_lomba,
       string_agg(distinct coalesce(kode_lomba, '(kosong)'), ', ') as kunci_foto
from wahana
where edisi = edisi_aktif() and kode like 'bidai%';

\echo ''
\echo '=== 4. Foto yang kunci lombanya TIDAK dikenal lagi ==='
-- Foto yang menyandang kunci yang sudah tidak ada di v_lomba_pos tidak akan
-- ketemu dari layar mana pun. Angkanya di sini supaya diketahui, bukan
-- ditemukan belakangan saat sebuah nilai dipertanyakan.
select f.pos, f.kode_lomba, count(*) as foto
from foto_lembar f
where not exists (select 1 from v_lomba_pos l
                  where l.edisi = edisi_aktif() and l.pos = f.pos and l.kode = f.kode_lomba)
group by f.pos, f.kode_lomba
order by f.pos, f.kode_lomba;
