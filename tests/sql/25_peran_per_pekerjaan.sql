-- ============================================================================
-- hrcd-rekap : tests/sql/25_peran_per_pekerjaan.sql
-- Peran per pekerjaan (migrasi 0058).
--
-- Yang dijaga paling keras: peran lama benar-benar HILANG. Selama `meja` atau
-- `operator_pos` masih bisa ditulis, akun baru bisa lahir dengan peran yang
-- paket_peran() jawab array kosong — akunnya bisa login, perannya terbaca,
-- dan setiap layar kosong tanpa satu pun pesan galat.
-- ============================================================================

do $$
declare
  v_admin uuid := '00000000-0000-0000-0000-00000000000a';
  v_meja  uuid := '00000000-0000-0000-0000-0000000000b1';
  v_pos   uuid := '00000000-0000-0000-0000-000000000001';
  v_n     int;
  v_peran text;
begin
  -- ------------------------------------------------------------------ 1
  -- Akun lama sudah pindah, dan tidak ada yang tertinggal.
  select count(*) into v_n from akun_panitia where peran in ('meja', 'operator_pos');
  assert v_n = 0, format('masih ada %s akun berperan lama', v_n);

  select peran into v_peran from akun_panitia where user_id = v_meja;
  assert v_peran = 'registrasi', format('meja harus jadi registrasi, jadi %s', v_peran);
  select peran into v_peran from akun_panitia where user_id = v_pos;
  assert v_peran = 'juri_pos', format('operator_pos harus jadi juri_pos, jadi %s', v_peran);

  -- ------------------------------------------------------------------ 2
  -- Nilai peran lama ditolak database, bukan sekadar tidak dipakai.
  begin
    update akun_panitia set peran = 'meja' where user_id = v_meja;
    assert false, 'peran "meja" seharusnya sudah ditolak check constraint';
  exception when check_violation then null;
  end;

  -- ------------------------------------------------------------------ 3
  -- Isi paket tiap peran, persis seperti yang diminta.
  assert paket_peran('registrasi') @> array['pendaftaran','pembayaran','daftar_ulang','cetak_kloter'],
         'registrasi kurang salah satu dari empat pekerjaannya';
  assert not (paket_peran('registrasi') @> array['keberangkatan']),
         'registrasi TIDAK memegang keberangkatan — itu pekerjaan gerbang';
  assert paket_peran('gerbang') @> array['keberangkatan','kedatangan'],
         'gerbang harus memegang keberangkatan dan kedatangan';
  assert paket_peran('juri_pos') @> array['pos'],
         'juri_pos harus memegang pos';

  -- Semua peran memegang live score. Ditulis sebagai perulangan supaya peran
  -- yang ditambah tahun depan ikut terjaga tanpa menambah baris di sini.
  for v_peran in select unnest(array['admin','registrasi','gerbang','juri_pos'])
  loop
    assert paket_peran(v_peran) @> array['live_score'],
           format('peran %s harus memegang live_score', v_peran);
  end loop;

  -- Yang TIDAK boleh: hanya admin yang mengelola akun dan pengaturan.
  for v_peran in select unnest(array['registrasi','gerbang','juri_pos'])
  loop
    assert not (paket_peran(v_peran) @> array['akun']),
           format('peran %s tidak boleh mengelola akun', v_peran);
    assert not (paket_peran(v_peran) @> array['pengaturan']),
           format('peran %s tidak boleh mengubah pengaturan', v_peran);
  end loop;

  -- ------------------------------------------------------------------ 4
  -- juri_pos wajib punya pos; peran lain wajib tidak.
  begin
    update akun_panitia set peran = 'juri_pos', pos = null where user_id = v_meja;
    assert false, 'juri_pos tanpa pos seharusnya ditolak';
  exception when check_violation then null;
  end;
  begin
    update akun_panitia set peran = 'registrasi', pos = 3 where user_id = v_meja;
    assert false, 'registrasi dengan pos seharusnya ditolak';
  exception when check_violation then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Hak nyatanya, dilihat dari kursi masing-masing.
-- ---------------------------------------------------------------------------
do $$
begin
  set local role authenticated;

  perform set_config('app.uid', '00000000-0000-0000-0000-0000000000b1', true);
  assert boleh('pembayaran'),      'registrasi harus boleh pembayaran';
  assert boleh('live_score'),      'registrasi harus boleh live score';
  assert not boleh('keberangkatan'), 'registrasi TIDAK boleh keberangkatan';
  assert not boleh('akun'),        'registrasi TIDAK boleh akun';

  perform set_config('app.uid', '00000000-0000-0000-0000-000000000001', true);
  assert boleh('pos'),             'juri_pos harus boleh pos';
  assert boleh('live_score'),      'juri_pos harus boleh live score';
  assert not boleh('pembayaran'),  'juri_pos TIDAK boleh pembayaran';

  perform set_config('app.uid', '00000000-0000-0000-0000-00000000000a', true);
  assert boleh('akun') and boleh('pengaturan'), 'admin harus boleh akun dan pengaturan';
end $$;

\echo '25 peran per pekerjaan: LULUS'
