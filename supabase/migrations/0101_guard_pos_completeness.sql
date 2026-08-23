-- ============================================================================
-- hrcd-rekap : 0101_guard_pos_completeness.sql
-- Kelengkapan pos hanya terbuka untuk akun panitia aktif.
--
-- Rebuild di 0060, lalu salinannya di 0096, kehilangan `peran() is not null`.
-- View ini definer agar dapat menghitung agregat lintas pos, jadi RLS tabel
-- dasarnya tidak menjadi pagar. Isolasi pos tidak dikembalikan: sejak 0069
-- membaca rincian lintas pos memang dibuka untuk panitia; yang hilang hanya
-- syarat bahwa pembacanya benar-benar panitia aktif.
-- ============================================================================

create or replace view v_kelengkapan_pos as
with regu_ikut as (
  select
    r.id,
    r.golongan,
    (k.jam_berangkat is not null)                                as sudah_berangkat,
    exists (select 1 from closing_regu c where c.regu_id = r.id) as sudah_closing
  from regu r
  join pendaftaran d on d.id = r.pendaftaran_id
  left join kloter k on k.nomor = r.kloter_nomor
  where not r.is_cancelled
    and d.status = 'lunas'
    and r.nomor_dada is not null
),
terisi as (
  select n.regu_id, w.pos, count(*)::int as jumlah
  from nilai_mentah n
  join wahana w on w.id = n.wahana_id
  where w.edisi = edisi_aktif()
  group by n.regu_id, w.pos
)
select
  p.nomor                       as pos,
  p.name                        as nama_pos,
  p.bayangan,
  p.jumlah_komponen,
  count(ri.id)::int                                      as regu_total,
  count(ri.id) filter (where ri.sudah_berangkat)::int    as regu_berangkat,
  count(ri.id) filter (where ri.sudah_closing)::int      as regu_closing,
  count(ri.id) filter (
    where coalesce(t.jumlah, 0)
          = komponen_pos_golongan(p.nomor, ri.golongan))::int as lengkap,
  count(ri.id) filter (
    where coalesce(t.jumlah, 0) > 0
      and coalesce(t.jumlah, 0)
          < komponen_pos_golongan(p.nomor, ri.golongan))::int as sebagian,
  count(ri.id) filter (where coalesce(t.jumlah, 0) = 0)::int  as kosong,
  count(ri.id) filter (
    where ri.sudah_closing
      and coalesce(t.jumlah, 0)
          < komponen_pos_golongan(p.nomor, ri.golongan))::int as hilang
from v_pos p
left join regu_ikut ri on komponen_pos_golongan(p.nomor, ri.golongan) > 0
left join terisi t     on t.regu_id = ri.id and t.pos = p.nomor
where p.jumlah_komponen > 0
  and peran() is not null
group by p.nomor, p.name, p.bayangan, p.jumlah_komponen;

comment on view v_kelengkapan_pos is
  'Agregat kelengkapan seluruh pos untuk panitia aktif. Definer agar agregat lintas pos tidak menuntut hak baca nilai mentah; badan view wajib menjaga peran() is not null.';

grant select on v_kelengkapan_pos to authenticated, service_role;
revoke all on v_kelengkapan_pos from anon;
