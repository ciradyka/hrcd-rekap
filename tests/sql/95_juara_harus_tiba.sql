-- Regu yang belum tercatat tiba tetap membawa skor sebenarnya tanpa penalti
-- fiktif, tetapi tidak mempunyai peringkat dan tidak dapat dipilih sebagai
-- penerima penghargaan manual.

do $blok$
declare
  v_sekolah uuid := gen_random_uuid();
  v_daftar uuid := gen_random_uuid();
  v_regu uuid := gen_random_uuid();
  v_jam_lama timestamptz;
  v_skor record;
begin
  insert into sekolah (id, name, address)
  values (v_sekolah, 'SEKOLAH UJI BELUM TIBA', 'Alamat uji');
  insert into pendaftaran
    (id, sekolah_id, kode_pembayaran, butuh_barak, jumlah_menginap,
     jumlah_regu, kontak_wa, status, kunci_kirim)
  values
    (v_daftar, v_sekolah, 'UJI95', false, 0, 1,
     '085555555555', 'lunas', gen_random_uuid());
  insert into regu
    (id, pendaftaran_id, nama_regu, nama_ketua, golongan,
     nomor_dada, kloter_nomor, urutan_kloter)
  values
    (v_regu, v_daftar, 'UJI BELUM TIBA 95', 'KETUA UJI',
     'penegak_pa', 499, 75, 1);

  select jam_berangkat into v_jam_lama from kloter where nomor = 75;
  update kloter set jam_berangkat = timestamptz '2026-08-29 09:00+07'
  where nomor = 75;
  insert into keberangkatan_regu (regu_id, recorded_by)
  values (v_regu, '00000000-0000-0000-0000-00000000000a');

  assert not exists (select 1 from closing_regu where regu_id = v_regu),
    '95.1 GAGAL: regu uji tanpa sengaja punya jam datang';

  select * into strict v_skor from v_total_skor where regu_id = v_regu;
  assert v_skor.penalti_checkout = 0,
    format('95.2 GAGAL: penalti tanpa jam datang = %s', v_skor.penalti_checkout);
  assert v_skor.total = v_skor.total_pos - v_skor.penalti_waktu - v_skor.penalti_anggota,
    format('95.3 GAGAL: total %s masih dipotong penalti tanpa jam datang', v_skor.total);
  assert not exists (select 1 from v_klasemen where regu_id = v_regu),
    '95.4 GAGAL: regu tanpa jam datang masih mendapat peringkat';

  set local role authenticated;
  perform set_config('app.uid', '00000000-0000-0000-0000-00000000000a', true);
  begin
    perform simpan_kejuaraan_manual('kostum', v_regu);
    assert false, '95.5 GAGAL: regu tanpa jam datang dapat dipilih sebagai juara';
  exception when others then
    assert sqlerrm like '%belum tiba%',
      format('95.5 GAGAL: alasan penolakan salah: %s', sqlerrm);
  end;

  reset role;
  delete from keberangkatan_regu where regu_id = v_regu;
  delete from regu where id = v_regu;
  update kloter set jam_berangkat = v_jam_lama where nomor = 75;
  delete from pendaftaran where id = v_daftar;
  delete from sekolah where id = v_sekolah;
end;
$blok$;

select '95_juara_harus_tiba OK' hasil;
