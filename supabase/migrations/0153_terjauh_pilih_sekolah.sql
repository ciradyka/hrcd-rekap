-- ============================================================================
-- hrcd-rekap : 0153_terjauh_pilih_sekolah.sql
-- Pangkalan Terjauh diisi SEKOLAH, bukan regu.
--
-- Yang diukur penghargaan ini adalah jarak pangkalan ke lokasi acara, dan
-- jarak itu milik sekolahnya — bukan milik salah satu regu yang dikirimnya.
-- Sampai sekarang kolomnya menyimpan `regu_id`, jadi panitia harus memilih
-- satu dari empat regu sekolah itu, dan tiga regu lain dari pangkalan yang
-- sama seolah-olah tidak ikut menempuh jarak yang sama.
--
-- `kejuaraan_manual` sekarang memuat DUA bentuk pilihan dalam satu tabel:
-- Kostum dan Terfavorit menunjuk regu, Terjauh menunjuk sekolah. Satu check
-- constraint mengikat tiap kode ke kolom yang benar, sehingga tidak ada baris
-- yang bisa menyimpan keduanya atau tidak menyimpan satu pun.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Kolom sekolah
-- ---------------------------------------------------------------------------

alter table kejuaraan_manual add column sekolah_id uuid references sekolah (id);
alter table kejuaraan_manual alter column regu_id drop not null;

-- Pilihan Terjauh yang sudah ada dipindahkan ke sekolah regunya. Panitia
-- memilih regu itu karena pangkalannya, jadi pangkalannyalah yang disimpan.
update kejuaraan_manual m
set sekolah_id = d.sekolah_id, regu_id = null
from regu r
join pendaftaran d on d.id = r.pendaftaran_id
where r.id = m.regu_id and m.kode = 'terjauh';

-- Baris Terjauh yang regunya sudah tidak bisa ditelusuri tidak menyimpan
-- keputusan apa pun yang bisa diselamatkan.
delete from kejuaraan_manual where kode = 'terjauh' and sekolah_id is null;

alter table kejuaraan_manual add constraint kejuaraan_manual_isi_check
  check (case when kode = 'terjauh'
              then sekolah_id is not null and regu_id is null
              else regu_id is not null and sekolah_id is null end);

comment on column kejuaraan_manual.sekolah_id is
  'Terisi HANYA untuk kode terjauh; penghargaan lain menunjuk regu lewat regu_id.';

-- ---------------------------------------------------------------------------
-- 2. Penyimpan pilihan
--
-- Dua RPC, bukan satu yang menerima dua macam id. Nama fungsinya menyebut apa
-- yang disimpan, jadi pemanggil yang keliru gagal di nama fungsi — bukan di
-- argumen ketiga yang diam-diam dibiarkan kosong.
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
    'terfavorit_penggalang_pa', 'terfavorit_penggalang_pi') then
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

  if right(p_kode, length(v_golongan) + 1) <> '_' || v_golongan then
    raise exception 'regu ini golongan %, bukan golongan penghargaan itu', v_golongan;
  end if;

  insert into kejuaraan_manual (edisi, kode, regu_id, diubah_oleh)
  values (edisi_aktif(), p_kode, p_regu, auth.uid())
  on conflict (edisi, kode) do update
    set regu_id = excluded.regu_id,
        sekolah_id = null,
        diubah_oleh = excluded.diubah_oleh,
        diubah_pada = now();
end;
$$;

create or replace function simpan_kejuaraan_terjauh(p_sekolah uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not boleh('pengaturan') then
    raise exception 'akun ini tidak berhak mengubah Kejuaraan';
  end if;

  if p_sekolah is null then
    delete from kejuaraan_manual
    where edisi = edisi_aktif() and kode = 'terjauh';
    return;
  end if;

  -- Pangkalan yang tidak mengirim satu regu pun tidak menempuh jarak apa pun.
  -- Daftar sekolah dibaca dari master yang memuat SELURUH sekolah kurasi, jadi
  -- tanpa pagar ini satu salah klik memberi gelar kepada sekolah yang tidak
  -- hadir, dan tidak ada yang menyanggah.
  if not exists (
    select 1 from regu r
    join pendaftaran d on d.id = r.pendaftaran_id
    where d.sekolah_id = p_sekolah and r.nomor_dada is not null
      and not r.is_cancelled and r.golongan not like 'intern_%'
  ) then
    raise exception 'sekolah ini tidak mengirim regu bernomor dada';
  end if;

  insert into kejuaraan_manual (edisi, kode, sekolah_id, diubah_oleh)
  values (edisi_aktif(), 'terjauh', p_sekolah, auth.uid())
  on conflict (edisi, kode) do update
    set sekolah_id = excluded.sekolah_id,
        regu_id = null,
        diubah_oleh = excluded.diubah_oleh,
        diubah_pada = now();
end;
$$;

revoke all on function simpan_kejuaraan_terjauh(uuid) from public;
grant execute on function simpan_kejuaraan_terjauh(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Daftar hasil
--
-- Baris Terjauh berubah dua hal: `nama_sekolah` dibaca dari `sekolah` langsung
-- dan bukan lewat regunya, dan `sumber`-nya jadi `manual_sekolah` supaya layar
-- tahu kotak carinya berisi sekolah, bukan nomor dada.
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
comment on column v_kejuaraan.sumber is
  'skor = dihitung, nomor_dada = dihitung dari nomor dada, manual = panitia memilih regu, manual_sekolah = panitia memilih sekolah.';

-- ---------------------------------------------------------------------------
-- 4. Pagar penutup
-- ---------------------------------------------------------------------------

do $$
declare
  v_def text := pg_get_functiondef('hasil_kejuaraan()'::regprocedure);
  v_salah integer;
begin
  assert v_def like
    '%order by bobot_juara desc nulls last, jumlah_skor desc, nama_sekolah%',
    '0153: urutan Juara Umum tidak lagi memakai poin gelar dengan NULLS LAST';
  assert v_def like '%sum(total) filter (where nomor_juara <= 6) as jumlah_skor%',
    '0153: jumlah skor Juara Umum tidak lagi dibatasi ke enam besar';
  assert v_def like '%''manual_sekolah''%',
    '0153: baris Terjauh tidak menandai dirinya sebagai pilihan sekolah';

  select count(*) into v_salah from kejuaraan_manual
  where kode = 'terjauh' and (sekolah_id is null or regu_id is not null);
  assert v_salah = 0,
    format('0153: %s baris Terjauh masih menunjuk regu', v_salah);

  select count(*) into v_salah from kejuaraan_manual
  where kode <> 'terjauh' and (regu_id is null or sekolah_id is not null);
  assert v_salah = 0,
    format('0153: %s penghargaan regu menyimpan sekolah', v_salah);
end;
$$;
