-- ============================================================================
-- 0163 : fase live kelima - `juara`.
--
-- Sesudah Top 10 masih ada satu keadaan yang belum punya bentuk publik: acara
-- sudah selesai, dan yang ditunggu peserta bukan lagi papan sementara
-- melainkan siapa juaranya. Sampai sekarang daftar itu cuma ada di layar
-- panitia; peserta menerimanya lewat pengeras suara.
--
-- APA YANG BERUBAH
--
--   1. `status_acara.fase_live` menerima nilai kelima, `juara`, dan
--      `atur_fase_live` ikut menerimanya.
--   2. Pagar `boleh('live_score')` DIPINDAH, bukan dilonggarkan: ia turun dari
--      dalam kedua fungsi penyusun daftar ke satu tempat, `hasil_kejuaraan()`.
--   3. View baru `v_kejuaraan_publik`, berpagar fase, boleh dibaca `anon`.
--
-- KENAPA PAGARNYA HARUS PINDAH
--
-- publish-live.yml tersambung sebagai pemilik database, bukan sebagai panitia
-- yang login. `boleh('live_score')` membaca `auth.uid()`, yang di sana NULL,
-- jadi seluruh daftar juara kosong untuk penerbit - dan berkas yang terbit ke
-- peserta akan berisi nol penghargaan tanpa satu pun galat. Yang menjaga
-- hasil_kejuaraan_dasar() dari panitia bukan `where` di dalamnya melainkan
-- `revoke all ... from public, authenticated` sejak 0140: ia SECURITY DEFINER
-- dan tidak seorang pun boleh memanggilnya langsung. Penjaga di ujung berkas
-- ini memeriksa persis itu, supaya pemindahan tadi tidak diam-diam berubah
-- jadi pelonggaran ketika suatu hari ada yang menambahkan grant.
--
-- TANPA SATU ANGKA SKOR, dan itu keputusan pemilik acara. Yang terbit cuma
-- nama penghargaan, nomor dada, nama regu, dan nama sekolah. `total`,
-- `poin_juara`, dan `jumlah_skor` tidak ikut sama sekali - bukan disembunyikan
-- tampilan, memang TIDAK ADA di kolomnya (CLAUDE.md 14.4). Halaman peserta
-- duduk di CDN dan bisa diminta siapa pun yang tahu alamatnya; satu-satunya
-- jaminan bahwa angka belum bocor adalah angkanya memang tidak ditulis.
--
-- FASE `juara` MENUTUP PAPAN DENGAN SENDIRINYA, tanpa satu baris pun
-- tambahan: v_klasemen_publik hanya membuka pada 'penuh' dan 'top10', dan
-- v_progres_publik hanya pada 'progres' dan 'penuh'. Jadi berkas yang terbit
-- pada fase ini memuat daftar juara dan tidak memuat papan - yang dilihat
-- peserta memang hanya kejuaraan.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Fase kelima
-- ---------------------------------------------------------------------------

alter table status_acara
  drop constraint status_acara_fase_live_check;

alter table status_acara
  add constraint status_acara_fase_live_check
  check (fase_live in ('pra', 'progres', 'penuh', 'top10', 'juara'));

create or replace function atur_fase_live(p_fase text)
returns text
language plpgsql security definer
set search_path = public
as $fn$
declare v_lama text;
begin
  if not boleh('pengaturan') then
    raise exception 'tidak berhak: pengaturan';
  end if;
  if p_fase not in ('pra', 'progres', 'penuh', 'top10', 'juara') then
    raise exception
      'fase tidak dikenal: % (pra / progres / penuh / top10 / juara)', p_fase;
  end if;

  select fase_live into v_lama from status_acara;
  if v_lama = p_fase then
    return v_lama;
  end if;

  update status_acara set fase_live = p_fase
   where fase_live is distinct from p_fase;

  raise notice 'fase_live: % -> %', v_lama, p_fase;
  return p_fase;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 2. Penyusun daftar, tanpa pagar hak di dalamnya
--
-- Isi kedua fungsi di bawah SAMA PERSIS dengan versi 0152/0153. Yang hilang
-- cuma tiga baris `where boleh('live_score')`, dan ketiganya muncul kembali
-- sebagai satu baris di hasil_kejuaraan() pada bagian 3.
--
-- Disalin utuh, bukan disunting di tempat, karena migrasi yang sudah
-- diterapkan ke produksi tidak pernah diedit (final-architecture.md bagian 2).
-- ---------------------------------------------------------------------------

