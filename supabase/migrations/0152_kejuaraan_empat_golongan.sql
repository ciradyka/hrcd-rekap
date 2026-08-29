-- ============================================================================
-- hrcd-rekap : 0152_kejuaraan_empat_golongan.sql
-- Kostum, Yel Yel, dan Terfavorit diberikan per golongan, bukan satu untuk
-- seluruh peserta.
--
-- Sebelum ini ketiganya hanya punya SATU pemenang. Penegak PA dan Penggalang
-- PI bersaing di meja yang sama padahal setiap gelar lain di acara ini sudah
-- dipisah empat golongan, dan Yel Yel bahkan dinilai di Pos 5 yang berjalan
-- per golongan sejak awal. Sekarang ketiganya ikut pembagian yang sama:
--
--   kostum_<golongan>      manual, dipilih pemegang hak `pengaturan`
--   yel_yel_<golongan>     otomatis, poin Pos 5 tertinggi di golongan itu
--   terfavorit_<golongan>  manual
--
-- Peserta Terjauh tetap satu untuk seluruh acara: yang diukur jarak sekolah,
-- dan jarak tidak mengenal golongan. Peserta Terbanyak juga tetap satu.
--
-- Pilihan manual yang sudah tersimpan TIDAK dibuang: ia dipindahkan ke kode
-- golongan regu yang terlanjur dipilih, sehingga panitia yang sudah memutuskan
-- satu Juara Kostum tidak kehilangan keputusannya.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Kode penghargaan manual
-- ---------------------------------------------------------------------------

alter table kejuaraan_manual drop constraint kejuaraan_manual_kode_check;

update kejuaraan_manual m
set kode = m.kode || '_' || r.golongan
from regu r
where r.id = m.regu_id
  and m.kode in ('kostum', 'terfavorit')
  and r.golongan in
    ('penegak_pa', 'penegak_pi', 'penggalang_pa', 'penggalang_pi');

-- Sisanya hanya bisa berupa baris yang regunya tidak lagi sah — 0142 sudah
-- membuang yang Intern dan 0143 yang belum tiba.
delete from kejuaraan_manual where kode in ('kostum', 'yel_yel', 'terfavorit');

alter table kejuaraan_manual add constraint kejuaraan_manual_kode_check
  check (kode in (
    'kostum_penegak_pa', 'kostum_penegak_pi',
    'kostum_penggalang_pa', 'kostum_penggalang_pi',
    'terfavorit_penegak_pa', 'terfavorit_penegak_pi',
    'terfavorit_penggalang_pa', 'terfavorit_penggalang_pi',
    'terjauh'));

-- ---------------------------------------------------------------------------
-- 2. Penyimpan pilihan manual
-- ---------------------------------------------------------------------------

