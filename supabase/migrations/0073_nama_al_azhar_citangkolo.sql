-- ============================================================================
-- hrcd-rekap : 0073_nama_al_azhar_citangkolo.sql
-- MA Al-Azhar Kota Banjar -> MA Al-Azhar Citangkolo Kota Banjar.
--
-- KENAPA
--
-- Diminta pemilik acara. "Citangkolo" adalah nama pesantrennya, dan itu yang
-- diucapkan orang — runbook bagian 5: pakai nama yang biasa diucapkan,
-- sedekat mungkin dengan nama resminya.
--
-- Ekor "Kota Banjar" TETAP. Ia bukan hiasan: aturan NPSN di runbook bagian 5
-- meminta nama membedakan sekolah sendirian, dan ekor daerah adalah cara
-- kita melakukannya. Menambah "Citangkolo" memperjelas, tidak menggantikan.
--
-- YANG TIDAK PERLU DIKHAWATIRKAN
--
-- `sekolah_kunci_unik` adalah unique index atas nama yang dinormalisasi, dan
-- nama baru ini tidak bentrok dengan satu pun baris lain. Pendaftaran yang
-- sudah menunjuk baris ini tidak tersentuh — `id`-nya tidak berubah, cuma
-- namanya.
-- ============================================================================

do $blok$
declare v_n int;
begin
  update sekolah
     set name = 'MA Al-Azhar Citangkolo Kota Banjar'
   where name = 'MA Al-Azhar Kota Banjar';
  get diagnostics v_n = row_count;

  if v_n = 0 then
    -- Bukan galat: bisa jadi migrasinya dijalankan dua kali, atau tabel
    -- sekolah belum diisi di database ini.
    raise notice '0073: "MA Al-Azhar Kota Banjar" tidak ada — dilewati.';
  else
    raise notice '0073: % baris diganti namanya.', v_n;
  end if;
end $blok$;
