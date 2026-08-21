-- ============================================================================
-- hrcd-rekap : tests/sql/49_daftar_ulang_lewati_kloter_berangkat.sql
-- Peserta terlambat tidak boleh diacak ke kloter yang sudah berangkat (0088).
--
-- Bentuk kasusnya mengikuti kejadian produksi: kloter 1-10 sudah jalan,
-- peserta baru menerima nomor dada, dan kloter 11 masih menunggu. Kloter 11
-- sengaja ditandai sudah dicetak untuk menjaga batas aturan: yang dilewati
-- hanya kloter BERANGKAT, bukan kloter yang kertasnya sudah beredar.
-- ============================================================================

do $blok$
declare
  v_sekolah uuid;
  v_daftar  uuid;
  v_regu    uuid;
  v_nomor   int;
  v_kloter  smallint;
  v_maks    int;
begin
  perform set_config('app.uid', '00000000-0000-0000-0000-00000000000a', true);

  select maks_regu_per_kloter into v_maks from edisi where is_active;
  assert (select count(*) from regu where kloter_nomor = 11) < v_maks,
         'fixture memenuhi kloter 11; tes tidak dapat membangun kasus produksi';

  update kloter
     set jam_berangkat = case
       when nomor <= 10 then timestamptz '2026-08-29 07:00+07' + nomor * interval '5 minutes'
       else null
     end,
         dicetak_pada = case when nomor = 11 then now() else dicetak_pada end
   where nomor <= 11;

  insert into sekolah (name, address)
  values ('SMP Uji Peserta Terlambat', 'Ciamis')
  returning id into v_sekolah;

  insert into pendaftaran
    (sekolah_id, kode_pembayaran, jumlah_regu, kontak_wa, status)
  values
    (v_sekolah, 'UJI-TERLAMBAT-KLOTER', 1, '081200000000', 'lunas')
  returning id into v_daftar;

  insert into regu (pendaftaran_id, nama_regu, nama_ketua, golongan)
  values (v_daftar, 'Uji Elang Terlambat', 'Ketua Uji', 'penggalang_pa')
  returning id into v_regu;

  select min(s.nomor) into v_nomor
    from nomor_dada_stok s
   where not exists (select 1 from regu r where r.nomor_dada = s.nomor)
     and not exists (select 1 from nomor_dada_pensiun p where p.nomor = s.nomor);

  select hasil.kloter into v_kloter
    from daftar_ulang_batch(
      'UJI-TERLAMBAT-KLOTER',
      jsonb_build_array(jsonb_build_object('regu_id', v_regu, 'nomor_dada', v_nomor))
    ) hasil;

  assert v_kloter = 11,
         format('peserta terlambat seharusnya masuk kloter 11, bukan kloter %s', v_kloter);
  assert (select dicetak_pada is not null from kloter where nomor = 11),
         'tes tidak membuktikan kloter tercetak tetap boleh dipilih';

  raise notice '49: peserta baru masuk kloter 11; kloter 1-10 yang sudah berangkat dilewati.';
end $blok$;

\echo '49 daftar ulang lewati kloter berangkat: LULUS'
