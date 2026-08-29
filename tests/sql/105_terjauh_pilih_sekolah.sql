\echo '--- 105. Pangkalan Terjauh diisi sekolah, bukan regu'

do $blok$
declare
  v_sekolah uuid := gen_random_uuid();
  v_sepi uuid := gen_random_uuid();
  v_daftar uuid := gen_random_uuid();
  v_regu uuid := gen_random_uuid();
  v_petugas uuid := '00000000-0000-0000-0000-00000000000a';
  v_jam_lama timestamptz;
  v_nama text;
  v_sumber text;
  v_jumlah integer;
begin
  select jam_berangkat into v_jam_lama from kloter where nomor = 75;
  update kloter set jam_berangkat = timestamptz '2026-08-29 07:00+07'
  where nomor = 75;

  insert into sekolah (id, name, address) values
    (v_sekolah, 'SEKOLAH UJI 105', 'Alamat uji'),
    (v_sepi, 'SEKOLAH UJI 105 TANPA REGU', 'Alamat uji');
  insert into pendaftaran
    (id, sekolah_id, kode_pembayaran, butuh_barak, jumlah_menginap,
     jumlah_regu, kontak_wa, status, kunci_kirim)
  values
    (v_daftar, v_sekolah, 'UJI105', false, 0, 1,
     '087777777777', 'lunas', gen_random_uuid());
  insert into regu
    (id, pendaftaran_id, nama_regu, nama_ketua, golongan,
     nomor_dada, kloter_nomor, urutan_kloter)
  values
    (v_regu, v_daftar, 'UJI TERJAUH 1', 'KETUA UJI',
     'penegak_pa', 496, 75, 1);
  insert into keberangkatan_regu (regu_id, recorded_by) values (v_regu, v_petugas);
  insert into closing_regu (regu_id, jam_datang, anggota_hadir, recorded_by)
  values (v_regu, timestamptz '2026-08-29 10:00+07', 5, v_petugas);

  set local role authenticated;
  perform set_config('app.uid', v_petugas::text, true);

  -- 105.1 — sekolah tersimpan dan terbit sebagai nama pangkalan
  perform simpan_kejuaraan_terjauh(v_sekolah);
  select nama_sekolah, sumber into v_nama, v_sumber
  from hasil_kejuaraan() where kode = 'terjauh';
  assert v_nama = 'SEKOLAH UJI 105',
    format('105.1 GAGAL: Pangkalan Terjauh = %s', v_nama);
  assert v_sumber = 'manual_sekolah',
    format('105.2 GAGAL: sumber baris Terjauh = %s', v_sumber);

  -- 105.3 — barisnya menyimpan sekolah, bukan regu
  reset role;
  select count(*) into v_jumlah from kejuaraan_manual
  where edisi = edisi_aktif() and kode = 'terjauh'
    and sekolah_id = v_sekolah and regu_id is null;
  assert v_jumlah = 1, '105.3 GAGAL: baris Terjauh tidak menyimpan sekolah';

  -- 105.4 — pangkalan tanpa regu bernomor dada ditolak
  set local role authenticated;
  perform set_config('app.uid', v_petugas::text, true);
  begin
    perform simpan_kejuaraan_terjauh(v_sepi);
    assert false, '105.4 GAGAL: sekolah tanpa regu diterima';
  exception when others then
    assert sqlerrm = 'sekolah ini tidak mengirim regu bernomor dada',
      format('105.4 GAGAL: penolakannya salah: %s', sqlerrm);
  end;

  -- 105.5 — terjauh tidak bisa lagi disimpan lewat jalur regu
  begin
    perform simpan_kejuaraan_manual('terjauh', v_regu);
    assert false, '105.5 GAGAL: Terjauh masih bisa diisi regu';
  exception when others then
    assert sqlerrm = 'penghargaan manual tidak dikenal',
      format('105.5 GAGAL: penolakannya salah: %s', sqlerrm);
  end;

  -- 105.6 — dikosongkan lagi
  perform simpan_kejuaraan_terjauh(null);
  reset role;
  select count(*) into v_jumlah from kejuaraan_manual
  where edisi = edisi_aktif() and kode = 'terjauh';
  assert v_jumlah = 0, '105.6 GAGAL: pilihan Terjauh tidak terhapus';

  -- 105.7 — constraint menolak baris yang mencampur dua bentuk
  begin
    insert into kejuaraan_manual (edisi, kode, regu_id, sekolah_id, diubah_oleh)
    values (edisi_aktif(), 'terjauh', v_regu, v_sekolah, v_petugas);
    assert false, '105.7 GAGAL: baris Terjauh boleh menyimpan regu sekaligus sekolah';
  exception when check_violation then null;
  end;

  begin
    insert into kejuaraan_manual (edisi, kode, sekolah_id, diubah_oleh)
    values (edisi_aktif(), 'kostum_penegak_pa', v_sekolah, v_petugas);
    assert false, '105.8 GAGAL: penghargaan regu boleh menyimpan sekolah';
  exception when check_violation then null;
  end;

  delete from closing_regu where regu_id = v_regu;
  delete from keberangkatan_regu where regu_id = v_regu;
  delete from regu where id = v_regu;
  delete from pendaftaran where id = v_daftar;
  delete from sekolah where id in (v_sekolah, v_sepi);
  update kloter set jam_berangkat = v_jam_lama where nomor = 75;
end;
$blok$;

\echo '105 terjauh pilih sekolah: LULUS'
