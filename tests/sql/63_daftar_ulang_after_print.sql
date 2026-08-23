-- Daftar ulang otomatis ke kloter tercetak harus muncul sebagai sisipan.

do $blok$
declare
  v_sekolah uuid;
  v_daftar uuid;
  v_regu uuid;
  v_nomor integer;
  v_kandidat smallint;
  v_dicetak_lama timestamptz;
  v_maks_eksternal smallint;
begin
  perform set_config('app.uid', '00000000-0000-0000-0000-00000000000a', true);

  select maks_eksternal_per_kloter into v_maks_eksternal
  from edisi where is_active;

  select k.nomor, k.dicetak_pada
    into v_kandidat, v_dicetak_lama
  from kloter k
  where k.jam_berangkat is null
    and (select count(*) from regu r
         where r.kloter_nomor = k.nomor and not r.is_cancelled
           and r.golongan not in ('intern_pa', 'intern_pi')) < v_maks_eksternal
  order by k.nomor
  limit 1;
  assert v_kandidat is not null, 'tidak ada kloter calon untuk menguji sisipan otomatis';

  update kloter set dicetak_pada = now() where nomor = v_kandidat;

  insert into sekolah (name, address)
  values ('Sekolah Uji Sisipan Otomatis 0102', 'Ciamis')
  returning id into v_sekolah;
  insert into pendaftaran
    (sekolah_id, kode_pembayaran, jumlah_regu, kontak_wa, status)
  values (v_sekolah, 'UJI-SISIPAN-0102', 1, '081200000102', 'lunas')
  returning id into v_daftar;
  insert into regu (pendaftaran_id, nama_regu, nama_ketua, golongan)
  values (v_daftar, 'Sisip Baru', 'Ketua Uji', 'penggalang_pa')
  returning id into v_regu;

  select min(s.nomor) into v_nomor
  from nomor_dada_stok s
  where not exists (select 1 from regu r where r.nomor_dada = s.nomor)
    and not exists (select 1 from nomor_dada_pensiun p where p.nomor = s.nomor);

  perform * from daftar_ulang_batch(
    'UJI-SISIPAN-0102',
    jsonb_build_array(jsonb_build_object('regu_id', v_regu, 'nomor_dada', v_nomor))
  );

  assert (select kloter_nomor = v_kandidat from regu where id = v_regu),
         'daftar ulang tidak memilih kloter tercetak yang paling awal';
  assert (select disisipkan_pada is not null from regu where id = v_regu),
         'regu yang masuk setelah cetak tidak ditandai sebagai sisipan';
  assert (select alasan_sisip = 'daftar ulang otomatis setelah daftar kloter dicetak'
          from regu where id = v_regu),
         'alasan sisipan otomatis tidak tercatat';
  assert exists (select 1 from v_sisipan_kloter where nomor_dada = v_nomor),
         'regu baru tidak muncul di daftar sisipan untuk petugas staging';

  delete from regu where id = v_regu;
  delete from pendaftaran where id = v_daftar;
  delete from sekolah where id = v_sekolah;
  update kloter set dicetak_pada = v_dicetak_lama where nomor = v_kandidat;

  raise notice '63: daftar ulang setelah cetak ditandai sebagai sisipan.';
end $blok$;

\echo '63 daftar ulang setelah cetak: LULUS'
