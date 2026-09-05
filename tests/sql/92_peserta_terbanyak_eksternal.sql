do $blok$
declare
  v_sekolah_eksternal uuid := gen_random_uuid();
  v_sekolah_intern uuid := gen_random_uuid();
  v_daftar_eksternal uuid := gen_random_uuid();
  v_daftar_intern uuid := gen_random_uuid();
  v_pemenang text;
begin
  insert into sekolah (id, name, address) values
    (v_sekolah_eksternal, 'SEKOLAH EKSTERNAL UJI 92', 'Alamat uji'),
    (v_sekolah_intern, 'SEKOLAH INTERN UJI 92', 'Alamat uji');
  insert into pendaftaran
    (id, sekolah_id, kode_pembayaran, butuh_barak, jumlah_menginap,
     jumlah_regu, kontak_wa, status, kunci_kirim)
  values
    (v_daftar_eksternal, v_sekolah_eksternal, 'UJI92-E', false, 0,
     1, '081111111111', 'lunas', gen_random_uuid()),
    (v_daftar_intern, v_sekolah_intern, 'UJI92-I', false, 0,
     2, '082222222222', 'lunas', gen_random_uuid());
  insert into regu
    (pendaftaran_id, nama_regu, nama_ketua, golongan,
     nomor_dada, kloter_nomor, urutan_kloter)
  values
    (v_daftar_eksternal, 'EKSTERNAL UJI', 'KETUA EKSTERNAL',
     'penegak_pa', 499, 75, 1),
    (v_daftar_intern, 'INTERN PA UJI', 'KETUA INTERN PA',
     'intern_pa', 1200, 75, 2),
    (v_daftar_intern, 'INTERN PI UJI', 'KETUA INTERN PI',
     'intern_pi', 1201, 75, 3);

  set local role authenticated;
  perform set_config('app.uid', '00000000-0000-0000-0000-00000000000a', true);
  select nama_sekolah into v_pemenang from hasil_kejuaraan()
  where kode = 'peserta_terbanyak';
  reset role;

  assert v_pemenang = 'SEKOLAH EKSTERNAL UJI 92',
    format('92 GAGAL: dua regu Internal ikut dihitung; pemenang = %s', v_pemenang);

  delete from regu where pendaftaran_id in (v_daftar_eksternal, v_daftar_intern);
  delete from pendaftaran where id in (v_daftar_eksternal, v_daftar_intern);
  delete from sekolah where id in (v_sekolah_eksternal, v_sekolah_intern);
end;
$blok$;
