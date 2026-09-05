do $blok$
declare
  v_sekolah uuid := gen_random_uuid();
  v_daftar uuid := gen_random_uuid();
  v_eksternal uuid := gen_random_uuid();
  v_intern uuid := gen_random_uuid();
  v_jumlah integer;
  v_definisi text;
begin
  insert into sekolah (id, name, address)
  values (v_sekolah, 'SEKOLAH UJI 93', 'Alamat uji');
  insert into pendaftaran
    (id, sekolah_id, kode_pembayaran, butuh_barak, jumlah_menginap,
     jumlah_regu, kontak_wa, status, kunci_kirim)
  values
    (v_daftar, v_sekolah, 'UJI93', false, 0, 2,
     '083333333333', 'lunas', gen_random_uuid());
  insert into regu
    (id, pendaftaran_id, nama_regu, nama_ketua, golongan,
     nomor_dada, kloter_nomor, urutan_kloter)
  values
    (v_eksternal, v_daftar, 'EKSTERNAL UJI 93', 'KETUA EKSTERNAL',
     'penegak_pa', 498, 75, 1),
    (v_intern, v_daftar, 'INTERN UJI 93', 'KETUA INTERN',
     'intern_pa', 1202, 75, 2);

  set local role authenticated;
  perform set_config('app.uid', '00000000-0000-0000-0000-00000000000a', true);

  begin
    perform simpan_kejuaraan_manual('kostum', v_intern);
    assert false, '93.1 GAGAL: regu Internal dapat dipilih';
  exception when others then
    -- JANGAN ganti 'Intern' jadi 'Internal' di sini. Ini bukan teks yang tes
    -- ini tulis, melainkan POLA yang dicocokkan ke pesan yang DIANGKAT
    -- migrasinya, dan migrasinya berbunyi '...atau termasuk Intern' —
    -- 0142, lalu 0143, 0152 dan 0153 yang menulis ulang fungsinya. Sebuah
    -- migrasi merekam apa yang benar-benar dijalankan, jadi kata itu tidak
    -- ikut disapu saat 'Ekstern/Intern' dibakukan jadi 'Eksternal/Internal'
    -- di docs, layar dan tes. Menamai ulang satu sisi perbandingan saja
    -- membuat polanya tidak pernah cocok: assert di dalam handler ini gagal,
    -- galatnya keluar dari blok do, dan 28 tes di belakangnya tidak pernah
    -- jalan sama sekali.
    assert sqlerrm like '%termasuk Intern',
      format('93.1 GAGAL: penolakannya salah: %s', sqlerrm);
  end;

  perform simpan_kejuaraan_manual('kostum', v_eksternal);
  reset role;
  select count(*) into v_jumlah from kejuaraan_manual
  where edisi = edisi_aktif() and kode = 'kostum' and regu_id = v_eksternal;
  assert v_jumlah = 1, '93.2 GAGAL: regu Eksternal tidak tersimpan';

  set local role authenticated;
  perform set_config('app.uid', '00000000-0000-0000-0000-00000000000a', true);
  perform simpan_kejuaraan_manual('kostum', null);
  reset role;
  select count(*) into v_jumlah from kejuaraan_manual
  where edisi = edisi_aktif() and kode = 'kostum';
  assert v_jumlah = 0, '93.3 GAGAL: pilihan tidak terhapus';

  select pg_get_functiondef('hasil_kejuaraan()'::regprocedure) into v_definisi;
  assert (length(v_definisi) - length(replace(v_definisi,
    'k.golongan in', ''))) / length('k.golongan in') = 2,
    '93.4 GAGAL: hasil otomatis tidak dibatasi ke empat golongan Eksternal';

  delete from regu where id in (v_eksternal, v_intern);
  delete from pendaftaran where id = v_daftar;
  delete from sekolah where id = v_sekolah;
end;
$blok$;
