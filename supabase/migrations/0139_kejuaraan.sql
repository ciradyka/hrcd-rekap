-- Kejuaraan: hasil utama diturunkan dari klasemen; empat penghargaan khusus
-- dipilih panitia. `nomor_dada` adalah unit peserta di sistem ini, sehingga
-- Peserta Terbanyak menghitung regu bernomor dada per sekolah.

create table kejuaraan_manual (
  edisi smallint not null references edisi (nomor),
  kode text not null check (kode in
    ('kostum', 'yel_yel', 'terfavorit', 'terjauh')),
  regu_id uuid not null references regu (id),
  diubah_oleh uuid not null references auth.users (id),
  diubah_pada timestamptz not null default now(),
  primary key (edisi, kode)
);

alter table kejuaraan_manual enable row level security;

create or replace function simpan_kejuaraan_manual(p_kode text, p_regu uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not boleh('pengaturan') then
    raise exception 'akun ini tidak berhak mengubah Kejuaraan';
  end if;
  if p_kode not in ('kostum', 'yel_yel', 'terfavorit', 'terjauh') then
    raise exception 'penghargaan manual tidak dikenal';
  end if;
  if not exists (select 1 from regu where id = p_regu
                 and nomor_dada is not null and not is_cancelled) then
    raise exception 'regu tidak ditemukan atau belum mendapat nomor dada';
  end if;

  insert into kejuaraan_manual (edisi, kode, regu_id, diubah_oleh)
  values (edisi_aktif(), p_kode, p_regu, auth.uid())
  on conflict (edisi, kode) do update
    set regu_id = excluded.regu_id,
        diubah_oleh = excluded.diubah_oleh,
        diubah_pada = now();
end;
$$;

revoke all on function simpan_kejuaraan_manual(text, uuid) from public;
grant execute on function simpan_kejuaraan_manual(text, uuid) to authenticated;

create or replace function hasil_kejuaraan()
returns table (
  urutan integer, kode text, nama_penghargaan text, sumber text,
  regu_id uuid, nomor_dada integer, nama_regu text, nama_sekolah text,
  golongan text, total numeric
)
language sql stable security definer
set search_path = public
as $$
with
peringkat as (
  select k.*,
         row_number() over (
           partition by k.golongan
           order by k.total desc,
                    abs(coalesce(k.selisih_menit, 100000)) asc,
                    k.nomor_dada asc) as nomor_juara
  from v_klasemen k
  where boleh('live_score')
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
where boleh('live_score')
order by urutan
$$;

revoke all on function hasil_kejuaraan() from public;
grant execute on function hasil_kejuaraan() to authenticated;
create view v_kejuaraan as select * from hasil_kejuaraan();
grant select on v_kejuaraan to authenticated;