create or replace function hasil_kejuaraan_dasar()
returns table (
  urutan integer, kode text, nama_penghargaan text, sumber text,
  regu_id uuid, nomor_dada integer, nama_regu text, nama_sekolah text,
  golongan text, total numeric
)
language sql stable security definer
set search_path = public
as $fn$
with
peringkat as (
  select k.*,
         row_number() over (
           partition by k.golongan
           order by k.total desc,
                    abs(coalesce(k.selisih_menit, 100000)) asc,
                    k.nomor_dada asc) as nomor_juara
  from v_klasemen k
),
nama_juara(nomor, nama) as (values
  (1, 'Juara I'), (2, 'Juara II'), (3, 'Juara III'),
  (4, 'Harapan I'), (5, 'Harapan II'), (6, 'Harapan III')
),
golongan_juara(kode, nama, urutan_dasar) as (values
  ('penegak_pa', 'Penegak PA', 10), ('penegak_pi', 'Penegak PI', 20),
  ('penggalang_pa', 'Penggalang PA', 40), ('penggalang_pi', 'Penggalang PI', 50)
),
baris_golongan as (
  select g.urutan_dasar + n.nomor as urutan,
         g.kode || '_' || n.nomor as kode,
         g.nama || ' ' || n.nama as nama_penghargaan,
         'skor'::text as sumber,
         p.regu_id, p.nomor_dada, p.nama_regu, p.nama_sekolah, p.golongan, p.total
  from golongan_juara g cross join nama_juara n
  left join peringkat p on p.golongan = g.kode and p.nomor_juara = n.nomor
),
calon_umum as (
  select nama_sekolah,
         count(*) filter (where nomor_juara <= 6) as jumlah_juara,
         sum(7 - nomor_juara) filter (where nomor_juara <= 6) as bobot_juara,
         sum(total) as jumlah_skor,
         case when golongan like 'penegak_%' then 'penegak' else 'penggalang' end as tingkat
  from peringkat
  group by nama_sekolah,
           case when golongan like 'penegak_%' then 'penegak' else 'penggalang' end
),
calon_semua as (
  select nama_sekolah, sum(jumlah_juara) jumlah_juara,
         sum(bobot_juara) bobot_juara, sum(jumlah_skor) jumlah_skor
  from calon_umum group by nama_sekolah
),
kandidat_umum as (
  select 'semua'::text tingkat, * from calon_semua
  union all
  select tingkat, nama_sekolah, jumlah_juara, bobot_juara, jumlah_skor
  from calon_umum
),
juara_umum as (
  select d.urutan, d.kode, d.nama nama_penghargaan,
         'skor'::text sumber, null::uuid regu_id, null::integer nomor_dada,
         null::text nama_regu, x.nama_sekolah, null::text golongan,
         null::numeric total
  from (values
    (1, 'juara_umum', 'Juara Umum ' || (select name from edisi where is_active), 'semua'),
    (2, 'juara_umum_penegak', 'Juara Umum Penegak', 'penegak'),
    (3, 'juara_umum_penggalang', 'Juara Umum Penggalang', 'penggalang')
  ) d(urutan, kode, nama, tingkat)
  left join lateral (
    select nama_sekolah from kandidat_umum k where k.tingkat = d.tingkat
    order by jumlah_juara desc, bobot_juara desc, jumlah_skor desc, nama_sekolah
    limit 1
  ) x on true
),
manual as (
  select 60 + v.urutan urutan, v.kode, v.nama, 'manual'::text,
         r.id, r.nomor_dada, r.nama_regu, s.name, r.golongan, null::numeric
  from (values (1, 'kostum', 'Juara Kostum'),
               (2, 'yel_yel', 'Juara Yel Yel'),
               (3, 'terfavorit', 'Peserta Terfavorit'),
               (4, 'terjauh', 'Peserta Terjauh')) v(urutan, kode, nama)
  left join kejuaraan_manual m on m.edisi = edisi_aktif() and m.kode = v.kode
  left join regu r on r.id = m.regu_id
  left join pendaftaran d on d.id = r.pendaftaran_id
  left join sekolah s on s.id = d.sekolah_id
),
terbanyak as (
  select 70 urutan, 'peserta_terbanyak' kode, 'Peserta Terbanyak' nama_penghargaan,
         'nomor_dada'::text sumber, null::uuid, null::integer, null::text,
         x.nama_sekolah, null::text, x.jumlah::numeric
  from (select s.name nama_sekolah, count(*) jumlah
        from regu r join pendaftaran d on d.id = r.pendaftaran_id
        join sekolah s on s.id = d.sekolah_id
        where r.nomor_dada is not null and not r.is_cancelled and d.status = 'lunas'
        group by s.name order by jumlah desc, s.name limit 1) x
)
select * from (
  select * from juara_umum
  union all select * from baris_golongan
  union all select * from manual
  union all select * from terbanyak
) semua
order by urutan
$fn$;

