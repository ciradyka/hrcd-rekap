-- ============================================================================
-- hrcd-rekap : 0103_restore_pos_last_entry.sql
-- Kembalikan waktu nilai terakhir ke panel kelengkapan pos.
--
-- Rebuild view di 0060 menghilangkan `terakhir_masuk`, padahal layar Rekap
-- masih memakainya untuk menandai pos yang diam lebih dari 30 menit. Kolom
-- ditambahkan di akhir agar kontrak kolom view yang sudah ada tidak berubah.
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
          < komponen_pos_golongan(p.nomor, ri.golongan))::int as hilang,
  (select max(n.created_at)
   from nilai_mentah n
   join wahana w on w.id = n.wahana_id
   where w.edisi = edisi_aktif() and w.pos = p.nomor)    as terakhir_masuk
from v_pos p
left join regu_ikut ri on komponen_pos_golongan(p.nomor, ri.golongan) > 0
left join terisi t     on t.regu_id = ri.id and t.pos = p.nomor
where p.jumlah_komponen > 0
  and peran() is not null
group by p.nomor, p.name, p.bayangan, p.jumlah_komponen;

comment on view v_kelengkapan_pos is
  'Agregat kelengkapan dan waktu nilai terakhir seluruh pos untuk panitia aktif. Definer agar agregat lintas pos tidak menuntut hak baca nilai mentah; badan view wajib menjaga peran() is not null.';

grant select on v_kelengkapan_pos to authenticated, service_role;
revoke all on v_kelengkapan_pos from anon;
