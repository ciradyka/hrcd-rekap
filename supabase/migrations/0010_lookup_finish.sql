-- ============================================================================
-- hrcd-rekap : 0010_lookup_finish.sql
--
-- Panitia menyebut targetnya: "cukup ketik nomor peserta, dan klik Sampai —
-- itu hanya perlu 3 detik, jadi kalau ada 20 regu bersamaan pun tidak lama."
--
-- Dua aksi, bukan tiga: TIDAK ADA tombol "Cari". Detail regu harus muncul
-- sendiri sambil operator mengetik. Karena itu dibutuhkan satu view ringkas
-- yang menjawab semua yang perlu dilihat operator dalam satu kali baca:
-- siapa regunya, sudah berangkat atau belum, dan sudah tercatat datang atau
-- belum (supaya pencatatan ganda langsung kelihatan, bukan jadi galat).
-- ============================================================================

create view v_regu_ringkas with (security_invoker = on) as
select
  r.id                                   as regu_id,
  r.nomor_dada,
  r.nama_regu,
  r.nama_ketua,
  s.nama                                 as nama_sekolah,
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
  -- Target kedatangan, supaya operator closing bisa melihat langsung apakah
  -- regu ini datang jauh dari targetnya (tanpa menghitung di kepala).
  case when k.jam_berangkat is not null and r.kontrak_menit is not null
    then k.jam_berangkat + make_interval(mins => r.kontrak_menit)
  end                                    as target_datang
from regu r
join pendaftaran d      on d.id = r.pendaftaran_id
join sekolah s          on s.id = d.sekolah_id
left join kloter k      on k.nomor = r.kloter_nomor
left join closing_regu c on c.regu_id = r.id
where not r.batal
  and d.status = 'lunas'
  and r.nomor_dada is not null;

grant select on v_regu_ringkas to authenticated;