revoke all on function hasil_kejuaraan_dasar() from public, anon, authenticated;

create function hasil_kejuaraan_semua()
returns table (
  urutan integer, kode text, nama_penghargaan text, sumber text,
  regu_id uuid, nomor_dada integer, nama_regu text, nama_sekolah text,
  golongan text, total numeric, poin_juara numeric, jumlah_skor numeric
)
language sql stable security definer
set search_path = public
as $fn$
with
golongan_juara(kode, nama, nomor) as (values
  ('penegak_pa', 'Penegak PA', 1), ('penegak_pi', 'Penegak PI', 2),
  ('penggalang_pa', 'Penggalang PA', 3), ('penggalang_pi', 'Penggalang PI', 4)
),
peringkat_eksternal as (
  select k.*,
         row_number() over (
           partition by k.golongan
           order by k.total desc,
                    abs(coalesce(k.selisih_menit, 100000)) asc,
                    k.nomor_dada asc) as nomor_juara
  from v_klasemen k
  where k.golongan in
    ('penegak_pa', 'penegak_pi', 'penggalang_pa', 'penggalang_pi')
),
calon_umum as (
  select nama_sekolah,
         count(*) filter (where nomor_juara <= 6) as jumlah_juara,
         sum(7 - nomor_juara) filter (where nomor_juara <= 6) as bobot_juara,
         sum(total) filter (where nomor_juara <= 6) as jumlah_skor,
         case when golongan like 'penegak_%' then 'penegak' else 'penggalang' end as tingkat
  from peringkat_eksternal
  group by nama_sekolah,
           case when golongan like 'penegak_%' then 'penegak' else 'penggalang' end
),
calon_semua as (
  select nama_sekolah, sum(jumlah_juara) jumlah_juara,
         sum(bobot_juara) bobot_juara, sum(jumlah_skor) jumlah_skor
  from calon_umum group by nama_sekolah
),
kandidat_umum as (
  select 'semua'::text tingkat, * from calon_semua
  union all
  select tingkat, nama_sekolah, jumlah_juara, bobot_juara, jumlah_skor
  from calon_umum
),
juara_umum as (
  select d.urutan, d.kode, d.nama nama_penghargaan,
         'skor'::text sumber, null::uuid regu_id, null::integer nomor_dada,
         null::text nama_regu, x.nama_sekolah, null::text golongan,
         null::numeric total, x.bobot_juara poin_juara, x.jumlah_skor
  from (values
    (1, 'juara_umum', 'Juara Umum ' || (select name from edisi where is_active), 'semua'),
    (2, 'juara_umum_penegak', 'Juara Umum Penegak', 'penegak'),
    (3, 'juara_umum_penggalang', 'Juara Umum Penggalang', 'penggalang')
  ) d(urutan, kode, nama, tingkat)
  left join lateral (
    select nama_sekolah, bobot_juara, jumlah_skor
    from kandidat_umum k where k.tingkat = d.tingkat
    order by bobot_juara desc nulls last, jumlah_skor desc, nama_sekolah
    limit 1
  ) x on true
),
manual as (
  select a.urutan_dasar + g.nomor as urutan,
         a.kode || '_' || g.kode as kode,
         a.nama || ' ' || g.nama as nama_penghargaan,
         'manual'::text as sumber,
         r.id as regu_id, r.nomor_dada, r.nama_regu, s.name as nama_sekolah,
         r.golongan, null::numeric total,
         null::numeric poin_juara, null::numeric jumlah_skor
  from (values ('kostum', 'Juara Kostum', 60),
               ('terfavorit', 'Peserta Terfavorit', 68))
       a(kode, nama, urutan_dasar)
  cross join golongan_juara g
  left join kejuaraan_manual m
    on m.edisi = edisi_aktif() and m.kode = a.kode || '_' || g.kode
  left join regu r on r.id = m.regu_id
  left join pendaftaran d on d.id = r.pendaftaran_id
  left join sekolah s on s.id = d.sekolah_id
  union all
  select 73, 'terjauh', 'Pangkalan Terjauh', 'manual_sekolah',
         null::uuid, null::integer, null::text, s.name, null::text,
         null::numeric, null::numeric, null::numeric
  from (values (true)) satu(ada)
  left join kejuaraan_manual m
    on m.edisi = edisi_aktif() and m.kode = 'terjauh'
  left join sekolah s on s.id = m.sekolah_id
),
yel_yel as (
  select 64 + g.nomor as urutan,
         'yel_yel_' || g.kode as kode,
         'Juara Yel Yel ' || g.nama as nama_penghargaan,
         'skor'::text as sumber,
         y.regu_id, y.nomor_dada, y.nama_regu, y.nama_sekolah,
         y.golongan, y.poin_pos as total,
         null::numeric poin_juara, null::numeric jumlah_skor
  from golongan_juara g
  left join lateral (
    select k.regu_id, k.nomor_dada, k.nama_regu, k.nama_sekolah,
           k.golongan, pp.poin_pos
    from v_klasemen k
    join v_poin_pos pp on pp.regu_id = k.regu_id and pp.pos = 5
    where k.golongan = g.kode
    order by pp.poin_pos desc, k.total desc, k.nomor_dada
    limit 1
  ) y on true
),
terbanyak as (
  select 74, 'peserta_terbanyak', 'Peserta Terbanyak', 'nomor_dada'::text,
         null::uuid, null::integer, null::text, p.nama_sekolah,
         null::text, p.jumlah::numeric, null::numeric, null::numeric
  from (values (true)) satu(ada)
  left join lateral (
    select s.name nama_sekolah, count(*) jumlah
    from regu r
    join pendaftaran d on d.id = r.pendaftaran_id
    join sekolah s on s.id = d.sekolah_id
    where r.nomor_dada is not null and not r.is_cancelled
      and d.status = 'lunas' and r.golongan not like 'intern_%'
    group by s.name
    order by jumlah desc, s.name
    limit 1
  ) p on true
)
select * from (
  select d.urutan, d.kode, d.nama_penghargaan, d.sumber, d.regu_id,
         d.nomor_dada, d.nama_regu, d.nama_sekolah, d.golongan, d.total,
         null::numeric, null::numeric
  from hasil_kejuaraan_dasar() d
  where d.kode ~ '^(penegak|penggalang)_(pa|pi)_[1-6]$'
  union all select * from juara_umum
  union all select * from manual
  union all select * from yel_yel
  union all select * from terbanyak
) semua
order by urutan
$fn$;

