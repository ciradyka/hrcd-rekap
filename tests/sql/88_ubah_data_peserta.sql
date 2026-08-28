-- ============================================================================
-- hrcd-rekap : tests/sql/88_ubah_data_peserta.sql
--
-- Panitia membetulkan data yang salah diketik pembina (migrasi 0135).
--
-- Migrasinya sendiri hanya bisa membuktikan pintunya TERKUNCI: ia berjalan
-- tanpa kursi pengguna, jadi `boleh()` selalu false di sana. Jalur positifnya
-- di sini, dijalankan sebagai akun registrasi sungguhan — yang menguji hak
-- harus menempati kursi (CLAUDE.md 13.8).
--
--   88.1  kontak pembina bisa dibetulkan, nomornya dinormalkan
--   88.2  identitas regu bisa dibetulkan, kotak anggota kosong dibuang
--   88.3  nama regu bisa diganti — dan yang kembar tetap ditolak
--   88.4  validasi lama ikut berlaku lewat pintu baru ini
--   88.5  mencabut centang `pendaftaran` menutup keduanya
-- ============================================================================

\set ON_ERROR_STOP on

begin;

do $blok$
declare
  v_registrasi uuid := '00000000-0000-0000-0000-0000000000b1';
  v_kunci uuid := gen_random_uuid();
  v_lain  uuid := gen_random_uuid();
  v_kode  text;
  v_kode2 text;
  v_regu  uuid;
  v_teks  text;
  v_pesan text;
begin
  perform set_config('app.uid', v_registrasi::text, true);

  -- Dua pendaftaran: satu yang dibetulkan, satu lagi yang namanya dipakai
  -- untuk menguji tabrakan nama regu.
  select (submit_pendaftaran(
    'SMA Negeri 1 Ciamis', '', false, '081200000088',
    jsonb_build_array(jsonb_build_object(
      'nama_regu', 'UJI EDIT DELAPAN', 'nama_ketua', 'Ketua Lama',
      'golongan', 'intern_pa', 'kelas_organisasi', 'XI IPA 1',
      'anggota', jsonb_build_array('Anggota Satu', 'Anggota Dua'))),
    0::smallint, v_kunci, 'Bu Lama', 'tunai', null) ->> 'kode_pembayaran')
  into v_kode;

  select (submit_pendaftaran(
    'SMA Negeri 1 Ciamis', '', false, '081200000088',
    jsonb_build_array(jsonb_build_object(
      'nama_regu', 'UJI EDIT SEMBILAN', 'nama_ketua', 'Ketua Lain',
      'golongan', 'intern_pi')),
    0::smallint, v_lain, null, 'tunai', null) ->> 'kode_pembayaran')
  into v_kode2;

  select r.id into v_regu
  from regu r join pendaftaran d on d.id = r.pendaftaran_id
  where d.kode_pembayaran = v_kode;

  -- 88.1  Kontak pembina. Nomornya sengaja ditulis dengan +62, spasi, dan
  --       tanda hubung — bentuk yang benar-benar dikirim orang dari HP.
  perform ubah_kontak_pendaftaran(v_kode, 'Bu Baru', '+62 812-9999-0000');
  select nama_kontak || ' / ' || kontak_wa into v_teks
  from pendaftaran where kode_pembayaran = v_kode;
  assert v_teks = 'Bu Baru / 081299990000',
    format('88.1 GAGAL: kontak jadi %s', v_teks);
  raise notice '88.1 LULUS: kontak dibetulkan, nomornya dinormalkan.';

  -- 88.2  Identitas regu. Kotak anggota kosong di TENGAH harus dibuang, bukan
  --       disimpan sebagai string kosong — aturan yang sama dengan pendaftaran.
  perform ubah_identitas_regu(v_regu, 'UJI EDIT DELAPAN', 'Ketua Baru',
                              array['Anggota Satu', '', 'Anggota Tiga'], 'XII IPS 2');
  select nama_ketua || ' / ' || array_to_string(anggota, ',') || ' / ' || kelas_organisasi
    into v_teks from regu where id = v_regu;
  assert v_teks = 'Ketua Baru / Anggota Satu,Anggota Tiga / XII IPS 2',
    format('88.2 GAGAL: regu jadi %s', v_teks);
  raise notice '88.2 LULUS: identitas regu dibetulkan, kotak kosong dibuang.';

  -- 88.3  Nama regu memang boleh diganti — itu salah ketik yang paling sering
  --       diminta. Yang tidak boleh: bertabrakan dengan regu lain, karena nama
  --       juara dibacakan di lapangan (0051).
  perform ubah_identitas_regu(v_regu, 'UJI EDIT SEPULUH', 'Ketua Baru',
                              array['Anggota Satu'], 'XII IPS 2');
  select nama_regu into v_teks from regu where id = v_regu;
  assert v_teks = 'UJI EDIT SEPULUH',
    format('88.3 GAGAL: nama regu jadi %s', v_teks);

  begin
    perform ubah_identitas_regu(v_regu, 'UJI EDIT SEMBILAN', 'Ketua Baru',
                                null, null);
    assert false, '88.3 GAGAL: nama regu kembar diterima';
  exception when unique_violation then
    null;
  end;
  raise notice '88.3 LULUS: nama regu bisa diganti; yang kembar ditolak.';

  -- 88.4  Validasi lama ikut lewat pintu baru: angka di nama orang, dan
  --       simbol di kelas/organisasi.
  begin
    perform ubah_identitas_regu(v_regu, 'UJI EDIT SEPULUH', 'Ketua 2', null, null);
    assert false, '88.4 GAGAL: nama ketua berangka diterima';
  exception when others then
    v_pesan := sqlerrm;
  end;
  assert v_pesan like '%angka%', format('88.4 GAGAL: pesannya %s', v_pesan);

  begin
    perform ubah_identitas_regu(v_regu, 'UJI EDIT SEPULUH', 'Ketua Baru',
                                null, 'XI-1');
    assert false, '88.4 GAGAL: kelas bersimbol diterima';
  exception when check_violation then
    null;
  end;
  raise notice '88.4 LULUS: validasi lama ikut berlaku lewat pintu baru.';

  -- 88.5  Centang dicabut, pintunya tertutup — panggilan yang SAMA PERSIS
  --       dijalankan dua kali dan yang berubah cuma satu baris akun_hak.
  delete from akun_hak where user_id = v_registrasi and fitur = 'pendaftaran';

  begin
    perform ubah_kontak_pendaftaran(v_kode, 'Bu Baru', '081299990000');
    assert false, '88.5 GAGAL: kontak masih bisa diubah tanpa centang';
  exception when others then
    v_pesan := sqlerrm;
  end;
  assert v_pesan like 'tidak berhak%',
    format('88.5 GAGAL: pesannya %s, bukan "tidak berhak"', v_pesan);

  begin
    perform ubah_identitas_regu(v_regu, 'UJI EDIT SEPULUH', 'Ketua Baru', null, null);
    assert false, '88.5 GAGAL: regu masih bisa diubah tanpa centang';
  exception when others then
    v_pesan := sqlerrm;
  end;
  assert v_pesan like 'tidak berhak%',
    format('88.5 GAGAL: pesannya %s, bukan "tidak berhak"', v_pesan);
  raise notice '88.5 LULUS: mencabut centang pendaftaran menutup keduanya.';
end;
$blok$;

rollback;
