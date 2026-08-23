-- ============================================================================
-- hrcd-rekap : 0107_poin_per_komponen.sql
-- Poin akhir TIAP KOMPONEN, supaya Live Score bisa menampilkan nilai — bukan
-- angka mentahnya.
--
-- ---------------------------------------------------------------------------
-- KENAPA
--
-- Live Score dibaca orang yang ingin tahu SIAPA UNGGUL, bukan berapa detik
-- larinya. Sampai sekarang tabel rinciannya menampilkan angka mentah, dan
-- angka mentah tidak bisa dibandingkan antar kolom:
--
--   Semaphore   "4"      lima huruf benar -> sebenarnya 80 poin
--   Menaksir    "8.55"   meter            -> sebenarnya 100 poin
--   Bakiak      "01:14"  waktu tempuh     -> sebenarnya 60 poin
--
-- Tiga kolom bersebelahan, tiga satuan berbeda, dan tidak satu pun menyebut
-- sumbangannya ke Total di ujung baris. Pembaca harus tahu tangga poin tiap
-- lomba di kepalanya sebelum baris itu berarti apa-apa — dan yang membaca
-- papan ini justru orang yang paling tidak punya tangga itu: pembina, peserta,
-- dan panitia yang bukan juri lomba tersebut.
--
-- Rekapitulasi panitia (#/rekap) TIDAK ikut berubah. Di sana angka mentah
-- justru yang dicari: ia lembar kerja untuk mencocokkan layar dengan kertas.

--
-- ---------------------------------------------------------------------------
-- KENAPA KOLOM BARU, BUKAN DIHITUNG DI BROWSER
--
-- "Layar tidak pernah menghitung skor sendiri, supaya tidak ada mesin skor
-- kedua yang bisa berbeda pendapat dengan v_poin_pos" — komentar itu sudah
-- ada di kepala layar Input Pos dan Rekapitulasi, dan berlaku sama di sini.
-- Menyalin `hitung_poin` ke JavaScript berarti tangga Menaksir hidup di dua
-- tempat, dan yang di browser akan basi pada edisi pertama yang mengubahnya.
--
-- ---------------------------------------------------------------------------
-- DUA VIEW, DUA CARA MENGAMBILNYA — DAN ITU BUKAN KELALAIAN
--
-- `v_rekap_penuh` security_invoker, jadi ia boleh memakai `v_poin_wahana`
-- (yang juga invoker): keduanya diperiksa terhadap hak pemanggil yang sama.
--
-- `v_progres_publik` DEFINER — itulah yang membuat anon boleh membacanya.
-- View invoker yang dipanggil dari dalam view definer tetap diperiksa
-- terhadap hak PEMANGGIL, jadi `v_poin_wahana` di dalamnya akan mengembalikan
-- nol baris untuk anon, tanpa satu pun galat. Karena itu yang di sana
-- memanggil `hitung_poin()` langsung atas tabel dasarnya — pola yang sama
-- persis dengan kolom `nilai` yang sudah ada di view itu, dan dengan
-- `v_lembar_pos` (lihat 0085 bagian 3b).
--
-- ---------------------------------------------------------------------------
-- KOLOMNYA DITAMBAH DI UJUNG, dan itu keharusan, bukan selera.
-- `create or replace view` menolak daftar kolom yang berubah urutan atau
-- tipenya; hanya penambahan di belakang yang diizinkan. Menyisipkan `poin` di
-- sebelah `nilai` akan menuntut drop + create, dan drop membuang GRANT-nya —
-- termasuk `grant select ... to anon` yang menghidupkan halaman peserta.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. v_rekap_penuh — badannya disalin utuh dari definisi termuda (0065, lalu
--    saringannya dilebarkan 0069). Yang bertambah: satu CTE dan satu kolom.
-- ---------------------------------------------------------------------------
create or replace view v_rekap_penuh with (security_invoker = on) as
with nilai_per_regu as (
  select
    n.regu_id,
    jsonb_object_agg(w.pos || '.' || w.kode, jsonb_build_object(
      'nilai_1', n.nilai_1, 'nilai_2', n.nilai_2)) as nilai
  from nilai_mentah n
  join wahana w on w.id = n.wahana_id
  where w.edisi = edisi_aktif()
  group by n.regu_id
),
poin_per_regu as (
  select pp.regu_id, jsonb_object_agg(pp.pos::text, pp.poin_pos) as poin_pos
  from v_poin_pos pp
  group by pp.regu_id
),
-- BARU. Kuncinya `pos.kode`, sama persis dengan `nilai` di atas, supaya layar
-- membaca keduanya dengan kunci yang sama dan tidak perlu memetakan apa pun.
poin_per_komponen as (
  select pk.regu_id,
         jsonb_object_agg(pk.pos || '.' || pk.kode, pk.poin) as poin
  from v_poin_wahana pk
  group by pk.regu_id
),
berangkat as (
  select distinct kb.regu_id from keberangkatan_regu kb
)
select
  r.id            as regu_id,
  kl.peringkat,
  r.nomor_dada,
  r.nama_regu,
  s.name          as nama_sekolah,
  r.golongan,

  coalesce(npr.nilai,    '{}'::jsonb) as nilai,
  coalesce(ppr.poin_pos, '{}'::jsonb) as poin_pos,

  r.kloter_nomor  as kloter,
  k.jam_berangkat,
  c.jam_datang,
  r.kontrak_menit,
  pw.selisih_menit,
  case when k.jam_berangkat is not null and c.jam_datang is not null
    then round(extract(epoch from (c.jam_datang - k.jam_berangkat)) / 60)::int
  end             as tempuh_menit,
  c.anggota_hadir,

  t.total_pos,
  pw.penalti_waktu,
  t.penalti_checkout,
  t.penalti_anggota,
  t.total,

  (b.regu_id is not null) as sudah_berangkat,
  (c.regu_id is not null) as sudah_closing,

  -- Kolom BARU, di ujung. Lihat kepala berkas.
  coalesce(pkm.poin, '{}'::jsonb) as poin

from regu r
join pendaftaran d       on d.id = r.pendaftaran_id
join sekolah s           on s.id = d.sekolah_id
join v_total_skor t      on t.regu_id = r.id
join v_penalti_waktu pw  on pw.regu_id = r.id
left join v_klasemen kl  on kl.regu_id = r.id
left join kloter k       on k.nomor = r.kloter_nomor
left join closing_regu c on c.regu_id = r.id
left join nilai_per_regu npr on npr.regu_id = r.id
left join poin_per_regu ppr  on ppr.regu_id = r.id
left join poin_per_komponen pkm on pkm.regu_id = r.id
left join berangkat b        on b.regu_id = r.id
where boleh_apa_saja('rekap', 'live_score');

comment on view v_rekap_penuh is
  'Rekap lengkap panitia. `nilai` angka mentah per komponen, `poin` poin akhir per komponen, `poin_pos` totalnya per pos. Haknya lewat boleh(rekap) atau boleh(live_score).';

-- ---------------------------------------------------------------------------
-- 2. v_progres_publik — badannya disalin utuh dari 0072. Yang bertambah satu
--    kolom, dengan pagar fase yang SAMA PERSIS dengan `nilai` di atasnya.
--
--    Pagar itu bukan hiasan: poin diturunkan dari nilai, jadi menerbitkannya
--    lebih awal membocorkan hasil lomba sama telanjangnya dengan menerbitkan
--    angka mentahnya. publish-live.yml memeriksa keduanya (CLAUDE.md 14.4).
-- ---------------------------------------------------------------------------
create or replace view v_progres_publik as
select
  r.nomor_dada,
  r.nama_regu,
  s.name as nama_sekolah,
  r.golongan,
  (select jsonb_object_agg(p.nomor::text,
            exists (select 1 from nilai_mentah n
                    join wahana w on w.id = n.wahana_id
                    where n.regu_id = r.id and w.pos = p.nomor))
   from pos p
   where p.edisi = edisi_aktif()
     and exists (select 1 from wahana w
                 where w.edisi = p.edisi and w.pos = p.nomor)) as pos_terlewati,
  exists (select 1 from closing_regu c where c.regu_id = r.id) as sudah_closing,
  r.kloter_nomor                              as kloter,
  r.kontrak_menit,
  k.jam_berangkat,
  case when k.jam_berangkat is not null and r.kontrak_menit is not null
    then k.jam_berangkat + make_interval(mins => r.kontrak_menit)
  end                                         as target_datang,
  c.jam_datang,
  exists (select 1 from keberangkatan_regu kb where kb.regu_id = r.id)
                                              as sudah_berangkat,

  (select coalesce(jsonb_object_agg(w.pos || '.' || w.kode,
            exists (select 1 from nilai_mentah n
                     where n.regu_id = r.id and n.wahana_id = w.id)), '{}'::jsonb)
   from wahana w
   where w.edisi = edisi_aktif()
     and (w.golongan is null or w.golongan = r.golongan))    as komponen_terisi,

  case when (select fase_live from status_acara) = 'penuh' then
    (select coalesce(jsonb_object_agg(w.pos || '.' || w.kode,
              jsonb_build_object('nilai_1', n.nilai_1, 'nilai_2', n.nilai_2)), '{}'::jsonb)
     from nilai_mentah n join wahana w on w.id = n.wahana_id
     where n.regu_id = r.id and w.edisi = edisi_aktif())
  else '{}'::jsonb end                                        as nilai,

  -- Kolom BARU, di ujung. `hitung_poin()` dipanggil langsung, BUKAN lewat
  -- v_poin_wahana — alasannya di kepala berkas: view invoker di dalam view
  -- definer akan kosong untuk anon.
  case when (select fase_live from status_acara) = 'penuh' then
    (select coalesce(jsonb_object_agg(w.pos || '.' || w.kode,
              hitung_poin(w.form, n.nilai_1, n.nilai_2, w.poin_maks,
                          w.raw_terbaik, w.raw_terburuk, w.poin_benar,
                          w.poin_salah, w.total_soal, w.tingkat,
                          w.jawaban_benar)), '{}'::jsonb)
     from nilai_mentah n join wahana w on w.id = n.wahana_id
     where n.regu_id = r.id and w.edisi = edisi_aktif())
  else '{}'::jsonb end                                        as poin

from regu r
join pendaftaran d on d.id = r.pendaftaran_id
join sekolah s     on s.id = d.sekolah_id
left join kloter k        on k.nomor = r.kloter_nomor
left join closing_regu c  on c.regu_id = r.id
where not r.is_cancelled
  and d.status = 'lunas'
  and r.nomor_dada is not null
  and (select fase_live from status_acara) in ('progres', 'penuh');

comment on view v_progres_publik is
  'Baris regu untuk halaman peserta. `komponen_terisi` centang (boleh sejak fase progres); `nilai` dan `poin` hanya terisi di fase penuh.';

-- ---------------------------------------------------------------------------
-- 3. Laporan, dan dua pagar yang harus tetap berdiri.
-- ---------------------------------------------------------------------------
do $blok$
declare
  v_fase   text;
  v_kolom  int;
begin
  -- Kedua kolom `poin` benar-benar ada, dan namanya persis itu. Layar membaca
  -- `rk.poin` dan `b.poin`; kolom yang salah nama tidak menggagalkan apa pun,
  -- ia cuma membuat seluruh sel tergambar kosong.
  select count(*) into v_kolom
  from information_schema.columns
  where table_schema = 'public'
    and (table_name, column_name) in (
      ('v_rekap_penuh', 'poin'), ('v_progres_publik', 'poin'));
  assert v_kolom = 2,
    format('0107: kolom `poin` belum ada di kedua view (ketemu %s dari 2)', v_kolom);

  -- Pagar fase di v_progres_publik dibaca dari definisinya, bukan diandaikan.
  assert (select count(*) from pg_views
          where schemaname = 'public' and viewname = 'v_progres_publik'
            and definition like '%hitung_poin%'
            and definition like '%fase_live%') = 1,
    '0107: v_progres_publik menghitung poin tanpa menyebut fase_live — '
    'poin akan terbit sebelum hasil diumumkan.';

  select fase_live into v_fase from status_acara;
  raise notice '0107: poin per komponen terpasang. Fase sekarang %; kolom `poin` '
               'di halaman peserta terisi hanya saat fase penuh.', v_fase;
end;
$blok$;