revoke all on function hasil_kejuaraan_semua() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Kedua pembungkus: satu untuk panitia, satu untuk peserta
--
-- Pagar hak panitia tidak berubah sedikit pun - ia cuma pindah ke sini, dan
-- di sini ia terbaca dalam satu baris alih-alih terkubur di ujung query 128
-- baris.
-- ---------------------------------------------------------------------------

create or replace function hasil_kejuaraan()
returns table (
  urutan integer, kode text, nama_penghargaan text, sumber text,
  regu_id uuid, nomor_dada integer, nama_regu text, nama_sekolah text,
  golongan text, total numeric, poin_juara numeric, jumlah_skor numeric
)
language sql stable security definer
set search_path = public
as $fn$
  select * from hasil_kejuaraan_semua()
  where boleh('live_score')
  order by urutan
$fn$;

revoke all on function hasil_kejuaraan() from public;
grant execute on function hasil_kejuaraan() to authenticated;

-- Kolom skor tidak ada di view publik, dan itulah yang menjadikannya aman
-- terbit. Kolom `sumber` juga tidak ikut: ia menyebut CARA gelar itu
-- ditentukan ('manual', 'skor', 'nomor_dada') - keterangan untuk panitia yang
-- memilihnya, bukan untuk yang membaca hasilnya.

