-- Peserta Terbanyak adalah penghargaan sekolah peserta lomba Eksternal.
-- Regu intern_pa dan intern_pi tetap mendapat nomor dada untuk alur lapangan,
-- tetapi tidak ikut dalam hitungan penghargaan ini.

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
  select * from hasil_kejuaraan_dasar() d
  where d.kode not in ('yel_yel', 'peserta_terbanyak')
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

