-- ============================================================================
-- hrcd-rekap : 0100_gate_regu_lookup.sql
-- Lookup regu di dua meja gerbang tidak bergantung pada hak Live Score.
--
-- `v_regu_ringkas` sebelumnya security_invoker dan ikut policy pendaftaran,
-- yang tidak mengenal keberangkatan/kedatangan. Membuka tabel pendaftaran
-- langsung kepada gerbang juga membuka nomor WA pembina yang tidak dipakai
-- layar ini. Karena itu view ringkas menjadi definer dengan pagar haknya
-- sendiri: gerbang mendapat data operasional yang diperlukan, bukan seluruh
-- baris pendaftaran.
-- ============================================================================

create or replace view v_regu_ringkas with (security_invoker = off) as
select
  r.id                                   as regu_id,
  r.nomor_dada,
  r.nama_regu,
  r.nama_ketua,
  s.name                                 as nama_sekolah,
  r.golongan,
  r.kloter_nomor                         as kloter,
  r.kontrak_menit,
  k.jam_berangkat,
  k.jam_berangkat is not null            as sudah_berangkat,
  exists (select 1 from keberangkatan_regu kb where kb.regu_id = r.id)
                                           as sudah_ceklis,
  c.jam_datang,
  c.anggota_hadir,
  c.regu_id is not null                  as sudah_finish,
  r.disisipkan_pada is not null          as sisipan,
  case when k.jam_berangkat is not null and r.kontrak_menit is not null
    then k.jam_berangkat + make_interval(mins => r.kontrak_menit)
  end                                    as target_datang
from regu r
join pendaftaran d       on d.id = r.pendaftaran_id
join sekolah s           on s.id = d.sekolah_id
left join kloter k       on k.nomor = r.kloter_nomor
left join closing_regu c on c.regu_id = r.id
where not r.is_cancelled
  and d.status = 'lunas'
  and r.nomor_dada is not null
  and boleh_apa_saja('keberangkatan', 'kedatangan', 'daftar_ulang',
                     'pengaturan');

comment on view v_regu_ringkas is
  'Lookup operasional untuk staging dan finish. Definer agar tidak membuka pendaftaran beserta nomor WA; badannya wajib menjaga keberangkatan/kedatangan/daftar_ulang/pengaturan.';

grant select on v_regu_ringkas to authenticated;
revoke all on v_regu_ringkas from anon;
