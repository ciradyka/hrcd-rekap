-- ============================================================================
-- hrcd-rekap : tests/sql/66_kloter_capacity_headroom.sql — migrasi 0105.
-- Tujuh puluh lima kloter tersedia dan semuanya tetap dijadwalkan 07:00-10:00.
-- ============================================================================

\echo '--- 66. kapasitas cadangan 75 kloter'

do $blok$
declare
  v_sekolah uuid;
  v_daftar uuid;
  v_regu uuid;
  v_nomor int;
  v_k1 timestamptz;
  v_k2 timestamptz;
  v_k60 timestamptz;
  v_k75 timestamptz;
begin
  perform set_config('app.uid', '00000000-0000-0000-0000-00000000000a', true);

  assert (select kloter_dasar = 75 and kloter_maks = 75
          from edisi where is_active),
         '66.1 GAGAL: batas kloter edisi bukan 75';
  assert (select count(*) from kloter where nomor between 1 and 75) = 75,
         '66.2 GAGAL: baris kloter 1-75 belum lengkap';

  select perkiraan_berangkat_kloter(1),
         perkiraan_berangkat_kloter(2),
         perkiraan_berangkat_kloter(60),
         perkiraan_berangkat_kloter(75)
  into v_k1, v_k2, v_k60, v_k75;

  assert (v_k1 at time zone 'Asia/Jakarta')::time = time '07:00',
         format('66.3 GAGAL: perkiraan K1 bukan 07:00: %s', v_k1);
  assert (v_k75 at time zone 'Asia/Jakarta')::time = time '10:00',
         format('66.4 GAGAL: perkiraan K75 bukan 10:00: %s', v_k75);
  assert v_k60 < v_k75,
         format('66.5 GAGAL: K60 (%s) tidak lebih awal dari K75 (%s)', v_k60, v_k75);
  assert extract(epoch from (v_k2 - v_k1)) between 145 and 147,
         format('66.6 GAGAL: jarak K1-K2 bukan sekitar 146 detik: %s',
                extract(epoch from (v_k2 - v_k1)));

  -- Buktikan kloter cadangan bukan sekadar baris mati. Setelah K1-K60 sudah
  -- berangkat, pembagian otomatis berikutnya harus terus ke K61, bukan menolak
  -- seluruh batch.
  update kloter
  set jam_berangkat = timestamptz '2026-08-29 07:00+07'
  where nomor between 1 and 60;
  update kloter
  set jam_berangkat = null
  where nomor between 61 and 75;

  insert into sekolah (name, address)
  values ('Sekolah Uji Headroom 0105', 'Ciamis')
  returning id into v_sekolah;

  insert into pendaftaran
    (sekolah_id, kode_pembayaran, jumlah_regu, kontak_wa, status)
  values (v_sekolah, 'UJI-HEADROOM-0105', 1, '081200000105', 'lunas')
  returning id into v_daftar;

  insert into regu (pendaftaran_id, nama_regu, nama_ketua, golongan)
  values (v_daftar, 'Regu Uji Headroom', 'Ketua Uji', 'penggalang_pa')
  returning id into v_regu;

  select min(s.nomor) into v_nomor
  from nomor_dada_stok s
  where not exists (select 1 from regu r where r.nomor_dada = s.nomor)
    and not exists (select 1 from nomor_dada_pensiun p where p.nomor = s.nomor);

  perform * from daftar_ulang_batch(
    'UJI-HEADROOM-0105',
    jsonb_build_array(jsonb_build_object('regu_id', v_regu,
                                         'nomor_dada', v_nomor))
  );

  assert (select kloter_nomor = 61 from regu where id = v_regu),
         '66.7 GAGAL: pembagian otomatis tidak melanjutkan ke K61';

  raise notice '66: K1-K75 terjadwal 07:00-10:00 dan K61 dapat dipakai otomatis.';
end $blok$;

\echo '66 kapasitas cadangan 75 kloter: LULUS'