create or replace function simpan_kejuaraan_manual(p_kode text, p_regu uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_golongan text;
begin
  if not boleh('pengaturan') then
    raise exception 'akun ini tidak berhak mengubah Kejuaraan';
  end if;
  if p_kode not in (
    'kostum_penegak_pa', 'kostum_penegak_pi',
    'kostum_penggalang_pa', 'kostum_penggalang_pi',
    'terfavorit_penegak_pa', 'terfavorit_penegak_pi',
    'terfavorit_penggalang_pa', 'terfavorit_penggalang_pi',
    'terjauh') then
    raise exception 'penghargaan manual tidak dikenal';
  end if;

  if p_regu is null then
    delete from kejuaraan_manual
    where edisi = edisi_aktif() and kode = p_kode;
    return;
  end if;

  select r.golongan into v_golongan
  from regu r
  join closing_regu c on c.regu_id = r.id
  where r.id = p_regu and r.nomor_dada is not null and not r.is_cancelled
    and r.golongan not like 'intern_%';

  if v_golongan is null then
    raise exception 'regu tidak ditemukan, belum tiba, belum mendapat nomor dada, atau termasuk Intern';
  end if;

  -- Gelar per golongan hanya boleh jatuh ke regu golongan itu. Layar boleh
  -- saja sudah menyaring daftar pilihannya, tetapi tanpa pagar ini RPC-nya
  -- tetap menerima regu Penggalang sebagai Juara Kostum Penegak PA.
  if p_kode <> 'terjauh'
     and right(p_kode, length(v_golongan) + 1) <> '_' || v_golongan then
    raise exception 'regu ini golongan %, bukan golongan penghargaan itu', v_golongan;
  end if;

  insert into kejuaraan_manual (edisi, kode, regu_id, diubah_oleh)
  values (edisi_aktif(), p_kode, p_regu, auth.uid())
  on conflict (edisi, kode) do update
    set regu_id = excluded.regu_id,
        diubah_oleh = excluded.diubah_oleh,
        diubah_pada = now();
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Daftar hasil
--
-- Yang masih diambil dari hasil_kejuaraan_dasar() tinggal 24 gelar golongan.
-- Juara Umum, ketiga penghargaan per golongan, Terjauh, dan Terbanyak disusun
-- di sini — versi 0139 sudah tidak menyisakan satu pun baris lain yang dipakai
-- apa adanya.
--
-- Urutan tampil: 1-3 Juara Umum, 11-56 gelar golongan, 61-64 Kostum,
-- 65-68 Yel Yel, 69-72 Terfavorit, 73 Terjauh, 74 Terbanyak.
--
-- `where boleh('live_score')` sekarang membungkus SELURUH hasil. Sebelumnya
-- tiap arm membawa pagarnya sendiri dan arm Juara Umum tidak kebagian, jadi
-- panitia tanpa hak `live_score` tetap bisa membaca nama sekolah Juara Umum.
-- ---------------------------------------------------------------------------

drop view v_kejuaraan;
drop function hasil_kejuaraan();

create function hasil_kejuaraan()
returns table (
  urutan integer, kode text, nama_penghargaan text, sumber text,
  regu_id uuid, nomor_dada integer, nama_regu text, nama_sekolah text,
  golongan text, total numeric, poin_juara numeric, jumlah_skor numeric
)
language sql stable security definer
set search_path = public
as $$
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
  select 73, 'terjauh', 'Peserta Terjauh', 'manual',
         r.id, r.nomor_dada, r.nama_regu, s.name, r.golongan,
         null::numeric, null::numeric, null::numeric
  from (values (true)) satu(ada)
  left join kejuaraan_manual m
    on m.edisi = edisi_aktif() and m.kode = 'terjauh'
  left join regu r on r.id = m.regu_id
  left join pendaftaran d on d.id = r.pendaftaran_id
  left join sekolah s on s.id = d.sekolah_id
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
where boleh('live_score')
order by urutan
$$;

revoke all on function hasil_kejuaraan() from public;
grant execute on function hasil_kejuaraan() to authenticated;

create view v_kejuaraan as select * from hasil_kejuaraan();
grant select on v_kejuaraan to authenticated;

comment on column v_kejuaraan.poin_juara is
  'Total poin posisi enam besar: 6, 5, 4, 3, 2, 1. Hanya diisi untuk Juara Umum.';
comment on column v_kejuaraan.jumlah_skor is
  'Jumlah skor regu sekolah yang berada di peringkat 1-6 dalam cakupan Juara Umum; pemecah poin sama.';

-- ---------------------------------------------------------------------------
-- 4. Pagar penutup
-- ---------------------------------------------------------------------------

do $$
declare
  v_def text := pg_get_functiondef('hasil_kejuaraan()'::regprocedure);
  v_sisa integer;
begin
  -- Yang dijaga 0148, 0149 dan 0151 ikut ditulis ulang di sini. Kalau salah
  -- satunya luput, Juara Umum kembali ke aturan lama tanpa satu pun galat.
  assert v_def like
    '%order by bobot_juara desc nulls last, jumlah_skor desc, nama_sekolah%',
    '0152: urutan Juara Umum tidak lagi memakai poin gelar dengan NULLS LAST';
  assert v_def like '%sum(total) filter (where nomor_juara <= 6) as jumlah_skor%',
    '0152: jumlah skor Juara Umum tidak lagi dibatasi ke enam besar';

  -- Ketiganya harus dibangun dari golongan_juara, bukan ditulis satu baris.
  assert v_def like '%''yel_yel_'' || g.kode%',
    '0152: Yel Yel tidak dibangun per golongan';
  assert v_def like '%a.kode || ''_'' || g.kode%',
    '0152: Kostum dan Terfavorit tidak dibangun per golongan';

  select count(*) into v_sisa from kejuaraan_manual
  where kode in ('kostum', 'yel_yel', 'terfavorit');
  assert v_sisa = 0,
    format('0152: %s pilihan manual masih memakai kode lama', v_sisa);
end;
$$;
