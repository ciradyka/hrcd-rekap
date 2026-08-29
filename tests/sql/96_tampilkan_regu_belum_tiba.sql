-- Belum tiba berarti terlihat tanpa peringkat, bukan menghilang dan bukan
-- merebut salah satu dari enam gelar golongan.

do $blok$
declare
  v_sekolah uuid := gen_random_uuid();
  v_daftar uuid := gen_random_uuid();
  v_regu uuid := gen_random_uuid();
  v_jam_lama timestamptz;
  v_fase_lama text;
  v_peringkat bigint;
begin
  insert into sekolah (id, name, address)
  values (v_sekolah, 'SEKOLAH UJI PAPAN BELUM TIBA', 'Alamat uji');
  insert into pendaftaran
    (id, sekolah_id, kode_pembayaran, butuh_barak, jumlah_menginap,
     jumlah_regu, kontak_wa, status, kunci_kirim)
  values
    (v_daftar, v_sekolah, 'UJI96', false, 0, 1,
     '086666666666', 'lunas', gen_random_uuid());
  insert into regu
    (id, pendaftaran_id, nama_regu, nama_ketua, golongan,
     nomor_dada, kloter_nomor, urutan_kloter)
  values
    (v_regu, v_daftar, 'UJI PAPAN TIBA 96', 'KETUA UJI',
     'penegak_pa', 499, 75, 1);

  select jam_berangkat into v_jam_lama from kloter where nomor = 75;
  select fase_live into v_fase_lama from status_acara;
  update kloter set jam_berangkat = timestamptz '2026-08-29 09:00+07'
  where nomor = 75;
  update status_acara set fase_live = 'penuh';
  insert into keberangkatan_regu (regu_id, recorded_by)
  values (v_regu, '00000000-0000-0000-0000-00000000000a');

  assert not exists (select 1 from v_klasemen where regu_id = v_regu),
    '96.1 GAGAL: regu belum tiba masuk mesin peringkat';

  set local role authenticated;
  perform set_config('app.uid', '00000000-0000-0000-0000-00000000000a', true);
  select peringkat into v_peringkat from klasemen_live_score()
  where nomor_dada = 499;
  assert found and v_peringkat is null,
    '96.2 GAGAL: regu belum tiba tidak tampil tanpa peringkat di papan panitia';

  reset role;
  select peringkat into v_peringkat from v_klasemen_publik
  where nomor_dada = 499;
  assert found and v_peringkat is null,
    '96.3 GAGAL: regu belum tiba tidak tampil tanpa peringkat di papan peserta';

  delete from keberangkatan_regu where regu_id = v_regu;
  delete from regu where id = v_regu;
  update kloter set jam_berangkat = v_jam_lama where nomor = 75;
  update status_acara set fase_live = v_fase_lama;
  delete from pendaftaran where id = v_daftar;
  delete from sekolah where id = v_sekolah;
end;
$blok$;

select '96_tampilkan_regu_belum_tiba OK' hasil;
