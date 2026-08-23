-- ============================================================================
-- hrcd-rekap : 0104_public_completeness_external_only.sql
-- Kelengkapan halaman peserta menghitung regu Eksternal saja.
--
-- Halaman peserta sengaja tidak menerbitkan regu Intern. publish-live.yml
-- membuang baris Intern dari progres, klasemen, dan daftar komponen, tetapi
-- `v_kelengkapan_publik` sudah telanjur mengagregasi seluruh golongan sehingga
-- hasilnya tidak bisa disaring lagi saat penerbitan.
--
-- Migrasi 0096 sudah membetulkan penyebut tiap golongan dan mengeluarkan regu
-- dari pos yang memang tidak mereka ikuti. Namun Intern tetap mengikuti Soal
-- Tulis di Pos 1--3, jadi penghitung publik ketiga pos itu masih lebih besar
-- daripada jumlah regu yang ditampilkan di bawahnya.
--
-- Papan panitia `v_kelengkapan_pos` tidak diubah: Intern adalah peserta nyata
-- yang kemajuannya memang perlu dipantau di sana. Hanya view publik yang
-- mengikuti boundary Eksternal milik halaman peserta.
-- ============================================================================

create or replace view v_kelengkapan_publik as
with regu_ikut as (
  select r.id, r.golongan
  from regu r
  join pendaftaran d on d.id = r.pendaftaran_id
  where not r.is_cancelled
    and d.status = 'lunas'
    and r.nomor_dada is not null
    and r.golongan not in ('intern_pa', 'intern_pi')
),
terisi as (
  select n.regu_id, w.pos, count(*)::int as jumlah
  from nilai_mentah n
  join wahana w on w.id = n.wahana_id
  where w.edisi = edisi_aktif()
  group by n.regu_id, w.pos
)
select
  p.nomor          as pos,
  p.name           as nama_pos,
  p.jumlah_komponen,
  count(ri.id)::int as regu_total,
  count(ri.id) filter (
    where coalesce(t.jumlah, 0)
          = komponen_pos_golongan(p.nomor, ri.golongan))::int as lengkap,
  count(ri.id) filter (
    where coalesce(t.jumlah, 0) > 0
      and coalesce(t.jumlah, 0)
          < komponen_pos_golongan(p.nomor, ri.golongan))::int as sebagian,
  case when count(ri.id) = 0 then 0 else
    floor(100.0 * count(ri.id) filter (
      where coalesce(t.jumlah, 0)
            = komponen_pos_golongan(p.nomor, ri.golongan)) / count(ri.id))::int
  end              as persen
from v_pos p
left join regu_ikut ri on komponen_pos_golongan(p.nomor, ri.golongan) > 0
left join terisi t     on t.regu_id = ri.id and t.pos = p.nomor
where p.jumlah_komponen > 0
  and (select fase_live from status_acara) in ('progres', 'penuh')
group by p.nomor, p.name, p.jumlah_komponen;

grant select on v_kelengkapan_publik to anon, authenticated, service_role;