create view v_kejuaraan_publik as
select urutan, kode, nama_penghargaan, nomor_dada, nama_regu, nama_sekolah,
       golongan
from hasil_kejuaraan_semua()
where (select fase_live from status_acara) = 'juara'
order by urutan;

grant select on v_kejuaraan_publik to anon, authenticated;

comment on view v_kejuaraan_publik is
  'Daftar juara untuk halaman peserta. Nol baris di luar fase juara, dan tidak pernah memuat satu angka skor pun.';

-- ---------------------------------------------------------------------------
-- 4. Penjaga
-- ---------------------------------------------------------------------------

do $blok$
declare v_lama text; v_kolom text[]; v_n integer;
begin
  assert pg_get_constraintdef(
    (select oid from pg_constraint
     where conrelid = 'status_acara'::regclass
       and conname = 'status_acara_fase_live_check')) like '%juara%',
    '0163: constraint fase belum menerima juara';
  assert pg_get_functiondef('atur_fase_live(text)'::regprocedure) like '%juara%',
    '0163: RPC fase belum menerima juara';

  -- KEDUA fungsi tanpa pagar itu harus tetap tidak bisa dipanggil siapa pun
  -- selain pemilik database. Inilah yang menggantikan `where` yang dibuang;
  -- kalau suatu hari ada yang menambahkan grant, berhenti di sini.
  assert not has_function_privilege(
           'authenticated', 'hasil_kejuaraan_dasar()', 'execute'),
    '0163: hasil_kejuaraan_dasar() bisa dipanggil authenticated';
  assert not has_function_privilege(
           'anon', 'hasil_kejuaraan_dasar()', 'execute'),
    '0163: hasil_kejuaraan_dasar() bisa dipanggil anon';
  assert not has_function_privilege(
           'authenticated', 'hasil_kejuaraan_semua()', 'execute'),
    '0163: hasil_kejuaraan_semua() bisa dipanggil authenticated';
  assert not has_function_privilege(
           'anon', 'hasil_kejuaraan_semua()', 'execute'),
    '0163: hasil_kejuaraan_semua() bisa dipanggil anon';
  assert has_function_privilege(
           'authenticated', 'hasil_kejuaraan()', 'execute'),
    '0163: panitia kehilangan hasil_kejuaraan()';
  assert pg_get_functiondef('hasil_kejuaraan()'::regprocedure)
           like '%boleh(''live_score'')%',
    '0163: pagar live_score hilang dari hasil_kejuaraan()';

  -- Kolom skor TIDAK BOLEH ada di view publik. Diperiksa dari katalog, bukan
  -- dari teks view-nya: kolom baru bernama lain akan lolos pencocokan teks.
  select array_agg(attname::text order by attnum) into v_kolom
    from pg_attribute
   where attrelid = 'v_kejuaraan_publik'::regclass and attnum > 0
     and not attisdropped;
  assert not (v_kolom && array['total', 'poin_juara', 'jumlah_skor']),
    format('0163: kolom skor ikut ke view publik: %s', v_kolom);

  -- Pagar fasenya diuji dengan MENGUBAH fasenya, bukan dengan membaca
  -- definisinya (CLAUDE.md 13.8). `select true` lolos pemeriksaan teks.
  select fase_live into v_lama from status_acara;

  update status_acara set fase_live = 'penuh' where fase_live is not null;
  assert not exists (select 1 from v_kejuaraan_publik),
    '0163: kejuaraan terbaca padahal fase masih penuh';

  update status_acara set fase_live = 'juara' where fase_live is not null;
  select count(*) into v_n from v_kejuaraan_publik;
  -- Papannya ikut ditutup fase ini, dan itu bagian dari janjinya: yang
  -- dilihat peserta pada fase juara HANYA kejuaraan.
  assert not exists (select 1 from v_klasemen_publik),
    '0163: klasemen masih terbuka pada fase juara';
  assert not exists (select 1 from v_progres_publik),
    '0163: baris progres masih terbuka pada fase juara';

  update status_acara set fase_live = v_lama where fase_live is not null;
  raise notice '0163: fase juara siap - % baris penghargaan; fase dikembalikan ke %.',
               v_n, v_lama;
end;
$blok$;
