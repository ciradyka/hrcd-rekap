-- Gelar Kejuaraan hanya untuk peserta Eksternal. Pilihan manual dapat
-- dikosongkan lewat RPC yang sama dengan memilih regu, menggunakan NULL.

delete from kejuaraan_manual m
using regu r
where r.id = m.regu_id and r.golongan like 'intern_%';

create or replace function simpan_kejuaraan_manual(p_kode text, p_regu uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not boleh('pengaturan') then
    raise exception 'akun ini tidak berhak mengubah Kejuaraan';
  end if;
  if p_kode not in ('kostum', 'terfavorit', 'terjauh') then
    raise exception 'penghargaan manual tidak dikenal';
  end if;

  if p_regu is null then
    delete from kejuaraan_manual
    where edisi = edisi_aktif() and kode = p_kode;
    return;
  end if;

  if not exists (
    select 1 from regu
    where id = p_regu and nomor_dada is not null and not is_cancelled
      and golongan not like 'intern_%'
  ) then
    raise exception 'regu tidak ditemukan, belum mendapat nomor dada, atau termasuk Intern';
  end if;

  insert into kejuaraan_manual (edisi, kode, regu_id, diubah_oleh)
  values (edisi_aktif(), p_kode, p_regu, auth.uid())
  on conflict (edisi, kode) do update
    set regu_id = excluded.regu_id,
        diubah_oleh = excluded.diubah_oleh,
        diubah_pada = now();
end;
$$;

drop view v_kejuaraan;

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
         sum(total) as jumlah_skor,
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
)
select * from hasil_kejuaraan_dasar() d
where d.kode not in
  ('juara_umum', 'juara_umum_penegak', 'juara_umum_penggalang',
   'yel_yel', 'peserta_terbanyak')
union all
select * from juara_umum
union all
select 62, 'yel_yel', 'Juara Yel Yel', 'skor',
       y.regu_id, y.nomor_dada, y.nama_regu, y.nama_sekolah,
       y.golongan, y.poin_pos
from (values (true)) satu(ada)
left join lateral (
  select k.regu_id, k.nomor_dada, k.nama_regu, k.nama_sekolah,
         k.golongan, pp.poin_pos
  from v_klasemen k
  join v_poin_pos pp on pp.regu_id = k.regu_id and pp.pos = 5
  where k.golongan in
    ('penegak_pa', 'penegak_pi', 'penggalang_pa', 'penggalang_pi')
  order by pp.poin_pos desc, k.total desc, k.nomor_dada
  limit 1
) y on true
where boleh('live_score')
union all
select 70, 'peserta_terbanyak', 'Peserta Terbanyak', 'nomor_dada',
       null::uuid, null::integer, null::text, p.nama_sekolah,
       null::text, p.jumlah::numeric
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
where boleh('live_score')
order by urutan
$$;

create view v_kejuaraan as select * from hasil_kejuaraan();
grant select on v_kejuaraan to authenticated;
